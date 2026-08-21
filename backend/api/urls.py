from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, ProductViewSet, ReviewViewSet, OrderViewSet,
    signup_view, login_view, logout_view, user_profile_view,
    admin_list_users, admin_delete_user,
    analyze_product_ai_view, ai_customer_support_view, admin_analytics_view
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'reviews', ReviewViewSet)
router.register(r'orders', OrderViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('auth/signup/', signup_view, name='signup'),
    path('auth/login/', login_view, name='login'),
    path('auth/logout/', logout_view, name='logout'),
    path('auth/profile/', user_profile_view, name='profile'),
    path('admin/users/', admin_list_users, name='admin-list-users'),
    path('admin/users/<int:user_id>/', admin_delete_user, name='admin-delete-user'),
    path('products/<int:product_id>/analyze-ai/', analyze_product_ai_view, name='analyze-product-ai'),
    path('chat/support/', ai_customer_support_view, name='ai-customer-support'),
    path('admin/analytics/', admin_analytics_view, name='admin-analytics'),
]