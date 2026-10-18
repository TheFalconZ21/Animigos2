/**
 * @file seasonal.service.ts
 * @description Servicio para gestionar la programación de animes de temporada y el calendario semanal de emisiones.
 */

import { ExtendedAnime, AiringDay, MOCK_TOP_ANIMES } from "./catalog-data";

export type SeasonName = "Invierno" | "Primavera" | "Verano" | "Otoño";

export interface DaySchedule {
  key: AiringDay;
  label: string;
  short: string;
}

export const DAYS_OF_WEEK: DaySchedule[] = [
  { key: "lunes", label: "Lunes", short: "Lun" },
  { key: "martes", label: "Martes", short: "Mar" },
  { key: "miercoles", label: "Miércoles", short: "Mié" },
  { key: "jueves", label: "Jueves", short: "Jue" },
  { key: "viernes", label: "Viernes", short: "Vie" },
  { key: "sabado", label: "Sábado", short: "Sáb" },
  { key: "domingo", label: "Domingo", short: "Dom" },
];

export const SEASONS_METADATA: { id: SeasonName; label: string; months: string; icon: string }[] = [
  { id: "Invierno", label: "Invierno", months: "Ene - Mar", icon: "❄️" },
  { id: "Primavera", label: "Primavera", months: "Abr - Jun", icon: "🌸" },
  { id: "Verano", label: "Verano", months: "Jul - Sep", icon: "☀️" },
  { id: "Otoño", label: "Otoño", months: "Oct - Dic", icon: "🍁" },
];

export const AVAILABLE_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

/**
 * Obtiene la temporada y año actual según la fecha local.
 */
export function getCurrentSeasonAndYear(): { season: SeasonName; year: number } {
  const now = new Date();
  const month = now.getMonth(); // 0 = Jan, 11 = Dec
  const year = now.getFullYear();

  let season: SeasonName = "Verano";
  if (month >= 0 && month <= 2) season = "Invierno";
  else if (month >= 3 && month <= 5) season = "Primavera";
  else if (month >= 6 && month <= 8) season = "Verano";
  else season = "Otoño";

  return { season, year };
}

/**
 * Retorna el día de la semana actual en formato AiringDay.
 */
export function getCurrentDayOfWeek(): AiringDay {
  const dayIndex = new Date().getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  switch (dayIndex) {
    case 1: return "lunes";
    case 2: return "martes";
    case 3: return "miercoles";
    case 4: return "jueves";
    case 5: return "viernes";
    case 6: return "sabado";
    case 0:
    default: return "domingo";
  }
}

/**
 * Navegación hacia la temporada anterior.
 */
export function getPreviousSeason(year: number, season: SeasonName): { year: number; season: SeasonName } {
  switch (season) {
    case "Invierno": return { year: year - 1, season: "Otoño" };
    case "Primavera": return { year, season: "Invierno" };
    case "Verano": return { year, season: "Primavera" };
    case "Otoño": return { year, season: "Verano" };
  }
}

/**
 * Navegación hacia la temporada siguiente.
 */
export function getNextSeason(year: number, season: SeasonName): { year: number; season: SeasonName } {
  switch (season) {
    case "Invierno": return { year, season: "Primavera" };
    case "Primavera": return { year, season: "Verano" };
    case "Verano": return { year, season: "Otoño" };
    case "Otoño": return { year: year + 1, season: "Invierno" };
  }
}

/**
 * Catálogo complementario estructurado de animes de temporada con asignación de día de emisión
 */
