from django.core.management.base import BaseCommand
from groups.models import SharedList, SharedListMember, SharedListCandidate
from animes.models import Anime

class Command(BaseCommand):
    help = 'Crea salas grupales y datos iniciales para la comunidad si la base de datos está vacía.'

    def handle(self, *args, **options):
        if SharedList.objects.count() >= 2:
            self.stdout.write(self.style.SUCCESS('Las salas iniciales ya existen. Omitiendo.'))
            return

        frieren = Anime.objects.filter(title__icontains='Frieren').first()
        snk = Anime.objects.filter(title__icontains='Shingeki no Kyojin').first()

        room1, created1 = SharedList.objects.get_or_create(
            invite_code='ANIMIGOS1',
            defaults={
                'name': 'Watch Party Estrenos de Temporada',
                'description': 'Sala pública de la comunidad para votar y ver animes juntos los fines de semana.',
                'status': 'voting',
                'selected_anime': frieren,
                'current_episode': 1,
            }
        )

        room2, created2 = SharedList.objects.get_or_create(
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
