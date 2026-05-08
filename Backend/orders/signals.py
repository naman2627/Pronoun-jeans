from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Sum


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