export const SEASONAL_ANIMES_DATABASE: ExtendedAnime[] = [
  // --- 2026 VERANO (Temporada Actual) ---
  {
    malId: 58514,
    title: "Chainsaw Man: Reze Arc",
    titleEnglish: "Chainsaw Man: Reze Arc",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1806/134016.jpg",
    score: 8.85,
    rank: 82,
    episodes: 12,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "MAPPA",
    genres: ["Acción", "Sobrenatural", "Gore"],
    synopsis: "Denji se encuentra con una misteriosa chica llamada Reze en una cafetería durante un día lluvioso, desatando una peligrosa y caótica batalla entre demonios y cazadores.",
    airingDay: "martes",
    broadcastTime: "24:00 JST",
    watchedByFriends: ["Lucas Benítez", "Sofía Martínez"],
  },
  {
    malId: 57890,
    title: "Solo Leveling Season 2: Arise from the Shadow",
    titleEnglish: "Solo Leveling Season 2",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1070/141444.jpg",
    score: 8.78,
    rank: 95,
    episodes: 13,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "A-1 Pictures",
    genres: ["Acción", "Fantasía", "Aventura"],
    synopsis: "Tras haber despertado el ejército de sombras y derrotado a la reina de las hormigas en la isla Jeju, Sung Jin-woo continúa ascendiendo de rango para proteger a la humanidad.",
    airingDay: "sabado",
    broadcastTime: "24:00 JST",
    watchedByFriends: ["Lucas Benítez", "Mauricio Rossi"],
  },
  {
    malId: 59312,
    title: "Fire Force Season 3",
    titleEnglish: "Fire Force Season 3",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1202/107386.jpg",
    score: 8.35,
    rank: 180,
    episodes: 24,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "David Production",
    genres: ["Acción", "Sobrenatural", "Sci-Fi"],
    synopsis: "Shinra Kusakabe y la 8ª Brigada Especial de Bomberos se adentran en el Gran Cataclismo final para desvelar el secreto del Evangelista.",
    airingDay: "viernes",
    broadcastTime: "01:25 JST",
  },
  {
    malId: 58821,
    title: "Sakamoto Days",
    titleEnglish: "Sakamoto Days",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1647/143588.jpg",
    score: 8.42,
    rank: 145,
    episodes: 12,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "TMS Entertainment",
    genres: ["Acción", "Comedia", "Shonen"],
    synopsis: "Taro Sakamoto era el asesino legendario más temido de todos, hasta que se enamoró, se casó y abrió una tienda de conveniencia. Ahora debe defender su pacífica vida cotidiana.",
    airingDay: "sabado",
    broadcastTime: "23:00 JST",
    watchedByFriends: ["Camila Torres"],
  },
  {
    malId: 57522,
    title: "Grand Blue Dreaming Season 2",
    titleEnglish: "Grand Blue Season 2",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1376/93665.jpg",
    score: 8.61,
    rank: 120,
    episodes: 12,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "Zero-G",
    genres: ["Comedia", "Slice of Life"],
    synopsis: "Iori Kitahara y el alocado club de buceo 'Peek a Boo' regresan con más aventuras acuáticas, fiestas descontroladas y camaradería universitaria.",
    airingDay: "lunes",
    broadcastTime: "22:30 JST",
    watchedByFriends: ["Mauricio Rossi"],
  },
  {
    malId: 58210,
    title: "Witch Hat Atelier",
    titleEnglish: "Witch Hat Atelier",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1329/143924.jpg",
    score: 8.70,
    rank: 110,
    episodes: 12,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "BUG FILMS",
    genres: ["Fantasía", "Aventura", "Magia"],
    synopsis: "Coco, una niña de un pequeño pueblo que soñaba con ser maga, descubre por casualidad el secreto prohibido detrás de los hechizos y comienza su aprendizaje en el taller de Qifrey.",
    airingDay: "miercoles",
    broadcastTime: "23:30 JST",
    watchedByFriends: ["Sofía Martínez"],
  },
  {
    malId: 59104,
    title: "Dr. STONE: Science Future",
    titleEnglish: "Dr. Stone Season 4",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1613/102576.jpg",
    score: 8.52,
    rank: 135,
    episodes: 24,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "TMS Entertainment",
    genres: ["Aventura", "Sci-Fi", "Comedia"],
    synopsis: "Senku Ishigami y el Reino de la Ciencia se preparan para el viaje espacial hacia la Luna con el objetivo de confrontar a Why-Man y salvar a la humanidad petrificada.",
    airingDay: "jueves",
    broadcastTime: "22:00 JST",
    watchedByFriends: ["Lucas Benítez"],
  },
  {
    malId: 58499,
    title: "KonoSuba: God's Blessing on This Wonderful World! 3",
    titleEnglish: "KonoSuba Season 3",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1638/141846.jpg",
    score: 8.48,
    rank: 140,
    episodes: 11,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "Drive",
    genres: ["Comedia", "Fantasía", "Isekai"],
    synopsis: "Kazuma, Aqua, Megumin y Darkness continúan sus hilarantes desventuras mientras son invitados al castillo real por la mismísima princesa Iris.",
    airingDay: "miercoles",
    broadcastTime: "23:00 JST",
    watchedByFriends: ["Sofía Martínez", "Lucas Benítez"],
  },
  {
    malId: 58712,
    title: "Oshi no Ko Season 2",
    titleEnglish: "[Oshi No Ko] Season 2",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1812/142999.jpg",
    score: 8.64,
    rank: 98,
    episodes: 13,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "Doga Kobo",
    genres: ["Drama", "Sobrenatural", "Misterio"],
    synopsis: "Aqua y Akane se integran en la obra teatral 'Tokyo Blade', mientras la investigación sobre la identidad del padre de los gemelos se intensifica tras bambalinas.",
    airingDay: "miercoles",
    broadcastTime: "23:00 JST",
    watchedByFriends: ["Camila Torres", "Sofía Martínez"],
  },
  {
    malId: 58930,
    title: "Kaiju No. 8 Season 2",
    titleEnglish: "Kaiju No. 8 Season 2",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1482/142475.jpg",
    score: 8.38,
    rank: 165,
    episodes: 12,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "Production I.G",
    genres: ["Acción", "Sci-Fi", "Militar"],
    synopsis: "Kafka Hibino demuestra su lealtad ante las Fuerzas de Defensa mientras surge una nueva ola de Kaijus inteligentes liderados por el temible Kaiju No. 9.",
    airingDay: "sabado",
    broadcastTime: "23:00 JST",
    watchedByFriends: ["Lucas Benítez"],
  },
  {
    malId: 58110,
    title: "Dandadan",
    titleEnglish: "DAN DA DAN",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1099/143582.jpg",
    score: 8.75,
    rank: 88,
    episodes: 12,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "Science SARU",
    genres: ["Acción", "Comedia", "Sobrenatural", "Sci-Fi"],
    synopsis: "Momo Ayase cree en fantasmas y Okarun cree en alienígenas. Cuando ambos apuestan para probar la existencia del otro, desatan una insana guerra paranormal de poderes y romance.",
    airingDay: "jueves",
    broadcastTime: "24:26 JST",
    watchedByFriends: ["Lucas Benítez", "Sofía Martínez", "Camila Torres"],
  },
  {
    malId: 57900,
    title: "Blue Lock Season 2",
    titleEnglish: "BLUE LOCK vs. U-20 JAPAN",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1258/143710.jpg",
    score: 8.12,
    rank: 210,
    episodes: 14,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "8bit",
    genres: ["Deportes", "Shonen"],
    synopsis: "Los delanteros sobrevivientes del proyecto Blue Lock se enfrentan a la selección nacional sub-20 de Japón con el futuro del fútbol nipón en juego.",
    airingDay: "sabado",
    broadcastTime: "23:30 JST",
    watchedByFriends: ["Lucas Benítez"],
  },
  {
    malId: 57400,
    title: "Re:ZERO -Starting Life in Another World- Season 3",
    titleEnglish: "Re:ZERO Season 3",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1487/142940.jpg",
    score: 8.82,
    rank: 75,
    episodes: 16,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "White Fox",
    genres: ["Drama", "Fantasía", "Suspenso", "Isekai"],
    synopsis: "Subaru y Emilia viajan a la ciudad acuática de Priestella por invitación de Anastasia, solo para que el Culto de la Bruja tome el control de las compuertas y siembre el terror.",
    airingDay: "miercoles",
    broadcastTime: "22:30 JST",
    watchedByFriends: ["Mauricio Rossi", "Sofía Martínez"],
  },
  {
    malId: 58600,
    title: "Bleach: Thousand-Year Blood War - The Conflict",
    titleEnglish: "Bleach: Thousand-Year Blood War Part 3",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1066/143594.jpg",
    score: 8.92,
    rank: 45,
    episodes: 13,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "Pierrot Films",
    genres: ["Acción", "Aventura", "Sobrenatural"],
    synopsis: "La batalla definitiva entre los Shinigami y el Wandenreich llega al Palacio Real, donde Ichigo Kurosaki debe enfrentar el inconmensurable poder del Todopoderoso Yhwach.",
    airingDay: "sabado",
    broadcastTime: "23:00 JST",
    watchedByFriends: ["Lucas Benítez", "Mauricio Rossi"],
  },
  {
    malId: 58350,
    title: "Tower of God Season 2: Workshop Battle",
    titleEnglish: "Tower of God Season 2",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1179/142823.jpg",
    score: 7.95,
    rank: 310,
    episodes: 26,
    status: "En Emisión",
    season: "Verano",
    year: 2026,
    studio: "The Answer Studio",
    genres: ["Acción", "Aventura", "Fantasía", "Misterio"],
    synopsis: "Ja Wangnan y el nuevo equipo de Viole se preparan para participar en la legendaria Batalla del Taller del piso 30, enfrentando los planes ocultos de FUG.",
    airingDay: "domingo",
    broadcastTime: "23:00 JST",
  },
  {
    malId: 58010,
    title: "Mushoku Tensei: Jobless Reincarnation Season 2 Part 2",
    titleEnglish: "Mushoku Tensei Season 2 Part 2",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1206/142079.jpg",
    score: 8.68,
    rank: 92,
    episodes: 12,
    status: "Finalizado",
    season: "Primavera",
    year: 2024,
    studio: "Studio Bind",
    genres: ["Drama", "Fantasía", "Isekai"],
    synopsis: "Rudeus emprende una peligrosa travesía hacia el continente de Begaritt para rescatar a su madre Zenith en el letal laberinto de teletransporte.",
    airingDay: "domingo",
    broadcastTime: "24:00 JST",
    watchedByFriends: ["Mauricio Rossi", "Sofía Martínez"],
  },

  // --- 2024 PRIMAVERA / VERANO / OTOÑO ---
  {
    malId: 53127,
    title: "Delicious in Dungeon",
    titleEnglish: "Delicious in Dungeon",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1487/140026.jpg",
    score: 8.62,
    rank: 105,
    episodes: 24,
    status: "Finalizado",
    season: "Primavera",
    year: 2024,
    studio: "Studio Trigger",
    genres: ["Comedia", "Fantasía", "Gastronomía"],
    synopsis: "Laios y su grupo exploran las profundidades de una mazmorra para salvar a su hermana devorada por un dragón, sobreviviendo cocinando y comiendo los monstruos que encuentran.",
    airingDay: "jueves",
    broadcastTime: "22:30 JST",
    watchedByFriends: ["Sofía Martínez"],
  },
  {
    malId: 54744,
    title: "Demon Slayer: Kimetsu no Yaiba Hashira Training Arc",
    titleEnglish: "Demon Slayer: Hashira Training Arc",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1749/141873.jpg",
    score: 8.42,
    rank: 155,
    episodes: 8,
    status: "Finalizado",
    season: "Primavera",
    year: 2024,
    studio: "ufotable",
    genres: ["Acción", "Fantasía", "Histórico"],
    synopsis: "Tanjiro y sus amigos se someten a un riguroso entrenamiento físico y marcial impartido por todos los Pilares del Cuerpo de Cazadores de Demonios en preparación para Muzan.",
    airingDay: "domingo",
    broadcastTime: "23:15 JST",
    watchedByFriends: ["Lucas Benítez", "Sofía Martínez", "Camila Torres"],
  },

  // --- 2023 OTOÑO ---
  {
    malId: 52991,
    title: "Frieren: Beyond Journey's End",
    titleEnglish: "Frieren: Beyond Journey's End",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1015/138006.jpg",
    score: 9.34,
    rank: 1,
    episodes: 28,
    status: "Finalizado",
    season: "Otoño",
    year: 2023,
    studio: "Madhouse",
    genres: ["Fantasía", "Aventura", "Drama"],
    synopsis: "La elfa maga Frieren emprende un viaje hacia el descanso de las almas para comprender a la humanidad y reconciliarse con la memoria del héroe Himmel.",
    airingDay: "viernes",
    broadcastTime: "23:00 JST",
    watchedByFriends: ["Sofía Martínez", "Mauricio Rossi", "Camila Torres"],
  },
  {
    malId: 54492,
    title: "The Apothecary Diaries",
    titleEnglish: "The Apothecary Diaries",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1708/138033.jpg",
    score: 8.89,
    rank: 55,
    episodes: 24,
    status: "Finalizado",
    season: "Otoño",
    year: 2023,
    studio: "TOHO animation STUDIO",
    genres: ["Drama", "Misterio", "Histórico"],
    synopsis: "Maomao, una joven boticaria secuestrada y vendida al Palacio Imperial, resuelve misterios médicos y venenos cortesanos gracias a su aguda mente científica.",
    airingDay: "sabado",
    broadcastTime: "01:05 JST",
    watchedByFriends: ["Sofía Martínez", "Camila Torres"],
  },
  {
    malId: 51009,
    title: "Jujutsu Kaisen Season 2 (Shibuya Incident)",
    titleEnglish: "Jujutsu Kaisen Season 2",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1792/138042.jpg",
    score: 8.81,
    rank: 72,
    episodes: 23,
    status: "Finalizado",
    season: "Otoño",
    year: 2023,
    studio: "MAPPA",
    genres: ["Acción", "Fantasía", "Sobrenatural"],
    synopsis: "En la noche de Halloween en Shibuya, Geto y las maldiciones sellan a Satoru Gojo, desatando una guerra mortal donde los hechiceros sufren trágicas pérdidas.",
    airingDay: "jueves",
    broadcastTime: "23:56 JST",
    watchedByFriends: ["Lucas Benítez", "Mauricio Rossi"],
  },
  {
    malId: 53887,
    title: "Spy x Family Season 2",
    titleEnglish: "SPY x FAMILY Season 2",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1506/138982.jpg",
    score: 8.16,
    rank: 195,
    episodes: 12,
    status: "Finalizado",
    season: "Otoño",
    year: 2023,
    studio: "Wit Studio & CloverWorks",
    genres: ["Comedia", "Acción", "Slice of Life"],
    synopsis: "Yor Forger acepta una misión secreta como guardaespaldas en un crucero de lujo, mientras Loid y Anya abordan el mismo barco por un premio escolar.",
    airingDay: "sabado",
    broadcastTime: "23:00 JST",
    watchedByFriends: ["Camila Torres"],
  },

  // --- 2023 PRIMAVERA ---
  {
    malId: 52034,
    title: "Oshi no Ko",
    titleEnglish: "Oshi No Ko Season 1",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1812/134727.jpg",
    score: 8.68,
    rank: 90,
    episodes: 11,
    status: "Finalizado",
    season: "Primavera",
    year: 2023,
    studio: "Doga Kobo",
    genres: ["Drama", "Sobrenatural", "Misterio"],
    synopsis: "Un médico rural y una paciente terminal reencarnan como los hijos gemelos de su idol favorita, Ai Hoshino, entrando al oscuro y competitivo mundo del espectáculo.",
    airingDay: "miercoles",
    broadcastTime: "23:00 JST",
    watchedByFriends: ["Camila Torres", "Sofía Martínez"],
  },
  {
    malId: 51535,
    title: "Hell's Paradise",
    titleEnglish: "Jigokuraku",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1280/134346.jpg",
    score: 8.11,
    rank: 220,
    episodes: 13,
    status: "Finalizado",
    season: "Primavera",
    year: 2023,
    studio: "MAPPA",
    genres: ["Acción", "Aventura", "Gore", "Sobrenatural"],
    synopsis: "Gabimaru el Vacío y otros criminales condenados a muerte viajan a una isla misteriosa y paradisíaca en busca del Elixir de la Vida para obtener el perdón del shogunato.",
    airingDay: "sabado",
    broadcastTime: "23:00 JST",
    watchedByFriends: ["Lucas Benítez"],
  },

  // --- 2023 INVIERNO ---
  {
    malId: 50602,
    title: "Vinland Saga Season 2",
    titleEnglish: "Vinland Saga Season 2",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1170/124312.jpg",
    score: 8.84,
    rank: 60,
    episodes: 24,
    status: "Finalizado",
    season: "Invierno",
    year: 2023,
    studio: "MAPPA",
    genres: ["Acción", "Aventura", "Drama", "Histórico"],
    synopsis: "Thorfinn, ahora un esclavo despojado de su sed de venganza en la granja de Ketil, entabla amistad con Einar y emprende el difícil camino hacia la verdadera redención y la paz.",
    airingDay: "lunes",
    broadcastTime: "24:30 JST",
    watchedByFriends: ["Mauricio Rossi"],
  },
  {
    malId: 52173,
    title: "Bungo Stray Dogs 4th Season",
    titleEnglish: "Bungo Stray Dogs Season 4",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1865/130722.jpg",
    score: 8.41,
    rank: 160,
    episodes: 13,
    status: "Finalizado",
    season: "Invierno",
    year: 2023,
    studio: "Bones",
    genres: ["Acción", "Misterio", "Sobrenatural"],
    synopsis: "La Agencia Armada de Detectives es incriminada por la temible organización 'Decadencia de los Ángeles', convirtiéndose en los fugitivos más buscados del país.",
    airingDay: "miercoles",
    broadcastTime: "23:00 JST",
  },
  {
    malId: 50709,
    title: "The Angel Next Door Spoils Me Rotten",
    titleEnglish: "The Angel Next Door Spoils Me Rotten",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1199/131971.jpg",
    score: 7.91,
    rank: 320,
    episodes: 12,
    status: "Finalizado",
    season: "Invierno",
    year: 2023,
    studio: "Project No.9",
    genres: ["Romance", "Escolar", "Slice of Life"],
    synopsis: "Un estudiante solitario y desordenado comparte un paraguas con la chica más popular y angelical de su escuela, iniciando una dulce relación de vecindad.",
    airingDay: "sabado",
    broadcastTime: "22:30 JST",
    watchedByFriends: ["Sofía Martínez"],
  },
  {
    malId: 50425,
    title: "Tomo-chan Is a Girl!",
    titleEnglish: "Tomo-chan Is a Girl!",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1208/131302.jpg",
    score: 7.78,
    rank: 390,
    episodes: 13,
    status: "Finalizado",
    season: "Invierno",
    year: 2023,
    studio: "Lay-duce",
    genres: ["Comedia", "Romance", "Escolar"],
    synopsis: "Tomo Aizawa es una chica atlética enamorada de su amigo de la infancia Jun, pero él solo la ve como a un compañero varón más.",
    airingDay: "jueves",
    broadcastTime: "00:30 JST",
    watchedByFriends: ["Camila Torres"],
  },

  // --- 2025 INVIERNO & PRIMAVERA ---
  {
    malId: 58800,
    title: "Gintama: Ginpachi-sensei",
    titleEnglish: "3-Nen Z-Gumi Ginpachi-Sensei",
    imageUrl: "https://cdn.myanimelist.net/images/anime/10/73249.jpg",
    score: 8.55,
    rank: 115,
    episodes: 12,
    status: "En Emisión",
    season: "Invierno",
    year: 2025,
    studio: "BN Pictures",
    genres: ["Comedia", "Parodia", "Escolar"],
    synopsis: "Ginpachi Sakata es un profesor despreocupado de secundaria que lidera la caótica clase 3-Z con sus métodos irreverentes.",
    airingDay: "martes",
    broadcastTime: "18:00 JST",
    watchedByFriends: ["Mauricio Rossi"],
  },
  {
    malId: 57950,
    title: "Fate/strange Fake",
    titleEnglish: "Fate/strange Fake",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1841/136894.jpg",
    score: 8.45,
    rank: 150,
    episodes: 12,
    status: "En Emisión",
    season: "Primavera",
    year: 2025,
    studio: "A-1 Pictures",
    genres: ["Acción", "Fantasía", "Sobrenatural"],
    synopsis: "En la ciudad estadounidense de Snowfield se desata una falsa Guerra del Santo Grial con clases distorsionadas y espíritus heroicos descomunales.",
    airingDay: "viernes",
    broadcastTime: "24:00 JST",
    watchedByFriends: ["Lucas Benítez"],
  },
  {
    malId: 59000,
    title: "One-Punch Man Season 3",
    titleEnglish: "One-Punch Man Season 3",
    imageUrl: "https://cdn.myanimelist.net/images/anime/12/76049.jpg",
    score: 8.90,
    rank: 48,
    episodes: 12,
    status: "Próximamente",
    season: "Otoño",
    year: 2025,
    studio: "J.C.Staff",
    genres: ["Acción", "Comedia", "Superpoderes"],
    synopsis: "La Asociación de Héroes lanza su asalto definitivo contra el cuartel subterráneo de la Asociación de Monstruos, mientras Garou continúa su monstruosa evolución.",
    airingDay: "domingo",
    broadcastTime: "23:05 JST",
    watchedByFriends: ["Lucas Benítez", "Mauricio Rossi"],
  },
  {
    malId: 58550,
    title: "My Hero Academia Final Season",
    titleEnglish: "My Hero Academia Season 8",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1911/141876.jpg",
    score: 8.35,
    rank: 185,
    episodes: 25,
    status: "Próximamente",
    season: "Primavera",
    year: 2025,
    studio: "Bones",
    genres: ["Acción", "Shonen", "Superpoderes"],
    synopsis: "Deku y la Clase 1-A enfrentan la fase culminante de la guerra total contra Tomura Shigaraki y All For One.",
    airingDay: "sabado",
    broadcastTime: "17:30 JST",
    watchedByFriends: ["Lucas Benítez"],
  }
];

