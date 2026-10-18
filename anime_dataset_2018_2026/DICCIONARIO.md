# Diccionario de datos

Generado del esquema real de cada fichero. Todos en Parquet con compresion zstd.

## `fuentes.parquet`

Procedencia y avisos de comparabilidad de cada uno de los nueve anos. LEER PRIMERO.

**9 filas · 10 columnas · 0.01 MB**

| Columna | Tipo |
|---|---|
| `ano` | int64 |
| `fichero` | large_string |
| `fecha_captura` | large_string |
| `titulos` | int64 |
| `nota_publicada` | bool |
| `desfase_nota` | double |
| `tiene_votos` | bool |
| `tiene_generos` | bool |
| `cobertura_ano` | double |
| `aviso` | large_string |

## `dim/anime.parquet`

Catalogo de AniList. Una fila por titulo. Clave: mal_id.

**19,384 filas · 47 columnas · 5.86 MB**

| Columna | Tipo |
|---|---|
| `mal_id` | int64 |
| `id` | int64 |
| `title_romaji` | large_string |
| `title_english` | large_string |
| `title_native` | large_string |
| `title_userPreferred` | large_string |
| `type` | large_string |
| `format` | large_string |
| `status` | large_string |
| `startDate_year` | int64 |
| `startDate_month` | double |
| `startDate_day` | double |
| `endDate_year` | double |
| `endDate_month` | double |
| `endDate_day` | double |
| `season` | large_string |
| `seasonYear` | double |
| `seasonInt` | double |
| `episodes` | double |
| `duration` | double |
| `chapters` | double |
| `volumes` | double |
| `countryOfOrigin` | large_string |
| `isLicensed` | bool |
| `source` | large_string |
| `hashtag` | large_string |
| `trailer_id` | large_string |
| `trailer_site` | large_string |
| `trailer_thumbnail` | large_string |
| `updatedAt` | int64 |
| `coverImage_extraLarge` | large_string |
| `coverImage_large` | large_string |
| `coverImage_medium` | large_string |
| `coverImage_color` | large_string |
| `bannerImage` | large_string |
| `averageScore` | double |
| `meanScore` | double |
| `popularity` | int64 |
| `favourites` | int64 |
| `trending` | int64 |
| `isFavourite` | bool |
| `isAdult` | bool |
| `isLocked` | bool |
| `siteUrl` | large_string |
| `startdate_full` | timestamp[us] |
| `enddate_full` | timestamp[us] |
| `description_text` | large_string |

## `hechos/anime_por_ano.parquet`

EL PANEL. Una fila por (titulo, ano). Clave: anime_id + ano.

**190,891 filas · 11 columnas · 3.48 MB**

| Columna | Tipo |
|---|---|
| `ano` | int64 |
| `anime_id` | int32 |
| `title` | large_string |
| `score` | double |
| `scored_by` | double |
| `members` | double |
| `rank` | double |
| `popularity` | double |
| `favorites` | double |
| `type` | string |
| `year_estreno` | double |

## `hechos/anime_stats_2026.parquet`

Agregados por titulo sobre las 968M de interacciones de 2026.

**29,604 filas · 22 columnas · 1.43 MB**

| Columna | Tipo |
|---|---|
| `anime_id` | int32 |
| `n_interactions` | int64 |
| `n_scored` | int64 |
| `score_sum` | int64 |
| `sum_watched_episodes` | int64 |
| `n_rewatching` | int64 |
| `mean_score` | double |
| `n_watching` | int64 |
| `n_completed` | int64 |
| `n_on_hold` | int64 |
| `n_dropped` | int64 |
| `n_plan_to_watch` | int64 |
| `score_1` | int64 |
| `score_2` | int64 |
| `score_3` | int64 |
| `score_4` | int64 |
| `score_5` | int64 |
| `score_6` | int64 |
| `score_7` | int64 |
| `score_8` | int64 |
| `score_9` | int64 |
| `score_10` | int64 |

## `hechos/estados_2026.parquet`

Reparto de estados (viendo, completado, abandonado...) en 2026.

**9 filas · 6 columnas · 0.00 MB**

| Columna | Tipo |
|---|---|
| `status` | int8 |
| `count` | int64 |
| `status_label` | large_string |
| `pct` | double |
| `row_groups_leidos` | int64 |
| `row_groups_totales` | int64 |

## `atributos/anime_generos_por_ano.parquet`

Generos POR ANO: la taxonomia cambia entre fuentes.

