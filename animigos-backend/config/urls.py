from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse
from django.conf import settings
from django.views.static import serve
from core.views import NewsView

def api_root_view(request):
    return JsonResponse({
        "project": "Animigos API",
        "version": "1.0.0",
        "status": "healthy",
        "endpoints": {
            "admin": "/admin/",
            "animes": "/api/animes/",
            "top_animes": "/api/animes/top/",
            "studios": "/api/animes/studios/",
            "schedule": "/api/animes/schedule/",
            "upcoming": "/api/animes/upcoming/",
            "news": "/api/news/",
            "groups": "/api/groups/",
            "group_by_code": "/api/groups/by_code/?code=XYZ",
            "users": "/api/users/",
        }
    })

urlpatterns = [
    path('', api_root_view, name='api-root'),
    path('admin/', admin.site.urls),
    # Prefijo estándar /api/
    path('api/animes/', include('animes.urls')),
    path('api/groups/', include('groups.urls')),
    path('api/admin/', include('groups.admin_urls')),
    path('api/users/', include('users.urls')),
    path('api/news/', NewsView.as_view(), name='news'),
    # Respaldo directo sin /api/
    path('animes/', include('animes.urls')),
    path('groups/', include('groups.urls')),
    path('users/', include('users.urls')),
    path('news/', NewsView.as_view(), name='news-fallback'),
    # Servir archivos multimedia (avatares, uploads) tanto en desarrollo como en producción
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
