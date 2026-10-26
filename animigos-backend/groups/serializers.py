from rest_framework import serializers
from .models import SharedList, SharedListMember, SharedListCandidate, SharedListVote
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


class SharedListSerializer(serializers.ModelSerializer):
    members = SharedListMemberSerializer(many=True, read_only=True)
    candidates = SharedListCandidateSerializer(many=True, read_only=True)
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
            'next_session_date',
            'session_notes',
            'selected_anime',
            'selected_anime_detail',
            'created_at',
            'updated_at',
            'members',
            'candidates',
            'catchup_members',
        ]
        read_only_fields = ['id', 'invite_code', 'created_at', 'updated_at']

    def get_catchup_members(self, obj):
        target = obj.current_episode
        return [
            {
                'id': str(m.id),
                'guest_name': m.guest_name,
                'episodes_watched': m.episodes_watched,
                'episodes_behind': max(0, target - m.episodes_watched),
            }
            for m in obj.members.all()
            if m.episodes_watched < target
        ]
