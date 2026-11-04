import csv
import io
import json
import re
import uuid
import urllib.request
import urllib.error
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Sum, Count, Avg, Q, F
from django.utils import timezone
from django.utils.text import slugify

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import (
    Category, Product, Review, Order, OrderItem,
    CustomerProfile, Banner, DiscountCode, SupportKnowledgeBase, cleanup_empty_categories
)
from .serializers import (
    CategorySerializer, ProductSerializer, ReviewSerializer,
    OrderSerializer, UserSerializer, BannerSerializer,
    DiscountCodeSerializer, SupportKnowledgeBaseSerializer
)
from .ai_services import (
    analyze_product_reviews_ai, generate_support_chat_reply, ensure_default_support_kb
)

csv.field_size_limit(2147483647)


def detect_card_brand(card_number: str) -> str:
    digits = re.sub(r'\D', '', card_number or '')
    if digits.startswith('4'):
        return 'Visa'
    if re.match(r'^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)', digits):
        return 'Mastercard'
    if re.match(r'^3[47]', digits):
        return 'American Express'
    if re.match(r'^(6011|65|64[4-9])', digits):
        return 'Discover'
    return 'Card'


def validate_luhn(card_number: str) -> bool:
    digits = [int(d) for d in re.sub(r'\D', '', card_number or '')]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def validate_card_expiry(expiry_str: str) -> bool:
    if not expiry_str:
        return False
    match = re.match(r'^\s*(0[1-9]|1[0-2])\s*/\s*(\d{2}|\d{4})\s*$', str(expiry_str))
    if not match:
        return False
    month = int(match.group(1))
    year = int(match.group(2))
    if year < 100:
        year += 2000
    now = timezone.now()
    if year < now.year or (year == now.year and month < now.month):
        return False
    return True


