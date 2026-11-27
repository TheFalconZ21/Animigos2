from django.urls import path
from . import views, sync_views, ranking_views, report_views, google_auth_views, feed_views, character_fav_views

urlpatterns = [
    path('register/', views.register_user, name='user-register'),
    path('login/', views.login_user, name='user-login'),
    path('logout/', views.logout_user, name='user-logout'),
    path('auth/google/', google_auth_views.google_auth_view, name='user-auth-google'),
    path('geo/', google_auth_views.detect_user_geo_view, name='user-geo'),
    path('me/demographics/', google_auth_views.update_demographics_view, name='user-demographics-update'),
    path('me/', views.get_current_user, name='user-me'),
    path('me/profile/', views.update_profile, name='user-profile-update'),
    path('me/preferences/', views.update_preferences, name='user-preferences-update'),
    # Mi Lista personal y Agenda de tareas
    path('my-list/', views.user_my_list_view, name='user-my-list'),
    path('agenda/', views.user_agenda_view, name='user-agenda'),
    path('my-list/import-mal-xml/', views.import_mal_xml_view, name='user-my-list-import-mal-xml'),
    path('my-list/import-netflix-csv/', sync_views.import_netflix_csv_view, name='user-my-list-import-netflix-csv'),
    path('my-list/<uuid:entry_id>/', views.user_my_list_entry_detail_view, name='user-my-list-entry-detail'),
    path('my-list/folders/', views.user_my_list_folders_view, name='user-my-list-folders'),
    path('my-list/folders/<uuid:folder_id>/', views.user_my_list_folder_detail_view, name='user-my-list-folder-detail'),
    # Integraciones Externas y Auto-Tracking (MAL, AniList, Extensión Crunchyroll/Netflix)
    path('integrations/status/', sync_views.integrations_status_view, name='user-integrations-status'),
    path('integrations/mal/connect/', sync_views.mal_connect_view, name='user-integrations-mal-connect'),
    path('integrations/mal/callback/', sync_views.mal_callback_view, name='user-integrations-mal-callback'),
    path('integrations/mal/sync/', sync_views.mal_sync_view, name='user-integrations-mal-sync'),
    path('integrations/mal/disconnect/', sync_views.mal_disconnect_view, name='user-integrations-mal-disconnect'),
    path('integrations/anilist/connect/', sync_views.anilist_connect_view, name='user-integrations-anilist-connect'),
    path('integrations/anilist/callback/', sync_views.anilist_callback_view, name='user-integrations-anilist-callback'),
    path('integrations/anilist/sync/', sync_views.anilist_sync_view, name='user-integrations-anilist-sync'),
    path('integrations/anilist/disconnect/', sync_views.anilist_disconnect_view, name='user-integrations-anilist-disconnect'),
    path('integrations/extension/token/', sync_views.extension_token_view, name='user-integrations-extension-token'),
    path('integrations/extension/track/', sync_views.extension_track_view, name='user-integrations-extension-track'),
    # Catálogo de Avatares Predefinidos
    path('preset-avatars/', views.get_preset_avatars, name='preset-avatars'),
    # Sistema de Amigos y Solicitudes de Amistad
    path('me/friends/', views.user_friends_view, name='user-friends'),
    path('me/friends/<int:friend_id>/', views.user_friends_view, name='user-friend-detail'),
    path('me/friend-requests/', views.user_friend_requests_view, name='user-friend-requests'),
    path('me/friend-requests/<uuid:request_id>/respond/', views.respond_friend_request_view, name='user-friend-request-respond'),
    path('me/friend-requests/<uuid:request_id>/', views.cancel_friend_request_view, name='user-friend-request-detail'),
    path('suggested-friends/', views.suggested_friends_view, name='user-suggested-friends'),
    # Perfiles Públicos, Muro de Comentarios, Recomendaciones Directas y Notificaciones
    path('public-profile/<str:username>/', views.public_user_profile_view, name='user-public-profile'),
    path('public-profile/<str:username>/comments/', views.profile_wall_comments_view, name='user-profile-wall-comments'),
    path('public-profile/<str:username>/comments/<str:comment_id>/', views.profile_wall_comment_detail_view, name='user-profile-wall-comment-detail'),
    path('public-profile/<str:username>/recommend/', views.recommend_anime_to_user_view, name='user-recommend-anime'),
    path('me/notifications/', views.user_notifications_view, name='user-notifications'),
    # Ranking global y de amigos (horas vistas + distribución normal)
    path('ranking/', ranking_views.user_ranking_view, name='user-ranking'),
    # Reportes de contenido y moderación comunitaria
    path('reports/', report_views.create_content_report_view, name='user-content-report-create'),
    path('admin/reports/', report_views.admin_list_reports_view, name='admin-content-report-list'),
    path('admin/reports/<int:report_id>/resolve/', report_views.admin_resolve_report_view, name='admin-content-report-resolve'),
    # Tablón Social compartido en PostgreSQL (publicaciones, encuestas, votos y agradecimientos)
    path('feed/', feed_views.social_feed_view, name='user-social-feed'),
    path('feed/<str:post_id>/vote/', feed_views.social_post_vote_view, name='user-social-post-vote'),
    path('feed/<str:post_id>/thank/', feed_views.social_post_thank_view, name='user-social-post-thank'),
    # Sistema de Personajes Favoritos reactivo en PostgreSQL
    path('favorite-characters/', character_fav_views.list_favorite_characters_view, name='user-favorite-characters'),
    path('favorite-characters/toggle/', character_fav_views.toggle_favorite_character_view, name='user-favorite-characters-toggle'),
]
