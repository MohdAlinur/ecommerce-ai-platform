from rest_framework import serializers
from django.utils.text import slugify
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Avg

from .models import (
    Category, Product, Review, Order, OrderItem,
    CustomerProfile, Banner, DiscountCode, SupportKnowledgeBase
)


class CategorySerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'product_count']

    def get_product_count(self, obj):
        if hasattr(obj, 'product_count'):
            return obj.product_count
        return obj.products.count()

    def create(self, validated_data):
        name = validated_data.get('name', '').strip()
        slug = validated_data.get('slug') or slugify(name) or 'category'

        original_slug = slug
        counter = 1
        while Category.objects.filter(slug=slug).exists():
            slug = f"{original_slug}-{counter}"
            counter += 1

        validated_data['slug'] = slug
        return super().create(validated_data)


class ReviewSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = Review
        fields = [
            'id', 'product', 'product_name', 'user',
            'user_name', 'rating', 'comment', 'is_approved', 'created_at'
        ]
        read_only_fields = ['user', 'created_at']


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    category_slug = serializers.ReadOnlyField(source='category.slug')
    image_display_url = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = '__all__'

    def get_image_display_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            return request.build_absolute_uri(obj.image.url) if request else f"http://127.0.0.1:8000{obj.image.url}"
        elif obj.image_url:
            return obj.image_url
        return None

    def get_reviews(self, obj):
        approved_reviews = obj.reviews.filter(is_approved=True).order_by('-created_at')
        return ReviewSerializer(approved_reviews, many=True).data

    def get_average_rating(self, obj):
        avg = obj.reviews.filter(is_approved=True).aggregate(avg=Avg('rating'))['avg']
        return round(float(avg), 1) if avg else 0.0


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'product_name', 'product_image',
            'selected_variants', 'quantity', 'price'
        ]

    def get_product_name(self, obj):
        if obj.product:
            return obj.product.name
        return obj.product_name_snapshot or 'Deleted Product'

    def get_product_image(self, obj):
        if obj.product:
            if obj.product.image:
                return f"http://127.0.0.1:8000{obj.product.image.url}"
            return obj.product.image_url
        return None


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    masked_card = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'user', 'customer_name', 'customer_email', 'phone',
            'shipping_address', 'city', 'postal_code', 'country', 'order_notes',
            'payment_method', 'payment_status', 'transaction_id',
            'card_holder_name', 'card_brand', 'card_last4', 'card_expiry', 'masked_card',
            'payment_phone', 'bkash_trx_id', 'paid_at',
            'subtotal_amount', 'discount_amount', 'discount_code',
            'shipping_fee', 'tax_amount', 'total_amount',
            'status', 'tracking_number', 'courier_name',
            'created_at', 'updated_at', 'items'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']

    def get_masked_card(self, obj):
        if obj.card_last4:
            brand = obj.card_brand or 'Card'
            return f"{brand} •••• {obj.card_last4}"
        return None


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    avatar_url = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    default_shipping_address = serializers.SerializerMethodField()
    shipping_address = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()
    postal_code = serializers.SerializerMethodField()
    country = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email', 'password',
            'is_staff', 'is_superuser', 'avatar_url', 'phone', 'name',
            'default_shipping_address', 'shipping_address', 'city', 'postal_code', 'country',
            'date_joined'
        ]
        read_only_fields = ['id', 'is_staff', 'is_superuser', 'date_joined']

    def get_avatar_url(self, obj):
        try:
            profile = obj.customer_profile
            if profile and profile.avatar:
                return profile.avatar.url
        except ObjectDoesNotExist:
            return None
        return None

    def get_phone(self, obj):
        try:
            return obj.customer_profile.phone_number
        except ObjectDoesNotExist:
            return None

    def get_default_shipping_address(self, obj):
        try:
            return obj.customer_profile.default_shipping_address
        except ObjectDoesNotExist:
            return None

    def get_shipping_address(self, obj):
        try:
            return obj.customer_profile.default_shipping_address
        except ObjectDoesNotExist:
            return None

    def get_city(self, obj):
        try:
            return obj.customer_profile.city
        except ObjectDoesNotExist:
            return 'Dhaka'

    def get_postal_code(self, obj):
        try:
            return obj.customer_profile.postal_code
        except ObjectDoesNotExist:
            return None

    def get_country(self, obj):
        try:
            return obj.customer_profile.country
        except ObjectDoesNotExist:
            return 'Bangladesh'

    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        validated_data.pop('is_staff', None)
        validated_data.pop('is_superuser', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance


class BannerSerializer(serializers.ModelSerializer):
    image_display_url = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = '__all__'

    def get_image_display_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            url = obj.image.url
            if request:
                return request.build_absolute_uri(url)
            return f"http://127.0.0.1:8000{url}"
        if obj.image_url:
            return obj.image_url
        return None


class DiscountCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscountCode
        fields = '__all__'


class SupportKnowledgeBaseSerializer(serializers.ModelSerializer):
    topic_slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = SupportKnowledgeBase
        fields = [
            'id', 'topic_slug', 'title', 'keywords',
            'response_markdown', 'is_active', 'hit_count', 'updated_at'
        ]
        read_only_fields = ['hit_count', 'updated_at']

    def create(self, validated_data):
        title = validated_data.get('title', '').strip()
        slug = validated_data.get('topic_slug') or slugify(title) or 'support-guide'

        original_slug = slug
        counter = 1
        while SupportKnowledgeBase.objects.filter(topic_slug=slug).exists():
            slug = f"{original_slug}-{counter}"
            counter += 1

        validated_data['topic_slug'] = slug
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'title' in validated_data and not validated_data.get('topic_slug'):
            new_slug = slugify(validated_data['title'])
            if new_slug and not SupportKnowledgeBase.objects.exclude(id=instance.id).filter(topic_slug=new_slug).exists():
                validated_data['topic_slug'] = new_slug
        return super().update(instance, validated_data)