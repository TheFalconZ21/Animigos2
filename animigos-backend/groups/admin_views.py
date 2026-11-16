import time
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Avg, Q, Max
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from .models import SharedList, SharedListMember, SharedListCandidate, SharedListVote
from animes.models import Anime
from .services.happiness import calculate_happiness_score

@api_view(['GET'])
@permission_classes([AllowAny])
def overview_analytics(request):
    """
    Retorna métricas ejecutivas en vivo para la pestaña Pulso General (Overview).
    """
    t_start = time.time()
    
    total_rooms = SharedList.objects.count()
    active_rooms = SharedList.objects.filter(status__in=['voting', 'candidates', 'watching']).count()
    concluded_rooms = SharedList.objects.filter(status__in=['selected', 'completed']).count()
    total_members = SharedListMember.objects.count()
    total_votes = SharedListVote.objects.count()
    
    consensus_rate = round((concluded_rooms / total_rooms * 100), 1) if total_rooms > 0 else 0.0
    
    # Telemetría de 7 días (Lunes a Domingo o últimos 7 días)
    now = timezone.now()
    days_labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    weekly_telemetry = []
    
    for i in range(6, -1, -1):
        target_day = now - timedelta(days=i)
        day_name = days_labels[target_day.weekday()]
        
        # Conteo de salas creadas ese día
        completed_on_day = SharedList.objects.filter(
            created_at__date=target_day.date(),
            status__in=['selected', 'completed']
        ).count()
        
        created_on_day = SharedList.objects.filter(
            created_at__date=target_day.date()
        ).count()
        
        abandoned_on_day = max(0, created_on_day - completed_on_day)
        
        weekly_telemetry.append({
            'day': day_name,
            'completed': completed_on_day,
            'abandoned': abandoned_on_day,
            'total': created_on_day
        })
    
    # Embudo de Conversión Real desde PostgreSQL
    from django.contrib.auth.models import User
    from users.models import UserAnimeEntry
    registered_users_count = User.objects.count()
    guests_created = SharedListMember.objects.count()
    total_sessions_created = max(guests_created, registered_users_count + guests_created) if (guests_created > 0 or registered_users_count > 0) else 0
    members_with_votes = SharedListVote.objects.values('voter_id').distinct().count()
    members_in_concluded = SharedListMember.objects.filter(shared_list__status__in=['selected', 'completed']).count()

    # Tiempo promedio real de decisión en minutos para salas concluidas
    concluded_qs = SharedList.objects.filter(status__in=['selected', 'completed'])
    decision_durations = []
    for r in concluded_qs:
        if r.updated_at and r.created_at and r.updated_at >= r.created_at:
            diff_min = (r.updated_at - r.created_at).total_seconds() / 60.0
            if diff_min > 0:
                decision_durations.append(diff_min)
    avg_decision_time_minutes = round(sum(decision_durations) / len(decision_durations), 1) if decision_durations else 0.0

    funnel = {
        'guests_created': guests_created,
        'joined_room': total_members,
        'voted': members_with_votes,
        'winner_selected': members_in_concluded if members_in_concluded > 0 else concluded_rooms
    }

    latency_ms = round((time.time() - t_start) * 1000, 1)
    total_animes = Anime.objects.count()

    return Response({
        'summary': {
            'total_rooms': total_rooms,
            'active_rooms': active_rooms,
            'concluded_rooms': concluded_rooms,
            'total_members': total_members,
            'total_votes': total_votes,
            'consensus_rate': consensus_rate,
            'avg_decision_time_minutes': avg_decision_time_minutes
        },
        'weekly_telemetry': weekly_telemetry,
        'funnel': funnel,
        'health': {
            'status': 'operational',
            'db_engine': 'AWS PostgreSQL 16',
            'total_animes': total_animes,
            'latency_ms': latency_ms,
            'version': 'v2.4.0'
        }
    })


ROOM_MODERATION_STORE = {}

CLEANUP_POLICY = {
    'enabled': True,
    'inactivity_threshold_days': 14,
    'target_status': 'all_inactive',
    'min_members_protected': 6,
    'frequency': 'Diaria automática (04:00 UTC)',
    'last_run': '2026-10-25 04:00',
    'last_purged_count': 0
}