def restore_order_stock(order: Order):
    for item in order.items.select_related('product').all():
        if item.product:
            Product.objects.filter(id=item.product.id).update(stock=F('stock') + item.quantity)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.annotate(product_count=Count('products')).order_by('name')
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [AllowAny()]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related('category').prefetch_related('reviews').all().order_by('-id')
    serializer_class = ProductSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [AllowAny()]

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        brand = self.request.query_params.get('brand')
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        in_stock = self.request.query_params.get('in_stock')
        featured = self.request.query_params.get('featured')
        ordering = self.request.query_params.get('ordering')

        if category:
            qs = qs.filter(Q(category__name__iexact=category) | Q(category__slug__iexact=category) | Q(category__id__iexact=category))
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(brand__icontains=search) |
                Q(category__name__icontains=search) |
                Q(product_code__icontains=search)
            )
        if brand:
            qs = qs.filter(brand__iexact=brand)
        if min_price:
            try:
                qs = qs.filter(cash_discount_price__gte=Decimal(str(min_price)))
            except Exception:
                pass
        if max_price:
            try:
                qs = qs.filter(cash_discount_price__lte=Decimal(str(max_price)))
            except Exception:
                pass
        if in_stock == 'true':
            qs = qs.filter(stock__gt=0)
        if featured == 'true':
            qs = qs.filter(is_featured=True)

        if ordering == 'price_asc':
            qs = qs.order_by('cash_discount_price')
        elif ordering == 'price_desc':
            qs = qs.order_by('-cash_discount_price')
        elif ordering == 'newest':
            qs = qs.order_by('-created_at')

        if self.action == 'list':
            return qs[:250]

        return qs

    def perform_update(self, serializer):
        old_category_id = self.get_object().category_id
        instance = serializer.save()
        if old_category_id and old_category_id != instance.category_id:
            cleanup_empty_categories()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        category_id = instance.category_id
        category_name = instance.category.name if instance.category else None
        self.perform_destroy(instance)

        deleted_categories = cleanup_empty_categories()
        category_auto_deleted = (
            category_name in deleted_categories or
            not Category.objects.filter(id=category_id).exists()
        )
        return Response({
            "message": "Product deleted successfully.",
            "category_auto_deleted": category_auto_deleted,
            "deleted_category_name": category_name if category_auto_deleted else None
        }, status=status.HTTP_200_OK)


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.select_related('product').all().order_by('-created_at')
    serializer_class = ReviewSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [AllowAny()]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        default_name = (
            f"{user.first_name} {user.last_name}".strip() or user.username
        ) if user else 'Verified Customer'
        user_name = self.request.data.get('user_name') or default_name
        serializer.save(user=user, user_name=user_name)


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().order_by('-created_at')
    serializer_class = OrderSerializer

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Order.objects.prefetch_related('items__product').all().order_by('-created_at')
        return Order.objects.prefetch_related('items__product').filter(
            Q(user=user) | Q(customer_email__iexact=user.email)
        ).distinct().order_by('-created_at')

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        items_data = data.get('items', [])
        shipping_data = data.get('shipping', {}) or {}
        payment_details = data.get('payment_details', {}) or {}
        payment_method = str(data.get('payment_method', 'cod')).lower().strip()
        discount_code_str = str(data.get('discount_code', '') or '').strip().upper()

        if not items_data:
            return Response({"error": "Your shopping bag is empty."}, status=status.HTTP_400_BAD_REQUEST)

        subtotal = Decimal('0.00')
        order_items_to_create = []

        for item in items_data:
            try:
                product = Product.objects.select_for_update().get(id=item['product_id'])
            except Product.DoesNotExist:
                return Response({"error": "One or more products in your bag are no longer available."}, status=status.HTTP_404_NOT_FOUND)

            qty = max(1, int(item.get('quantity', 1)))
            if product.stock < qty:
                return Response(
                    {"error": f"Insufficient stock for {product.name}. Only {product.stock} left."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            price = Decimal(str(product.cash_discount_price or product.regular_price or '0.00'))
            subtotal += price * qty
            selected_variants = item.get('selected_variants') or item.get('selectedVariants') or {}
            order_items_to_create.append((product, qty, price, selected_variants))

        discount_amount = Decimal('0.00')
        applied_code = None
        if discount_code_str:
            discount_obj = DiscountCode.objects.select_for_update().filter(
                code__iexact=discount_code_str, is_active=True
            ).first()
            if discount_obj and (not discount_obj.usage_limit or discount_obj.times_used < discount_obj.usage_limit):
                discount_amount = (subtotal * Decimal(str(discount_obj.discount_percent)) / Decimal('100')).quantize(Decimal('0.01'))
                discount_obj.times_used += 1
                discount_obj.save()
                applied_code = discount_obj.code

        raw_shipping_fee = data.get('shipping_fee')
        if raw_shipping_fee is not None:
            try:
                shipping_fee = Decimal(str(raw_shipping_fee)).quantize(Decimal('0.01'))
            except Exception:
                shipping_fee = Decimal('0.00')
        else:
            shipping_fee = Decimal('0.00') if subtotal >= Decimal('5000.00') else Decimal('120.00')

        tax_amount = Decimal('0.00')
        total = max(Decimal('0.00'), subtotal - discount_amount + shipping_fee + tax_amount)

        card_holder_name = None
        card_brand = None
        card_last4 = None
        card_expiry = None
        payment_phone = None
        bkash_trx_id = None
        paid_at = None

        if payment_method == 'card':
            raw_card_number = str(payment_details.get('card_number') or data.get('card_number') or '').strip()
            card_holder_name = str(payment_details.get('card_holder_name') or data.get('card_holder_name') or shipping_data.get('name') or request.user.username).strip()
            card_expiry = str(payment_details.get('card_expiry') or data.get('card_expiry') or '').strip()
            card_cvv = str(payment_details.get('card_cvv') or data.get('card_cvv') or '').strip()

            clean_digits = re.sub(r'\D', '', raw_card_number)
            if clean_digits:
                if len(clean_digits) < 13 or len(clean_digits) > 19:
                    return Response({"error": "Please enter a valid 13 to 19 digit card number."}, status=status.HTTP_400_BAD_REQUEST)
                if not validate_card_expiry(card_expiry):
                    return Response({"error": "Card expiry date is invalid or expired (use MM/YY)."}, status=status.HTTP_400_BAD_REQUEST)
                if not re.match(r'^\d{3,4}$', card_cvv):
                    return Response({"error": "Please enter a valid 3 or 4 digit security code (CVV)."}, status=status.HTTP_400_BAD_REQUEST)
                card_brand = detect_card_brand(clean_digits)
                card_last4 = clean_digits[-4:]
            else:
                card_brand = 'Visa'
                card_last4 = '4242'

            transaction_id = f"TXN-CRD-{uuid.uuid4().hex[:10].upper()}"
            payment_status = 'PAID'
            paid_at = timezone.now()

        elif payment_method in ['bkash', 'nagad']:
            payment_phone = str(
                payment_details.get('payment_phone') or
                payment_details.get('bkash_number') or
                data.get('payment_phone') or
                shipping_data.get('phone') or ''
            ).strip()
            bkash_trx_id = str(
                payment_details.get('bkash_trx_id') or
                payment_details.get('transaction_id') or
                data.get('bkash_trx_id') or ''
            ).strip().upper()

            if not bkash_trx_id:
                bkash_trx_id = f"TRX{uuid.uuid4().hex[:8].upper()}"

            transaction_id = f"TXN-{payment_method.upper()}-{bkash_trx_id}"
            payment_status = 'PAID'
            paid_at = timezone.now()

        else:
            payment_method = 'cod'
            transaction_id = f"TXN-COD-{uuid.uuid4().hex[:10].upper()}"
            payment_status = 'UNPAID'

        customer_name = (
            shipping_data.get('name') or
            f"{request.user.first_name} {request.user.last_name}".strip() or
            request.user.username
        )
        customer_email = shipping_data.get('email') or request.user.email
        customer_phone = shipping_data.get('phone') or ''
        shipping_address = shipping_data.get('address') or ''
        city = shipping_data.get('city') or 'Dhaka'
        postal_code = shipping_data.get('postal_code') or ''
        country = shipping_data.get('country') or 'Bangladesh'
        order_notes = shipping_data.get('notes') or data.get('order_notes') or ''

        order = Order.objects.create(
            user=request.user,
            customer_name=customer_name,
            customer_email=customer_email,
            phone=customer_phone,
            shipping_address=shipping_address,
            city=city,
            postal_code=postal_code,
            country=country,
            order_notes=order_notes,
            payment_method=payment_method,
            payment_status=payment_status,
            transaction_id=transaction_id,
            card_holder_name=card_holder_name,
            card_brand=card_brand,
            card_last4=card_last4,
            card_expiry=card_expiry,
            payment_phone=payment_phone,
            bkash_trx_id=bkash_trx_id,
            paid_at=paid_at,
            subtotal_amount=subtotal,
            discount_amount=discount_amount,
            discount_code=applied_code,
            shipping_fee=shipping_fee,
            tax_amount=tax_amount,
            total_amount=total,
            status='PENDING'
        )

        for product, qty, price, selected_variants in order_items_to_create:
            OrderItem.objects.create(
                order=order,
                product=product,
                product_name_snapshot=product.name,
                selected_variants=selected_variants,
                quantity=qty,
                price=price
            )
            product.stock -= qty
            product.save()

        profile, _ = CustomerProfile.objects.get_or_create(user=request.user)
        profile_updated = False
        if shipping_address and not profile.default_shipping_address:
            profile.default_shipping_address = shipping_address
            profile_updated = True
        if city and not profile.city:
            profile.city = city
            profile_updated = True
        if postal_code and not profile.postal_code:
            profile.postal_code = postal_code
            profile_updated = True
        if profile_updated:
            profile.save()

        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        order = self.get_object()
        previous_status = order.status
        new_status = request.data.get('status')

        response = super().partial_update(request, *args, **kwargs)

        if new_status in ['CANCELLED', 'REFUNDED'] and previous_status not in ['CANCELLED', 'REFUNDED']:
            restore_order_stock(order)

        return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def cancel_order_view(request, order_id):
    try:
        if request.user.is_staff:
            order = Order.objects.select_for_update().get(id=order_id)
        else:
            order = Order.objects.select_for_update().filter(
                Q(user=request.user) | Q(customer_email__iexact=request.user.email)
            ).get(id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

    if order.status in ['CANCELLED', 'REFUNDED']:
        return Response({"error": "Order is already cancelled."}, status=status.HTTP_400_BAD_REQUEST)

    if not request.user.is_staff and order.status in ['SHIPPED', 'DELIVERED', 'COMPLETED']:
        return Response(
            {"error": "Orders that have already been shipped or delivered cannot be cancelled online."},
            status=status.HTTP_400_BAD_REQUEST
        )

    restore_order_stock(order)
    order.status = 'CANCELLED'
    if order.payment_status == 'PAID':
        order.payment_status = 'REFUNDED'
    order.save()

    return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)


class BannerViewSet(viewsets.ModelViewSet):
    queryset = Banner.objects.none()
    serializer_class = BannerSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [AllowAny()]


class DiscountCodeViewSet(viewsets.ModelViewSet):
    queryset = DiscountCode.objects.all().order_by('-id')
    serializer_class = DiscountCodeSerializer
    permission_classes = [IsAdminUser]


class SupportKnowledgeBaseViewSet(viewsets.ModelViewSet):
    """
    Allows Admins to add, edit, toggle, and delete 0-token Customer Service FAQ
    guides directly from the Admin Console.
    """
    serializer_class = SupportKnowledgeBaseSerializer

    def get_queryset(self):
        ensure_default_support_kb()
        return SupportKnowledgeBase.objects.all().order_by('-hit_count', 'id')

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [AllowAny()]


@api_view(['POST'])
@permission_classes([AllowAny])
def validate_discount_view(request):
    code = str(request.data.get('code', '') or '').strip().upper()
    subtotal_raw = request.data.get('subtotal', 0)

    if not code:
        return Response({"error": "Please enter a promo code."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        subtotal = Decimal(str(subtotal_raw))
    except Exception:
        subtotal = Decimal('0.00')

    discount = DiscountCode.objects.filter(code__iexact=code, is_active=True).first()
    if not discount:
        return Response({"error": "Invalid or inactive promo code."}, status=status.HTTP_404_NOT_FOUND)

    if discount.usage_limit and discount.times_used >= discount.usage_limit:
        return Response({"error": "This promo code has reached its usage limit."}, status=status.HTTP_400_BAD_REQUEST)

    discount_amount = (subtotal * Decimal(str(discount.discount_percent)) / Decimal('100')).quantize(Decimal('0.01'))
    final_total = max(Decimal('0.00'), subtotal - discount_amount)

    return Response({
        "valid": True,
        "code": discount.code,
        "discount_percent": discount.discount_percent,
        "discount_amount": float(discount_amount),
        "final_total": float(final_total)
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def store_highlights_view(request):
    total_products = Product.objects.filter(stock__gt=0).count()
    total_categories = Category.objects.count()
    brands = list(
        Product.objects.exclude(brand__isnull=True)
        .exclude(brand__exact='')
        .values_list('brand', flat=True)
        .distinct()[:12]
    )
    avg_rating = Review.objects.filter(is_approved=True).aggregate(avg=Avg('rating'))['avg'] or 4.9

    return Response({
        "in_stock_products": total_products,
        "active_categories": total_categories,
        "top_brands": brands,
        "average_store_rating": round(float(avg_rating), 1)
    })


@api_view(['POST'])
@permission_classes([AllowAny])
@transaction.atomic
def signup_view(request):
    email = str(request.data.get('email', '') or '').strip().lower()
    phone = str(request.data.get('phone', '') or '').strip()
    name = str(request.data.get('name', '') or '').strip()
    password = request.data.get('password', '')
    address = str(request.data.get('shipping_address') or request.data.get('default_shipping_address') or '').strip()

    if not email or not phone or not password or not name:
        return Response({"error": "Name, email, phone number, and password are all required."}, status=status.HTTP_400_BAD_REQUEST)

    if len(password) < 8:
        return Response({"error": "Password must be at least 8 characters long."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email__iexact=email).exists():
        return Response({"error": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)
    if CustomerProfile.objects.filter(phone_number=phone).exists():
        return Response({"error": "This phone number is already registered."}, status=status.HTTP_400_BAD_REQUEST)

    base_username = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0]) or 'user'
    username = base_username
    counter = 1
    while User.objects.filter(username__iexact=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    name_parts = name.split(' ', 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ''

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name
    )

    profile, _ = CustomerProfile.objects.get_or_create(user=user)
    profile.phone_number = phone
    if address:
        profile.default_shipping_address = address
    profile.save()

    login(request, user)
    return Response(UserSerializer(user, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    identifier = (
        request.data.get('identifier') or
        request.data.get('email') or
        request.data.get('phone') or
        request.data.get('username') or ''
    ).strip()
    password = request.data.get('password', '')

    if not identifier or not password:
        return Response({"error": "Email/Phone and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    user_obj = (
        User.objects.filter(email__iexact=identifier).first() or
        User.objects.filter(username__iexact=identifier).first()
    )

    if not user_obj:
        profile = CustomerProfile.objects.select_related('user').filter(phone_number=identifier).first()
        if profile:
            user_obj = profile.user

    user = None
    if user_obj:
        user = authenticate(request, username=user_obj.username, password=password)

    if user is not None:
        login(request, user)
        return Response(UserSerializer(user, context={'request': request}).data)

    return Response({"error": "Invalid credentials. Please check your email/phone and password."}, status=status.HTTP_400_BAD_REQUEST)


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
        email_verified = str(google_data.get('email_verified', 'true')).lower() == 'true'
        name = google_data.get('name', '')

        if not email or not email_verified:
            return Response({"error": "Verified Google email address is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email).first()

        if not user:
            base_username = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0]) or 'user'
            username = base_username
            counter = 1
            while User.objects.filter(username__iexact=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            name_parts = name.split(' ', 1)
            user = User.objects.create(
                username=username,
                email=email.lower(),
                first_name=name_parts[0],
                last_name=name_parts[1] if len(name_parts) > 1 else ''
            )
            user.set_unusable_password()
            user.save()
            CustomerProfile.objects.get_or_create(user=user)

        login(request, user)
        return Response(UserSerializer(user, context={'request': request}).data, status=status.HTTP_200_OK)

    except urllib.error.URLError:
        return Response({"error": "Invalid or expired Google token"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def logout_view(request):
    logout(request)
    return Response({"message": "Logged out successfully"})


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def user_profile_view(request):
    user = request.user
    profile, _ = CustomerProfile.objects.get_or_create(user=user)

    if request.method == 'GET':
        return Response(UserSerializer(user, context={'request': request}).data)

    data = request.data

    if 'name' in data and str(data.get('name', '')).strip():
        parts = str(data.get('name')).strip().split(' ', 1)
        user.first_name = parts[0]
        user.last_name = parts[1] if len(parts) > 1 else ''
    if 'first_name' in data:
        user.first_name = str(data.get('first_name', '')).strip()
    if 'last_name' in data:
        user.last_name = str(data.get('last_name', '')).strip()

    if 'username' in data and str(data.get('username', '')).strip():
        new_username = str(data.get('username')).strip()
        if User.objects.exclude(id=user.id).filter(username__iexact=new_username).exists():
            return Response({"error": "This username is already taken."}, status=status.HTTP_400_BAD_REQUEST)
        user.username = new_username

    if 'email' in data and str(data.get('email', '')).strip():
        new_email = str(data.get('email')).strip().lower()
        if User.objects.exclude(id=user.id).filter(email__iexact=new_email).exists():
            return Response({"error": "This email is already registered to another account."}, status=status.HTTP_400_BAD_REQUEST)
        user.email = new_email

    new_password = data.get('new_password') or data.get('password')
    if new_password and str(new_password).strip():
        current_password = data.get('current_password')
        if current_password and user.has_usable_password():
            if not user.check_password(current_password):
                return Response({"error": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        if len(str(new_password)) < 8:
            return Response({"error": "New password must be at least 8 characters long."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(str(new_password))

    user.save()
    if new_password and str(new_password).strip():
        login(request, user)

    if 'phone' in data:
        new_phone = str(data.get('phone') or '').strip()
        if new_phone:
            if CustomerProfile.objects.exclude(user=user).filter(phone_number=new_phone).exists():
                return Response({"error": "This phone number is already linked to another account."}, status=status.HTTP_400_BAD_REQUEST)
            profile.phone_number = new_phone
        else:
            profile.phone_number = None

    if 'default_shipping_address' in data or 'shipping_address' in data:
        addr = data.get('default_shipping_address') if 'default_shipping_address' in data else data.get('shipping_address')
        profile.default_shipping_address = str(addr or '').strip()

    if 'city' in data:
        profile.city = str(data.get('city') or '').strip()
    if 'postal_code' in data:
        profile.postal_code = str(data.get('postal_code') or '').strip()
    if 'country' in data:
        profile.country = str(data.get('country') or '').strip()

    if 'avatar' in request.FILES:
        profile.avatar = request.FILES['avatar']

    profile.save()
    return Response(UserSerializer(user, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_list_users(request):
    users = User.objects.select_related('customer_profile').all().order_by('-date_joined')
    serializer = UserSerializer(users, many=True, context={'request': request})
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
@transaction.atomic
def admin_create_admin_view(request):
    email = str(request.data.get('email', '') or '').strip().lower()
    phone = str(request.data.get('phone', '') or '').strip()
    name = str(request.data.get('name', '') or '').strip()
    password = request.data.get('password', '')

    if not email or not phone or not password or not name:
        return Response({"error": "All fields are required."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email__iexact=email).exists():
        return Response({"error": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)
    if CustomerProfile.objects.filter(phone_number=phone).exists():
        return Response({"error": "This phone number is already registered."}, status=status.HTTP_400_BAD_REQUEST)

    base_username = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0]) or 'admin'
    username = base_username
    counter = 1
    while User.objects.filter(username__iexact=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    name_parts = name.split(' ', 1)
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

    profile, _ = CustomerProfile.objects.get_or_create(user=user)
    profile.phone_number = phone
    profile.save()

    return Response(UserSerializer(user, context={'request': request}).data, status=status.HTTP_201_CREATED)


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
            if brand.lower() == 'nan':
                brand = ''

            product_code = str(row.get('asin') or row.get('product_code', '')).strip()
            if product_code.lower() == 'nan':
                product_code = ''

            description = str(row.get('description', '')).strip()
            if description.lower() == 'nan':
                description = ''

            def clean_price(val):
                if not val:
                    return Decimal('0.00')
                v_str = str(val).replace('"', '').replace('$', '').replace('₹', '').replace('৳', '').replace(',', '').strip()
                if v_str.lower() == 'nan' or not v_str:
                    return Decimal('0.00')
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
                defaults={'slug': slugify(category_name) or 'uncategorized'}
            )

            image_url = str(row.get('image_url') or row.get('image', '')).strip()
            if image_url.lower() == 'nan':
                image_url = ''

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

        cleanup_empty_categories()
        return Response({"message": f"Successfully imported {imported_count} products."}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({"error": f"Error parsing CSV file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAdminUser])
@transaction.atomic
def admin_bulk_delete_products_view(request):
    product_ids = request.data.get('product_ids', [])

    if not product_ids or not isinstance(product_ids, list):
        return Response({"error": "Please provide a valid list of product IDs."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        qs = Product.objects.filter(id__in=product_ids)
        deleted_count = qs.count()
        qs.delete()

        deleted_categories = cleanup_empty_categories()

        return Response({
            "message": f"Successfully deleted {deleted_count} products.",
            "deleted_categories": deleted_categories
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": f"Failed to delete products: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def analyze_product_ai_view(request, product_id):
    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

    reviews = list(product.reviews.filter(is_approved=True).values('rating', 'comment', 'user_name'))
    analysis_data = analyze_product_reviews_ai(product.name, reviews, product_id=product.id)
    return Response(analysis_data)


@api_view(['POST'])
@permission_classes([AllowAny])
def ai_customer_support_view(request):
    history = request.data.get('history', [])
    message = request.data.get('message', '')
    product_context = request.data.get('product_context', '')

    if not str(message).strip():
        return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)

    reply = generate_support_chat_reply(
        history=history,
        message=str(message),
        product_context=str(product_context or '')
    )
    return Response({"reply": reply}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_analytics_view(request):
    completed_revenue = Order.objects.filter(
        Q(status__in=['COMPLETED', 'DELIVERED']) | Q(payment_status='PAID')
    ).exclude(status__in=['CANCELLED', 'REFUNDED']).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

    total_orders = Order.objects.count()
    pending_orders = Order.objects.filter(status='PENDING').count()
    processing_orders = Order.objects.filter(status='PROCESSING').count()
    shipped_orders = Order.objects.filter(status='SHIPPED').count()
    delivered_orders = Order.objects.filter(status__in=['DELIVERED', 'COMPLETED']).count()
    cancelled_orders = Order.objects.filter(status__in=['CANCELLED', 'REFUNDED']).count()

    total_products = Product.objects.count()
    out_of_stock_count = Product.objects.filter(stock=0).count()
    low_stock_count = Product.objects.filter(stock__lt=5).count()
    total_customers = User.objects.filter(is_staff=False).count()
    avg_rating = Review.objects.filter(is_approved=True).aggregate(avg=Avg('rating'))['avg'] or 0.0

    today = timezone.now().date()
    sales_trend = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_orders = Order.objects.filter(created_at__date=day).exclude(status__in=['CANCELLED', 'REFUNDED'])
        day_total = day_orders.aggregate(total=Sum('total_amount'))['total'] or 0
        sales_trend.append({
            "date": day.strftime("%b %d"),
            "revenue": float(day_total),
            "orders": day_orders.count()
        })

    category_distribution = list(
        Category.objects.annotate(count=Count('products')).values('id', 'name', 'slug', 'count').order_by('-count')
    )

    payment_breakdown = list(
        Order.objects.exclude(status__in=['CANCELLED', 'REFUNDED'])
        .values('payment_method')
        .annotate(count=Count('id'), revenue=Sum('total_amount'))
    )

    top_products_qs = (
        OrderItem.objects.exclude(order__status__in=['CANCELLED', 'REFUNDED'])
        .values('product__id', 'product__name', 'product__brand', 'product_name_snapshot')
        .annotate(units_sold=Sum('quantity'), revenue=Sum(F('quantity') * F('price')))
        .order_by('-units_sold')[:5]
    )
    top_selling_products = [
        {
            "id": item['product__id'],
            "name": item['product__name'] or item['product_name_snapshot'] or 'Product',
            "brand": item['product__brand'] or 'AuraTech',
            "units_sold": item['units_sold'] or 0,
            "revenue": float(item['revenue'] or 0)
        }
        for item in top_products_qs
    ]

    return Response({
        "metrics": {
            "total_revenue": float(completed_revenue),
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "processing_orders": processing_orders,
            "shipped_orders": shipped_orders,
            "delivered_orders": delivered_orders,
            "cancelled_orders": cancelled_orders,
            "total_products": total_products,
            "low_stock_alerts": low_stock_count,
            "low_stock_products": low_stock_count,
            "out_of_stock_products": out_of_stock_count,
            "total_customers": total_customers,
            "average_rating": round(float(avg_rating), 1),
        },
        "sales_trend": sales_trend,
        "category_distribution": category_distribution,
        "payment_breakdown": payment_breakdown,
        "top_selling_products": top_selling_products,
    })