from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from users.models import Profile
from groups.models import SharedList, SharedListMember, SharedListCandidate
from animes.models import Anime

ADMIN_USERS = [
    {
        'email': 'J.carmonao@udd.cl',
        'username': 'jcarmonao',
        'display_name': 'J. Carmona',
        'password': 'villarroel123',
        'avatar_url': '/media/avatars/attack_on_titan/aot_fc_levi-avatar.webp',
    },
    {
        'email': 'agustingarridop@gmail.com',
        'username': 'agustingarridop',
        'display_name': 'Agustín Garrido',
        'password': 'villarroel123',
        'avatar_url': '/media/avatars/bleach/bleach_ichigo_avatar.webp',
    },
    {
        'email': 'mfalcong@udd.cl',
        'username': 'mfalcong',
        'display_name': 'M. Falcón',
        'password': 'villarroel123',
        'avatar_url': '/media/avatars/crunchyroll_classic_collection/classic-hime-avatar-3.webp',
    },
    {
        'email': 'alonsorogonz@gmail.com',
        'username': 'alonsorogonz',
        'display_name': 'Alonso González',
        'password': 'villarroel123',
        'avatar_url': '/media/avatars/jujutsu_kaisen/jjk_gojo_avatar.webp',
    },
]

class Command(BaseCommand):
    help = 'Configura administradores y salas grupales iniciales de Animigos.'

    def handle(self, *args, **options):
        # 1. Configurar los 4 administradores
        for admin_data in ADMIN_USERS:
            email = admin_data['email']
            username = admin_data['username']
            display_name = admin_data['display_name']
            password = admin_data['password']

            user = User.objects.filter(email__iexact=email).first()
            if not user:
                user = User.objects.filter(username__iexact=username).first()

            if user:
                user.username = username
                user.email = email
                user.is_staff = True
                user.is_superuser = True
                user.is_active = True
                user.set_password(password)
                user.save()
            else:
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    is_staff=True,
                    is_superuser=True,
                    is_active=True
                )

            profile, _ = Profile.objects.get_or_create(user=user)
            if profile.display_name != display_name:
                profile.display_name = display_name
                profile.save()

            # Asignar avatar de anime oficial si no tiene uno o si tenía la imagen stock genérica
            default_unsplash = 'images.unsplash.com/photo-1534528741775-53994a69daeb'
            if not profile.avatar_url or default_unsplash in profile.avatar_url:
                profile.avatar_url = admin_data.get('avatar_url', '')
                profile.save()

        self.stdout.write(self.style.SUCCESS('Administradores configurados correctamente.'))

        # 2. Configurar salas iniciales
        if SharedList.objects.count() < 2:
            frieren = Anime.objects.filter(title__icontains='Frieren').first()
            snk = Anime.objects.filter(title__icontains='Shingeki no Kyojin').first()

            room1, _ = SharedList.objects.get_or_create(
                invite_code='ANIMIGOS1',
                defaults={
                    'name': 'Watch Party Estrenos de Temporada',
                    'description': 'Sala pública de la comunidad para votar y ver animes juntos los fines de semana.',
                    'status': 'voting',
                    'selected_anime': frieren,
                    'current_episode': 1,
                }
            )

            room2, _ = SharedList.objects.get_or_create(
                invite_code='ANIMIGOS2',
                defaults={
                    'name': 'Clásicos y Shonen de Culto',
                    'description': 'Espacio de discusión y votación de series terminadas y leyendas de la animación.',
                    'status': 'voting',
                    'selected_anime': snk,
                    'current_episode': 1,
                }
            )

            self.stdout.write(self.style.SUCCESS(f'Salas iniciales listas: {room1.invite_code}, {room2.invite_code}'))

