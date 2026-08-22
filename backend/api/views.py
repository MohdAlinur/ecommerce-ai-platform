import json
import google.generativeai as genai
from decimal import Decimal
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import Category, Product, Review, Order, OrderItem, CustomerProfile
from .serializers import CategorySerializer, ProductSerializer, ReviewSerializer, OrderSerializer, UserSerializer
from .ai_services import analyze_product_reviews_ai

# Configure Gemini API securely from your settings
try:
    genai.configure(api_key=settings.GEMINI_API_KEY)
except AttributeError:
    pass

# ==================================================
# MASTER AI SHOPPING AGENT SYSTEM PROMPT
# ==================================================
SHOPPING_AGENT_PROMPT = """You are an expert AI Personal Shopping Assistant for an e-commerce website.
Your primary goal is to help customers find the most suitable product from the products available in the website's database.
You are NOT a salesperson.
You are an unbiased product-matching and decision-support agent.
Your job is to understand the customer's needs, search the connected product database, compare relevant products, and recommend the best available option for that specific customer.

==================================================
1. PRIMARY OBJECTIVE
==================================================
For every shopping request:
1. Understand what the customer wants.
2. Identify the relevant product category/subcategory.
3. Determine the customer's important requirements.
4. Search the connected website product database.
5. Filter products according to the customer's requirements.
6. Compare the strongest matching products.
7. Recommend the best match.
8. Clearly explain why it is the best match.
9. Mention important limitations or trade-offs.
10. Never invent information.

==================================================
2. PRODUCT DATABASE — SOURCE OF TRUTH
==================================================
The connected website database is the primary and authoritative source for product information.
Never invent or assume product information. NEVER invent a product, specification, guess a price, or assume availability.
If information is missing from the database, say: "I couldn't verify that information from the available product data."

==================================================
3. CUSTOMER REQUIREMENT UNDERSTANDING
==================================================
Before searching, determine the customer's relevant requirements (Product type, Budget, Intended use, Performance, Brand preference, Specifications). Do not ask for every possible requirement. Only collect information that materially affects the recommendation.

==================================================
4. CLARIFICATION RULE
==================================================
If essential information is missing, ask a maximum of 3 clarification questions. Prioritize questions with the greatest impact. If enough information is already available, do not ask questions. SEARCH IMMEDIATELY.

==================================================
5. CONVERSATION MEMORY
==================================================
Remember all relevant information already provided in the current conversation (Budget, Use case, Requirements, Brand preferences). Never ask the customer to repeat information already provided. If the customer changes a requirement, the latest requirement takes priority.

==================================================
6. CATEGORY KNOWLEDGE
==================================================
Use the following website category structure for product classification and search: Desktop, Laptop, Component, Monitor, Power, Phone, Tablet, Office Equipment, Accessories, Camera, Security, Networking, Software, Server & Storage, Gaming, TV, Appliance, Gadget. Brands are attributes/filters, not necessarily independent product categories.

==================================================
7. SEARCH & MATCHING STRATEGY
==================================================
Rank products using this priority:
1. Must-have requirements
2. Intended use
3. Compatibility
4. Budget
5. Required specifications
6. Important features
7. Value for money
8. Brand preference

==================================================
8. BUDGET LOGIC
==================================================
Respect the customer's budget. Do not recommend products above that budget unless no suitable product exists within budget, AND the product is clearly identified as an over-budget alternative.

==================================================
9. PRODUCT COMPARISON
==================================================
When there are multiple suitable products, compare a maximum of 3 using this structure:
Product | Price | Best For | Main Advantage | Main Limitation

==================================================
10. RESPONSE FORMAT
==================================================
For a normal recommendation, use:
Best Match: [Product Name] — [Price]
Why: [2–4 concise sentences explaining why it matches the customer's requirements.]
Pros:
- [Relevant advantage]
- [Relevant advantage]
Cons:
- [Important limitation]
Alternative: [Product Name] — [Price] (Brief explanation of why they might choose it instead)

==================================================
11. ABSOLUTE RULES
==================================================
These rules always apply:
DATABASE DATA > ASSUMPTIONS
CUSTOMER REQUIREMENTS > GENERIC POPULARITY
VERIFIED INFORMATION > GUESSES
RELEVANT PRODUCTS > LARGE PRODUCT LISTS
BEST FIT > MOST EXPENSIVE PRODUCT
HONEST LIMITATIONS > SALES PITCH
LATEST CUSTOMER REQUIREMENT > PREVIOUS REQUIREMENT
NO INVENTED DATA. NO INVENTED PRICES. NO INVENTED AVAILABILITY. NO INVENTED FEATURES.

Your job is not to sell. Your job is to make the customer's purchasing decision easier, faster, and more confident."""

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [AllowAny()]

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by('-id')
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [AllowAny()]

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if category:
            qs = qs.filter(category__name__iexact=category) | qs.filter(category__slug__iexact=category)
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(brand__icontains=search)
        return qs

