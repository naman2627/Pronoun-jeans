from django.urls import path
from .views import (
    CartDetailView, CartItemUpdateView, CartItemDetailView,
    CheckoutView, OrderHistoryView,
    ApplyCouponView,
    AgentCommissionsListView, AgentLedgerSummaryView,
    AgentSampleOrdersListView, AgentOrdersListView,
    AgentOrderTrackingUpdateView, OrderTrackingTimelineView,
)

urlpatterns = [
    # Cart
    path('cart/',                CartDetailView.as_view(),      name='cart-detail'),
    path('cart/update/',         CartItemUpdateView.as_view(),  name='cart-item-update'),
    path('cart/items/<int:pk>/', CartItemDetailView.as_view(),  name='cart-item-detail'),

    # Coupon
    path('cart/apply-coupon/', ApplyCouponView.as_view(), name='apply-coupon'),

    # Checkout & history
    path('checkout/', CheckoutView.as_view(),    name='checkout'),
    path('history/',  OrderHistoryView.as_view(), name='order-history'),

    # Agent — commissions & ledger
    path('agent/commissions/', AgentCommissionsListView.as_view(), name='agent-commissions'),
    path('agent/ledger/',      AgentLedgerSummaryView.as_view(),   name='agent-ledger'),

    # Agent — sample orders & buyer orders
    path('agent/sample-orders/', AgentSampleOrdersListView.as_view(), name='agent-sample-orders'),
    path('agent/orders/',        AgentOrdersListView.as_view(),        name='agent-orders'),

    # Agent — per-order actions
    path('agent/orders/<int:pk>/tracking/',       AgentOrderTrackingUpdateView.as_view(), name='agent-order-tracking'),
    path('agent/orders/<int:pk>/track-timeline/', OrderTrackingTimelineView.as_view(),    name='order-track-timeline'),
]