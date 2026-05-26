from decimal import Decimal
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.db.models import F, Sum


@receiver(post_save, sender='orders.Order')
def create_commission_on_delivered(sender, instance, created, **kwargs):
    """
    Commission is ONLY created when an order reaches DELIVERED status.
    Never fires on order creation or any other status change.
    """
    # Import here to avoid circular imports at module load time
    from .models import Order, Commission

    if instance.status != Order.Status.DELIVERED:
        return

    buyer = instance.user
    agent = getattr(buyer, 'assigned_agent', None)
    if not agent:
        return

    try:
        agent_profile = agent.agent_profile
    except Exception:
        return

    commission_pct = agent_profile.commission_percentage
    if commission_pct <= 0:
        return

    base_amount = instance.grand_total
    amount      = (Decimal(str(commission_pct)) / Decimal('100')) * base_amount

    _, created_now = Commission.objects.get_or_create(
        order=instance,
        defaults={
            'agent':                 agent,
            'commission_percentage': commission_pct,
            'amount':                amount.quantize(Decimal('0.01')),
            'status':                Commission.Status.PENDING,
        },
    )

    if created_now:
        _check_and_award_bonus(agent, agent_profile)


def _check_and_award_bonus(agent, agent_profile):
    """
    Award a flat ₹5,000 bonus if total delivered sales >= ₹5,00,000
    and bonus has not already been awarded.
    Bonus Commission has order=None to distinguish it from regular commissions.
    """
    from .models import Order, Commission

    BONUS_THRESHOLD = Decimal('500000.00')
    BONUS_AMOUNT    = Decimal('5000.00')

    # Check if bonus already awarded — identified by order=None + exact amount
    already_awarded = Commission.objects.filter(
        agent=agent,
        order__isnull=True,
        amount=BONUS_AMOUNT,
    ).exists()

    if already_awarded:
        return

    # Sum all delivered sales for this agent's buyers
    total_delivered = (
        Order.objects.filter(
            user__assigned_agent=agent,
            status=Order.Status.DELIVERED,
        ).aggregate(t=Sum('total_amount'))['t'] or Decimal('0')
    )

    if total_delivered >= BONUS_THRESHOLD:
        Commission.objects.create(
            agent                = agent,
            order                = None,
            commission_percentage= Decimal('0.00'),
            amount               = BONUS_AMOUNT,
            status               = Commission.Status.PENDING,
        )


# ── Stock management ──────────────────────────────────────────────────────────

@receiver(pre_save, sender='orders.Order')
def capture_previous_order_status(sender, instance, **kwargs):
    """Store previous status on the instance so post_save can detect transitions."""
    if instance.pk:
        try:
            instance._prev_status = (
                sender.objects.values_list('status', flat=True).get(pk=instance.pk)
            )
        except sender.DoesNotExist:
            instance._prev_status = None
    else:
        instance._prev_status = None


@receiver(post_save, sender='orders.Order')
def restore_stock_on_cancellation(sender, instance, created, **kwargs):
    """
    When an order transitions to CANCELLED, restore stock for all its items —
    but only if stock was actually decremented for this order.

    UPI orders: stock decremented at order creation → always restore.
    Razorpay orders: stock decremented only after payment verification
                     (payment_status=PAID) → restore only then.
    """
    if created:
        return

    prev = getattr(instance, '_prev_status', None)
    if prev == instance.status or instance.status != instance.Status.CANCELLED:
        return

    is_upi = instance.payment_method == instance.PaymentMethod.DIRECT_UPI
    is_razorpay_paid = (
        instance.payment_method == instance.PaymentMethod.RAZORPAY
        and instance.payment_status == instance.PaymentStatus.PAID
    )
    if not (is_upi or is_razorpay_paid):
        return

    from products.models import ProductVariation
    for item in instance.items.all():
        ProductVariation.objects.filter(pk=item.variation_id).update(
            stock_quantity=F('stock_quantity') + item.quantity
        )