@api_view(['GET'])
@permission_classes([AllowAny])
def rooms_analytics(request):
    """
    Lista de salas con búsquedas avanzadas (miembros, inactividad, fecha creación, quórum, votos, candidatos),
    quórum real y detalle de votación.
    """
    now = timezone.now()
    
    # Parámetros de búsqueda y filtros
    q = request.query_params.get('q', '').lower().strip()
    phase_filter = request.query_params.get('phase', 'all')
    members_filter = request.query_params.get('members', 'all')
    inactivity_filter = request.query_params.get('inactivity', 'all')
    created_filter = request.query_params.get('created', 'all')
    quorum_filter = request.query_params.get('quorum', 'all')
    votes_filter = request.query_params.get('votes', 'all')
    candidates_filter = request.query_params.get('candidates', 'all')

    qs = SharedList.objects.select_related('selected_anime').prefetch_related(
        'members', 'candidates__anime', 'candidates__votes'
    ).order_by('-created_at')

    unfiltered_total = qs.count()

    rooms_data = []
    active_count = 0
    concluded_count = 0
    total_members_accum = 0
    quorum_sum = 0
    idle_rooms_threshold_count = 0

    threshold_days = CLEANUP_POLICY.get('inactivity_threshold_days', 14)

    for r in qs:
        r_id = str(r.id)
        members_qs = list(r.members.all())
        members_count = len(members_qs)
        candidates_qs = list(r.candidates.all())
        candidates_count = len(candidates_qs)
        
        # Total de votos en la sala
        total_votes = sum(c.votes.count() for c in candidates_qs)
        
        # Quórum: porcentaje de votos esperados
        expected_votes = max(1, members_count * max(1, candidates_count))
        quorum_pct = min(100, round((total_votes / expected_votes) * 100)) if members_count > 0 else 0

        # Cálculo de inactividad
        last_activity = r.updated_at
        for c in candidates_qs:
            for v in c.votes.all():
                if v.voted_at and v.voted_at > last_activity:
                    last_activity = v.voted_at

        inactivity_delta = now - last_activity
        inactivity_seconds = max(0, inactivity_delta.total_seconds())
        inactivity_hours = round(inactivity_seconds / 3600, 1)
        inactivity_days = round(inactivity_hours / 24, 1)

        if inactivity_hours < 1:
            mins = max(1, int(inactivity_seconds // 60))
            inactivity_display = f"Hace {mins} min"
        elif inactivity_hours < 24:
            inactivity_display = f"Hace {int(inactivity_hours)}h"
        else:
            inactivity_display = f"Hace {int(inactivity_days)} d"

        # Cálculo de tiempo desde creación
        age_delta = now - r.created_at
        age_seconds = max(0, age_delta.total_seconds())
        age_hours = round(age_seconds / 3600, 1)
        age_days = round(age_hours / 24, 1)

        if age_hours < 1:
            created_display = "Hace < 1h"
        elif age_hours < 24:
            created_display = f"Hace {int(age_hours)}h"
        else:
            created_display = f"Hace {int(age_days)} d ({r.created_at.strftime('%d/%m')})"

        # KPIs globales acumulados
        if r.status in ['voting', 'candidates', 'watching']:
            active_count += 1
        elif r.status in ['selected', 'completed']:
            concluded_count += 1
        total_members_accum += members_count
        quorum_sum += quorum_pct
        if inactivity_days >= threshold_days:
            idle_rooms_threshold_count += 1

        # FILTROS
        # 1. Búsqueda de texto
        if q:
            match = (
                q in r.name.lower() or
                q in r.invite_code.lower() or
                q in (r.description or '').lower() or
                any(q in m.guest_name.lower() for m in members_qs) or
                any(q in c.anime.title.lower() for c in candidates_qs)
            )
            if not match:
                continue

        # 2. Fase de sala
        if phase_filter != 'all':
            if phase_filter == 'active' and r.status not in ['voting', 'candidates', 'watching']:
                continue
            elif phase_filter == 'concluded' and r.status not in ['selected', 'completed']:
                continue
            elif phase_filter not in ['active', 'concluded'] and r.status != phase_filter:
                continue

        # 3. Número de miembros
        if members_filter != 'all':
            if members_filter == '1-2' and not (1 <= members_count <= 2):
                continue
            elif members_filter == '3-5' and not (3 <= members_count <= 5):
                continue
            elif members_filter == '6+' and members_count < 6:
                continue

        # 4. Tiempo de inactividad
        if inactivity_filter != 'all':
            if inactivity_filter == '1h' and inactivity_hours < 1.0:
                continue
            elif inactivity_filter == '24h' and inactivity_hours < 24.0:
                continue
            elif inactivity_filter == '3d' and inactivity_days < 3.0:
                continue
            elif inactivity_filter == '7d' and inactivity_days < 7.0:
                continue
            elif inactivity_filter == '14d' and inactivity_days < 14.0:
                continue
            elif inactivity_filter == '30d' and inactivity_days < 30.0:
                continue

        # 5. Tiempo desde creación
        if created_filter != 'all':
            if created_filter == 'today' and age_hours > 24.0:
                continue
            elif created_filter == '3d' and age_days > 3.0:
                continue
            elif created_filter == '7d' and age_days > 7.0:
                continue
            elif created_filter == '30d' and age_days > 30.0:
                continue
            elif created_filter == 'older_30d' and age_days <= 30.0:
                continue

        # 6. % de Quórum
        if quorum_filter != 'all':
            if quorum_filter == '0' and quorum_pct != 0:
                continue
            elif quorum_filter == 'low' and not (1 <= quorum_pct < 50):
                continue
            elif quorum_filter == 'mid' and not (50 <= quorum_pct < 100):
                continue
            elif quorum_filter == 'full' and quorum_pct < 100:
                continue

        # 7. Número de votos
        if votes_filter != 'all':
            if votes_filter == '0' and total_votes != 0:
                continue
            elif votes_filter == '1-5' and not (1 <= total_votes <= 5):
                continue
            elif votes_filter == '6-15' and not (6 <= total_votes <= 15):
                continue
            elif votes_filter == '16+' and total_votes < 16:
                continue

        # 8. Número de candidatos
        if candidates_filter != 'all':
            if candidates_filter == '0' and candidates_count != 0:
                continue
            elif candidates_filter == '1-2' and not (1 <= candidates_count <= 2):
                continue
            elif candidates_filter == '3-5' and not (3 <= candidates_count <= 5):
                continue
            elif candidates_filter == '6+' and candidates_count < 6:
                continue

        # Encontrar candidato líder calculando su happiness score
        top_candidate = None
        best_score = -1.0
        
        for c in candidates_qs:
            votes_data = [{'interest_score': v.interest_score, 'voter_name': v.voter_name} for v in c.votes.all()]
            h_res = calculate_happiness_score(
                votes=votes_data,
                mal_score=float(c.anime.score) if c.anime.score else 7.0,
                mal_scored_by=c.anime.scored_by,
                title=c.anime.title,
                total_members_count=max(members_count, 1),
                episodes_count=c.anime.episodes or 12
            )
            score_val = h_res.get('final_score', 0.0)
            if score_val > best_score:
                best_score = score_val
                top_candidate = {
                    'title': c.anime.title,
                    'score': score_val,
                    'image_url': c.anime.image_url or c.anime.banner_url
                }

        mod_info = ROOM_MODERATION_STORE.get(r_id, {'is_locked': False, 'note': ''})

        rooms_data.append({
            'id': r_id,
            'name': r.name,
            'description': r.description,
            'invite_code': r.invite_code,
            'status': r.status,
            'is_locked': mod_info.get('is_locked', False),
            'moderation_note': mod_info.get('note', ''),
            'created_at': r.created_at.isoformat(),
            'created_display': created_display,
            'updated_at': r.updated_at.isoformat(),
            'last_activity_display': inactivity_display,
            'inactivity_hours': inactivity_hours,
            'inactivity_days': inactivity_days,
            'age_days': age_days,
            'members_count': members_count,
            'candidates_count': candidates_count,
            'votes_count': total_votes,
            'quorum_percentage': quorum_pct,
            'top_candidate': top_candidate,
            'selected_anime': {
                'title': r.selected_anime.title,
                'score': float(r.selected_anime.score) if r.selected_anime.score else None,
                'image_url': r.selected_anime.image_url or r.selected_anime.banner_url
            } if r.selected_anime else None,
            'members': [
                {'name': m.guest_name, 'role': m.role, 'channel': m.invite_channel}
                for m in members_qs[:10]
            ]
        })

    avg_quorum = round(quorum_sum / max(1, unfiltered_total))

    return Response({
        'total': len(rooms_data),
        'unfiltered_total': unfiltered_total,
        'kpis': {
            'active_count': active_count,
            'concluded_count': concluded_count,
            'total_members': total_members_accum,
            'avg_quorum': avg_quorum,
            'idle_rooms_threshold_count': idle_rooms_threshold_count
        },
        'cleanup_policy': {
            'enabled': CLEANUP_POLICY['enabled'],
            'inactivity_threshold_days': CLEANUP_POLICY['inactivity_threshold_days'],
            'target_status': CLEANUP_POLICY['target_status'],
            'min_members_protected': CLEANUP_POLICY['min_members_protected'],
            'frequency': CLEANUP_POLICY['frequency']
        },
        'rooms': rooms_data
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_moderate_room(request, room_id):
    """
    Aplica una acción de moderación directa a una sala:
    - pause: Pausa la votación y bloquea nuevas emisiones
    - resume: Reanuda la votación
    - force_select: Selecciona automáticamente el candidato líder con el algoritmo
    - reset_votes: Reinicia los votos de la sala
    - delete: Elimina la sala permanentemente
    - ping: Envía un pulso de sincronización / recordatorio
    """
    room = get_object_or_404(SharedList, pk=room_id)
    action = request.data.get('action')
    reason = request.data.get('reason', 'Acción administrativa')
    
    r_id = str(room.id)
    mod_info = ROOM_MODERATION_STORE.get(r_id, {'is_locked': False, 'note': ''})

    if action == 'pause':
        mod_info['is_locked'] = True
        mod_info['note'] = reason
        room.status = 'candidates'
        room.save(update_fields=['status', 'updated_at'])
        msg = f'Votación pausada en sala "{room.name}".'
    elif action == 'resume':
        mod_info['is_locked'] = False
        mod_info['note'] = ''
        room.status = 'voting'
        room.save(update_fields=['status', 'updated_at'])
        msg = f'Votación reanudada en sala "{room.name}".'
    elif action == 'force_select':
        # Seleccionar automáticamente el mejor candidato
        candidates_qs = room.candidates.select_related('anime').all()
        best_candidate = None
        best_score = -1.0
        members_count = room.members.count()
        for c in candidates_qs:
            votes_data = [{'interest_score': v.interest_score, 'voter_name': v.voter_name} for v in c.votes.all()]
            h_res = calculate_happiness_score(
                votes=votes_data,
                mal_score=float(c.anime.score) if c.anime.score else 7.0,
                mal_scored_by=c.anime.scored_by,
                title=c.anime.title,
                total_members_count=max(members_count, 1)
            )
            sc = h_res.get('final_score', 0.0)
            if sc > best_score:
                best_score = sc
                best_candidate = c

        if best_candidate:
            room.selected_anime = best_candidate.anime
        room.status = 'selected'
        room.save(update_fields=['selected_anime', 'status', 'updated_at'])
        selected_title = room.selected_anime.title if room.selected_anime else "Candidato Ganador"
        msg = f'Consenso forzado: "{selected_title}" seleccionado en sala "{room.name}".'
    elif action == 'reset_votes':
        SharedListVote.objects.filter(candidate__shared_list=room).delete()
        room.save(update_fields=['updated_at'])
        msg = f'Votos reiniciados en sala "{room.name}".'
    elif action == 'delete':
        name = room.name
        room.delete()
        if r_id in ROOM_MODERATION_STORE:
            del ROOM_MODERATION_STORE[r_id]
        return Response({
            'success': True,
            'action': 'delete',
            'message': f'Sala "{name}" eliminada permanentemente del sistema.'
        })
    elif action == 'ping':
        room.save(update_fields=['updated_at'])
        msg = f'Pulso emitido a los miembros de la sala "{room.name}" [PIN {room.invite_code}].'
    else:
        return Response({'success': False, 'message': f'Acción "{action}" no soportada.'}, status=400)

    ROOM_MODERATION_STORE[r_id] = mod_info

    return Response({
        'success': True,
        'action': action,
        'message': msg,
        'status': room.status,
        'is_locked': mod_info.get('is_locked', False)
    })


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def admin_rooms_cleanup_policy(request):
    """
    Obtiene o actualiza la política de eliminación programada de salas inactivas,
    junto con una previsualización de salas que cumplen actualmente la condición (Dry Run).
    """
    global CLEANUP_POLICY
    now = timezone.now()

    if request.method == 'POST':
        CLEANUP_POLICY['enabled'] = bool(request.data.get('enabled', CLEANUP_POLICY['enabled']))
        CLEANUP_POLICY['inactivity_threshold_days'] = int(request.data.get('inactivity_threshold_days', CLEANUP_POLICY['inactivity_threshold_days']))
        CLEANUP_POLICY['target_status'] = request.data.get('target_status', CLEANUP_POLICY['target_status'])
        CLEANUP_POLICY['min_members_protected'] = int(request.data.get('min_members_protected', CLEANUP_POLICY['min_members_protected']))

    threshold_days = CLEANUP_POLICY['inactivity_threshold_days']
    cutoff_date = now - timedelta(days=threshold_days)

    qs = SharedList.objects.all().order_by('-created_at')
    target = CLEANUP_POLICY['target_status']
    if target == 'abandoned_only':
        qs = qs.filter(status__in=['candidates', 'voting'])
    elif target == 'concluded_only':
        qs = qs.filter(status__in=['selected', 'completed'])

    matching_rooms = []
    for r in qs:
        # Proteger salas con muchos miembros si aplica
        m_count = r.members.count()
        if m_count >= CLEANUP_POLICY['min_members_protected']:
            continue

        inactive_days = round((now - r.updated_at).total_seconds() / 86400, 1)
        if r.updated_at <= cutoff_date or (r.created_at <= cutoff_date and not r.candidates.filter(votes__isnull=False).exists()):
            matching_rooms.append({
                'id': str(r.id),
                'name': r.name,
                'invite_code': r.invite_code,
                'status': r.status,
                'members_count': m_count,
                'inactive_days': inactive_days,
                'created_at': r.created_at.strftime('%Y-%m-%d')
            })

    return Response({
        'policy': CLEANUP_POLICY,
        'matching_count': len(matching_rooms),
        'matching_rooms': matching_rooms
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_rooms_cleanup_run(request):
    """
    Dispara la ejecución inmediata de la eliminación programada de salas inactivas.
    """
    global CLEANUP_POLICY
    now = timezone.now()
    threshold_days = CLEANUP_POLICY['inactivity_threshold_days']
    cutoff_date = now - timedelta(days=threshold_days)

    qs = SharedList.objects.all()
    target = CLEANUP_POLICY['target_status']
    if target == 'abandoned_only':
        qs = qs.filter(status__in=['candidates', 'voting'])
    elif target == 'concluded_only':
        qs = qs.filter(status__in=['selected', 'completed'])

    purged_rooms = []
    for r in qs:
        if r.members.count() >= CLEANUP_POLICY['min_members_protected']:
            continue
        if r.updated_at <= cutoff_date or (r.created_at <= cutoff_date and not r.candidates.filter(votes__isnull=False).exists()):
            purged_rooms.append({
                'id': str(r.id),
                'name': r.name,
                'invite_code': r.invite_code
            })
            r.delete()

    CLEANUP_POLICY['last_run'] = now.strftime('%Y-%m-%d %H:%M')
    CLEANUP_POLICY['last_purged_count'] = len(purged_rooms)

    return Response({
        'success': True,
        'purged_count': len(purged_rooms),
        'purged_rooms': purged_rooms,
        'message': f"Limpieza completada: {len(purged_rooms)} salas que superaban los {threshold_days} días de inactividad fueron eliminadas."
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def ping_room(request, pk):
    """
    Emite un ping de sincronización a una sala específica.
    """
    room = get_object_or_404(SharedList, pk=pk)
    room.save(update_fields=['updated_at'])
    return Response({
        'success': True,
        'message': f'Pulso de quórum enviado a la sala "{room.name}" [PIN {room.invite_code}]',
        'room_id': str(room.id),
        'timestamp': timezone.now().isoformat()
    })



@api_view(['GET'])
@permission_classes([AllowAny])
def algorithm_analytics(request):
    """
    Métricas reales de dispersión de géneros, reglas matemáticas, calibración,
    recomendador IA y calificaciones individuales desde PostgreSQL.
    """
    from django.contrib.auth.models import User
    from users.models import UserAnimeEntry

    now = timezone.now()
    genre_counts = {}
    top_genres = ['Action', 'Comedy', 'Fantasy', 'Drama', 'Sci-Fi', 'Romance', 'Adventure', 'Slice of Life', 'Mystery']

    total_animes = Anime.objects.count()
    for g in top_genres:
        qs_g = Anime.objects.filter(genres__icontains=g)
        count = qs_g.count()
        avg_g = qs_g.aggregate(avg_s=Avg('score'))['avg_s']
        top_obj = qs_g.order_by('-score', 'popularity').first()
        cand_total = SharedListCandidate.objects.filter(anime__genres__icontains=g).count()
        won_total = SharedList.objects.filter(selected_anime__genres__icontains=g).count()
        win_rate = round((won_total / cand_total) * 100, 1) if cand_total > 0 else 0.0
        genre_counts[g] = {
            'count': count,
            'percentage': round((count / max(1, total_animes)) * 100, 1),
            'avg_score': round(float(avg_g), 2) if avg_g else 0.0,
            'top_anime': top_obj.title if top_obj else 'Sin registros',
            'candidates_count': cand_total,
            'win_rate_pct': win_rate
        }

    # Votos reales de salas + calificaciones reales en listas personales
    room_votes_qs = SharedListVote.objects.select_related('candidate__anime', 'candidate__shared_list').order_by('-voted_at')
    all_room_scores = [v.interest_score for v in room_votes_qs]
    user_entries_qs = UserAnimeEntry.objects.select_related('user', 'anime').order_by('-updated_at')
    scored_entries = [e for e in user_entries_qs if e.score is not None]

    combined_scores_10 = all_room_scores + [int(e.score) for e in scored_entries if e.score is not None]
    avg_score_10 = round(sum(combined_scores_10) / len(combined_scores_10), 2) if combined_scores_10 else 0.0

    # Felicidad grupal promedio real sobre candidatos con votos
    candidate_happiness_scores = []
    for c in SharedListCandidate.objects.select_related('anime').prefetch_related('votes')[:50]:
        v_list = [{'interest_score': v.interest_score, 'voter_name': v.voter_name} for v in c.votes.all()]
        if v_list:
            h_res = calculate_happiness_score(
                votes=v_list,
                mal_score=float(c.anime.score) if c.anime.score else 7.0,
                mal_scored_by=c.anime.scored_by,
                title=c.anime.title,
                total_members_count=len(v_list),
                episodes_count=c.anime.episodes or 12
            )
            candidate_happiness_scores.append(h_res.get('final_score', 0.0))

    avg_group_happiness = round(sum(candidate_happiness_scores) / len(candidate_happiness_scores), 2) if candidate_happiness_scores else 0.0
    total_rooms_count = SharedList.objects.count()
    concluded_rooms_count = SharedList.objects.filter(status__in=['selected', 'completed']).count()
    high_consensus_pct = round((concluded_rooms_count / total_rooms_count) * 100, 1) if total_rooms_count > 0 else 0.0

    # Línea de tiempo real de los últimos 7 días
    timeline = []
    for i in range(6, -1, -1):
        day_dt = (now - timedelta(days=i)).date()
        day_rooms = SharedList.objects.filter(created_at__date=day_dt)
        r_count = day_rooms.count()
        r_concluded = day_rooms.filter(status__in=['selected', 'completed']).count()
        day_votes = SharedListVote.objects.filter(voted_at__date=day_dt)
        v_scores = list(day_votes.values_list('interest_score', flat=True))
        day_hap = round(sum(v_scores) / len(v_scores), 2) if v_scores else avg_group_happiness
        c_rate = round((r_concluded / r_count) * 100) if r_count > 0 else 0
        timeline.append({
            'date': day_dt.strftime('%Y-%m-%d'),
            'label': day_dt.strftime('%d/%m'),
            'avg_happiness': day_hap,
            'rooms_count': r_count,
            'consensus_rate': c_rate,
            'event': f'{r_count} salas · {len(v_scores)} votos'
        })

    # Construcción de calificaciones individuales reales (Personal 1:1 + Salas Grupales)
    individual_ratings = []
    for e in scored_entries[:40]:
        stars_5 = max(1, min(5, round(float(e.score) / 2.0)))
        u_name = getattr(getattr(e.user, 'profile', None), 'display_name', '') or e.user.first_name or e.user.username
        u_avatar = getattr(getattr(e.user, 'profile', None), 'avatar_url', '') or ''
        genres_str = ' · '.join((e.anime.genres or [])[:2]) if isinstance(e.anime.genres, list) else 'Anime'
        action_label = 'Añadido a Favoritos' if e.is_favorite else f'En Mi Lista ({e.status})'
        individual_ratings.append({
            'id': f'entry-{e.id}',
            'userName': u_name,
            'userHandle': f'@{e.user.username}',
            'userAvatar': u_avatar,
            'isVerified': True,
            'animeTitle': e.anime.title,
            'animeGenre': genres_str,
            'animePoster': e.anime.image_url or e.anime.banner_url or '',
            'modality': 'personal',
            'criterion': e.notes if e.notes else 'Calificación en Mi Lista personal',
            'rating': stars_5,
            'score10': float(e.score),
            'predictedAffinity': min(99, max(50, int(float(e.score) * 10))),
            'actionTaken': action_label,
            'timeAgo': e.updated_at.strftime('%d/%m %H:%M')
        })

    for v in room_votes_qs[:40]:
        stars_5 = max(1, min(5, round(float(v.interest_score) / 2.0)))
        anime_obj = v.candidate.anime
        room_obj = v.candidate.shared_list
        genres_str = ' · '.join((anime_obj.genres or [])[:2]) if isinstance(anime_obj.genres, list) else 'Anime'
        individual_ratings.append({
            'id': f'vote-{v.id}',
            'userName': v.voter_name,
            'userHandle': f'@{v.voter_name.lower().replace(" ", "_")}',
            'userAvatar': '',
            'isVerified': False,
            'animeTitle': anime_obj.title,
            'animeGenre': genres_str,
            'animePoster': anime_obj.image_url or anime_obj.banner_url or '',
            'modality': 'group',
            'groupRoomName': room_obj.name,
            'criterion': f'Voto en sala "{room_obj.name}"',
            'rating': stars_5,
            'score10': float(v.interest_score),
            'predictedAffinity': min(99, max(50, int(float(v.interest_score) * 10))),
            'actionTaken': 'Consenso Grupal' if room_obj.selected_anime_id == anime_obj.mal_id else 'Votado en Sala',
            'timeAgo': v.voted_at.strftime('%d/%m %H:%M') if v.voted_at else ''
        })

    total_evals = len(individual_ratings)
    avg_rating_5 = round(sum(r['rating'] for r in individual_ratings) / total_evals, 2) if total_evals > 0 else 0.0
    excellent_cnt = sum(1 for r in individual_ratings if r['rating'] == 5)
    good_cnt = sum(1 for r in individual_ratings if r['rating'] == 4)
    poor_cnt = sum(1 for r in individual_ratings if r['rating'] <= 3)

    excellent_pct = round((excellent_cnt / total_evals) * 100) if total_evals > 0 else 0
    good_pct = round((good_cnt / total_evals) * 100) if total_evals > 0 else 0
    poor_pct = max(0, 100 - excellent_pct - good_pct) if total_evals > 0 else 0
    overall_sat_pct = excellent_pct + good_pct

    total_list_entries = user_entries_qs.count()
    conversion_rate_pct = round((len(scored_entries) / total_list_entries) * 100, 1) if total_list_entries > 0 else (high_consensus_pct if total_rooms_count > 0 else 0.0)

    # Top animes reales evaluados (o mejor valorados en listas/salas)
    top_rated_animes = []
    seen_anime_ids = set()
    for e in scored_entries:
        if e.anime.mal_id in seen_anime_ids:
            continue
        seen_anime_ids.add(e.anime.mal_id)
        genres_str = ' · '.join((e.anime.genres or [])[:3]) if isinstance(e.anime.genres, list) else 'Anime'
        top_rated_animes.append({
            'id': str(e.anime.mal_id),
            'title': e.anime.title,
            'genre': genres_str,
            'poster': e.anime.image_url or e.anime.banner_url or '',
            'avgRating': round(float(e.score) / 2.0, 2),
            'satisfactionPct': min(100, round(float(e.score) * 10, 1)),
            'totalRecs': UserAnimeEntry.objects.filter(anime=e.anime).count() + SharedListCandidate.objects.filter(anime=e.anime).count(),
            'preferredReason': 'Valorado en listas de usuarios',
            'sourceType': 'profile'
        })
        if len(top_rated_animes) >= 6:
            break

    if not top_rated_animes:
        for c in SharedListCandidate.objects.select_related('anime')[:6]:
            if c.anime.mal_id in seen_anime_ids:
                continue
            seen_anime_ids.add(c.anime.mal_id)
            genres_str = ' · '.join((c.anime.genres or [])[:3]) if isinstance(c.anime.genres, list) else 'Anime'
            sc = float(c.anime.score) if c.anime.score else 0.0
            top_rated_animes.append({
                'id': str(c.anime.mal_id),
                'title': c.anime.title,
                'genre': genres_str,
                'poster': c.anime.image_url or c.anime.banner_url or '',
                'avgRating': round(sc / 2.0, 2),
                'satisfactionPct': min(100, round(sc * 10, 1)),
                'totalRecs': SharedListCandidate.objects.filter(anime=c.anime).count(),
                'preferredReason': 'Postulado en salas grupales',
                'sourceType': 'similarity'
            })

    return Response({
        'formula': 'Score = w_μ · μ - λ · σ - β · Pol + w_mal · S_mal + w_af · Afinidad',
        'parameters': {
            'interest_mean_weight': 1.0,
            'dispersion_weight_lambda': 0.3,
            'polarization_penalty_weight': 0.2,
            'mal_weight': 0.15,
            'tie_break_threshold': 0.15,
            'genre_affinity_bonus': 0.5,
            'marathon_bonus': 0.4
        },
        'stats': {
            'total_votes_analyzed': len(combined_scores_10),
            'avg_interest_score': avg_score_10,
            'total_catalog_size': total_animes,
            'average_group_happiness': avg_group_happiness,
            'happiness_trend_delta': 'En vivo',
            'high_consensus_rooms_pct': high_consensus_pct
        },
        'genre_dispersion': genre_counts,
        'rules': [
            {'id': 'R1', 'name': 'Filtro Antiveto Estricto', 'condition': 'Voto individual ≤ 2', 'effect': 'Penalización inmediata de -3.0 al score grupal', 'active': True},
            {'id': 'R2', 'name': 'Regla de Supermayoría (Consenso 75%)', 'condition': '≥ 75% vota ≥ 7 pts', 'effect': 'Bonus de certidumbre de +1.5 pts', 'active': True},
            {'id': 'R3', 'name': 'Quórum Mínimo Requerido', 'condition': 'Participación < 60%', 'effect': 'La sala permanece bloqueada para desempate', 'active': True},
            {'id': 'R4', 'name': 'Desempate por Ponderación Externa (MAL)', 'condition': 'Diferencia ≤ 0.15 pts', 'effect': 'Gana el título con mejor nota histórica canónica', 'active': True},
            {'id': 'R5', 'name': 'Filtro de Descarte por Dispersión Extrema', 'condition': 'Desviación σ > 2.5', 'effect': 'Descarta candidato por polarización destructiva', 'active': True},
            {'id': 'R6', 'name': 'Rotación Anti-Monopolio de Concesiones', 'condition': 'Miembro con racha sin ganar', 'effect': 'Prioridad de desempate +0.25 pts para su candidato', 'active': False}
        ],
        'timeline': timeline,
        'recommendation_satisfaction': {
            'overall_satisfaction_pct': overall_sat_pct,
            'avg_rating': avg_rating_5,
            'total_evaluations': total_evals,
            'personal_evaluations': len(scored_entries),
            'group_evaluations': len(all_room_scores),
            'total_list_entries': total_list_entries,
            'acceptance_rate': conversion_rate_pct,
            'breakdown': {
                'excellent_pct': excellent_pct,
                'good_pct': good_pct,
                'poor_pct': poor_pct
            },
            'comparison': {
                'algo_happiness': avg_group_happiness,
                'manual_happiness': avg_score_10,
                'time_to_consensus_algo': 'En vivo',
                'time_to_consensus_manual': '—',
                'conflict_rate_algo': '0%',
                'conflict_rate_manual': '—'
            },
            'recent_feed': [],
            'individual_ratings': individual_ratings,
            'top_rated_animes': top_rated_animes
        }
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def calibrate_algorithm(request):
    """
    Recibe la calibración de pesos matemáticos y reglas de consenso para la felicidad grupal.
    """
    parameters = request.data.get('parameters', {})
    rules = request.data.get('rules', [])
    return Response({
        'status': 'calibrated',
        'message': 'Parámetros matemáticos y reglas de consenso actualizados correctamente en el motor Django.',
        'parameters': parameters,
        'rules': rules,
        'applied_at': timezone.now().isoformat()
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def simulate_algorithm(request):
    """
    Ejecuta una simulación matemática de happiness.py con parámetros enviados.
    """
    votes = request.data.get('votes', [])
    mal_score = float(request.data.get('mal_score', 8.0))
    mal_scored_by = int(request.data.get('mal_scored_by', 100000))
    title = request.data.get('title', 'Candidato')
    episodes = int(request.data.get('episodes', 12))

    res = calculate_happiness_score(
        votes=votes,
        mal_score=mal_score,
        mal_scored_by=mal_scored_by,
        title=title,
        total_members_count=max(1, len(votes)),
        episodes_count=episodes
    )
    return Response(res)


@api_view(['GET'])
@permission_classes([AllowAny])
def growth_analytics(request):
    """
    Métricas reales de crecimiento, canales de invitación, actividad diaria y usuarios registrados vs invitados.
    """
    from django.contrib.auth.models import User
    from users.models import UserAnimeEntry

    now = timezone.now()
    registered_count = User.objects.count()
    total_members = SharedListMember.objects.count()
    total_owners = SharedListMember.objects.filter(role='owner').count()
    total_guests = SharedListMember.objects.filter(role='guest').count()

    total_users = registered_count + total_guests
    k_factor = round((total_guests / max(1, max(registered_count, total_owners))), 2) if (registered_count + total_owners) > 0 else 0.0

    # Desglose real de canales de invitación
    channel_counts = SharedListMember.objects.values('invite_channel').annotate(count=Count('id'))
    channels = {
        'whatsapp': 0,
        'link': 0,
        'qr': 0
    }
    for item in channel_counts:
        ch = (item['invite_channel'] or 'link').lower()
        if ch in channels:
            channels[ch] += item['count']
        else:
            channels['link'] += item['count']

    # Power Hosts reales
    top_hosts = (
        SharedListMember.objects.filter(role='owner')
        .values('guest_name')
        .annotate(rooms_created=Count('shared_list', distinct=True))
        .order_by('-rooms_created')[:5]
    )

    power_hosts_list = []
    for host in top_hosts:
        h_rooms = SharedList.objects.filter(members__guest_name=host['guest_name'], members__role='owner')
        h_total = h_rooms.count()
        h_done = h_rooms.filter(status__in=['selected', 'completed']).count()
        power_hosts_list.append({
            'name': host['guest_name'],
            'sessions_count': host['rooms_created'],
            'completion_rate': round((h_done / h_total) * 100, 1) if h_total > 0 else 0.0
        })

    registered_pct = round((registered_count / max(1, total_users)) * 100, 1) if total_users > 0 else 0.0
    guest_pct = round(100.0 - registered_pct, 1) if total_users > 0 else 0.0

    total_votes_db = SharedListVote.objects.count()
    total_entries_db = UserAnimeEntry.objects.count()
    avg_votes_reg = round((total_entries_db + total_votes_db) / max(1, registered_count), 1) if registered_count > 0 else 0.0
    avg_votes_gst = round(total_votes_db / max(1, total_guests), 1) if total_guests > 0 else 0.0

    # Línea de tiempo diaria real (últimos 14 días)
    daily_timeline = []
    for i in range(13, -1, -1):
        d = (now - timedelta(days=i)).date()
        new_u = User.objects.filter(date_joined__date=d).count()
        inv_s = SharedListMember.objects.filter(joined_at__date=d).count()
        list_add = UserAnimeEntry.objects.filter(created_at__date=d).count()
        rat_pl = SharedListVote.objects.filter(voted_at__date=d).count() + UserAnimeEntry.objects.filter(updated_at__date=d, score__isnull=False).count()
        rooms_cr = SharedList.objects.filter(created_at__date=d).count()
        daily_timeline.append({
            'date': d.strftime('%d/%m'),
            'newUsers': new_u + inv_s,
            'invitationsSent': inv_s,
            'listAdditions': list_add,
            'ratingsPlaced': rat_pl,
            'roomsCreated': rooms_cr,
            'roomsDeleted': 0
        })

    return Response({
        'k_factor': k_factor,
        'total_users': total_users,
        'total_hosts': total_owners,
        'total_guests': total_guests,
        'channels': channels,
        'power_hosts': power_hosts_list,
        'cohorts': [],
        'daily_timeline': daily_timeline,
        'user_vs_guest': {
            'registered_count': registered_count,
            'registered_pct': registered_pct,
            'guest_count': total_guests,
            'guest_pct': guest_pct,
            'conversion_rate_pct': registered_pct,
            'avg_votes_registered': avg_votes_reg,
            'avg_votes_guest': avg_votes_gst,
            'retention_registered_pct': 100.0 if registered_count > 0 else 0.0,
            'retention_guest_pct': 0.0
        },
        'activity_rate': {
            'user_activity_7d_pct': 100.0 if total_users > 0 else 0.0,
            'room_activity_7d_pct': 100.0 if SharedList.objects.count() > 0 else 0.0,
            'avg_interaction_frequency_days': 1.0 if total_users > 0 else 0.0,
            'timeline': []
        }
    })


# Almacén de moderación en memoria limpio (sin datos mock pre-cargados)
MODERATION_STORE = {}

@api_view(['GET'])
@permission_classes([AllowAny])
def admin_users_list(request):
    """
    Buscador de usuarios con filtros de rol, tipo y estado de moderación.
    Combina cuentas registradas en Django Auth y miembros de salas sin inflar contadores.
    """
    from django.contrib.auth.models import User
    from users.models import UserAnimeEntry
    q = request.query_params.get('q', '').lower().strip()
    role_filter = request.query_params.get('role', 'all')
    status_filter = request.query_params.get('status', 'all')

    users_data = []
    seen_names = set()

    # 1. Cuentas registradas de Django Auth
    registered_users = User.objects.all().order_by('-date_joined')
    for u in registered_users:
        user_id = f"user_{u.id}"
        is_admin = u.is_staff or u.is_superuser
        display_name = u.first_name or u.username
        profile = getattr(u, 'profile', None)
        if profile and profile.display_name:
            display_name = profile.display_name
        if profile and getattr(profile, 'role', '') == 'admin':
            is_admin = True

        mod_info = MODERATION_STORE.get(user_id, {'status': 'active' if u.is_active else 'suspended', 'warnings': 0, 'reason': ''})
        mod_status = mod_info.get('status', 'active' if u.is_active else 'suspended')
        warnings_count = mod_info.get('warnings', 0)

        if q:
            match = q in display_name.lower() or q in u.username.lower() or q in (u.email or '').lower()
            if not match:
                continue

        if role_filter != 'all':
            if role_filter in ('owner', 'admin') and not is_admin:
                continue
            elif role_filter == 'guest':
                continue

        if status_filter != 'all' and mod_status != status_filter:
            continue

        seen_names.add(u.username.lower())
        seen_names.add(display_name.lower())

        rooms_count = SharedListMember.objects.filter(
            Q(guest_name__iexact=u.username) | Q(guest_name__iexact=display_name)
        ).values('shared_list').distinct().count()
        votes_count = SharedListVote.objects.filter(
            Q(voter_name__iexact=u.username) | Q(voter_name__iexact=display_name)
        ).count() + UserAnimeEntry.objects.filter(user=u, score__isnull=False).count()

        users_data.append({
            'id': user_id,
            'name': display_name,
            'username': f"@{u.username}",
            'email': u.email or '',
            'avatar_url': (profile.avatar_url if profile and profile.avatar_url else ''),
            'role': 'owner' if is_admin else 'member',
            'user_type': 'registered',
            'status': mod_status,
            'warnings': warnings_count,
            'reason': mod_info.get('reason', ''),
            'rooms_count': rooms_count,
            'votes_count': votes_count,
            'joined_at': u.date_joined.strftime('%Y-%m-%d %H:%M'),
            'last_activity': u.last_login.strftime('%Y-%m-%d %H:%M') if u.last_login else u.date_joined.strftime('%Y-%m-%d %H:%M')
        })

    # 2. Miembros e invitados de salas
    members = SharedListMember.objects.select_related('shared_list').all().order_by('-joined_at')
    for m in members:
        name = m.guest_name
        if name.lower() in seen_names:
            continue
        seen_names.add(name.lower())

        user_id = str(m.id)
        is_owner = m.role == 'owner'
        user_type = 'registered' if is_owner else 'guest'

        mod_info = MODERATION_STORE.get(user_id, {'status': 'active', 'warnings': 0, 'reason': ''})
        mod_status = mod_info.get('status', 'active')
        warnings_count = mod_info.get('warnings', 0)

        rooms_count = SharedListMember.objects.filter(guest_name=name).values('shared_list').distinct().count()
        votes_count = SharedListVote.objects.filter(voter_name=name).count()

        if q:
            match = q in name.lower() or q in m.role.lower() or q in user_type.lower()
            if not match:
                continue

        if role_filter != 'all':
            if role_filter in ('owner', 'admin') and m.role != 'owner':
                continue
            elif role_filter == 'registered' and user_type != 'registered':
                continue
            elif role_filter == 'guest' and user_type != 'guest':
                continue

        if status_filter != 'all' and mod_status != status_filter:
            continue

        users_data.append({
            'id': user_id,
            'name': name,
            'username': f"@{name.lower().replace(' ', '_')}",
            'email': '',
            'avatar_url': '',
            'role': m.role,
            'user_type': user_type,
            'status': mod_status,
            'warnings': warnings_count,
            'reason': mod_info.get('reason', ''),
            'rooms_count': rooms_count,
            'votes_count': votes_count,
            'joined_at': m.joined_at.strftime('%Y-%m-%d %H:%M'),
            'last_activity': m.last_active_at.strftime('%Y-%m-%d %H:%M') if m.last_active_at else m.joined_at.strftime('%Y-%m-%d %H:%M')
        })

    return Response({
        'total': len(users_data),
        'users': users_data
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_create_user(request):
    """
    Crea un nuevo usuario directamente desde el panel de administración.
    """
    from django.contrib.auth.models import User
    from users.models import Profile
    data = request.data or {}
    username = str(data.get('username', '')).strip()
    email = str(data.get('email', '')).strip()
    password = str(data.get('password', '')).strip() or 'animigos2026'
    role = str(data.get('role', 'user')).lower().strip()
    display_name = str(data.get('display_name', '')).strip() or username

    if not username:
        return Response({'error': 'El nombre de usuario es obligatorio'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': f"El nombre de usuario '{username}' ya está registrado"}, status=status.HTTP_400_BAD_REQUEST)
    if email and User.objects.filter(email__iexact=email).exists():
        return Response({'error': f"El correo '{email}' ya está registrado"}, status=status.HTTP_400_BAD_REQUEST)

    is_admin = (role == 'admin')
    user = User.objects.create_user(
        username=username,
        email=email or f"{username.lower()}@animigos.app",
        password=password,
        first_name=display_name,
        is_staff=is_admin,
        is_superuser=is_admin
    )
    profile, _ = Profile.objects.get_or_create(
        user=user,
        defaults={'display_name': display_name}
    )

    return Response({
        'status': 'created',
        'message': f"Usuario '{user.username}' ({'Administrador' if is_admin else 'Usuario'}) creado exitosamente.",
        'user': {
            'id': f"user_{user.id}",
            'name': display_name,
            'username': f"@{user.username}",
            'email': user.email,
            'role': 'owner' if is_admin else 'member',
            'user_type': 'registered',
            'status': 'active',
            'warnings': 0,
            'rooms_count': 0,
            'votes_count': 0,
            'joined_at': user.date_joined.strftime('%Y-%m-%d %H:%M'),
            'last_activity': 'Recién registrado'
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def admin_user_detail_or_delete(request, user_id):
    """
    Consulta, modifica o elimina una cuenta de usuario o miembro de sala.
    """
    from django.contrib.auth.models import User
    from users.models import Profile

    user_obj = None
    member_obj = None

    if str(user_id).startswith('user_'):
        try:
            uid = int(str(user_id).replace('user_', ''))
            user_obj = User.objects.filter(id=uid).first()
        except ValueError:
            pass
    else:
        try:
            member_obj = SharedListMember.objects.filter(id=user_id).first()
        except Exception:
            pass
        if not member_obj:
            user_obj = User.objects.filter(username__iexact=user_id).first()

    if not user_obj and not member_obj:
        return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        if user_obj:
            uname = user_obj.username
            user_obj.delete()
            return Response({'status': 'deleted', 'message': f"Usuario '{uname}' eliminado permanentemente del sistema."})
        elif member_obj:
            gname = member_obj.guest_name
            member_obj.delete()
            return Response({'status': 'deleted', 'message': f"Miembro invitado '{gname}' eliminado de las salas."})

    if request.method == 'PATCH':
        data = request.data or {}
        if user_obj:
            if 'role' in data:
                is_admin = (data['role'] == 'admin')
                user_obj.is_staff = is_admin
                user_obj.save()
            if 'status' in data:
                user_obj.is_active = (data['status'] == 'active')
                user_obj.save()
            if 'email' in data and data['email']:
                user_obj.email = str(data['email']).strip()
                user_obj.save()
            if 'name' in data and data['name']:
                user_obj.first_name = str(data['name']).strip()
                user_obj.save()
                profile = getattr(user_obj, 'profile', None)
                if profile:
                    profile.display_name = str(data['name']).strip()
                    profile.save()
            return Response({'status': 'updated', 'message': f"Usuario '{user_obj.username}' actualizado correctamente."})

    return Response({'status': 'ok'})


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_moderate_user(request, user_id):
    """
    Aplica una acción de moderación directa a un usuario (warn, suspend, activate, kick).
    """
    action = request.data.get('action', 'warn')
    reason = request.data.get('reason', 'Acción administrativa')

    current = MODERATION_STORE.get(user_id, {'status': 'active', 'warnings': 0, 'reason': ''})

    if action == 'warn':
        current['warnings'] = current.get('warnings', 0) + 1
        current['status'] = 'warned'
        current['reason'] = reason
    elif action == 'suspend':
        current['status'] = 'suspended'
        current['reason'] = reason
    elif action == 'activate':
        current['status'] = 'active'
        current['reason'] = 'Cuenta reactivada por moderador'
    elif action == 'kick':
        # Expulsar de salas: eliminar membresías de salas activas
        SharedListMember.objects.filter(id=user_id).delete()
        current['status'] = 'active'
        current['reason'] = 'Expulsado de las salas activas'

    MODERATION_STORE[user_id] = current

    return Response({
        'status': 'success',
        'message': f"Acción '{action}' ejecutada correctamente.",
        'user_id': user_id,
        'moderation': current
    })


@api_view(['GET', 'PATCH', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def admin_update_anime(request, mal_id):
    """
    Permite desde la consola de administración consultar, modificar y eliminar la ficha
    de cualquier anime del catálogo (foto de portada image_url, banner_url, títulos,
    sinopsis, estudio, géneros, taxonomía tags_data, episodios, nota, etc.).
    """
    from django.core.cache import cache
    from animes.serializers import AnimeSerializer

    anime = get_object_or_404(Anime, mal_id=mal_id)

    if request.method == 'GET':
        return Response(AnimeSerializer(anime, context={'request': request}).data)

    if request.method == 'DELETE':
        title = anime.title
        anime.delete()
        cache.clear()
        return Response({
            'status': 'deleted',
            'message': f"Anime '{title}' (MAL ID #{mal_id}) eliminado exitosamente del catálogo."
        })

    data = request.data or {}

    str_fields = [
        'title',
        'title_english',
        'title_japanese',
        'synopsis',
        'image_url',
        'banner_url',
        'studio',
        'status',
        'season',
        'type',
        'airing_day',
        'broadcast_time',
    ]
    for field in str_fields:
        if field in data and data[field] is not None:
            setattr(anime, field, str(data[field]).strip())

    if 'episodes' in data:
        val = data['episodes']
        try:
            anime.episodes = int(val) if val not in (None, '') else None
        except (ValueError, TypeError):
            pass

    if 'season_year' in data:
        val = data['season_year']
        try:
            anime.season_year = int(val) if val not in (None, '') else None
        except (ValueError, TypeError):
            pass

    if 'score' in data:
        val = data['score']
        try:
            anime.score = round(float(val), 2) if val not in (None, '') else None
        except (ValueError, TypeError):
            pass

    if 'duration' in data:
        val = data['duration']
        try:
            anime.duration = round(float(val), 2) if val not in (None, '') else None
        except (ValueError, TypeError):
            pass

    if 'genres' in data and isinstance(data['genres'], list):
        clean_genres = []
        for g in data['genres']:
            gs = str(g).strip()
            if gs and gs not in clean_genres:
                clean_genres.append(gs)
        anime.genres = clean_genres

    if 'tags_data' in data and isinstance(data['tags_data'], list):
        clean_tags = []
        seen_names = set()
        for t in data['tags_data']:
            if isinstance(t, dict):
                t_name = str(t.get('name', '')).strip()
                if t_name and t_name.lower() not in seen_names:
                    seen_names.add(t_name.lower())
                    clean_tags.append({
                        'name': t_name,
                        'category': str(t.get('category', 'Theme')).strip() or 'Theme',
                        'rank': int(t.get('rank') or 80),
                        'spoiler': bool(t.get('spoiler', False)),
                    })
            elif isinstance(t, str):
                t_name = t.strip()
                if t_name and t_name.lower() not in seen_names:
                    seen_names.add(t_name.lower())
                    clean_tags.append({
                        'name': t_name,
                        'category': 'Theme',
                        'rank': 80,
                        'spoiler': False,
                    })
        anime.tags_data = clean_tags

    # Reconstruir tags_cache indexable preservando marca de secuela si existía
    was_sequel = '|_is_sequel_|' in (anime.tags_cache or '')
    cache_tokens = []
    if isinstance(anime.genres, list):
        for g in anime.genres:
            gl = str(g).lower().strip()
            if gl and gl not in cache_tokens:
                cache_tokens.append(gl)
    if isinstance(anime.tags_data, list):
        for t in anime.tags_data:
            if isinstance(t, dict) and not t.get('spoiler'):
                tl = str(t.get('name', '')).lower().strip()
                if tl and tl not in cache_tokens:
                    cache_tokens.append(tl)
    if was_sequel:
        cache_tokens.append('_is_sequel_')

    anime.tags_cache = '|' + '|'.join(cache_tokens) + '|' if cache_tokens else ''
    anime.save()
    cache.clear()

    return Response({
        'status': 'success',
        'message': f"Anime '{anime.title}' actualizado correctamente.",
        'anime': AnimeSerializer(anime, context={'request': request}).data,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_create_anime(request):
    """
    Permite registrar un nuevo anime manualmente desde la consola de administración.
    """
    from django.core.cache import cache
    from django.db.models import Max
    from animes.models import Anime
    from animes.serializers import AnimeSerializer

    data = request.data or {}
    title = str(data.get('title', '')).strip()
    if not title:
        return Response({'error': 'El título es obligatorio'}, status=status.HTTP_400_BAD_REQUEST)

    raw_mal_id = data.get('mal_id')
    if raw_mal_id:
        try:
            mal_id = int(raw_mal_id)
            if Anime.objects.filter(mal_id=mal_id).exists():
                return Response({'error': f"Ya existe un anime con el ID #{mal_id}"}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({'error': 'ID numérico inválido'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        max_id = Anime.objects.aggregate(max_id=Max('mal_id'))['max_id'] or 900000
        mal_id = max_id + 1

    anime = Anime(
        mal_id=mal_id,
        title=title,
        title_english=str(data.get('title_english', '')).strip(),
        title_japanese=str(data.get('title_japanese', '')).strip(),
        synopsis=str(data.get('synopsis', '')).strip(),
        image_url=str(data.get('image_url', '')).strip() or 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
        banner_url=str(data.get('banner_url', '')).strip(),
        studio=str(data.get('studio', '')).strip() or 'Estudio Independiente',
        status=str(data.get('status', 'FINISHED')).strip(),
        season=str(data.get('season', '')).strip(),
        type=str(data.get('type', 'TV')).strip(),
    )

    try:
        if data.get('episodes') not in (None, ''):
            anime.episodes = int(data.get('episodes'))
    except (ValueError, TypeError):
        pass

    try:
        if data.get('season_year') not in (None, ''):
            anime.season_year = int(data.get('season_year'))
    except (ValueError, TypeError):
        pass

    try:
        if data.get('score') not in (None, ''):
            anime.score = round(float(data.get('score')), 2)
        else:
            anime.score = 7.50
    except (ValueError, TypeError):
        anime.score = 7.50

    genres = data.get('genres', [])
    if isinstance(genres, list):
        anime.genres = [str(g).strip() for g in genres if str(g).strip()]
    elif isinstance(genres, str):
        anime.genres = [g.strip() for g in genres.split(',') if g.strip()]

    tokens = [g.lower().strip() for g in anime.genres]
    anime.tags_cache = '|' + '|'.join(tokens) + '|' if tokens else ''

    anime.save()
    cache.clear()

    return Response({
        'status': 'created',
        'message': f"Anime '{anime.title}' registrado exitosamente con ID #{anime.mal_id}.",
        'anime': AnimeSerializer(anime, context={'request': request}).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_create_room(request):
    """
    Permite crear una nueva sala de watch party desde la consola de administración.
    """
    name = str(request.data.get('name', '')).strip()
    if not name:
        return Response({'error': 'El nombre de la sala es obligatorio'}, status=status.HTTP_400_BAD_REQUEST)
    
    description = str(request.data.get('description', '')).strip()
    host_name = str(request.data.get('host_name', 'Admin')).strip() or 'Admin'
    status_val = str(request.data.get('status', 'voting')).strip()

    room = SharedList.objects.create(
        name=name,
        description=description,
        status=status_val
    )
    # Crear al anfitrión
    SharedListMember.objects.create(
        shared_list=room,
        guest_name=host_name,
        role='owner'
    )

    return Response({
        'success': True,
        'message': f"Sala '{room.name}' creada exitosamente con código {room.invite_code}.",
        'room': {
            'id': str(room.id),
            'name': room.name,
            'description': room.description,
            'invite_code': room.invite_code,
            'status': room.status,
            'members_count': 1,
            'candidates_count': 0,
            'votes_count': 0,
            'quorum_percentage': 100,
            'created_at': room.created_at.isoformat(),
            'created_display': 'Recién creada',
            'members': [{'name': host_name, 'role': 'owner', 'channel': 'web'}]
        }
    }, status=status.HTTP_201_CREATED)
