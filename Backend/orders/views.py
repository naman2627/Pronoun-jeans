from decimal import Decimal
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import Cart, CartItem, Order, OrderItem, Commission, SampleOrder, Coupon
from .tracking_service import get_bigship_tracking
from products.models import Product, ProductVariation
from accounts.models import Address
from accounts.views import IsAgent
from .serializers import (
    CartSerializer, OrderSerializer, CommissionSerializer,
    SampleOrderSerializer, OrderTrackingUpdateSerializer,
)


# ── Cart ──────────────────────────────────────────────────────────────────────

class CartDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return Response(CartSerializer(cart).data)


class CartItemUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        product_id = request.data.get('product_id')
        items      = request.data.get('items', [])

        if not product_id or not items:
            return Response(
                {'error': 'product_id and items array are required for bulk add.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_quantity = sum(
            int(item.get('quantity', 0))
            for item in items
            if int(item.get('quantity', 0)) > 0
        )

        if total_quantity == 0:
            return Response({'error': 'No valid quantities provided.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        if total_quantity < product.moq:
            return Response(
                {'error': f'Total quantity ({total_quantity}) must be >= MOQ ({product.moq}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart, _ = Cart.objects.get_or_create(user=request.user)

        for item in items:
            variation_id = item.get('variation_id')
            quantity     = int(item.get('quantity', 0))
            if quantity > 0:
                try:
                    variation = ProductVariation.objects.get(pk=variation_id, product=product)
                    CartItem.objects.update_or_create(
                        cart=cart, variation=variation, defaults={'quantity': quantity}
                    )
                except ProductVariation.DoesNotExist:
                    continue

        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)


class CartItemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, pk):
        try:
            item = CartItem.objects.select_related('cart').get(pk=pk, cart__user=request.user)
        except CartItem.DoesNotExist:
            return Response({'error': 'Cart item not found.'}, status=status.HTTP_404_NOT_FOUND)

        quantity = int(request.data.get('quantity', 1))
        if quantity <= 0:
            item.delete()
        else:
            item.quantity = quantity
            item.save()

        cart = Cart.objects.prefetch_related('items__variation').get(user=request.user)
        return Response(CartSerializer(cart).data)


# ── Coupon ────────────────────────────────────────────────────────────────────

class ApplyCouponView(APIView):
    """
    POST { "coupon_code": "SAVE10" }
    Validates the coupon against the user's current cart and returns
    discount_amount and grand_total if valid.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        coupon_code = request.data.get('coupon_code', '').strip().upper()

        if not coupon_code:
            return Response({'error': 'Please enter a coupon code.'}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch coupon
        try:
            coupon = Coupon.objects.get(code=coupon_code)
        except Coupon.DoesNotExist:
            return Response({'error': 'Invalid coupon code.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check active + date validity
        now = timezone.now()
        if not coupon.is_active:
            return Response({'error': 'This coupon is no longer active.'}, status=status.HTTP_400_BAD_REQUEST)
        if now < coupon.valid_from:
            return Response({'error': 'This coupon is not yet valid.'}, status=status.HTTP_400_BAD_REQUEST)
        if now > coupon.valid_to:
            return Response({'error': 'This coupon has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        # Get cart total
        try:
            cart = Cart.objects.prefetch_related('items__variation').get(user=request.user)
        except Cart.DoesNotExist:
            return Response({'error': 'Your cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        items = cart.items.all()
        if not items.exists():
            return Response({'error': 'Your cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        cart_total = sum(item.quantity * item.variation.b2b_price for item in items)

        # Check minimum order value
        if cart_total < coupon.min_order_value:
            return Response(
                {'error': f'Minimum order value for this coupon is ₹{coupon.min_order_value}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        discount_amount = coupon.calculate_discount(cart_total)
        grand_total     = cart_total - discount_amount

        return Response({
            'coupon_code':     coupon.code,
            'discount_type':   coupon.discount_type,
            'discount_value':  str(coupon.discount_value),
            'discount_amount': str(discount_amount),
            'subtotal':        str(cart_total),
            'grand_total':     str(grand_total),
        }, status=status.HTTP_200_OK)


# ── Checkout ──────────────────────────────────────────────────────────────────

class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        shipping_address_id = request.data.get('shipping_address_id')
        billing_address_id  = request.data.get('billing_address_id')
        payment_method      = request.data.get('payment_method', Order.PaymentMethod.BANK_TRANSFER)
        coupon_code         = request.data.get('coupon_code', '').strip().upper()

        if payment_method not in Order.PaymentMethod.values:
            return Response(
                {'error': f"Invalid payment_method. Choose from: {Order.PaymentMethod.values}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        shipping_address = None
        billing_address  = None

        if shipping_address_id:
            try:
                shipping_address = Address.objects.get(pk=shipping_address_id, user=request.user)
            except Address.DoesNotExist:
                return Response({'error': 'Shipping address not found.'}, status=status.HTTP_400_BAD_REQUEST)

        if billing_address_id:
            try:
                billing_address = Address.objects.get(pk=billing_address_id, user=request.user)
            except Address.DoesNotExist:
                return Response({'error': 'Billing address not found.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cart = Cart.objects.prefetch_related('items__variation__product').get(user=request.user)
        except Cart.DoesNotExist:
            return Response({'error': 'Cart not found.'}, status=status.HTTP_400_BAD_REQUEST)

        items = cart.items.all()
        if not items.exists():
            return Response({'error': 'Cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        total_amount = sum(item.quantity * item.variation.b2b_price for item in items)

        # Validate and apply coupon
        coupon          = None
        discount_amount = Decimal('0.00')

        if coupon_code:
            try:
                coupon = Coupon.objects.get(code=coupon_code)
                now    = timezone.now()
                if coupon.is_active and coupon.valid_from <= now <= coupon.valid_to and total_amount >= coupon.min_order_value:
                    discount_amount = coupon.calculate_discount(total_amount)
                else:
                    coupon = None  # invalid at checkout time — ignore silently
            except Coupon.DoesNotExist:
                coupon = None

        order = Order.objects.create(
            user             = request.user,
            shipping_address = shipping_address,
            billing_address  = billing_address,
            payment_method   = payment_method,
            payment_status   = Order.PaymentStatus.PENDING,
            total_amount     = total_amount,
            coupon           = coupon,
            discount_amount  = discount_amount,
            status           = Order.Status.PENDING,
        )

        OrderItem.objects.bulk_create([
            OrderItem(
                order     = order,
                variation = item.variation,
                quantity  = item.quantity,
                price     = item.variation.b2b_price,
            )
            for item in items
        ])

        cart.items.all().delete()

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


# ── Order History ─────────────────────────────────────────────────────────────

class OrderHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(
            user=request.user
        ).prefetch_related('items__variation__product').order_by('-created_at')
        return Response(OrderSerializer(orders, many=True).data)


# ── Agent: Commission & Ledger ────────────────────────────────────────────────

class AgentCommissionsListView(generics.ListAPIView):
    permission_classes = [IsAgent]
    serializer_class   = CommissionSerializer

    def get_queryset(self):
        return Commission.objects.filter(
            agent=self.request.user
        ).select_related('order', 'order__user', 'agent').order_by('-created_at')


class AgentLedgerSummaryView(APIView):
    permission_classes = [IsAgent]

    def get(self, request):
        qs           = Commission.objects.filter(agent=request.user)
        total_earned = qs.aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        total_paid   = qs.filter(status=Commission.Status.PAID).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        balance_due  = qs.filter(status=Commission.Status.PENDING).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        return Response({
            'total_earned': str(total_earned),
            'total_paid':   str(total_paid),
            'balance_due':  str(balance_due),
        })


# ── Agent: Sample Orders ──────────────────────────────────────────────────────

class AgentSampleOrdersListView(generics.ListCreateAPIView):
    permission_classes = [IsAgent]
    serializer_class   = SampleOrderSerializer

    def get_queryset(self):
        return SampleOrder.objects.filter(
            agent=self.request.user
        ).select_related('buyer', 'agent').order_by('-date')

    def perform_create(self, serializer):
        serializer.save(agent=self.request.user)


# ── Agent: Buyer Orders ───────────────────────────────────────────────────────

class AgentOrdersListView(generics.ListAPIView):
    permission_classes = [IsAgent]
    serializer_class   = OrderSerializer

    def get_queryset(self):
        return Order.objects.filter(
            user__assigned_agent=self.request.user
        ).select_related(
            'user', 'shipping_address', 'billing_address'
        ).prefetch_related(
            'items__variation__product'
        ).order_by('-created_at')


# ── Agent: Order Tracking Update ──────────────────────────────────────────────

class AgentOrderTrackingUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAgent]
    serializer_class   = OrderTrackingUpdateSerializer
    http_method_names  = ['patch']

    def get_queryset(self):
        return Order.objects.filter(user__assigned_agent=self.request.user)


# ── Tracking Timeline (Buyer + Agent) ────────────────────────────────────────

class OrderTrackingTimelineView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            order = Order.objects.select_related(
                'user', 'user__assigned_agent'
            ).get(pk=pk)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        is_buyer = order.user == request.user
        is_agent = (
            order.user.assigned_agent is not None and
            order.user.assigned_agent == request.user
        )

        if not (is_buyer or is_agent):
            return Response(
                {'error': 'You do not have permission to view this order\'s tracking.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not order.tracking_number:
            return Response(
                {'timeline': [{
                    'timestamp': None,
                    'status':    'Processing',
                    'location':  '',
                    'message':   'No tracking number has been assigned yet.',
                }]},
                status=status.HTTP_200_OK,
            )

        timeline = get_bigship_tracking(order.tracking_number)
        return Response({'timeline': timeline}, status=status.HTTP_200_OK)