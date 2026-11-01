from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    ProductViewSet,
    ReviewViewSet,
    OrderViewSet,
    BannerViewSet,
    DiscountCodeViewSet,
    signup_view,
    login_view,
    google_login_view,
    logout_view,
    user_profile_view,
    admin_list_users,
    admin_delete_user,
    admin_create_admin_view,
    admin_bulk_import_csv_view,
    admin_bulk_delete_products_view,
    analyze_product_ai_view,
    ai_customer_support_view,
    admin_analytics_view,
    cancel_order_view,
    validate_discount_view,
    store_highlights_view,
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'reviews', ReviewViewSet, basename='review')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'banners', BannerViewSet, basename='banner')
router.register(r'discounts', DiscountCodeViewSet, basename='discount')

urlpatterns = [
    # Order & Discount custom routes (placed before router to avoid lookup collisions)
    path('orders/<int:order_id>/cancel/', cancel_order_view, name='cancel-order'),
    path('discounts/validate/', validate_discount_view, name='validate-discount'),
    path('store-highlights/', store_highlights_view, name='store-highlights'),

    # Authentication & Profile
    path('auth/signup/', signup_view, name='signup'),
    path('auth/login/', login_view, name='login'),
    path('auth/google/', google_login_view, name='google-login'),
    path('auth/logout/', logout_view, name='logout'),
    path('auth/profile/', user_profile_view, name='user-profile'),

    # Admin Management
    path('admin/users/', admin_list_users, name='admin-users'),
    path('admin/users/<int:user_id>/', admin_delete_user, name='admin-delete-user'),
    path('admin/users/create-admin/', admin_create_admin_view, name='admin-create-admin'),
    path('admin/products/bulk-csv/', admin_bulk_import_csv_view, name='admin-bulk-csv'),
    path('admin/products/bulk-delete/', admin_bulk_delete_products_view, name='admin-bulk-delete'),
    path('admin/analytics/', admin_analytics_view, name='admin-analytics'),

    # AI Services
    path('products/<int:product_id>/analyze-ai/', analyze_product_ai_view, name='analyze-product-ai'),
    path('chat/support/', ai_customer_support_view, name='ai-customer-support'),

    # Standard REST ViewSets
    path('', include(router.urls)),
]