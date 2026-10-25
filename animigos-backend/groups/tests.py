from django.test import TestCase
from animes.models import Anime
from groups.models import SharedList, SharedListMember, SharedListCandidate, SharedListVote
from groups.services.happiness import calculate_happiness_score

class HappinessAlgorithmTests(TestCase):
    def test_happiness_calculation_high_consensus(self):
        votes = [
            {"voter_id": "1", "voter_name": "Ana", "interest_score": 9},
            {"voter_id": "2", "voter_name": "Bob", "interest_score": 9},
            {"voter_id": "3", "voter_name": "Carlos", "interest_score": 8},
        ]
        result = calculate_happiness_score(
            votes=votes,
            mal_score=8.5,
            mal_scored_by=200000,
            title="Frieren",
            total_members_count=3,
            episodes_count=28
        )
        self.assertGreaterEqual(result["finalScore"], 8.0)
        self.assertIn("¡Consenso alto!", result["explanations"][0])

    def test_happiness_calculation_zero_votes(self):
        result = calculate_happiness_score(votes=[], title="Vacio")
        self.assertEqual(result["finalScore"], 0.0)

class SharedListAPITests(TestCase):
    def setUp(self):
        self.anime = Anime.objects.create(
            mal_id=1,
            title="Cowboy Bebop",
            score=8.75,
            studio="Sunrise",
            genres=["Action", "Sci-Fi"]
        )

    def test_create_room_and_nominate(self):
        room = SharedList.objects.create(name="Sala Otaku")
        candidate = SharedListCandidate.objects.create(
            shared_list=room,
            anime=self.anime,
            suggested_by="Sora"
        )
        vote = SharedListVote.objects.create(
            candidate=candidate,
            voter_id="user_123",
            voter_name="Sora",
            interest_score=10
        )
        self.assertEqual(room.candidates.count(), 1)
        self.assertEqual(candidate.votes.first().interest_score, 10)
