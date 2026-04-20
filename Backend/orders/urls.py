# Backend/orders/urls.py

from django.urls import path
from .views import CartDetailView, CartItemUpdateView, CheckoutView, OrderHistoryView

urlpatterns = [
    path('cart/', CartDetailView.as_view(), name='cart-detail'),
    path('cart/update/', CartItemUpdateView.as_view(), name='cart-item-update'),
    path('checkout/', CheckoutView.as_view(), name='checkout'),
    path('history/', OrderHistoryView.as_view(), name='order-history'),
]