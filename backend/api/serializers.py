from rest_framework import serializers
from django.utils.text import slugify
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist

# Assuming Banner and DiscountCode were added to your models.py
from .models import Category, Product, Review, Order, OrderItem, CustomerProfile, Banner, DiscountCode

class CategorySerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']

    def create(self, validated_data):
        name = validated_data.get('name')
        slug = validated_data.get('slug') or slugify(name)
        
        original_slug = slug
        counter = 1
        while Category.objects.filter(slug=slug).exists():
            slug = f"{original_slug}-{counter}"
            counter += 1
        
        validated_data['slug'] = slug
        return super().create(validated_data)

class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    image_display_url = serializers.SerializerMethodField()
    reviews = ReviewSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = '__all__'

    def get_image_display_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            # Safely returns the absolute URL if the request context is provided
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        elif obj.image_url:
            return obj.image_url
        return None

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'quantity', 'price']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'customer_name', 'customer_email', 'phone', 
            'shipping_address', 'payment_method', 'total_amount', 
            'status', 'tracking_number', 'courier_name', 'created_at', 'items'
        ]

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    avatar_url = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'is_staff', 'is_superuser', 'avatar_url', 'phone', 'name']

    def get_avatar_url(self, obj):
        try:
            profile = obj.customer_profile
            if profile and profile.avatar:
                request = self.context.get('request')
                return request.build_absolute_uri(profile.avatar.url) if request else profile.avatar.url
        except ObjectDoesNotExist:
            return None
        return None
        
    def get_phone(self, obj):
        try:
            profile = obj.customer_profile
            if profile:
                return profile.phone_number
        except ObjectDoesNotExist:
            return None
        return None
        
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
        
        # Update standard fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        # Safely hash the new password if provided during an update
        if password:
            instance.set_password(password)
            
        instance.save()
        return instance

# ==========================================
# ENTERPRISE MODULES: CMS & MARKETING
# ==========================================
class BannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = '__all__'

class DiscountCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscountCode
        fields = '__all__'