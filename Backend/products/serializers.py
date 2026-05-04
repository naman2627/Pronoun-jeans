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
    margin_percentage = serializers.SerializerMethodField()
    color_name        = serializers.SerializerMethodField()
    color_hex         = serializers.SerializerMethodField()

    class Meta:
        model  = ProductVariation
        fields = [
            'id', 'size', 'color', 'color_name', 'color_hex',
            'sku', 'b2b_price', 'mrp', 'margin_percentage',
            'stock_quantity', 'image',
        ]

    def get_margin_percentage(self, obj):
        if not obj.mrp or obj.mrp == 0:
            return 0
        try:
            margin = ((obj.mrp - obj.b2b_price) / obj.mrp) * 100
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