from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ProductViewSet, hero_slides

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"catalog",    ProductViewSet,  basename="product")

urlpatterns = [
    path("", include(router.urls)),
    path("hero-slides/", hero_slides, name="hero-slides"),
]