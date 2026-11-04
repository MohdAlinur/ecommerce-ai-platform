from django.db import models
from django.contrib.auth.models import User
from django.db.models import Count
from django.db.models.signals import post_delete
from django.dispatch import receiver


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class Product(models.Model):
    category = models.ForeignKey(Category, related_name='products', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=100, blank=True, null=True)
    product_code = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField()
    cash_discount_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    regular_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    stock = models.PositiveIntegerField(default=10)
    is_featured = models.BooleanField(default=False)

    # Primary Image
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    image_url = models.URLField(max_length=500, blank=True, null=True)

    # Gallery, Variants & Structured Specs
    image_gallery = models.JSONField(default=list, blank=True)
    variants = models.JSONField(default=list, blank=True)
    key_features = models.JSONField(default=list, blank=True)
    specifications = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


def cleanup_empty_categories():
    """
    Automatically deletes any Category that has 0 products remaining.
    """
    empty_cats = Category.objects.annotate(product_count=Count('products')).filter(product_count=0)
    deleted_names = list(empty_cats.values_list('name', flat=True))
    if deleted_names:
        empty_cats.delete()
    return deleted_names


@receiver(post_delete, sender=Product)
def auto_delete_empty_category_on_product_delete(sender, instance, **kwargs):
    if instance.category_id:
        if not Product.objects.filter(category_id=instance.category_id).exists():
            Category.objects.filter(id=instance.category_id).delete()


class Review(models.Model):
    product = models.ForeignKey(Product, related_name='reviews', on_delete=models.CASCADE)
    user = models.ForeignKey(User, related_name='reviews', on_delete=models.SET_NULL, null=True, blank=True)
    user_name = models.CharField(max_length=100)
    rating = models.PositiveSmallIntegerField(default=5)
    comment = models.TextField()
    is_approved = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user_name} - {self.product.name}"


class Order(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('SHIPPED', 'Shipped'),
        ('DELIVERED', 'Delivered'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
        ('REFUNDED', 'Refunded'),
    ]

    PAYMENT_CHOICES = [
        ('bkash', 'bKash Mobile Banking'),
        ('nagad', 'Nagad Mobile Banking'),
        ('card', 'Credit/Debit Card'),
        ('cod', 'Cash on Delivery'),
    ]

    PAYMENT_STATUS = [
        ('UNPAID', 'Unpaid'),
        ('PROCESSING', 'Processing'),
        ('PAID', 'Paid'),
        ('FAILED', 'Failed'),
        ('REFUNDED', 'Refunded'),
    ]

    user = models.ForeignKey(User, related_name='orders', on_delete=models.SET_NULL, null=True, blank=True)
    customer_name = models.CharField(max_length=150)
    customer_email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True, null=True)
    shipping_address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True, default='Dhaka')
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True, default='Bangladesh')
    order_notes = models.TextField(blank=True, null=True)

    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default='cod')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default='UNPAID')
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    card_holder_name = models.CharField(max_length=150, blank=True, null=True)
    card_brand = models.CharField(max_length=50, blank=True, null=True)
    card_last4 = models.CharField(max_length=4, blank=True, null=True)
    card_expiry = models.CharField(max_length=10, blank=True, null=True)
    payment_phone = models.CharField(max_length=25, blank=True, null=True)
    bkash_trx_id = models.CharField(max_length=100, blank=True, null=True)
    paid_at = models.DateTimeField(blank=True, null=True)

    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_code = models.CharField(max_length=30, blank=True, null=True)
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    tracking_number = models.CharField(max_length=100, blank=True, null=True)
    courier_name = models.CharField(max_length=100, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Order #{self.id} - {self.customer_name}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    product_name_snapshot = models.CharField(max_length=255, blank=True, default='')
    selected_variants = models.JSONField(default=dict, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def save(self, *args, **kwargs):
        if self.product and not self.product_name_snapshot:
            self.product_name_snapshot = self.product.name
        super().save(*args, **kwargs)

    def __str__(self):
        name = self.product.name if self.product else (self.product_name_snapshot or 'Deleted Product')
        return f"{self.quantity}x {name}"


class CustomerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer_profile')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    default_shipping_address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True, default='Dhaka')
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True, default='Bangladesh')

    def __str__(self):
        return f"{self.user.username}'s Profile"


class Banner(models.Model):
    title = models.CharField(max_length=100)
    image = models.ImageField(upload_to='banners/', null=True, blank=True)
    image_url = models.URLField(max_length=500, blank=True, null=True)
    link = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class DiscountCode(models.Model):
    code = models.CharField(max_length=20, unique=True)
    discount_percent = models.PositiveIntegerField(default=10)
    is_active = models.BooleanField(default=True)
    usage_limit = models.PositiveIntegerField(default=100, blank=True, null=True)
    times_used = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.code


# ==============================================================================
# ZERO-TOKEN DATABASE CUSTOMER SERVICE KNOWLEDGE BASE & PERSISTENT AI CACHE
# ==============================================================================
class SupportKnowledgeBase(models.Model):
    """
    Stores step-by-step website guides & customer service FAQs in PostgreSQL.
    Matched queries are answered directly from the database using 0 AI tokens!
    """
    topic_slug = models.CharField(max_length=100, unique=True)
    title = models.CharField(max_length=200)
    keywords = models.TextField(help_text="Comma-separated trigger phrases")
    response_markdown = models.TextField()
    is_active = models.BooleanField(default=True)
    hit_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.hit_count} hits)"


class AIChatCacheEntry(models.Model):
    """
    Stores generated AI responses in PostgreSQL so repeated questions across
    all users and server restarts cost 0 tokens.
    """
    cache_key = models.CharField(max_length=64, unique=True, db_index=True)
    question = models.CharField(max_length=500)
    reply_markdown = models.TextField()
    hit_count = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.question[:50]} ({self.hit_count} hits)"