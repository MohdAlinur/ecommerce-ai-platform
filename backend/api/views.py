from decimal import Decimal
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import Category, Product, Review, Order, OrderItem, CustomerProfile
from .serializers import CategorySerializer, ProductSerializer, ReviewSerializer, OrderSerializer, UserSerializer
from .ai_services import analyze_product_reviews_ai, chat_customer_support_ai

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
    # Fixed the missing queryset to resolve the routing AssertionError
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

@api_view(['POST'])
@permission_classes([AllowAny])
def ai_customer_support_view(request):
    history = request.data.get('history', [])
    message = request.data.get('message', '')
    product_context = request.data.get('product_context', '')
    
    if not message.strip():
        return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)

    if not product_context:
        products = Product.objects.all()[:15]
        product_context = "\n".join([f"- {p.name}: ৳{p.cash_discount_price}, Category: {p.category.name}" for p in products])

    reply = chat_customer_support_ai(history, message, product_context)
    return Response({"reply": reply})

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