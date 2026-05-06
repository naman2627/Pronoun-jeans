from django.urls import path
from .views import (
    CartDetailView, CartItemUpdateView, CartItemDetailView,
    CheckoutView, OrderHistoryView,
    ApplyCouponView, ActiveCouponsListView,
    RazorpayCreateOrderView, RazorpayVerifyPaymentView,
    DirectUPICheckoutView,
    AgentCommissionsListView, AgentLedgerSummaryView,
    AgentSampleOrdersListView, AgentOrdersListView,
    AgentOrderTrackingUpdateView, OrderTrackingTimelineView,
)

urlpatterns = [
    # Cart
    path('cart/',                CartDetailView.as_view(),      name='cart-detail'),
    path('cart/update/',         CartItemUpdateView.as_view(),  name='cart-item-update'),
    path('cart/items/<int:pk>/', CartItemDetailView.as_view(),  name='cart-item-detail'),

    # Coupons
    path('cart/apply-coupon/', ApplyCouponView.as_view(),      name='apply-coupon'),
    path('coupons/active/',    ActiveCouponsListView.as_view(), name='active-coupons'),

    # Direct UPI
    path('upi/checkout/', DirectUPICheckoutView.as_view(), name='upi-checkout'),

    # Razorpay
    path('razorpay/create/', RazorpayCreateOrderView.as_view(),  name='razorpay-create'),
    path('razorpay/verify/', RazorpayVerifyPaymentView.as_view(), name='razorpay-verify'),

    # Standard checkout (disabled — returns error pointing to correct endpoints)
    path('checkout/', CheckoutView.as_view(), name='checkout'),

    # History
    path('history/', OrderHistoryView.as_view(), name='order-history'),

    # Agent
    path('agent/commissions/',                    AgentCommissionsListView.as_view(),    name='agent-commissions'),
    path('agent/ledger/',                         AgentLedgerSummaryView.as_view(),      name='agent-ledger'),
    path('agent/sample-orders/',                  AgentSampleOrdersListView.as_view(),   name='agent-sample-orders'),
    path('agent/orders/',                         AgentOrdersListView.as_view(),         name='agent-orders'),
    path('agent/orders/<int:pk>/tracking/',       AgentOrderTrackingUpdateView.as_view(), name='agent-order-tracking'),
    path('agent/orders/<int:pk>/track-timeline/', OrderTrackingTimelineView.as_view(),   name='order-track-timeline'),
]