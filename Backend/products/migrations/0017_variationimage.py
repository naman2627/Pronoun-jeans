from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0016_add_sizeset_sizesetbreakdown'),
    ]

    operations = [
        migrations.CreateModel(
            name='VariationImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(upload_to='variations/gallery/')),
                ('alt_text', models.CharField(blank=True, max_length=255)),
                ('order', models.PositiveSmallIntegerField(default=0)),
                ('variation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='gallery_images', to='products.productvariation')),
            ],
            options={
                'ordering': ['order', 'id'],
            },
        ),
    ]
