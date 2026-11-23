from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from .models import ContentReport

VALID_CONTENT_TYPES = {'profile_wall', 'chat_message', 'recommendation', 'suggestion', 'poll', 'other'}
VALID_CATEGORIES = {'toxicity', 'spoilers', 'spam', 'other'}

CATEGORY_TO_SEVERITY = {
    'toxicity': 'high',
    'spoilers': 'medium',
    'spam': 'low',
    'other': 'medium',
}


def _resolve_reported_user(reported_username: str):
    cleaned = (reported_username or '').strip().lstrip('@')
    if not cleaned:
        return None
    return (
        User.objects.select_related('profile')
        .filter(Q(username__iexact=cleaned) | Q(profile__display_name__iexact=cleaned))
        .first()
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_content_report_view(request):
    """Permite a cualquier usuario autenticado reportar contenido o conducta ofensiva."""
    data = request.data or {}
    content_type = str(data.get('content_type') or 'other').strip()
    if content_type not in VALID_CONTENT_TYPES:
        content_type = 'other'

    category = str(data.get('category') or 'toxicity').strip()
    if category not in VALID_CATEGORIES:
        category = 'toxicity'

    reason = str(data.get('reason') or '').strip()[:1000]
    reported_username = str(data.get('reported_username') or '').strip().lstrip('@')[:150]
    target_id = str(data.get('target_id') or '').strip()[:120]
    target_excerpt = str(data.get('target_excerpt') or '').strip()[:600]
    context_label = str(data.get('context_label') or '').strip()[:200]

    reported_user = _resolve_reported_user(reported_username)
    if reported_user and reported_user.id == request.user.id:
        return Response(
            {'error': 'No puedes reportarte a ti mismo.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Evitar duplicados abiertos del mismo reportante sobre el mismo elemento
    if target_id:
        existing = ContentReport.objects.filter(
            reporter=request.user,
            content_type=content_type,
            target_id=target_id,
            status='open',
        ).first()
        if existing:
            return Response(
                {
                    'id': existing.id,
                    'already_reported': True,
                    'message': 'Ya enviaste un reporte sobre este elemento. Nuestro equipo lo revisará.',
                },
                status=status.HTTP_200_OK,
            )

    severity = CATEGORY_TO_SEVERITY.get(category, 'medium')
    report = ContentReport.objects.create(
        reporter=request.user,
        reported_user=reported_user,
        reported_username=reported_username or (reported_user.username if reported_user else 'Desconocido'),
        content_type=content_type,
        category=category,
        severity=severity,
        reason=reason or 'Reporte de conducta o contenido ofensivo.',
        target_id=target_id,
        target_excerpt=target_excerpt,
        context_label=context_label or dict(ContentReport.CONTENT_TYPE_CHOICES).get(content_type, 'Plataforma'),
    )

    return Response(
        {
            'id': report.id,
            'already_reported': False,
            'message': 'Reporte enviado correctamente. Gracias por ayudar a mantener segura la comunidad.',
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_list_reports_view(request):
    """Lista los reportes abiertos para el panel de Moderación del Admin Console."""
    status_filter = request.query_params.get('status', 'open')
    qs = ContentReport.objects.select_related('reporter', 'reporter__profile', 'reported_user', 'reported_user__profile')
    if status_filter and status_filter != 'all':
        qs = qs.filter(status=status_filter)

    items = []
    for r in qs[:100]:
        rep_user = r.reported_user
        rep_profile = getattr(rep_user, 'profile', None) if rep_user else None
        reporter_profile = getattr(r.reporter, 'profile', None)
        reporter_name = (
            (reporter_profile.display_name if reporter_profile and reporter_profile.display_name else None)
            or r.reporter.username
        )
        reported_name = (
            (rep_profile.display_name if rep_profile and rep_profile.display_name else None)
            or (rep_user.username if rep_user else None)
            or r.reported_username
            or 'Usuario'
        )
        # Mapear 'other' a 'toxicity' para compatibilidad con las 3 categorías del dashboard de moderación
        ui_category = r.category if r.category in ('toxicity', 'spoilers', 'spam') else 'toxicity'
        items.append({
            'id': str(r.id),
            'category': ui_category,
            'contentType': r.content_type,
            'reportedUserId': str(rep_user.id) if rep_user else f'ext_{r.id}',
            'reportedUserName': reported_name,
            'reportedUserUsername': rep_user.username if rep_user else r.reported_username,
            'reportedUserEmail': rep_user.email if rep_user else '',
            'reportedUserAvatar': (rep_profile.avatar_url if rep_profile and rep_profile.avatar_url else ''),
            'reporterName': reporter_name,
            'reason': r.reason,
            'context': r.context_label or r.get_content_type_display(),
            'targetComment': r.target_excerpt,
            'timestamp': r.created_at.strftime('%d/%m/%Y %H:%M'),
            'severity': r.severity,
            'status': r.status,
        })

    return Response({'reports': items, 'count': len(items)})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_resolve_report_view(request, report_id):
    """Marca un reporte como resuelto o descartado desde Moderación."""
    try:
        report = ContentReport.objects.get(id=report_id)
    except ContentReport.DoesNotExist:
        return Response({'error': 'Reporte no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    action = str((request.data or {}).get('action') or 'resolved').strip()
    report.status = 'dismissed' if action == 'dismissed' else 'resolved'
    report.resolved_by = request.user
    report.resolved_at = timezone.now()
    report.save(update_fields=['status', 'resolved_by', 'resolved_at'])

    return Response({'id': str(report.id), 'status': report.status})
