from rest_framework.routers import DefaultRouter
from .views import AnimeViewSet

router = DefaultRouter()
router.register(r'', AnimeViewSet, basename='anime')

urlpatterns = router.urls
