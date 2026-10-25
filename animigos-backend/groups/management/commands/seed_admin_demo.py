import random
from datetime import timedelta
from django.utils import timezone
from django.core.management.base import BaseCommand
from groups.models import SharedList, SharedListMember, SharedListCandidate, SharedListVote
from animes.models import Anime

class Command(BaseCommand):
    help = 'Puebla la base de datos con salas realistas, miembros y votos usando los animes de PostgreSQL'

    def handle(self, *args, **options):
        self.stdout.write("Generando salas de demostración realistas...")

        # Verificar animes disponibles en la base de datos
        available_animes = list(Anime.objects.filter(score__gte=8.0)[:50])
        if not available_animes:
            available_animes = list(Anime.objects.all()[:30])

        if not available_animes:
            self.stderr.write(self.style.ERROR("No hay animes en la base de datos para generar candidatos."))
            return

        # Limpiar salas previas de demo para no duplicar indefinidamente
        SharedList.objects.all().delete()

        # Nombres y anfitriones
        hosts = [
            ('Alex Anfitrión', 'whatsapp'),
            ('Sofía Moderadora', 'link'),
            ('Martín Otaku', 'link'),
            ('Valeria K.', 'qr'),
            ('Diego R.', 'whatsapp'),
        ]

        guest_names = ['Camila', 'Tomás', 'Lucas', 'Valentina', 'Matías', 'Ignacio', 'Isidora', 'Sebastián', 'Catalina', 'Felipe']

        rooms_config = [
            {
                'name': 'Maratón Fin de Semana Anime',
                'description': 'Buscando el mejor anime de 12-24 episodios para ver el sábado en la noche con pizza.',
                'status': 'voting',
                'invite_code': 'PIN-8492',
                'host_idx': 0,
                'candidates_count': 4,
                'members_count': 5,
                'days_ago': 0
            },
            {
                'name': 'Estrenos y Joyas Ocultas',
                'description': 'Debatiendo entre clásicos del 2020 al 2026.',
                'status': 'candidates',
                'invite_code': 'PIN-4103',
                'host_idx': 1,
                'candidates_count': 3,
                'members_count': 3,
                'days_ago': 1
            },
            {
                'name': 'Viernes de Películas y Ovas',
                'description': 'Películas de alta producción visual con consenso alcanzado.',
                'status': 'selected',
                'invite_code': 'PIN-9421',
                'host_idx': 2,
                'candidates_count': 3,
                'members_count': 4,
                'days_ago': 2
            },
            {
                'name': 'Shingeki no Kyojin Re-watch',
                'description': 'Sala completada viendo los arcos finales.',
                'status': 'completed',
                'invite_code': 'PIN-1185',
                'host_idx': 3,
                'candidates_count': 2,
                'members_count': 6,
                'days_ago': 3
            },
            {
                'name': 'Comedias y Slice of Life Relax',
                'description': 'Para desestresarse después de los exámenes.',
                'status': 'voting',
                'invite_code': 'PIN-7729',
                'host_idx': 4,
                'candidates_count': 4,
                'members_count': 4,
                'days_ago': 1
            },
            {
                'name': 'Cyberpunk y Ciencia Ficción 2026',
                'description': 'Debate sobre tramas complejas y mundos distópicos.',
                'status': 'selected',
                'invite_code': 'PIN-6302',
                'host_idx': 0,
                'candidates_count': 3,
                'members_count': 5,
                'days_ago': 4
            },
            {
                'name': 'Isekai Fanatics Anonymous',
                'description': 'Revisando los mejores animes de mundos paralelos.',
                'status': 'completed',
                'invite_code': 'PIN-5290',
                'host_idx': 1,
                'candidates_count': 3,
                'members_count': 4,
                'days_ago': 5
            }
        ]

        now = timezone.now()

        for config in rooms_config:
            host_name, default_channel = hosts[config['host_idx']]
            created_time = now - timedelta(days=config['days_ago'], hours=random.randint(1, 10))

            room = SharedList.objects.create(
                name=config['name'],
                description=config['description'],
                status=config['status'],
                invite_code=config['invite_code']
            )
            # Forzar fecha creada para alimentar los gráficos de telemetría semanal
            SharedList.objects.filter(id=room.id).update(created_at=created_time)

            # Crear Host
            host_member = SharedListMember.objects.create(
                shared_list=room,
                guest_name=host_name,
                guest_token=f"host_token_{random.randint(1000, 9999)}",
                role='owner',
                invite_channel=default_channel
            )

            # Crear Miembros
            room_members = [host_member]
            assigned_guests = random.sample(guest_names, config['members_count'] - 1)
            for g_name in assigned_guests:
                ch = random.choice(['whatsapp', 'whatsapp', 'link', 'qr'])
                member = SharedListMember.objects.create(
                    shared_list=room,
                    guest_name=g_name,
                    guest_token=f"guest_{random.randint(10000, 99999)}",
                    role='guest',
                    invite_channel=ch
                )
                room_members.append(member)

            # Crear Candidatos de Animes reales
            selected_animes = random.sample(available_animes, config['candidates_count'])
            candidates = []
            for anime in selected_animes:
                c = SharedListCandidate.objects.create(
                    shared_list=room,
                    anime=anime,
                    suggested_by=random.choice(room_members).guest_name
                )
                candidates.append(c)

            # Generar Votos si la sala está en voting, selected o completed
            if config['status'] in ['voting', 'selected', 'completed']:
                for c in candidates:
                    for m in room_members:
                        # Si está en voting, simular quórum parcial
                        if config['status'] == 'voting' and random.random() < 0.25:
                            continue  # no ha votado todavía

                        score_val = random.randint(6, 10)
                        SharedListVote.objects.create(
                            candidate=c,
                            voter_id=m.guest_token,
                            voter_name=m.guest_name,
                            interest_score=score_val
                        )

            # Si está en selected o completed, elegir el primer candidato como ganador
            if config['status'] in ['selected', 'completed']:
                room.selected_anime = candidates[0].anime
                room.save(update_fields=['selected_anime'])

        total_r = SharedList.objects.count()
        total_m = SharedListMember.objects.count()
        total_v = SharedListVote.objects.count()

        self.stdout.write(
            self.style.SUCCESS(
                f"Demostración generada con éxito: {total_r} salas creadas, {total_m} miembros, {total_v} votos emitidos."
            )
        )
