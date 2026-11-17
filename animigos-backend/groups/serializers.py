from rest_framework import serializers
from .models import (
    SharedList,
    SharedListMember,
    SharedListCandidate,
    SharedListVote,
    SharedListWatchingAnime,
    SharedListAnimeParticipation,
)
from animes.serializers import AnimeSerializer
from .services.happiness import calculate_happiness_score

class SharedListVoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SharedListVote
        fields = ['id', 'candidate', 'voter_id', 'voter_name', 'interest_score', 'voted_at']


class SharedListMemberSerializer(serializers.ModelSerializer):
    sync_status = serializers.SerializerMethodField()
    episodes_behind = serializers.SerializerMethodField()

    class Meta:
        model = SharedListMember
        fields = [
            'id',
            'guest_token',
            'guest_name',
            'role',
            'episodes_watched',
            'last_active_at',
            'joined_at',
            'sync_status',
            'episodes_behind',
        ]

    def get_sync_status(self, obj):
        target = obj.shared_list.current_episode
        if obj.episodes_watched > target:
            return 'adelantado'
        elif obj.episodes_watched == target:
            return 'al_dia'
        return 'atrasado'

    def get_episodes_behind(self, obj):
        target = obj.shared_list.current_episode
        return max(0, target - obj.episodes_watched)


class SharedListCandidateSerializer(serializers.ModelSerializer):
    anime = AnimeSerializer(read_only=True)
    anime_id = serializers.IntegerField(write_only=True)
    votes = SharedListVoteSerializer(many=True, read_only=True)
    happiness_result = serializers.SerializerMethodField()

    class Meta:
        model = SharedListCandidate
        fields = ['id', 'shared_list', 'anime', 'anime_id', 'suggested_by', 'added_at', 'votes', 'happiness_result']
        read_only_fields = ['id', 'added_at']

    def get_happiness_result(self, obj):
        votes_data = [
            {
                "voter_id": v.voter_id,
                "voter_name": v.voter_name,
                "interest_score": v.interest_score,
            }
            for v in obj.votes.all()
        ]
        
        total_members = obj.shared_list.members.count()
        anime = obj.anime

        return calculate_happiness_score(
            votes=votes_data,
            mal_score=float(anime.score) if anime.score else None,
            mal_scored_by=anime.scored_by,
            title=anime.title,
            total_members_count=total_members if total_members > 0 else 4,
            episodes_count=anime.episodes or 24
        )


class SharedListAnimeParticipationSerializer(serializers.ModelSerializer):
    member_id = serializers.UUIDField(source='member.id', read_only=True)
    guest_name = serializers.SerializerMethodField()
    guest_token = serializers.CharField(source='member.guest_token', read_only=True)
    sync_status = serializers.SerializerMethodField()
    episodes_behind = serializers.SerializerMethodField()

    class Meta:
        model = SharedListAnimeParticipation
        fields = [
            'id',
            'member_id',
            'guest_name',
            'guest_token',
            'episodes_watched',
            'is_participating',
            'sync_status',
            'episodes_behind',
            'joined_at',
        ]

    def get_guest_name(self, obj):
        import urllib.parse
        return urllib.parse.unquote_plus(obj.member.guest_name).strip()

    def get_sync_status(self, obj):
        target = obj.watching_anime.current_episode
        if obj.episodes_watched > target:
            return 'adelantado'
        elif obj.episodes_watched == target:
            return 'al_dia'
        return 'atrasado'

    def get_episodes_behind(self, obj):
        target = obj.watching_anime.current_episode
        return max(0, target - obj.episodes_watched)


class SharedListWatchingAnimeSerializer(serializers.ModelSerializer):
    anime = AnimeSerializer(read_only=True)
    anime_id = serializers.IntegerField(source='anime.mal_id', read_only=True)
    participations = SharedListAnimeParticipationSerializer(many=True, read_only=True)
    participants_count = serializers.SerializerMethodField()
    episodes_total = serializers.SerializerMethodField()

    class Meta:
        model = SharedListWatchingAnime
        fields = [
            'id',
            'anime_id',
            'anime',
            'current_episode',
            'episodes_total',
            'is_active',
            'started_at',
            'completed_at',
            'participants_count',
            'participations',
        ]

    def get_participants_count(self, obj):
        return obj.participations.filter(is_participating=True).count()

    def get_episodes_total(self, obj):
        return obj.anime.episodes or 24


class SharedListSerializer(serializers.ModelSerializer):
    members = serializers.SerializerMethodField()
    members_count = serializers.SerializerMethodField()
    candidates = SharedListCandidateSerializer(many=True, read_only=True)
    watching_animes = SharedListWatchingAnimeSerializer(many=True, read_only=True)
    selected_anime_detail = AnimeSerializer(source='selected_anime', read_only=True)
    catchup_members = serializers.SerializerMethodField()

    class Meta:
        model = SharedList
        fields = [
            'id',
            'name',
            'description',
            'status',
            'invite_code',
            'current_episode',
            'max_members',
            'criteria_data',
            'next_session_date',
            'session_notes',
            'selected_anime',
            'selected_anime_detail',
            'watching_animes',
            'created_at',
            'updated_at',
            'members_count',
            'members',
            'candidates',
            'catchup_members',
        ]
        read_only_fields = ['id', 'invite_code', 'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Estados estrictos de la sala: 'deciding' ("Decidiendo") o 'watching' ("Viendo")
        has_watching = instance.watching_animes.filter(is_active=True).exists()
        data['status'] = 'watching' if has_watching else 'deciding'
        return data

    def get_members(self, obj):
        import urllib.parse
        seen = set()
        deduped = []
        raw_members = sorted(
            obj.members.all(),
            key=lambda x: (0 if x.role == 'owner' else 1, getattr(x, 'joined_at', None))
        )
        for m in raw_members:
            clean_name = urllib.parse.unquote_plus(m.guest_name).strip()
            dedup_key = clean_name.lower()
            if dedup_key in seen:
                continue
            seen.add(dedup_key)
            deduped.append(m)
        return SharedListMemberSerializer(deduped, many=True).data

    def get_members_count(self, obj):
        return len(self.get_members(obj))

    def get_catchup_members(self, obj):
        target = obj.current_episode
        seen = set()
        result = []
        raw_members = sorted(
            obj.members.all(),
            key=lambda x: (0 if x.role == 'owner' else 1, getattr(x, 'joined_at', None))
        )
        for m in raw_members:
            import urllib.parse
            clean_name = urllib.parse.unquote_plus(m.guest_name).strip()
            dedup_key = clean_name.lower()
            if dedup_key in seen:
                continue
            seen.add(dedup_key)
            if m.episodes_watched < target:
                result.append({
                    'id': str(m.id),
                    'guest_name': clean_name,
                    'episodes_watched': m.episodes_watched,
                    'episodes_behind': max(0, target - m.episodes_watched),
                })
        return result
