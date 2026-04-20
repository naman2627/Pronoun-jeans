# Backend/orders/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from .models import Cart, CartItem, Order, OrderItem
from products.models import ProductVariation
from .serializers import CartSerializer, OrderSerializer


class CartDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        serializer = CartSerializer(cart)
        return Response(serializer.data)


class CartItemUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        variation_id = request.data.get('variation_id')
        quantity = request.data.get('quantity')

        if variation_id is None or quantity is None:
            return Response(
                {'error': 'variation_id and quantity are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            quantity = int(quantity)
            variation = ProductVariation.objects.select_related('product').get(pk=variation_id)
        except (ValueError, ProductVariation.DoesNotExist):
            return Response({'error': 'Invalid variation_id.'}, status=status.HTTP_400_BAD_REQUEST)

        cart, _ = Cart.objects.get_or_create(user=request.user)

        if quantity == 0:
            CartItem.objects.filter(cart=cart, variation=variation).delete()
            return Response({'message': 'Item removed from cart.'}, status=status.HTTP_200_OK)

        if quantity < variation.product.moq:
            return Response(
                {'error': f'Quantity must be >= MOQ ({variation.product.moq}) for this product.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        cart_item, created = CartItem.objects.update_or_create(
            cart=cart,
            variation=variation,
            defaults={'quantity': quantity}
        )

        return Response(
            CartSerializer(cart).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        try:
            cart = Cart.objects.prefetch_related(
                'items__variation__product'
            ).get(user=request.user)
        except Cart.DoesNotExist:
            return Response({'error': 'Cart not found.'}, status=status.HTTP_400_BAD_REQUEST)

        items = cart.items.all()
        if not items.exists():
            return Response({'error': 'Cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        total_amount = sum(item.quantity * item.variation.b2b_price for item in items)

        order = Order.objects.create(
            user=request.user,
            total_amount=total_amount,
            status=Order.Status.PENDING
        )

        OrderItem.objects.bulk_create([
            OrderItem(
                order=order,
                variation=item.variation,
                quantity=item.quantity,
                price=item.variation.b2b_price
            )
            for item in items
        ])

        cart.items.all().delete()

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(
            user=request.user
        ).prefetch_related('items__variation__product').order_by('-created_at')
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)