**278,854 filas · 3 columnas · 0.71 MB**

| Columna | Tipo |
|---|---|
| `ano` | int64 |
| `anime_id` | int32 |
| `genero` | large_string |

## `atributos/anime_generos_2026.parquet`

Generos de AniList 2026, con posicion original.

**40,237 filas · 3 columnas · 0.11 MB**

| Columna | Tipo |
|---|---|
| `mal_id` | int64 |
| `pos` | int64 |
| `genre` | large_string |

## `atributos/anime_tags.parquet`

Tags de AniList con su rango y marcas de spoiler.

**131,562 filas · 8 columnas · 0.57 MB**

| Columna | Tipo |
|---|---|
| `mal_id` | int64 |
| `tag_id` | int64 |
| `tag` | large_string |
| `category` | large_string |
| `rank` | int64 |
| `is_general_spoiler` | bool |
| `is_media_spoiler` | bool |
| `is_adult` | bool |

## `atributos/anime_estudios.parquet`

Estudios de animacion por titulo.

**39,012 filas · 5 columnas · 0.21 MB**

| Columna | Tipo |
|---|---|
| `mal_id` | int64 |
| `studio_id` | int64 |
| `studio` | large_string |
| `is_main` | bool |
| `is_animation_studio` | bool |

## `atributos/anime_staff.parquet`

Equipo tecnico y artistico por titulo.

**201,090 filas · 5 columnas · 2.11 MB**

| Columna | Tipo |
|---|---|
| `mal_id` | int64 |
| `anilist_staff_id` | int64 |
| `role` | large_string |
| `name_full` | large_string |
| `name_native` | large_string |

## `atributos/anime_personajes.parquet`

Personajes por titulo, con su recuento de favoritos.

**142,597 filas · 6 columnas · 2.27 MB**

| Columna | Tipo |
|---|---|
| `mal_id` | int64 |
| `anilist_character_id` | int64 |
| `role` | large_string |
| `name_full` | large_string |
| `name_native` | large_string |
| `favourites` | null |

## `atributos/anime_rankings.parquet`

Puestos de AniList por tipo, formato, ano y temporada.

**22,845 filas · 8 columnas · 0.10 MB**

| Columna | Tipo |
|---|---|
| `mal_id` | int64 |
| `rank` | int64 |
| `type` | large_string |
| `format` | large_string |
| `year` | double |
| `season` | large_string |
| `all_time` | bool |
| `context` | large_string |

## `atributos/anime_sinonimos.parquet`

Titulos alternativos.

**27,288 filas · 3 columnas · 0.55 MB**

| Columna | Tipo |
|---|---|
| `mal_id` | int64 |
| `pos` | int64 |
| `synonym` | large_string |

## `atributos/anime_distribucion_score.parquet`

Histograma de notas de AniList por titulo.

**182,685 filas · 3 columnas · 0.37 MB**

| Columna | Tipo |
|---|---|
| `mal_id` | int64 |
| `score_anilist` | int64 |
| `amount` | int64 |

## `atributos/anime_distribucion_status.parquet`

Reparto de estados de AniList por titulo.

**96,910 filas · 3 columnas · 0.33 MB**

| Columna | Tipo |
|---|---|
| `mal_id` | int64 |
| `status` | large_string |
| `amount` | int64 |

## `atributos/anime_relaciones.parquet`

Grafo entre titulos: SEQUEL, PREQUEL, PARENT, SIDE_STORY...

**30,589 filas · 6 columnas · 0.19 MB**

| Columna | Tipo |
|---|---|
| `mal_id_from` | int64 |
| `relation_type` | large_string |
| `anilist_id_to` | int64 |
| `mal_id_to` | null |
| `type_to` | large_string |
| `format_to` | large_string |

## `atributos/anime_recomendaciones.parquet`

Grafo de recomendaciones entre titulos, con su rating.

**108,279 filas · 4 columnas · 0.38 MB**

| Columna | Tipo |
|---|---|
| `mal_id_from` | int64 |
| `rating` | int64 |
| `anilist_id_to` | double |
| `mal_id_to` | null |

## `agregados/tasas_exito_genero.parquet`

Probabilidad de exito por genero. TV nueva estrenada 2013-2022.

**14 filas · 6 columnas · 0.00 MB**

| Columna | Tipo |
|---|---|
| `genero` | large_string |
| `series` | int64 |
| `nota_media` | double |
| `miembros_mediana` | double |
| `p_500k` | double |
| `p_nota_8` | double |