class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().order_by('-created_at')
    serializer_class = ReviewSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return [AllowAny()]

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().order_by('-created_at')
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return Order.objects.all().order_by('-created_at')
        return Order.objects.filter(customer_email=self.request.user.email).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        data = request.data
        items_data = data.get('items', [])
        
        shipping_data = data.get('shipping', {})
        payment_method = data.get('payment_method', 'cod')
        
        if not items_data:
            return Response({"error": "Cart is empty"}, status=status.HTTP_400_BAD_REQUEST)

        total = Decimal('0.00')
        order_items_to_create = []

        for item in items_data:
            try:
                product = Product.objects.get(id=item['product_id'])
            except Product.DoesNotExist:
                return Response({"error": f"Product not found"}, status=status.HTTP_404_NOT_FOUND)
                
            qty = int(item['quantity'])
            if product.stock < qty:
                return Response({"error": f"Not enough stock for {product.name}"}, status=status.HTTP_400_BAD_REQUEST)
            
            price = Decimal(str(product.cash_discount_price))
            item_total = price * qty
            total += item_total
            order_items_to_create.append((product, qty, price))

        order = Order.objects.create(
            customer_name=shipping_data.get('name', request.user.username),
            customer_email=request.user.email,
            shipping_address=shipping_data.get('address', ''),
            phone=shipping_data.get('phone', ''),
            payment_method=payment_method,
            total_amount=total,
            status='COMPLETED'
        )

        for product, qty, price in order_items_to_create:
            OrderItem.objects.create(order=order, product=product, quantity=qty, price=price)
            product.stock -= qty
            product.save()

        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([AllowAny])
def signup_view(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        login(request, user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return Response(UserSerializer(user).data)
    return Response({"error": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
def logout_view(request):
    logout(request)
    return Response({"message": "Logged out successfully"})

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def user_profile_view(request):
    user = request.user
    profile, created = CustomerProfile.objects.get_or_create(user=user)
    
    if request.method == 'GET':
        return Response(UserSerializer(user).data)
        
    elif request.method == 'PUT':
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            
            if 'avatar' in request.FILES:
                profile.avatar = request.FILES['avatar']
                profile.save()
                
            return Response(UserSerializer(user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_list_users(request):
    users = User.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)

@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def admin_delete_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
        if user.is_superuser:
            return Response({"error": "Cannot delete superuser"}, status=status.HTTP_403_FORBIDDEN)
        user.delete()
        return Response({"message": "User deleted successfully"})
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([AllowAny])
def analyze_product_ai_view(request, product_id):
    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

    reviews = list(product.reviews.values('rating', 'comment', 'user_name'))
    analysis_data = analyze_product_reviews_ai(product.name, reviews)
    return Response(analysis_data)

# ==================================================
# MAIN AI AGENT VIEW
# ==================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def ai_customer_support_view(request):
    history = request.data.get('history', [])
    message = request.data.get('message', '')
    product_context = request.data.get('product_context', '')
    
    if not message.strip():
        return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Dynamic "Source of Truth" Product Injection
    if not product_context:
        products = Product.objects.all().select_related('category')[:100]  # Extracts a solid catalog chunk
        product_list_strs = []
        for p in products:
            cat_name = p.category.name if p.category else "Uncategorized"
            brand = p.brand if p.brand else "N/A"
            price = p.cash_discount_price if p.cash_discount_price else p.price
            product_list_strs.append(f"- Name: {p.name} | Category: {cat_name} | Brand: {brand} | Price: ৳{price} | Stock: {p.stock} | Features: {p.key_features}")
        product_context = "Available Products in Database:\n" + "\n".join(product_list_strs)
    else:
        # Used when explicit comparison data is sent from the frontend Compare Drawer
        product_context = "Explicit Product Comparison Data:\n" + str(product_context)

    try:
        # Format history for Gemini SDK
        gemini_history = []
        for msg in history:
            gemini_history.append({
                "role": "user" if msg['role'] == 'user' else "model",
                "parts": [msg['parts'][0]['text']]
            })

        # Initialize the strictly controlled AI Agent
        model = genai.GenerativeModel(
            model_name='gemini-1.5-flash',
            system_instruction=SHOPPING_AGENT_PROMPT
        )
        chat = model.start_chat(history=gemini_history)

        full_message = f"PRODUCT DATABASE CONTEXT:\n{product_context}\n\nUSER REQUEST: {message}"
        response = chat.send_message(full_message)

        return Response({"reply": response.text})

    except Exception as e:
        print("AI Agent Error:", e)
        return Response({"error": "AI Support currently unavailable."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_analytics_view(request):
    total_revenue = Order.objects.filter(status='COMPLETED').aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    total_orders = Order.objects.count()
    total_products = Product.objects.count()
    avg_rating = Review.objects.aggregate(avg=Avg('rating'))['avg'] or 0.0

    today = timezone.now().date()
    sales_trend = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_total = Order.objects.filter(
            status='COMPLETED', 
            created_at__date=day
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        sales_trend.append({
            "date": day.strftime("%b %d"),
            "revenue": float(day_total)
        })

    category_distribution = list(Category.objects.annotate(count=Count('products')).values('name', 'count'))

    return Response({
        "metrics": {
            "total_revenue": float(total_revenue),
            "total_orders": total_orders,
            "total_products": total_products,
            "average_rating": round(avg_rating, 1)
        },
        "sales_trend": sales_trend,
        "category_distribution": category_distribution
    })