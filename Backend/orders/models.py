from django.db import models
from django.conf import settings
from django.utils import timezone


class Coupon(models.Model):
    class DiscountType(models.TextChoices):
        PERCENTAGE   = 'percentage',   'Percentage'
        FIXED_AMOUNT = 'fixed_amount', 'Fixed Amount'

    code            = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type   = models.CharField(max_length=20, choices=DiscountType.choices, default=DiscountType.PERCENTAGE)
    discount_value  = models.DecimalField(max_digits=10, decimal_places=2)
    min_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active       = models.BooleanField(default=True)
    valid_from      = models.DateTimeField()
    valid_to        = models.DateTimeField()
    created_at      = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} ({self.get_discount_type_display()} — {self.discount_value})"

    def is_valid(self):
        now = timezone.now()
        return self.is_active and self.valid_from <= now <= self.valid_to

    def calculate_discount(self, cart_total):
        from decimal import Decimal
        if self.discount_type == self.DiscountType.PERCENTAGE:
            discount = (Decimal(str(self.discount_value)) / Decimal('100')) * cart_total
        else:
            discount = Decimal(str(self.discount_value))
        # Discount cannot exceed cart total
        return min(discount, cart_total).quantize(Decimal('0.01'))


class Cart(models.Model):
    user       = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cart')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cart({self.user.email})"


class CartItem(models.Model):
    cart      = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    variation = models.ForeignKey('products.ProductVariation', on_delete=models.CASCADE)
    quantity  = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('cart', 'variation')

    def __str__(self):
        return f"{self.variation.sku} x{self.quantity}"


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING   = 'PENDING',   'Pending'
        APPROVED  = 'APPROVED',  'Approved'
        SHIPPED   = 'SHIPPED',   'Shipped'
        DELIVERED = 'DELIVERED', 'Delivered'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class PaymentMethod(models.TextChoices):
        RAZORPAY      = 'razorpay',      'Razorpay'
        NET_30        = 'net_30',        'Net 30 Terms'
        BANK_TRANSFER = 'bank_transfer', 'Direct Bank Transfer'

    class PaymentStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PAID    = 'paid',    'Paid'
        FAILED  = 'failed',  'Failed'

    user             = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='orders')
    shipping_address = models.ForeignKey('accounts.Address', null=True, blank=True, on_delete=models.SET_NULL, related_name='shipping_orders')
    billing_address  = models.ForeignKey('accounts.Address', null=True, blank=True, on_delete=models.SET_NULL, related_name='billing_orders')
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    payment_method   = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.BANK_TRANSFER)
    payment_status   = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    total_amount     = models.DecimalField(max_digits=10, decimal_places=2)

    # Coupon / discount
    coupon          = models.ForeignKey(Coupon, null=True, blank=True, on_delete=models.SET_NULL, related_name='orders')
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Tracking fields
    courier_name    = models.CharField(max_length=100, null=True, blank=True)
    tracking_number = models.CharField(max_length=100, null=True, blank=True)
    tracking_url    = models.URLField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def grand_total(self):
        from decimal import Decimal
        return max(self.total_amount - Decimal(str(self.discount_amount)), Decimal('0'))

    def __str__(self):
        return f"Order#{self.pk} — {self.user.email} [{self.status}]"


class OrderItem(models.Model):
    order     = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    variation = models.ForeignKey('products.ProductVariation', on_delete=models.PROTECT)
    quantity  = models.PositiveIntegerField()
    price     = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.variation.sku} x{self.quantity} @ {self.price}"


class Commission(models.Model):
    class Status(models.TextChoices):
        PENDING = 'Pending', 'Pending'
        PAID    = 'Paid',    'Paid'

    agent                 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='commissions',
        limit_choices_to={'is_agent': True},
    )
    order                 = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='commission')
    commission_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    amount                = models.DecimalField(max_digits=10, decimal_places=2)
    status                = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at            = models.DateTimeField(auto_now_add=True)
    paid_at               = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Commission — {self.agent.email} | Order#{self.order.pk} | ₹{self.amount} [{self.status}]"


class SampleOrder(models.Model):
    design_number = models.CharField(max_length=100)
    rate          = models.DecimalField(max_digits=10, decimal_places=2)
    date          = models.DateField()
    buyer         = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sample_orders',
    )
    agent         = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_sample_orders',
        limit_choices_to={'is_agent': True},
    )
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"Sample D.No.{self.design_number} — {self.buyer.email} | ₹{self.rate}"