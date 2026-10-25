"""
Servicio para el cálculo del Algoritmo de Felicidad Grupal en Animigos.

Evalúa un anime candidato dentro de una lista compartida y determina
la probabilidad de generar alta satisfacción en todo el grupo.
"""

import math
from typing import List, Dict, Any, Optional

def calculate_happiness_score(
    votes: List[Dict[str, Any]],
    mal_score: Optional[float] = None,
    mal_scored_by: Optional[int] = None,
    title: str = "Anime",
    total_members_count: int = 4,
    episodes_count: int = 24
) -> Dict[str, Any]:
    explanations: List[str] = []

    if not votes:
        return {
            "finalScore": 0.0,
            "final_score": 0.0,
            "interestMean": 0.0,
            "interest_mean": 0.0,
            "interestDispersion": 0.0,
            "interest_dispersion": 0.0,
            "dispersionPenalty": 0.0,
            "dispersion_penalty": 0.0,
            "malScoreContribution": 0.0,
            "mal_score_contribution": 0.0,
            "popularityContribution": 0.0,
            "popularity_contribution": 0.0,
            "durationContribution": 0.0,
            "duration_contribution": 0.0,
            "quorumPercentage": 0,
            "quorum_percentage": 0,
            "votesCount": 0,
            "votes_count": 0,
            "totalMembers": total_members_count,
            "total_members": total_members_count,
            "explanations": ["Aún no hay votos registrados en el grupo para este anime."],
        }

    # 1. Media de ganas del grupo (InterestMean)
    total_interest = sum(v["interest_score"] for v in votes)
    interest_mean = total_interest / len(votes)

    # 2. Dispersión (Varianza y Desviación Estándar)
    variance = sum((v["interest_score"] - interest_mean) ** 2 for v in votes) / len(votes)
    interest_dispersion = math.sqrt(variance)

    # Factor de penalización por dispersión
    dispersion_penalty = round(interest_dispersion * 0.3, 2)

    # 3. Aporte de la nota externa (MyAnimeList)
    valid_mal_score = float(mal_score) if mal_score and float(mal_score) > 0 else 7.0
    mal_score_contribution = round((valid_mal_score / 10.0) * 1.5, 2)

    # 4. Aporte de popularidad / confianza
    valid_scored_by = mal_scored_by if mal_scored_by and mal_scored_by > 0 else 1000
    raw_popularity_factor = min(math.log10(valid_scored_by) / 6.0, 1.0)
    popularity_contribution = round(raw_popularity_factor * 0.5, 2)

    # 5. Aporte por duración estratégica
    duration_contribution = 0.0
    if 12 <= episodes_count <= 28:
        duration_contribution = 0.4  # Bonus por maratón ideal
    elif episodes_count > 100:
        duration_contribution = -0.5  # Penalización leve por extensión

    # 6. Quórum y participación
    votes_count = len(votes)
    total_members = max(votes_count, total_members_count)
    quorum_percentage = round((votes_count / total_members) * 100)

    # 7. Cálculo final normalizado (0 a 10)
    raw_score = interest_mean - dispersion_penalty + mal_score_contribution + popularity_contribution + duration_contribution
    final_score = round(max(0.0, min(10.0, raw_score)), 1)

    # 8. Explicabilidad en lenguaje natural
    if interest_dispersion <= 1.2 and interest_mean >= 7.0:
        explanations.append(
            f'¡Consenso alto! Todos los integrantes mostraron mucho interés por ver "{title}" y hay muy poca diferencia entre las valoraciones.'
        )
    elif interest_dispersion > 2.8:
        explanations.append(
            'Existe división en el grupo: mientras algunos integrantes tienen muchas ganas, otros mostraron poco interés.'
        )

    zero_voters = [v.get("voter_name", "Alguien") for v in votes if v["interest_score"] == 0]
    if zero_voters:
        verb = "no tienen ganas" if len(zero_voters) > 1 else "no tiene ganas"
        explanations.append(f"{', '.join(zero_voters)} {verb} de ver este anime (0/10).")

    if mal_score and float(mal_score) >= 8.5 and interest_mean < 6.0:
        explanations.append(
            f"Aunque tiene una excelente calificación global en MyAnimeList ({mal_score}/10), el interés directo del grupo es moderado."
        )

    if not explanations:
        explanations.append(f"Opción equilibrada con un promedio de ganas del grupo de {round(interest_mean, 1)}/10.")

    res = {
        "final_score": final_score,
        "finalScore": final_score,
        "interest_mean": round(interest_mean, 1),
        "interestMean": round(interest_mean, 1),
        "interest_dispersion": round(interest_dispersion, 2),
        "interestDispersion": round(interest_dispersion, 2),
        "dispersion_penalty": dispersion_penalty,
        "dispersionPenalty": dispersion_penalty,
        "mal_score_contribution": mal_score_contribution,
        "malScoreContribution": mal_score_contribution,
        "popularity_contribution": popularity_contribution,
        "popularityContribution": popularity_contribution,
        "duration_contribution": duration_contribution,
        "durationContribution": duration_contribution,
        "quorum_percentage": quorum_percentage,
        "quorumPercentage": quorum_percentage,
        "votes_count": votes_count,
        "votesCount": votes_count,
        "total_members": total_members,
        "totalMembers": total_members,
        "explanations": explanations,
    }
    return res
