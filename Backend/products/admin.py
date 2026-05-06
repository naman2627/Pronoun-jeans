from django import forms
from django.contrib import admin
from django.utils.html import format_html
from .models import Category, Product, ProductVariation, ProductImage, Color


# ── Decimal widget override ───────────────────────────────────────────────────
# Forces ALL DecimalField widgets in admin to use max_digits=10, decimal_places=2
# and never pass through Python float — eliminates the 2676 → 2675.9 bug.

DECIMAL_FIELD_OVERRIDES = {
    forms.DecimalField: {
        'form_class': forms.DecimalField,
        'kwargs': {
            'max_digits':     10,
            'decimal_places': 2,
            'localize':       False,   # never use locale-based float parsing
        },
    },
}


# ── Color ─────────────────────────────────────────────────────────────────────

@admin.register(Color)
class ColorAdmin(admin.ModelAdmin):
    list_display  = ['swatch', 'name', 'hex_code', 'variation_count']
    search_fields = ['name', 'hex_code']
    ordering      = ['name']

    def swatch(self, obj):
        return format_html(
            '<div style="width:28px;height:28px;border-radius:6px;'
            'background:{};border:1px solid #ccc;display:inline-block;'
            'vertical-align:middle;"></div>',
            obj.hex_code,
        )
    swatch.short_description = ''

    def variation_count(self, obj):
        return obj.variations.count()
    variation_count.short_description = 'Variations'


# ── Category ──────────────────────────────────────────────────────────────────

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display        = ['name', 'slug', 'image']
    prepopulated_fields = {'slug': ('name',)}


# ── ProductImage inline ───────────────────────────────────────────────────────

class ProductImageInline(admin.TabularInline):
    model           = ProductImage
    extra           = 3
    fields          = ['image', 'alt_text', 'order', 'preview']
    readonly_fields = ['preview']
    ordering        = ['order', 'id']

    def preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="width:60px;height:60px;object-fit:cover;'
                'border-radius:6px;border:1px solid #ddd;" />',
                obj.image.url,
            )
        return '—'
    preview.short_description = 'Preview'


# ── ProductVariation inline ───────────────────────────────────────────────────

class ProductVariationInlineForm(forms.ModelForm):
    """
    Explicit ModelForm for the variation inline.
    Declaring b2b_price and mrp as forms.DecimalField ensures the admin
    never casts input through float — input string goes straight to Decimal.
    """
    b2b_price = forms.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=True,
        localize=False,
    )
    mrp = forms.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        localize=False,
    )

    class Meta:
        model  = ProductVariation
        fields = ['size', 'color', 'color_palette', 'sku',
                  'b2b_price', 'mrp', 'stock_quantity', 'image']


class ProductVariationInline(admin.TabularInline):
    model      = ProductVariation
    form       = ProductVariationInlineForm
    extra      = 1
    fields     = ['size', 'color', 'color_palette', 'sku',
                  'b2b_price', 'mrp', 'stock_quantity', 'image']


# ── Product ───────────────────────────────────────────────────────────────────

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display        = ['name', 'category', 'is_active', 'created_at']
    list_filter         = ['is_active', 'category']
    prepopulated_fields = {'slug': ('name',)}
    inlines             = [ProductImageInline, ProductVariationInline]


# ── ProductImage standalone ───────────────────────────────────────────────────

@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ['preview', 'product', 'alt_text', 'order']
    list_filter  = ['product']
    ordering     = ['product', 'order']

    def preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="width:50px;height:50px;object-fit:cover;'
                'border-radius:4px;border:1px solid #ddd;" />',
                obj.image.url,
            )
        return '—'
    preview.short_description = ''


# ── ProductVariation standalone ───────────────────────────────────────────────

class ProductVariationAdminForm(forms.ModelForm):
    b2b_price = forms.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=True,
        localize=False,
    )
    mrp = forms.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        localize=False,
    )

    class Meta:
        model  = ProductVariation
        fields = '__all__'


@admin.register(ProductVariation)
class ProductVariationAdmin(admin.ModelAdmin):
    form          = ProductVariationAdminForm
    list_display  = ['swatch', 'product', 'size', 'color', 'color_palette',
                     'sku', 'b2b_price', 'stock_quantity']
    list_filter   = ['color_palette', 'product']
    search_fields = ['sku', 'product__name', 'color']

    def swatch(self, obj):
        hex_code = obj.color_palette.hex_code if obj.color_palette else '#CCCCCC'
        return format_html(
            '<div style="width:20px;height:20px;border-radius:50%;'
            'background:{};border:1px solid #ccc;display:inline-block;"></div>',
            hex_code,
        )
    swatch.short_description = ''

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('product', 'color_palette')