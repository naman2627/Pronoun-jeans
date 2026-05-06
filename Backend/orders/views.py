import razorpay
import hmac
import hashlib
from decimal import Decimal
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
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
    SampleOrderSerializer, OrderTrackingUpdateSerializer, CouponSerializer,
)


def get_razorpay_client():
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
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


# ── Coupons ───────────────────────────────────────────────────────────────────

class ActiveCouponsListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = CouponSerializer

    def get_queryset(self):
        now = timezone.now()
        return Coupon.objects.filter(
            is_active=True,
            valid_from__lte=now,
            valid_to__gte=now,
        ).order_by('min_order_value')


class ApplyCouponView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        coupon_code = request.data.get('coupon_code', '').strip().upper()

        if not coupon_code:
            return Response({'error': 'Please enter a coupon code.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            coupon = Coupon.objects.get(code=coupon_code)
        except Coupon.DoesNotExist:
            return Response({'error': 'Invalid coupon code.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if not coupon.is_active:
            return Response({'error': 'This coupon is no longer active.'}, status=status.HTTP_400_BAD_REQUEST)
        if now < coupon.valid_from:
            return Response({'error': 'This coupon is not yet valid.'}, status=status.HTTP_400_BAD_REQUEST)
        if now > coupon.valid_to:
            return Response({'error': 'This coupon has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cart = Cart.objects.prefetch_related('items__variation').get(user=request.user)
        except Cart.DoesNotExist:
            return Response({'error': 'Your cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        items = cart.items.all()
        if not items.exists():
            return Response({'error': 'Your cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        cart_total = sum(item.quantity * item.variation.b2b_price for item in items)

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


# ── Razorpay ──────────────────────────────────────────────────────────────────

class RazorpayCreateOrderView(APIView):
    """
    POST /api/orders/razorpay/create/
    Creates a Razorpay order and a pending Django Order.
    Returns razorpay_order_id and key_id to the frontend.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        shipping_address_id = request.data.get('shipping_address_id')
        billing_address_id  = request.data.get('billing_address_id')
        coupon_code         = request.data.get('coupon_code', '').strip().upper()

        # Validate addresses
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

        # Validate cart
        try:
            cart = Cart.objects.prefetch_related('items__variation__product').get(user=request.user)
        except Cart.DoesNotExist:
            return Response({'error': 'Cart not found.'}, status=status.HTTP_400_BAD_REQUEST)

        cart_items = cart.items.all()
        if not cart_items.exists():
            return Response({'error': 'Cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        total_amount    = sum(item.quantity * item.variation.b2b_price for item in cart_items)
        coupon          = None
        discount_amount = Decimal('0.00')

        if coupon_code:
            try:
                coupon = Coupon.objects.get(code=coupon_code)
                now    = timezone.now()
                if coupon.is_active and coupon.valid_from <= now <= coupon.valid_to and total_amount >= coupon.min_order_value:
                    discount_amount = coupon.calculate_discount(total_amount)
                else:
                    coupon = None
            except Coupon.DoesNotExist:
                coupon = None

        grand_total = total_amount - discount_amount

        # Create Razorpay order (amount in paise)
        try:
            client           = get_razorpay_client()
            razorpay_amount  = int(grand_total * 100)  # paise
            razorpay_order   = client.order.create({
                'amount':   razorpay_amount,
                'currency': 'INR',
                'payment_capture': 1,  # auto-capture
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to create Razorpay order: {str(e)}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Create Django Order (pending until payment verified)
        django_order = Order.objects.create(
            user                = request.user,
            shipping_address    = shipping_address,
            billing_address     = billing_address,
            payment_method      = Order.PaymentMethod.RAZORPAY,
            payment_status      = Order.PaymentStatus.PENDING,
            total_amount        = total_amount,
            coupon              = coupon,
            discount_amount     = discount_amount,
            status              = Order.Status.PENDING,
            razorpay_order_id   = razorpay_order['id'],
        )

        OrderItem.objects.bulk_create([
            OrderItem(
                order     = django_order,
                variation = item.variation,
                quantity  = item.quantity,
                price     = item.variation.b2b_price,
            )
            for item in cart_items
        ])

        return Response({
            'razorpay_order_id': razorpay_order['id'],
            'amount':            razorpay_amount,
            'currency':          'INR',
            'key_id':            settings.RAZORPAY_KEY_ID,
            'django_order_id':   django_order.id,
            'name':              request.user.company_name or request.user.email,
            'email':             request.user.email,
            'contact':           getattr(request.user, 'phone_number', '') or '',
        }, status=status.HTTP_201_CREATED)


class RazorpayVerifyPaymentView(APIView):
    """
    POST /api/orders/razorpay/verify/
    Verifies the Razorpay payment signature, marks the order as Paid,
    and clears the user's cart.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        razorpay_order_id   = request.data.get('razorpay_order_id', '')
        razorpay_payment_id = request.data.get('razorpay_payment_id', '')
        razorpay_signature  = request.data.get('razorpay_signature', '')

        if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
            return Response(
                {'error': 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify signature using HMAC-SHA256
        try:
            client = get_razorpay_client()
            client.utility.verify_payment_signature({
                'razorpay_order_id':   razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature':  razorpay_signature,
            })
        except razorpay.errors.SignatureVerificationError:
            return Response(
                {'error': 'Payment signature verification failed. Please contact support.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {'error': f'Verification error: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fetch and update the Django order
        try:
            order = Order.objects.get(
                razorpay_order_id=razorpay_order_id,
                user=request.user,
            )
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        order.razorpay_payment_id = razorpay_payment_id
        order.razorpay_signature  = razorpay_signature
        order.payment_status      = Order.PaymentStatus.PAID
        order.status              = Order.Status.APPROVED
        order.save(update_fields=[
            'razorpay_payment_id', 'razorpay_signature',
            'payment_status', 'status',
        ])

        # Clear cart
        try:
            cart = Cart.objects.get(user=request.user)
            cart.items.all().delete()
        except Cart.DoesNotExist:
            pass

        return Response({
            'message':  'Payment verified successfully.',
            'order_id': order.id,
        }, status=status.HTTP_200_OK)


# ── Checkout (non-Razorpay) ───────────────────────────────────────────────────

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

        # Block Razorpay from using this endpoint — it has its own flow
        if payment_method == Order.PaymentMethod.RAZORPAY:
            return Response(
                {'error': 'For Razorpay payments, use /api/orders/razorpay/create/'},
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

        total_amount    = sum(item.quantity * item.variation.b2b_price for item in items)
        coupon          = None
        discount_amount = Decimal('0.00')

        if coupon_code:
            try:
                coupon = Coupon.objects.get(code=coupon_code)
                now    = timezone.now()
                if coupon.is_active and coupon.valid_from <= now <= coupon.valid_to and total_amount >= coupon.min_order_value:
                    discount_amount = coupon.calculate_discount(total_amount)
                else:
                    coupon = None
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