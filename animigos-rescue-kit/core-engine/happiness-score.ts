/**
 * @file happiness-score.ts
 * @description Módulo para el cálculo del Algoritmo de Felicidad Grupal en Animigos.
 * 
 * Este algoritmo evalúa un anime candidato dentro de una lista compartida
 * y determina la probabilidad de generar una alta satisfacción en todo el grupo.
 * 
 * Cumple estrictamente con la Regla de Documentación de Código.
 */

export interface VoteInput {
  /** ID del usuario o token del invitado que emitió el voto */
  voterId: string;
  /** Nombre del votante para generar explicaciones personalizadas */
  voterName: string;
  /** Puntuación de interés / ganas de ver el anime (0 a 10) */
  interestScore: number;
}

export interface CandidateScoreInput {
  /** ID del anime en MyAnimeList */
  malId: number;
  /** Título del anime */
  title: string;
  /** Calificación promedio en MyAnimeList (0 a 10) */
  malScore: number | null;
  /** Cantidad de usuarios que han valorado el anime en MAL */
  malScoredBy: number | null;
  /** Arreglo de votos emitidos por los integrantes de la lista compartida */
  votes: VoteInput[];
  /** Total de miembros de la lista compartida para calcular quórum */
  totalMembersCount?: number;
  /** Número aproximado de episodios */
  episodesCount?: number;
}

export interface HappinessScoreResult {
  /** Puntuación final de felicidad grupal (Escala 0 a 10) */
  finalScore: number;
  /** Promedio directo de las ganas del grupo */
  interestMean: number;
  /** Desviación estándar de los votos (medida de desacuerdo/dispersión) */
  interestDispersion: number;
  /** Penalización aplicada por alta discrepancia entre integrantes */
  dispersionPenalty: number;
  /** Ponderación sumada por la nota global de MyAnimeList */
  malScoreContribution: number;
  /** Ponderación sumada por la popularidad/confianza de MyAnimeList */
  popularityContribution: number;
  /** Factor/Bonus por duración adecuada */
  durationContribution: number;
  /** Porcentaje de quórum / participación de votantes (0-100) */
  quorumPercentage: number;
  /** Cantidad actual de votos emitidos */
  votesCount: number;
  /** Total de integrantes esperados */
  totalMembers: number;
  /** Arreglo de razones en lenguaje natural que explican la puntuación */
  explanations: string[];
}

/**
 * Calcula la puntuación de felicidad grupal de un anime candidato.
 * 
 * @param input Datos del candidato y votos del grupo
 * @returns HappinessScoreResult con desglose y explicabilidad en lenguaje natural
 */
export function calculateHappinessScore(input: CandidateScoreInput): HappinessScoreResult {
  const { votes, malScore, malScoredBy, title, totalMembersCount = 4, episodesCount = 24 } = input;
  const explanations: string[] = [];

  // Si no hay votos registrados, devolver puntuación cero por defecto
  if (!votes || votes.length === 0) {
    return {
      finalScore: 0,
      interestMean: 0,
      interestDispersion: 0,
      dispersionPenalty: 0,
      malScoreContribution: 0,
      popularityContribution: 0,
      durationContribution: 0,
      quorumPercentage: 0,
      votesCount: 0,
      totalMembers: totalMembersCount,
      explanations: ["Aún no hay votos registrados en el grupo para este anime."],
    };
  }

  // 1. CÁLCULO DE LA MEDIA DE GANAS DEL GRUPO (InterestMean)
  const totalInterest = votes.reduce((sum, vote) => sum + vote.interestScore, 0);
  const interestMean = totalInterest / votes.length;

  // 2. CÁLCULO DE LA DISPERSIÓN (Varianza y Desviación Estándar)
  const variance = votes.reduce((sum, vote) => {
    const diff = vote.interestScore - interestMean;
    return sum + diff * diff;
  }, 0) / votes.length;
  
  const interestDispersion = Math.sqrt(variance);

  /**
   * Factor de penalización por dispersión:
   * Multiplica la desviación estándar por 0.3.
   */
  const dispersionPenalty = Number((interestDispersion * 0.3).toFixed(2));

  // 3. APORTE DE LA NOTA EXTERNA (MyAnimeList)
  const validMalScore = malScore && malScore > 0 ? malScore : 7.0;
  const malScoreContribution = Number(((validMalScore / 10) * 1.5).toFixed(2));

  // 4. APORTE DE POPULARIDAD / CONFIANZA
  const validScoredBy = malScoredBy && malScoredBy > 0 ? malScoredBy : 1000;
  const rawPopularityFactor = Math.min(Math.log10(validScoredBy) / 6.0, 1.0);
  const popularityContribution = Number((rawPopularityFactor * 0.5).toFixed(2));

  // 5. APORTE POR DURACIÓN ESTRATÉGICA (Formato corto/medio ideal para maratón de grupo)
  let durationContribution = 0;
  if (episodesCount >= 12 && episodesCount <= 28) {
    durationContribution = 0.4; // Bonus por maratoneable ideal
  } else if (episodesCount > 100) {
    durationContribution = -0.5; // Ligera penalización por ser demasiado extenso
  }

  // 6. QUÓRUM Y PARTICIPACIÓN
  const votesCount = votes.length;
  const totalMembers = Math.max(votesCount, totalMembersCount);
  const quorumPercentage = Math.round((votesCount / totalMembers) * 100);

  // 7. CÁLCULO FINAL NORMALIZADO (Rango 0 a 10)
  let rawScore = interestMean - dispersionPenalty + malScoreContribution + popularityContribution + durationContribution;
  const finalScore = Number(Math.max(0, Math.min(10, rawScore)).toFixed(1));

  // 8. GENERACIÓN DE EXPLICABILIDAD EN LENGUAJE NATURAL
  if (interestDispersion <= 1.2 && interestMean >= 7.0) {
    explanations.push(
      `¡Consenso alto! Todos los integrantes mostraron mucho interés por ver "${title}" y hay muy poca diferencia entre las valoraciones.`
    );
  } else if (interestDispersion > 2.8) {
    explanations.push(
      `Existe división en el grupo: mientras algunos integrantes tienen muchas ganas, otros mostraron poco interés.`
    );
  }

  const zeroVoters = votes.filter((v) => v.interestScore === 0).map((v) => v.voterName);
  if (zeroVoters.length > 0) {
    explanations.push(
      `${zeroVoters.join(", ")} no tiene${zeroVoters.length > 1 ? "n" : ""} ganas de ver este anime (0/10).`
    );
  }

  if (malScore && malScore >= 8.5 && interestMean < 6.0) {
    explanations.push(
      `Aunque tiene una excelente calificación global en MyAnimeList (${malScore}/10), el interés directo del grupo es moderado.`
    );
  }

  if (explanations.length === 0) {
    explanations.push(
      `Opción equilibrada con un promedio de ganas del grupo de ${interestMean.toFixed(1)}/10.`
    );
  }

  return {
    finalScore,
    interestMean: Number(interestMean.toFixed(1)),
    interestDispersion: Number(interestDispersion.toFixed(2)),
    dispersionPenalty,
    malScoreContribution,
    popularityContribution,
    durationContribution,
    quorumPercentage,
    votesCount,
    totalMembers,
    explanations,
  };
}
