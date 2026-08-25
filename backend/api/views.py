import sys
import csv
import io
import json
import re
import urllib.request
from decimal import Decimal
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Sum, Count, Avg, Q
from django.utils import timezone
from django.utils.text import slugify
from datetime import timedelta
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny
from rest_framework.response import Response

from google import genai
from google.genai import types

from .models import Category, Product, Review, Order, OrderItem, CustomerProfile, Banner, DiscountCode
from .serializers import CategorySerializer, ProductSerializer, ReviewSerializer, OrderSerializer, UserSerializer, BannerSerializer, DiscountCodeSerializer
from .ai_services import analyze_product_reviews_ai

# ==================================================
# UNLOCK CSV LIMITS FOR MASSIVE AMAZON DATASETS
# ==================================================
csv.field_size_limit(2147483647)

# ==================================================
# MASTER AI SHOPPING AGENT SYSTEM PROMPT
# ==================================================
SHOPPING_AGENT_PROMPT = """You are an expert AI Personal Shopping Assistant for the AuraTech e-commerce platform.
Your primary goal is to help customers find the most suitable product from the products available in the website's database.
You are an unbiased product-matching and decision-support agent.
Your job is to understand the customer's needs, search the connected product database, compare relevant products, and recommend the best available option for that specific customer.

==================================================
1. PRIMARY OBJECTIVE
==================================================
For every shopping request:
1. Understand what the customer wants.
2. Search the connected website product database.
3. Filter products according to the customer's requirements.
4. Compare the strongest matching products.
5. Recommend the best match and clearly explain why.

==================================================
2. PRODUCT DATABASE — SOURCE OF TRUTH
==================================================
The connected website database is the primary and authoritative source for product information.
Never invent or assume product information. NEVER invent a product, specification, guess a price, or assume availability.

==================================================
3. SINGLE PRODUCT DETAILS FORMAT
==================================================
If the customer asks for details about a SPECIFIC product, structure your response cleanly using Markdown like this:

**[Product Name]**
* **Price:** ৳[Price]
* **Brand:** [Brand]
* **Status:** [In Stock / Out of Stock]
* **Key Features:**
  - [Feature 1]
  - [Feature 2]
* **Important Specifications:**
  - [Spec 1: Value]
  - [Spec 2: Value]
* **Available Variations:** [e.g., Colors, Sizes, etc.]
* **Summary:** [1-2 sentences summarizing the description]

==================================================
4. MULTIPLE PRODUCT COMPARISON FORMAT
==================================================
When a user asks you to compare MULTIPLE products, analyze all of them deeply based on their specs, features, and price. 
Structure your comparison cleanly using Markdown:

**Product Comparison:**
1. **[Product 1 Name]** - ৳[Price] (Best for: [Brief Use Case])
2. **[Product 2 Name]** - ৳[Price] (Best for: [Brief Use Case])
*(Continue for all products...)*

**Key Differences:**
* **Performance/Specs:** [Compare the main specs]
* **Features:** [Compare unique features]
* **Value:** [Compare price vs value]

**Final Verdict:**
Declare a clear overall winner based on the most common use cases, or declare specific winners for specific needs.

==================================================
5. ABSOLUTE RULES
==================================================
DATABASE DATA > ASSUMPTIONS
NO INVENTED DATA. NO INVENTED PRICES. NO INVENTED AVAILABILITY. NO INVENTED FEATURES.
Your job is to make the customer's purchasing decision easier, faster, and more confident."""

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

class BannerViewSet(viewsets.ModelViewSet):
    queryset = Banner.objects.all().order_by('-created_at')
    serializer_class = BannerSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [AllowAny()]

class DiscountCodeViewSet(viewsets.ModelViewSet):
    queryset = DiscountCode.objects.all()
    serializer_class = DiscountCodeSerializer
    permission_classes = [IsAdminUser]

