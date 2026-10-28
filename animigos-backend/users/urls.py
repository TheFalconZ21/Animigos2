from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register_user, name='user-register'),
    path('login/', views.login_user, name='user-login'),
    path('logout/', views.logout_user, name='user-logout'),
    path('me/', views.get_current_user, name='user-me'),
    path('me/profile/', views.update_profile, name='user-profile-update'),
    path('me/preferences/', views.update_preferences, name='user-preferences-update'),
    # Mi Lista personal
    path('my-list/', views.user_my_list_view, name='user-my-list'),
    path('my-list/import-mal-xml/', views.import_mal_xml_view, name='user-my-list-import-mal-xml'),
    path('my-list/<uuid:entry_id>/', views.user_my_list_entry_detail_view, name='user-my-list-entry-detail'),
    path('my-list/folders/', views.user_my_list_folders_view, name='user-my-list-folders'),
    path('my-list/folders/<uuid:folder_id>/', views.user_my_list_folder_detail_view, name='user-my-list-folder-detail'),
    # Catálogo de Avatares Predefinidos
    path('preset-avatars/', views.get_preset_avatars, name='preset-avatars'),
    # Sistema de Amigos
    path('me/friends/', views.user_friends_view, name='user-friends'),
    path('me/friends/<int:friend_id>/', views.user_friends_view, name='user-friend-detail'),
    path('suggested-friends/', views.suggested_friends_view, name='user-suggested-friends'),
    # Perfiles Públicos, Recomendaciones Directas y Notificaciones
    path('public-profile/<str:username>/', views.public_user_profile_view, name='user-public-profile'),
    path('public-profile/<str:username>/recommend/', views.recommend_anime_to_user_view, name='user-recommend-anime'),
    path('me/notifications/', views.user_notifications_view, name='user-notifications'),
]
