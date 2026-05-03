from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Order, Commission


@receiver(post_save, sender=Order)
def create_commission_on_order(sender, instance, created, **kwargs):
    """
    Auto-create a Commission record when an order is placed.
    Commission is calculated on the grand_total (after discount),
    not the raw total_amount, so agents earn on what the buyer actually pays.
    """
    if not created:
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

    if hasattr(instance, 'commission'):
        return

    # Use grand_total (after coupon discount) as commission base
    base_amount = instance.grand_total

    amount = (Decimal(str(commission_pct)) / Decimal('100')) * base_amount

    Commission.objects.get_or_create(
        order=instance,
        defaults={
            'agent':                 agent,
            'commission_percentage': commission_pct,
            'amount':                amount.quantize(Decimal('0.01')),
            'status':                Commission.Status.PENDING,
        },
    )