@api_view(['POST'])
@permission_classes([AllowAny])
def signup_view(request):
    email = request.data.get('email')
    phone = request.data.get('phone')
    name = request.data.get('name', '')
    password = request.data.get('password')

    if not email or not phone or not password or not name:
        return Response({"error": "All fields are required."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({"error": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)
    if CustomerProfile.objects.filter(phone_number=phone).exists():
        return Response({"error": "This phone number is already registered."}, status=status.HTTP_400_BAD_REQUEST)

    base_username = email.split('@')[0]
    username = base_username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    name_parts = name.strip().split(' ', 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ''

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name
    )
    
    profile, created = CustomerProfile.objects.get_or_create(user=user)
    profile.phone_number = phone
    profile.save()

    login(request, user)
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    email = request.data.get('email')
    password = request.data.get('password')
    
    if not email or not password:
        return Response({"error": "Email and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    user = None
    try:
        user_obj = User.objects.get(email=email)
        user = authenticate(request, username=user_obj.username, password=password)
    except User.DoesNotExist:
        pass
        
    if user is not None:
        login(request, user)
        return Response(UserSerializer(user).data)
        
    return Response({"error": "Invalid email or password."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def google_login_view(request):
    token = request.data.get('token')
    if not token:
        return Response({"error": "No Google token provided"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            google_data = json.loads(response.read().decode())
            
        email = google_data.get('email')
        name = google_data.get('name', '')
        
        if not email:
            return Response({"error": "Google account did not provide an email address."}, status=status.HTTP_400_BAD_REQUEST)
        
        user = User.objects.filter(email=email).first()
        
        if not user:
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
                
            name_parts = name.split(' ', 1)
            user = User.objects.create(
                username=username,
                email=email,
                first_name=name_parts[0],
                last_name=name_parts[1] if len(name_parts) > 1 else ''
            )
            user.set_unusable_password()
            user.save()
            CustomerProfile.objects.get_or_create(user=user)
        
        login(request, user)
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)
        
    except urllib.error.URLError:
         return Response({"error": "Invalid or expired Google token"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
@permission_classes([IsAdminUser])
def admin_create_admin_view(request):
    email = request.data.get('email')
    phone = request.data.get('phone')
    name = request.data.get('name', '')
    password = request.data.get('password')

    if not email or not phone or not password or not name:
        return Response({"error": "All fields are required."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({"error": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)
    if CustomerProfile.objects.filter(phone_number=phone).exists():
        return Response({"error": "This phone number is already registered."}, status=status.HTTP_400_BAD_REQUEST)

    base_username = email.split('@')[0]
    username = base_username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    name_parts = name.strip().split(' ', 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ''

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        is_staff=True,
        is_superuser=True
    )
    
    profile, created = CustomerProfile.objects.get_or_create(user=user)
    profile.phone_number = phone
    profile.save()

    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_bulk_import_csv_view(request):
    if 'file' not in request.FILES:
        return Response({"error": "No CSV file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
    
    csv_file = request.FILES['file']
    if not csv_file.name.endswith('.csv'):
        return Response({"error": "File must be a CSV format."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        decoded_file = csv_file.read().decode('utf-8', errors='replace')
        io_string = io.StringIO(decoded_file)
        reader = csv.DictReader(io_string)
        
        imported_count = 0
        for row in reader:
            raw_title = row.get('title') or row.get('name')
            if not raw_title or str(raw_title).lower() == 'nan':
                continue
                
            name = str(raw_title).strip()
            brand = str(row.get('brand', '')).strip()
            if brand.lower() == 'nan': brand = ''
            
            product_code = str(row.get('asin') or row.get('product_code', '')).strip()
            if product_code.lower() == 'nan': product_code = ''
                
            description = str(row.get('description', '')).strip()
            if description.lower() == 'nan': description = ''

            def clean_price(val):
                if not val: return Decimal('0.00')
                v_str = str(val).replace('"', '').replace('$', '').replace('₹', '').replace(',', '').strip()
                if v_str.lower() == 'nan' or not v_str: return Decimal('0.00')
                try:
                    return Decimal(v_str)
                except Exception:
                    return Decimal('0.00')

            cash_discount_price = clean_price(row.get('final_price') or row.get('cash_discount_price') or row.get('discount_price'))
            regular_price = clean_price(row.get('initial_price') or row.get('regular_price') or row.get('actual_price'))
            if regular_price <= Decimal('0.00'):
                regular_price = cash_discount_price

            stock_val = str(row.get('stock') or row.get('availability', '')).strip().lower()
            stock = 10
            if stock_val.isdigit():
                stock = int(stock_val)
            elif 'out of stock' in stock_val:
                stock = 0

            cat_raw = str(row.get('categories') or row.get('category') or row.get('main_category', 'Uncategorized')).strip()
            category_name = 'Uncategorized'
            if cat_raw.startswith('['):
                try:
                    cats = json.loads(cat_raw)
                    if isinstance(cats, list) and len(cats) > 0:
                        category_name = str(cats[-1])
                except json.JSONDecodeError:
                    pass
            elif cat_raw and cat_raw.lower() != 'nan':
                category_name = cat_raw

            category, _ = Category.objects.get_or_create(
                name=category_name, 
                defaults={'slug': slugify(category_name)}
            )

            image_url = str(row.get('image_url') or row.get('image', '')).strip()
            if image_url.lower() == 'nan': image_url = ''
            
            image_gallery = []
            images_raw = str(row.get('images', '')).strip()
            if images_raw.startswith('['):
                try:
                    image_gallery = json.loads(images_raw)
                except json.JSONDecodeError:
                    pass

            features_raw = str(row.get('features') or row.get('key_features', '')).strip()
            key_features = []
            if features_raw.startswith('['):
                try:
                    key_features = json.loads(features_raw)
                except json.JSONDecodeError:
                    pass
            elif features_raw and features_raw.lower() != 'nan':
                key_features = features_raw.split('|')

            variants_raw = str(row.get('variations') or row.get('variants', '')).strip()
            variants = []
            if variants_raw.startswith('['):
                try:
                    raw_vars = json.loads(variants_raw)
                    if raw_vars and isinstance(raw_vars, list):
                        if len(raw_vars) > 0 and 'name' in raw_vars[0] and 'options' in raw_vars[0]:
                            variants = raw_vars
                        elif len(raw_vars) > 0 and 'asin' in raw_vars[0] and 'name' in raw_vars[0]:
                            options = [str(v.get('name')) for v in raw_vars if v.get('name')]
                            if options:
                                variants = [{"name": "Style / Option", "options": options}]
                except json.JSONDecodeError:
                    pass

            specs = []
            spec_group = {"groupName": "Product Information", "features": []}
            for field in ['item_weight', 'product_dimensions', 'manufacturer', 'model_number', 'department', 'date_first_available', 'reviews_count', 'rating', 'ratings', 'no_of_ratings', 'sub_category']:
                val = str(row.get(field, '')).strip()
                if val and val.lower() != 'nan':
                    spec_group["features"].append({
                        "key": field.replace('_', ' ').title(), 
                        "value": val
                    })
            
            specs_raw = str(row.get('specifications', '')).strip()
            if specs_raw.startswith('['):
                try:
                    specs = json.loads(specs_raw)
                except json.JSONDecodeError:
                    pass
                    
            if spec_group["features"]:
                specs.append(spec_group)

            Product.objects.create(
                category=category,
                name=name[:255],
                brand=brand[:100],
                product_code=product_code[:100],
                description=description,
                cash_discount_price=cash_discount_price,
                regular_price=regular_price,
                stock=stock,
                image_url=image_url,
                image_gallery=image_gallery,
                key_features=key_features,
                variants=variants,
                specifications=specs
            )
            imported_count += 1
            
        return Response({"message": f"Successfully imported {imported_count} products."}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({"error": f"Error parsing CSV file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_bulk_delete_products_view(request):
    product_ids = request.data.get('product_ids', [])
    
    if not product_ids or not isinstance(product_ids, list):
        return Response({"error": "Please provide a valid list of product IDs."}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        deleted_count, _ = Product.objects.filter(id__in=product_ids).delete()
        return Response({"message": f"Successfully deleted {deleted_count} products."}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": f"Failed to delete products: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


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


@api_view(['POST'])
@permission_classes([AllowAny])
def ai_customer_support_view(request):
    history = request.data.get('history', [])
    message = request.data.get('message', '')
    product_context = request.data.get('product_context', '')
    
    if not message.strip():
        return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)

    # -------------------------------------------------------------------------
    # FIXED LOGIC: ADVANCED EXACT MATCH & INTERSECTION SEARCH
    # -------------------------------------------------------------------------
    if not product_context:
        search_str = message.strip()
        
        # Priority 1: Exact Name Match
        products = Product.objects.filter(name__iexact=search_str).select_related('category')
        
        # Priority 2: Very close Name match
        if not products.exists():
            products = Product.objects.filter(name__icontains=search_str).select_related('category')[:30]
            
        # Priority 3: Smart Keyword Intersection (AND logic)
        if not products.exists():
            ignore_words = {'the', 'and', 'for', 'with', 'this', 'that', 'about', 'what', 'how', 'product', 'detail', 'details', 'tell', 'help', 'price', 'sizes', 'size'}
            raw_words = re.findall(r'\b\w+\b', message.lower())
            search_terms = [w for w in raw_words if len(w) > 2 and w not in ignore_words]
            
            if search_terms:
                q_objects = Q()
                # Use AND logic for up to 4 significant terms to ensure precise matching
                for term in search_terms[:4]:
                    q_objects &= (Q(name__icontains=term) | Q(brand__icontains=term) | Q(category__name__icontains=term))
                products = Product.objects.filter(q_objects).select_related('category').distinct()[:30]
        
        # Priority 4: Generic OR Fallback
        if not products.exists():
            if 'search_terms' in locals() and search_terms:
                q_objects = Q()
                for term in search_terms[:3]:
                    q_objects |= Q(name__icontains=term)
                products = Product.objects.filter(q_objects).select_related('category').distinct()[:30]
            else:
                products = Product.objects.all().select_related('category').order_by('-id')[:30]

        # Compile the perfectly matched products into context
        product_list_strs = []
        for p in products:
            cat_name = p.category.name if p.category else "Uncategorized"
            brand = p.brand if p.brand else "N/A"
            price = p.cash_discount_price if p.cash_discount_price else p.regular_price 
            
            product_list_strs.append(
                f"[ID: {p.id}] Name: {p.name} | Category: {cat_name} | Brand: {brand} | Price: ৳{price} | "
                f"Stock: {p.stock} | Variations: {p.variants} | Features: {p.key_features} | Specs: {p.specifications}"
            )
        product_context = "Available Products in Database:\n" + "\n".join(product_list_strs)
    else:
        product_context = "Explicit Product Comparison Data:\n" + str(product_context)

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        gemini_history = []
        for msg in history:
            gemini_history.append(
                types.Content(
                    role="user" if msg['role'] == 'user' else "model",
                    parts=[types.Part.from_text(text=msg['parts'][0]['text'])]
                )
            )

        chat = client.chats.create(
            model='gemini-3.6-flash', 
            config=types.GenerateContentConfig(
                system_instruction=SHOPPING_AGENT_PROMPT,
            ),
            history=gemini_history
        )

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