## `agregados/exito_por_origen_y_genero.parquet`

Lo mismo, cruzado con el origen del material.

**44 filas · 5 columnas · 0.00 MB**

| Columna | Tipo |
|---|---|
| `origen` | large_string |
| `genero` | large_string |
| `series` | int64 |
| `nota_media` | double |
| `p_500k` | double |

## `agregados/deriva_nota_por_genero.parquet`

Cuanto cambia la nota de cada genero entre 2018 y 2026.

**36 filas · 5 columnas · 0.00 MB**

| Columna | Tipo |
|---|---|
| `genero` | large_string |
| `titulos` | int64 |
| `nota_2018` | double |
| `nota_2026` | double |
| `deriva` | double |

## `agregados/genero_por_edad_2023.parquet`

Censo 2023: genero de anime por franja de edad.

**105 filas · 6 columnas · 0.01 MB**

| Columna | Tipo |
|---|---|
| `grupo` | double |
| `genero` | large_string |
| `valoraciones` | int64 |
| `cuota_grupo` | double |
| `cuota_global` | double |
| `desviacion` | double |

## `agregados/genero_por_sexo_2023.parquet`

Censo 2023: genero de anime por genero declarado.

**63 filas · 6 columnas · 0.01 MB**

| Columna | Tipo |
|---|---|
| `grupo` | large_string |
| `genero` | large_string |
| `valoraciones` | int64 |
| `cuota_grupo` | double |
| `cuota_global` | double |
| `desviacion` | double |

## `usuarios/perfiles_2026.parquet`

18,2M perfiles con demografia y estadisticas de consumo.

**18,213,591 filas · 21 columnas · 424.82 MB**

| Columna | Tipo |
|---|---|
| `username` | large_string |
| `gender` | int32 |
| `location` | large_string |
| `joined_date` | timestamp[us] |
| `last_online_ts` | timestamp[us] |
| `birth_year` | int16 |
| `birth_month` | int8 |
| `birth_day` | int8 |
| `anime_mean` | float |
| `anime_mean_invalid` | bool |
| `anime_days` | float |
| `anime_days_invalid` | bool |
| `anime_inprogress` | int32 |
| `anime_completed` | int32 |
| `anime_onhold` | int32 |
| `anime_dropped` | int32 |
| `anime_planned` | int32 |
| `anime_episodes` | int32 |
| `fav_anime_n` | int32 |
| `list_fetched_ok` | bool |
| `account_age_days` | int32 |

## `usuarios/favoritos_anime.parquet`

Favoritos de anime, en orden. Clave: username + pos.

**14,741,717 filas · 3 columnas · 61.55 MB**

| Columna | Tipo |
|---|---|
| `username` | large_string |
| `pos` | int64 |
| `item_id` | int32 |

## `usuarios/favoritos_manga.parquet`

Favoritos de manga.

**4,574,324 filas · 3 columnas · 22.04 MB**

| Columna | Tipo |
|---|---|
| `username` | large_string |
| `pos` | int64 |
| `item_id` | int32 |

## `usuarios/favoritos_personaje.parquet`

Personajes favoritos.

**16,275,174 filas · 3 columnas · 61.08 MB**

| Columna | Tipo |
|---|---|
| `username` | large_string |
| `pos` | int64 |
| `item_id` | int32 |

## `usuarios/favoritos_persona.parquet`

Personas favoritas (seiyuu, staff).

**4,592,474 filas · 3 columnas · 19.07 MB**

| Columna | Tipo |
|---|---|
| `username` | large_string |
| `pos` | int64 |
| `item_id` | int32 |

## `usuarios/favoritos_empresa.parquet`

Empresas favoritas.

**474,536 filas · 3 columnas · 1.93 MB**

| Columna | Tipo |
|---|---|
| `username` | large_string |
| `pos` | int64 |
| `item_id` | int32 |

## `usuarios/amigos.parquet`

Grafo de amistades. PARCIAL: la fuente trunca a 10 por usuario.

**7,330,215 filas · 3 columnas · 79.67 MB**

| Columna | Tipo |
|---|---|
| `username` | large_string |
| `pos` | int64 |
| `friend_username` | large_string |

## `usuarios/insignias.parquet`

Insignias del perfil.

**458,762 filas · 3 columnas · 2.16 MB**

| Columna | Tipo |
|---|---|
| `username` | large_string |
| `pos` | int64 |
| `badge` | large_string |
