/**
 * @file index.ts
 * @description Punto de entrada unificado para el Core Engine de Animigos.
 * Agrupa la lógica de negocio pura, cálculo de felicidad, gestión de sesiones de invitados
 * y servicios de catálogo/temporadas.
 */

// Algoritmo de Felicidad Grupal v1
export * from "./happiness-score";

// Gestión de Sesiones de Invitados (Local/Client)
export * from "./guest-session.service";

// Catálogo, Tipos e Interfaces de Anime
export * from "./catalog-data";

// Temporadas y Calendario Semanal de Emisiones
export * from "./seasonal.service";
