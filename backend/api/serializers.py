from rest_framework import serializers
from django.utils.text import slugify
from .models import Category, Product, Review, Order, OrderItem, CustomerProfile
from django.contrib.auth.models import User

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
        if obj.image:
            return obj.image.url
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
            'status', 'created_at', 'items'
        ]

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'is_staff', 'is_superuser', 'avatar_url']

    def get_avatar_url(self, obj):
        # Safe fetch: Prevents 500 errors if the profile relation is missing or errors out
        try:
            if hasattr(obj, 'customer_profile') and obj.customer_profile and obj.customer_profile.avatar:
                return obj.customer_profile.avatar.url
        except Exception:
            return None
        return None

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user