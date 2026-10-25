from rest_framework import serializers
from .models import SharedList, SharedListMember, SharedListCandidate, SharedListVote
from animes.serializers import AnimeSerializer
from .services.happiness import calculate_happiness_score

class SharedListVoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SharedListVote
        fields = ['id', 'candidate', 'voter_id', 'voter_name', 'interest_score', 'voted_at']


class SharedListMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = SharedListMember
        fields = ['id', 'guest_token', 'guest_name', 'role', 'joined_at']


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

    class Meta:
        model = SharedList
        fields = [
            'id',
            'name',
            'description',
            'status',
            'invite_code',
            'selected_anime',
            'selected_anime_detail',
            'created_at',
            'updated_at',
            'members',
            'candidates',
        ]
        read_only_fields = ['id', 'invite_code', 'created_at', 'updated_at']
