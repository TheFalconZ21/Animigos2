from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register_user, name='user-register'),
    path('login/', views.login_user, name='user-login'),
    path('logout/', views.logout_user, name='user-logout'),
    path('me/', views.get_current_user, name='user-me'),
    path('me/profile/', views.update_profile, name='user-profile-update'),
    path('me/preferences/', views.update_preferences, name='user-preferences-update'),
]
