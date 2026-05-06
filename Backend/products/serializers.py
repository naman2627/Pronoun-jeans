from rest_framework import serializers
from .models import Category, Product, ProductVariation, ProductImage


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = Category
        fields = ['id', 'name', 'slug', 'image']


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProductImage
        fields = ['id', 'image', 'alt_text', 'order']


class ProductVariationSerializer(serializers.ModelSerializer):
    # Alias — frontend uses set_price, DB stores b2b_price
    set_price         = serializers.DecimalField(source='b2b_price', max_digits=10, decimal_places=2, read_only=True)
    margin_percentage = serializers.SerializerMethodField()
    color_name        = serializers.SerializerMethodField()
    color_hex         = serializers.SerializerMethodField()

    class Meta:
        model  = ProductVariation
        fields = [
            'id', 'size', 'color', 'color_name', 'color_hex',
            'sku',
            # Pricing
            'set_price',        # alias of b2b_price — total set price
            'b2b_price',        # kept for cart/order backward compatibility
            'per_piece_price',  # wholesale price per piece
            'mrp',              # MRP for full set
            'mrp_per_piece',    # MRP per individual piece
            'margin_percentage',
            'stock_quantity', 'image',
        ]

    def get_margin_percentage(self, obj):
        """Margin based on per_piece_price vs mrp_per_piece when available,
        otherwise falls back to set_price vs mrp."""
        try:
            if obj.per_piece_price and obj.mrp_per_piece and obj.mrp_per_piece > 0:
                margin = ((obj.mrp_per_piece - obj.per_piece_price) / obj.mrp_per_piece) * 100
            elif obj.mrp and obj.mrp > 0:
                margin = ((obj.mrp - obj.b2b_price) / obj.mrp) * 100
            else:
                return 0
            return round(float(margin), 1)
        except Exception:
            return 0

    def get_color_name(self, obj):
        if obj.color_palette:
            return obj.color_palette.name
        return obj.color or ''

    def get_color_hex(self, obj):
        if obj.color_palette:
            return obj.color_palette.hex_code
        return '#CCCCCC'


class ProductSerializer(serializers.ModelSerializer):
    variations     = ProductVariationSerializer(many=True, read_only=True)
    category_name  = serializers.CharField(source='category.name', read_only=True)
    gallery_images = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model  = Product
        fields = [
            'id', 'name', 'slug', 'description', 'fabric_details',
            'category', 'category_name', 'is_active', 'moq',
            'image', 'created_at', 'variations', 'gallery_images',
        ]