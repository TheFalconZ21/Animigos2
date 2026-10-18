import React from "react";
import { ExtendedAnime } from "../core-engine";

export interface AnimeCatalogCardProps {
  anime: ExtendedAnime;
  isPostulated?: boolean;
  onPostulate?: (anime: ExtendedAnime) => void;
  onOpenDetails?: (anime: ExtendedAnime) => void;
}

/**
 * Tarjeta de catálogo de anime construida con Bootstrap 5.
 * Adaptada para el grid de Bootstrap (col-6 col-md-4 col-xl-3).
 */
export const AnimeCatalogCard: React.FC<AnimeCatalogCardProps> = ({
  anime,
  isPostulated = false,
  onPostulate,
  onOpenDetails,
}) => {
  return (
    <div className="card h-100 shadow-sm border-0 transition-hover">
      {/* Portada con Badge de Nota */}
      <div className="position-relative overflow-hidden" style={{ height: "260px" }}>
        <img
          src={anime.imageUrl}
          alt={anime.title}
          className="card-img-top w-100 h-100 object-fit-cover"
        />
        <div className="position-absolute top-0 end-0 m-2">
          <span className="badge bg-dark bg-opacity-75 shadow-sm fs-6">
            ⭐ {anime.score > 0 ? anime.score.toFixed(1) : "N/A"}
          </span>
        </div>
        {anime.episodes && (
          <div className="position-absolute bottom-0 start-0 m-2">
            <span className="badge bg-secondary bg-opacity-75 shadow-sm">
              {anime.episodes} episodios
            </span>
          </div>
        )}
      </div>

      {/* Cuerpo */}
      <div className="card-body d-flex flex-column p-3">
        <h6 className="card-title fw-bold text-truncate mb-1" title={anime.title}>
          {anime.title}
        </h6>
        <p className="text-muted small mb-2 text-truncate">
          {anime.studio || "Estudio no especificado"} • {anime.year || "Año N/A"}
        </p>

        {/* Géneros */}
        <div className="mb-3 d-flex flex-wrap gap-1" style={{ maxHeight: "48px", overflow: "hidden" }}>
          {anime.genres.slice(0, 3).map((genre) => (
            <span key={genre} className="badge bg-light text-dark border" style={{ fontSize: "0.7rem" }}>
              {genre}
            </span>
          ))}
        </div>

        {/* Botones de acción */}
        <div className="mt-auto d-grid gap-2">
          {onPostulate && (
            <button
              type="button"
              className={`btn btn-sm ${isPostulated ? "btn-success disabled" : "btn-primary"}`}
              onClick={() => onPostulate(anime)}
              disabled={isPostulated}
            >
              {isPostulated ? "✓ Postulado al Grupo" : "+ Postular al Grupo"}
            </button>
          )}

          {onOpenDetails && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => onOpenDetails(anime)}
            >
              Ver Detalles
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
