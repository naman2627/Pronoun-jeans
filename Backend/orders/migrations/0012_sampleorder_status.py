from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0011_alter_cartitem_variation_set_null'),
    ]

    operations = [
        migrations.AddField(
            model_name='sampleorder',
            name='status',
            field=models.CharField(
                choices=[
                    ('PENDING',    'Pending'),
                    ('CONFIRMED',  'Confirmed'),
                    ('DISPATCHED', 'Dispatched'),
                    ('COMPLETED',  'Completed'),
                    ('CANCELLED',  'Cancelled'),
                ],
                default='PENDING',
                max_length=15,
            ),
        ),
    ]
