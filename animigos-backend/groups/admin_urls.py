from django.urls import path
from . import admin_views

urlpatterns = [
    path('overview/', admin_views.overview_analytics, name='admin-overview'),
    path('rooms/', admin_views.rooms_analytics, name='admin-rooms'),
    path('rooms/<uuid:pk>/ping/', admin_views.ping_room, name='admin-room-ping'),
    path('algorithm/', admin_views.algorithm_analytics, name='admin-algorithm'),
    path('algorithm/simulate/', admin_views.simulate_algorithm, name='admin-algorithm-simulate'),
    path('algorithm/calibrate/', admin_views.calibrate_algorithm, name='admin-algorithm-calibrate'),
    path('growth/', admin_views.growth_analytics, name='admin-growth'),
    path('users/', admin_views.admin_users_list, name='admin-users-list'),
    path('users/<str:user_id>/moderate/', admin_views.admin_moderate_user, name='admin-user-moderate'),
]
