import razorpay
from decimal import Decimal, ROUND_HALF_UP
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
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_address(address_id, user):
    if not address_id:
        return None
    try:
        return Address.objects.get(pk=address_id, user=user)
    except Address.DoesNotExist:
        return None


def _compute_cart_total(cart_items):
    return sum(
        Decimal(str(item.quantity)) * item.variation.b2b_price
        for item in cart_items
    )


def _apply_coupon(coupon_code, total_amount):
    """Returns (coupon_obj_or_None, discount_amount)."""
    if not coupon_code:
        return None, Decimal('0.00')
    try:
        coupon = Coupon.objects.get(code=coupon_code.strip().upper())
        now    = timezone.now()
        if (coupon.is_active
                and coupon.valid_from <= now <= coupon.valid_to
                and total_amount >= coupon.min_order_value):
            return coupon, coupon.calculate_discount(total_amount)
    except Coupon.DoesNotExist:
        pass
    return None, Decimal('0.00')


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
            return Response({'error': 'product_id and items array are required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        total_quantity = sum(int(i.get('quantity', 0)) for i in items if int(i.get('quantity', 0)) > 0)
        if total_quantity == 0:
            return Response({'error': 'No valid quantities provided.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        if total_quantity < product.moq:
            return Response({'error': f'Total quantity ({total_quantity}) must be >= MOQ ({product.moq}).'},
                            status=status.HTTP_400_BAD_REQUEST)

        cart, _ = Cart.objects.get_or_create(user=request.user)
        for item in items:
            qty = int(item.get('quantity', 0))
            if qty > 0:
                try:
                    variation = ProductVariation.objects.get(pk=item.get('variation_id'), product=product)
                    CartItem.objects.update_or_create(
                        cart=cart, variation=variation, defaults={'quantity': qty}
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
            is_active=True, valid_from__lte=now, valid_to__gte=now,
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

        cart_total      = _compute_cart_total(items)
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
        })


# ── Direct UPI Checkout ───────────────────────────────────────────────────────

class DirectUPICheckoutView(APIView):
    """
    POST /api/orders/upi/checkout/

    Payload:
        shipping_address_id  int
        billing_address_id   int
        payment_plan         'advance' | 'full'
        utr_number           str   (buyer's UPI transaction reference)
        coupon_code          str   (optional)

    Backend recalculates everything — never trusts frontend amounts.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        payment_plan        = request.data.get('payment_plan', '').strip()
        utr_number          = request.data.get('utr_number', '').strip()
        shipping_address_id = request.data.get('shipping_address_id')
        billing_address_id  = request.data.get('billing_address_id')
        coupon_code         = request.data.get('coupon_code', '')

        # ── Validate payment_plan ──
        if payment_plan not in ('advance', 'full'):
            return Response({'error': "payment_plan must be 'advance' or 'full'."},
                            status=status.HTTP_400_BAD_REQUEST)

        # ── Validate UTR ──
        if not utr_number:
            return Response({'error': 'Please enter your UPI Transaction Reference ID (UTR).'},
                            status=status.HTTP_400_BAD_REQUEST)

        # ── Resolve addresses ──
        shipping_address = _resolve_address(shipping_address_id, request.user)
        billing_address  = _resolve_address(billing_address_id,  request.user)

        if not shipping_address:
            return Response({'error': 'Please select a shipping address.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not billing_address:
            return Response({'error': 'Please select a billing address.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # ── Validate cart ──
        try:
            cart = Cart.objects.prefetch_related('items__variation__product').get(user=request.user)
        except Cart.DoesNotExist:
            return Response({'error': 'Cart not found.'}, status=status.HTTP_400_BAD_REQUEST)

        cart_items = cart.items.all()
        if not cart_items.exists():
            return Response({'error': 'Cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        # ── Compute totals (all Decimal, no float) ──
        total_amount    = _compute_cart_total(cart_items)
        coupon, coupon_discount = _apply_coupon(coupon_code, total_amount)

        # Subtotal after coupon
        subtotal = (total_amount - coupon_discount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Extra 1% discount for full payment
        if payment_plan == 'full':
            upi_discount = (subtotal * Decimal('0.01')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        else:
            upi_discount = Decimal('0.00')

        grand_total = (subtotal - upi_discount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Amount paid now & balance due
        if payment_plan == 'advance':
            amount_paid = (grand_total * Decimal('0.10')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            balance_due = (grand_total - amount_paid).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            payment_status_val = Order.PaymentStatus.PARTIAL
        else:  # full
            amount_paid = grand_total
            balance_due = Decimal('0.00')
            payment_status_val = Order.PaymentStatus.PENDING  # pending until admin verifies

        # ── Create Order ──
        order = Order.objects.create(
            user             = request.user,
            shipping_address = shipping_address,
            billing_address  = billing_address,
            payment_method   = Order.PaymentMethod.DIRECT_UPI,
            payment_status   = payment_status_val,
            status           = Order.Status.PENDING_VERIFICATION,
            total_amount     = total_amount,
            coupon           = coupon,
            discount_amount  = coupon_discount,
            payment_plan     = payment_plan,
            upi_discount     = upi_discount,
            amount_paid      = amount_paid,
            balance_due      = balance_due,
            utr_number       = utr_number,
            payment_verified = False,
        )

        OrderItem.objects.bulk_create([
            OrderItem(
                order     = order,
                variation = item.variation,
                quantity  = item.quantity,
                price     = item.variation.b2b_price,
            )
            for item in cart_items
        ])

        # Clear cart
        cart.items.all().delete()

        return Response({
            'order_id':    order.id,
            'grand_total': str(grand_total),
            'amount_paid': str(amount_paid),
            'balance_due': str(balance_due),
            'upi_discount': str(upi_discount),
            'message':     'Order placed. Pending payment verification.',
        }, status=status.HTTP_201_CREATED)


# ── Razorpay ──────────────────────────────────────────────────────────────────

class RazorpayCreateOrderView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        shipping_address_id = request.data.get('shipping_address_id')
        billing_address_id  = request.data.get('billing_address_id')
        coupon_code         = request.data.get('coupon_code', '')

        shipping_address = _resolve_address(shipping_address_id, request.user)
        billing_address  = _resolve_address(billing_address_id,  request.user)

        if not shipping_address:
            return Response({'error': 'Shipping address not found.'}, status=status.HTTP_400_BAD_REQUEST)
        if not billing_address:
            return Response({'error': 'Billing address not found.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cart = Cart.objects.prefetch_related('items__variation__product').get(user=request.user)
        except Cart.DoesNotExist:
            return Response({'error': 'Cart not found.'}, status=status.HTTP_400_BAD_REQUEST)

        cart_items = cart.items.all()
        if not cart_items.exists():
            return Response({'error': 'Cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        total_amount            = _compute_cart_total(cart_items)
        coupon, discount_amount = _apply_coupon(coupon_code, total_amount)
        grand_total             = (total_amount - discount_amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        try:
            client         = get_razorpay_client()
            razorpay_order = client.order.create({
                'amount':          int(grand_total * 100),
                'currency':        'INR',
                'payment_capture': 1,
            })
        except Exception as e:
            return Response({'error': f'Failed to create Razorpay order: {str(e)}'},
                            status=status.HTTP_502_BAD_GATEWAY)

        django_order = Order.objects.create(
            user              = request.user,
            shipping_address  = shipping_address,
            billing_address   = billing_address,
            payment_method    = Order.PaymentMethod.RAZORPAY,
            payment_status    = Order.PaymentStatus.PENDING,
            total_amount      = total_amount,
            coupon            = coupon,
            discount_amount   = discount_amount,
            status            = Order.Status.PENDING,
            razorpay_order_id = razorpay_order['id'],
        )

        OrderItem.objects.bulk_create([
            OrderItem(order=django_order, variation=item.variation,
                      quantity=item.quantity, price=item.variation.b2b_price)
            for item in cart_items
        ])

        return Response({
            'razorpay_order_id': razorpay_order['id'],
            'amount':            int(grand_total * 100),
            'currency':          'INR',
            'key_id':            settings.RAZORPAY_KEY_ID,
            'django_order_id':   django_order.id,
            'name':              getattr(request.user, 'company_name', '') or request.user.email,
            'email':             request.user.email,
            'contact':           getattr(request.user, 'phone_number', '') or '',
        }, status=status.HTTP_201_CREATED)


class RazorpayVerifyPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        razorpay_order_id   = request.data.get('razorpay_order_id', '')
        razorpay_payment_id = request.data.get('razorpay_payment_id', '')
        razorpay_signature  = request.data.get('razorpay_signature', '')

        if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
            return Response({'error': 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            client = get_razorpay_client()
            client.utility.verify_payment_signature({
                'razorpay_order_id':   razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature':  razorpay_signature,
            })
        except razorpay.errors.SignatureVerificationError:
            return Response({'error': 'Payment signature verification failed.'},
                            status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Verification error: {str(e)}'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.get(razorpay_order_id=razorpay_order_id, user=request.user)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        order.razorpay_payment_id = razorpay_payment_id
        order.razorpay_signature  = razorpay_signature
        order.payment_status      = Order.PaymentStatus.PAID
        order.status              = Order.Status.APPROVED
        order.save(update_fields=['razorpay_payment_id', 'razorpay_signature', 'payment_status', 'status'])

        try:
            Cart.objects.get(user=request.user).items.all().delete()
        except Cart.DoesNotExist:
            pass

        return Response({'message': 'Payment verified.', 'order_id': order.id})


# ── Checkout (kept for any future non-Razorpay/non-UPI use) ──────────────────

class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        return Response(
            {'error': 'Use /api/orders/upi/checkout/ for Direct UPI or /api/orders/razorpay/create/ for Razorpay.'},
            status=status.HTTP_400_BAD_REQUEST,
        )


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
    permission_classes = [IsAuthenticated]
    serializer_class   = CommissionSerializer

    def get_queryset(self):
        return Commission.objects.filter(
            agent=self.request.user
        ).select_related('order', 'order__user', 'agent').order_by('-created_at')


class AgentLedgerSummaryView(APIView):
    permission_classes = [IsAuthenticated]

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
    permission_classes = [IsAuthenticated]
    serializer_class   = SampleOrderSerializer

    def get_queryset(self):
        return SampleOrder.objects.filter(
            agent=self.request.user
        ).select_related('buyer', 'agent').order_by('-date')

    def perform_create(self, serializer):
        serializer.save(agent=self.request.user)


# ── Agent: Buyer Orders ───────────────────────────────────────────────────────

class AgentOrdersListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = OrderSerializer

    def get_queryset(self):
        return Order.objects.filter(
            user__assigned_agent=self.request.user
        ).select_related('user', 'shipping_address', 'billing_address').prefetch_related(
            'items__variation__product'
        ).order_by('-created_at')


# ── Agent: Order Tracking Update ──────────────────────────────────────────────

class AgentOrderTrackingUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = OrderTrackingUpdateSerializer
    http_method_names  = ['patch']

    def get_queryset(self):
        return Order.objects.filter(user__assigned_agent=self.request.user)


# ── Tracking Timeline ─────────────────────────────────────────────────────────

class OrderTrackingTimelineView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            order = Order.objects.select_related('user', 'user__assigned_agent').get(pk=pk)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        is_buyer = order.user == request.user
        is_agent = (
            order.user.assigned_agent is not None and
            order.user.assigned_agent == request.user
        )
        if not (is_buyer or is_agent):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        if not order.tracking_number:
            return Response({'timeline': [{
                'timestamp': None, 'status': 'Processing',
                'location': '', 'message': 'No tracking number assigned yet.',
            }]})

        timeline = get_bigship_tracking(order.tracking_number)
        return Response({'timeline': timeline})