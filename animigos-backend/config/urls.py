"""
URL configuration for Animigos backend.
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

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
            "groups": "/api/groups/",
            "group_by_code": "/api/groups/by_code/?code=XYZ",
            "users": "/api/users/",
        }
    })

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('', api_root_view, name='api-root'),
    path('admin/', admin.site.urls),
    path('api/animes/', include('animes.urls')),
    path('api/groups/', include('groups.urls')),
    path('api/admin/', include('groups.admin_urls')),
    path('api/users/', include('users.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

