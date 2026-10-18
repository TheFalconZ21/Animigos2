import React, { useState } from "react";
import { calculateHappinessScore, VoteInput } from "../core-engine";

export interface CandidateVotingCardProps {
  malId: number;
  title: string;
  imageUrl?: string;
  malScore: number;
  malScoredBy?: number;
  episodesCount?: number;
  currentUserId: string;
  currentUserName: string;
  initialVotes: VoteInput[];
  onVoteChange?: (candidateMalId: number, newScore: number) => void;
}

/**
 * Componente React con Bootstrap 5 para votación de animes candidatos
 * y visualización del Algoritmo de Felicidad Grupal en tiempo real.
 */
export const CandidateVotingCard: React.FC<CandidateVotingCardProps> = ({
  malId,
  title,
  imageUrl = "https://placehold.co/300x450?text=Anime",
  malScore,
  malScoredBy = 50000,
  episodesCount = 12,
  currentUserId,
  currentUserName,
  initialVotes,
  onVoteChange,
}) => {
  const existingVote = initialVotes.find((v) => v.voterId === currentUserId);
  const [userScore, setUserScore] = useState<number>(existingVote ? existingVote.interestScore : 5);

  // Votos actualizados incluyendo el cambio reactivo del usuario actual
  const activeVotes: VoteInput[] = [
    ...initialVotes.filter((v) => v.voterId !== currentUserId),
    { voterId: currentUserId, voterName: currentUserName, interestScore: userScore },
  ];

  // Ejecución del algoritmo puro de felicidad grupal
  const happinessResult = calculateHappinessScore({
    malId,
    title,
    malScore,
    malScoredBy,
    votes: activeVotes,
    totalMembersCount: Math.max(activeVotes.length, 3),
    episodesCount,
  });

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setUserScore(val);
    if (onVoteChange) {
      onVoteChange(malId, val);
    }
  };

  // Badge contextual según la felicidad
  const getScoreBadgeClass = (score: number) => {
    if (score >= 8.0) return "bg-success text-white";
    if (score >= 6.0) return "bg-primary text-white";
    if (score >= 4.0) return "bg-warning text-dark";
    return "bg-danger text-white";
  };

  return (
    <div className="card shadow-sm border-0 mb-4 overflow-hidden">
      <div className="row g-0">
        {/* Portada */}
        <div className="col-12 col-md-3 text-center bg-dark">
          <img
            src={imageUrl}
            alt={title}
            className="img-fluid w-100 h-100 object-fit-cover"
            style={{ maxHeight: "280px" }}
          />
        </div>

        {/* Contenido y Métricas */}
        <div className="col-12 col-md-9 d-flex flex-column">
          <div className="card-body pb-2">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
              <div>
                <h5 className="card-title fw-bold mb-1 text-dark">{title}</h5>
                <span className="badge bg-secondary me-2">⭐ MAL: {malScore}</span>
                <span className="badge bg-light text-secondary border">{episodesCount} eps</span>
              </div>

              {/* Indicador de Felicidad Grupal */}
              <div className="text-end">
                <span className="text-muted small d-block">Felicidad Grupal</span>
                <span className={`badge fs-5 px-3 py-1 ${getScoreBadgeClass(happinessResult.finalScore)}`}>
                  {happinessResult.finalScore} / 10
                </span>
              </div>
            </div>

            {/* Slider de votación personal */}
            <div className="bg-light p-3 rounded-3 border mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label htmlFor={`vote-range-${malId}`} className="form-label small fw-bold mb-0">
                  Tus ganas de ver este anime:
                </label>
                <span className="badge bg-dark fs-6 px-2.5 py-1">{userScore} / 10</span>
              </div>
              <input
                id={`vote-range-${malId}`}
                type="range"
                className="form-range"
                min="0"
                max="10"
                step="1"
                value={userScore}
                onChange={handleSliderChange}
              />
              <div className="d-flex justify-content-between text-muted small" style={{ fontSize: "0.75rem" }}>
                <span>0 (Cero ganas)</span>
                <span>5 (Neutro)</span>
                <span>10 (¡Quiero verlo ya!)</span>
              </div>
            </div>

            {/* Explicabilidad generada por el algoritmo */}
            <div className="small">
              <h6 className="fw-bold text-secondary mb-1" style={{ fontSize: "0.85rem" }}>
                💡 Análisis del Grupo:
              </h6>
              <ul className="list-unstyled mb-0 text-muted">
                {happinessResult.explanations.map((exp, idx) => (
                  <li key={idx} className="mb-1">
                    • {exp}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer con desglose de consenso */}
          <div className="card-footer bg-white border-top-0 pt-0 d-flex justify-content-between text-muted small pb-3">
            <span>Media del grupo: <strong>{happinessResult.interestMean}</strong></span>
            <span>Discrepancia: <strong>{happinessResult.interestDispersion > 2 ? "Alta ⚠️" : "Baja ✅"}</strong></span>
            <span>Participación: <strong>{happinessResult.quorumPercentage}%</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