/**
 * Combina animes del catálogo top y la base seasonal para una temporada y año dados,
 * asignando un día de emisión coherente a los animes de top si no lo tenían.
 */
export function getSeasonalAnimes(year: number, season: SeasonName): ExtendedAnime[] {
  // 1. Filtrar de la base seasonal
  const fromDatabase = SEASONAL_ANIMES_DATABASE.filter(
    (a) => a.year === year && a.season?.toLowerCase() === season.toLowerCase()
  );

  // 2. Extraer del MOCK_TOP_ANIMES animes que coincidan en año y season
  const daysList: AiringDay[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
  const fromTop = MOCK_TOP_ANIMES.filter(
    (a) => a.year === year && a.season?.toLowerCase() === season.toLowerCase()
  ).map((a, idx) => ({
    ...a,
    airingDay: a.airingDay || daysList[(a.malId + idx) % daysList.length],
    broadcastTime: a.broadcastTime || "23:00 JST",
  }));

  // Combinar evitando duplicados por malId
  const seenIds = new Set<number>();
  const combined: ExtendedAnime[] = [];

  for (const item of [...fromDatabase, ...fromTop]) {
    if (!seenIds.has(item.malId)) {
      seenIds.add(item.malId);
      combined.push(item);
    }
  }

  // Si para años anteriores no hay suficientes datos registrados,
  // generamos una distribución estilizada con animes de ese año para que el usuario siempre vea un calendario completo.
  if (combined.length === 0) {
    const yearAnimes = MOCK_TOP_ANIMES.filter((a) => a.year === year);
    if (yearAnimes.length > 0) {
      return yearAnimes.map((a, idx) => ({
        ...a,
        season,
        airingDay: daysList[idx % daysList.length],
        broadcastTime: "23:00 JST",
      }));
    }

    // Fallback con muestra distribuida en los 7 días
    return MOCK_TOP_ANIMES.slice(0, 14).map((a, idx) => ({
      ...a,
      year,
      season,
      airingDay: daysList[idx % daysList.length],
      broadcastTime: `${20 + (idx % 4)}:${idx % 2 === 0 ? "00" : "30"} JST`,
    }));
  }

  return combined;
}

/**
 * Agrupa una lista de animes por cada día de la semana (Lunes a Domingo).
 */
export function groupAnimesByDay(animes: ExtendedAnime[]): Record<AiringDay, ExtendedAnime[]> {
  const grouped: Record<AiringDay, ExtendedAnime[]> = {
    lunes: [],
    martes: [],
    miercoles: [],
    jueves: [],
    viernes: [],
    sabado: [],
    domingo: [],
  };

  const daysList: AiringDay[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

  animes.forEach((anime, idx) => {
    const day = anime.airingDay || daysList[idx % daysList.length];
    if (grouped[day]) {
      grouped[day].push({ ...anime, airingDay: day });
    } else {
      grouped.domingo.push({ ...anime, airingDay: "domingo" });
    }
  });

  return grouped;
}
