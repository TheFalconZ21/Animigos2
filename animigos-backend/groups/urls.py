from rest_framework.routers import DefaultRouter
from .views import SharedListViewSet

router = DefaultRouter()
router.register(r'', SharedListViewSet, basename='group')

urlpatterns = router.urls
