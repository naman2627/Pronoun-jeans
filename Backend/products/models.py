from decimal import Decimal, ROUND_HALF_UP
from django.db import models


class Category(models.Model):
    name  = models.CharField(max_length=255)
    slug  = models.SlugField(unique=True, max_length=255)
    image = models.ImageField(upload_to='categories/', null=True, blank=True)

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    category       = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name="products")
    name           = models.CharField(max_length=255)
    slug           = models.SlugField(unique=True, max_length=255)
    description    = models.TextField(blank=True)
    fabric_details = models.TextField(blank=True, null=True)
    is_active      = models.BooleanField(default=True)
    moq            = models.PositiveIntegerField(default=10, help_text="Minimum Order Quantity for B2B clients")
    image          = models.ImageField(upload_to='products/', blank=True, null=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    """Secondary gallery images for a product."""
    product  = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='gallery_images')
    image    = models.ImageField(upload_to='products/gallery/')
    alt_text = models.CharField(max_length=255, blank=True)
    order    = models.PositiveSmallIntegerField(default=0, help_text='Display order (lower = first)')

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"Gallery image for {self.product.name} (#{self.pk})"


class Color(models.Model):
    name     = models.CharField(max_length=100, unique=True)
    hex_code = models.CharField(max_length=7, default='#CCCCCC',
                                help_text='CSS hex color, e.g. #1A2B3C')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.hex_code})"


class ProductVariation(models.Model):
    product        = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variations")
    size           = models.CharField(max_length=50)

    # Legacy plain-text color — auto-synced from color_palette on save
    color          = models.CharField(max_length=100, blank=True, null=True)

    # Structured color FK
    color_palette  = models.ForeignKey(
        Color,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='variations',
    )

    sku            = models.CharField(max_length=100, unique=True)

    # Prices — always stored and handled as Decimal, never float
    b2b_price      = models.DecimalField(max_digits=10, decimal_places=2)
    mrp            = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    stock_quantity = models.PositiveIntegerField(default=0)
    image          = models.ImageField(upload_to='variations/', null=True, blank=True)

    class Meta:
        unique_together = ("product", "size", "color")
        verbose_name    = "Product Variation"

    def save(self, *args, **kwargs):
        # ── Decimal safety: ensure prices are always exact Decimal values ──
        # This guards against any caller passing a float (e.g. from JSON)
        if self.b2b_price is not None and not isinstance(self.b2b_price, Decimal):
            self.b2b_price = Decimal(str(self.b2b_price)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if self.mrp is not None and not isinstance(self.mrp, Decimal):
            self.mrp = Decimal(str(self.mrp)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # ── Color sync: copy color_palette.name → color CharField ──
        if self.color_palette_id:
            # Try the already-loaded relation first (avoids extra query)
            palette = self.__dict__.get('color_palette')
            if palette is not None:
                self.color = palette.name
            else:
                # Fresh admin form save — relation not in cache, fetch name only
                color_name = Color.objects.filter(
                    pk=self.color_palette_id
                ).values_list('name', flat=True).first()
                if color_name:
                    self.color = color_name

        super().save(*args, **kwargs)

    def __str__(self):
        # Safe __str__ that never triggers an extra query
        product_name = (
            self.__dict__['product'].name
            if 'product' in self.__dict__
            else f"SKU {self.sku}"
        )
        color_label = (
            self.color
            or (self.__dict__.get('color_palette') and self.__dict__['color_palette'].name)
            or '—'
        )
        return f"{product_name} | {self.size} | {color_label}"