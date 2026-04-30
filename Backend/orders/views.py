from decimal import Decimal
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Sum

from .models import Cart, CartItem, Order, OrderItem, Commission, SampleOrder
from products.models import Product, ProductVariation
from accounts.models import Address
from accounts.views import IsAgent
from .serializers import (
    CartSerializer, OrderSerializer, CommissionSerializer, SampleOrderSerializer,
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

        total_quantity = sum(int(item.get('quantity', 0)) for item in items if int(item.get('quantity', 0)) > 0)

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


# ── Checkout ──────────────────────────────────────────────────────────────────

class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        shipping_address_id = request.data.get('shipping_address_id')
        billing_address_id  = request.data.get('billing_address_id')
        payment_method      = request.data.get('payment_method', Order.PaymentMethod.BANK_TRANSFER)

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

        order = Order.objects.create(
            user             = request.user,
            shipping_address = shipping_address,
            billing_address  = billing_address,
            payment_method   = payment_method,
            payment_status   = Order.PaymentStatus.PENDING,
            total_amount     = total_amount,
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
    """Returns all commission records for the logged-in agent."""
    permission_classes = [IsAgent]
    serializer_class   = CommissionSerializer

    def get_queryset(self):
        return Commission.objects.filter(
            agent=self.request.user
        ).select_related(
            'order', 'order__user', 'agent'
        ).order_by('-created_at')


class AgentLedgerSummaryView(APIView):
    """Returns total earned, total paid, and balance due for the logged-in agent."""
    permission_classes = [IsAgent]

    def get(self, request):
        qs = Commission.objects.filter(agent=request.user)

        total_earned = qs.aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        total_paid   = qs.filter(status=Commission.Status.PAID).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        balance_due  = qs.filter(status=Commission.Status.PENDING).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')

        return Response({
            'total_earned': str(total_earned),
            'total_paid':   str(total_paid),
            'balance_due':  str(balance_due),
        })


# ── Agent: Sample Orders (List + Create) ──────────────────────────────────────

class AgentSampleOrdersListView(generics.ListCreateAPIView):
    """
    GET  — returns all sample orders for the logged-in agent's buyers.
    POST — creates a new sample order; agent is injected automatically.
    """
    permission_classes = [IsAgent]
    serializer_class   = SampleOrderSerializer

    def get_queryset(self):
        return SampleOrder.objects.filter(
            agent=self.request.user
        ).select_related('buyer', 'agent').order_by('-date')

    def perform_create(self, serializer):
        # Agent is always the logged-in user — never taken from payload
        serializer.save(agent=self.request.user)


# ── Agent: Buyer Orders ───────────────────────────────────────────────────────

class AgentOrdersListView(generics.ListAPIView):
    """Returns all orders placed by buyers assigned to the logged-in agent."""
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