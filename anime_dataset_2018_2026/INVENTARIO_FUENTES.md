# Inventario de datasets de MyAnimeList, 2018–2026

Revisión de las nueve carpetas `dataset YYYY` de `D:\Codigos\Visualizacion`: qué contiene
cada una, qué columnas trae, qué defectos tiene y qué se puede analizar combinándolas.

> **Actualizado** tras el reemplazo de `dataset 2022` y `dataset 2023` por volcados
> completos tipo Jikan, y tras la aparición de `dataset 2024/dataset 2024 b`, que **sí es
> un corte propio de 2024**. Con eso el panel pasa de 7 a **9 años consecutivos, sin
> huecos**: 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025 y 2026.

**Conclusión corta:** el panel temporal es viable. Hay **11.879 títulos con el mismo
`anime_id` en los nueve años**, y **132.750 usuarios aparecen en los cinco datasets que
incluyen usuarios**, lo que permite seguir no solo la nota de un anime sino el
comportamiento de las mismas personas durante ocho años.

Las tablas normalizadas están en [`panel_temporal/`](panel_temporal/).

---

## 1. Resumen por año

| Año | Catálogo de anime | Usuarios | Interacciones | Nota |
|---|---|---|---|---|
| **2018** | `AnimeList.csv` — 14.478 títulos, 31 col | `UserList.csv` — 302.674 | `UserAnimeList.csv` — ~80,6 M | Completo |
| **2019** | `Anime.csv` — 15.278 títulos, 27 col | — | — | Solo catálogo |
| **2020** | `animes.csv` — 17.058 títulos, 11 col | `users.csv` — 302.674 | `user_watches.csv` — ~87,9 M | **Sin columna de nota** |
| **2021** | `anime.csv.zst` — 18.353 títulos, 23 col | `users.csv.zst` — 449.254 | `anime_list.csv.zst` — **129,4 M** | El más grande |
| **2022** | `anime.csv` — 24.640 títulos, 34 col | — | — | + personajes, personas, manga |
| **2023** | `anime.csv` — 24.985 títulos, 39 col | — | — | + manga. Trae fecha de captura |
| **2024** | `dataset 2024 b/jikan_final.csv` — 26.564, 36 col | `users-details-2023.csv` — 731.289 | `users-score-2023.csv` — ~30,4 M | Corte propio de 2024 + volcado de 2023 |
| **2025** | `mal_anime.csv` — 19.931 títulos, 25 col | — | — | Solo catálogo |
| **2026** | `clean/anime.parquet` — 19.384 (AniList) | 18.213.591 | 526,8 M (cohorte) de 968 M | Ya procesado |

---

## 2. Detalle por carpeta

### dataset 2018 — 8,95 GB

Scrape de MyAnimeList. El más completo de los antiguos.

| Fichero | Tamaño | Filas | Contenido |
|---|---|---|---|
| `AnimeList.csv` | 9,8 MB | 14.478 | Catálogo completo, 31 columnas |
| `anime_cleaned.csv` | 6,0 MB | — | Subconjunto filtrado, +2 columnas derivadas |
| `anime_filtered.csv` | 10,3 MB | — | Otra variante filtrada |
| `UserList.csv` | 29 MB | 302.674 | Perfiles con estadísticas agregadas |
| `users_cleaned.csv` / `users_filtered.csv` | 16 / 14 MB | — | Variantes |
| `UserAnimeList.csv` | **4,77 GB** | ~80,6 M | Una fila por usuario × anime |
| `animelists_cleaned.csv` / `_filtered.csv` | 2,26 GB c/u | — | Variantes del anterior |

**Columnas de `AnimeList.csv`:** `anime_id`, `title`, `title_english`, `title_japanese`,
`title_synonyms`, `image_url`, `type`, `source`, `episodes`, `status`, `airing`,
`aired_string`, `aired`, `duration`, `rating`, `score`, `scored_by`, `rank`, `popularity`,
`members`, `favorites`, `background`, `premiered`, `broadcast`, `related`, `producer`,
`licensor`, `studio`, `genre`, `opening_theme`, `ending_theme`.

**Columnas de `UserAnimeList.csv`:** `username`, `anime_id`, `my_watched_episodes`,
`my_start_date`, `my_finish_date`, `my_score`, `my_status`, `my_rewatching`,
`my_rewatching_ep`, `my_last_updated`, `my_tags`.

Único año con `opening_theme` / `ending_theme` y con `my_tags` a nivel de interacción.

> **`score` codifica «sin nota» como `0`, no como nulo.** Son 354 títulos. Es el único
> año que lo hace así, y por eso su cobertura de nota aparenta ser del 100%. Sin
> corregirlo, la media de 2018 sale 6,142 en vez de 6,296 y la correlación con 2019 cae
> de 0,981 a 0,926. El constructor del panel ya convierte esos ceros en nulos.

### dataset 2019 — 0,02 GB

Solo catálogo. `Anime.csv`, 15.278 títulos, 27 columnas. Clave `animeID`.

> **Cuidado:** todos los nombres de columna salvo el primero llevan **un espacio inicial**
> (`' name'`, `' score'`…). Hay que aplicar `df.columns = [c.strip() for c in df.columns]`
> antes de usarlo.

Aporta `synopsis`, que 2018 no trae.

### dataset 2020 — 2,79 GB

| Fichero | Tamaño | Filas | Contenido |
|---|---|---|---|
| `animes.csv` | 10,1 MB | 17.058 | Catálogo **sin nota, sin miembros, sin ranking** |
| `users.csv` | 26 MB | 302.674 | Perfiles mínimos (7 columnas) |
| `user_watches.csv` | 1,32 GB | ~87,9 M | `anime_id`, `score`, `status`, `num_watched_episodes`, `user_id` |
| `mal_db.dump` | 630 MB | — | Volcado PostgreSQL (`PGDMP` 12.4) |

**El catálogo no trae nota** ni fecha de emisión: sus columnas son `title`, `anime_id`,
`url`, `image_path`, `airing_status`, `num_episodes`, `mpaa_rating`, `last_scraped_date`,
`title_japanese`, `synopsis`, `title_english`. La nota de 2020 hay que **calcularla** de
`user_watches.csv` — ver aviso 4.1. Es también el único año sin año de estreno utilizable.

**Hallazgo:** la lista de usuarios de 2020 es **la misma cohorte que la de 2018**
(302.672 de 302.674 nombres coinciden). Es un re-scrape de las mismas personas dos años
después: un panel longitudinal genuino a nivel de usuario.

### dataset 2021 — 12,16 GB

Ficheros comprimidos con Zstandard, con un `*_peek.csv` de muestra al lado de cada uno.

| Fichero | Comprimido | Filas | Contenido |
|---|---|---|---|
| `anime.csv.zst` | 4,2 MB | 18.353 | Catálogo, 23 columnas |
| `users.csv.zst` | 17 MB | 449.254 | Perfiles, 16 columnas |
| `anime_list.csv.zst` | 830 MB | **129.419.831** | Interacciones (4,68 GB descomprimido) |
| `favorite_anime.csv.zst` | 7,6 MB | — | `user_id`, `anime_id` |
| `favorite_manga.csv.zst` | 4,0 MB | — | `user_id`, `manga_id` |
| `favorite_characters.csv.zst` | 9,5 MB | — | `user_id`, `character_id` |
| `anime_genres.csv.zst` | 83 KB | 52.076 | **Defectuoso, ver abajo** |
| `anime_studios.csv.zst` | 34 KB | 12.106 | **Defectuoso, ver abajo** |

Para leerlos: `zstandard.ZstdDecompressor().stream_reader(open(f,'rb'))`.

> **Defecto en `anime_genres` y `anime_studios`.** La cabecera dice `anime_id,genres`, pero
> la primera columna solo tiene **43 valores distintos** y cada uno se corresponde siempre
> con el mismo nombre (19→Music, 5→Dementia, 8→Drama…). Son pares `(genre_id, genre_name)`
> repetidos 52.076 veces: **la referencia al anime se perdió en la exportación**. Igual con
> estudios (786 valores distintos). Inservibles para unir por título; los géneros de 2021
> hay que imputarlos desde otro año.

Único dataset con las tablas de **favoritos** separadas por tipo, comparable con las que
produce el pipeline de 2026.

### dataset 2022 — 0,16 GB *(reemplazado)*

Volcado completo tipo Jikan, fechado **2022-07-23**.

| Fichero | Tamaño | Filas | Columnas |
|---|---|---|---|
| `anime.csv` | 18,3 MB | 24.640 | 34 |
| `characters.csv` | 54,8 MB | 146.049 | 8 |
| `manga.csv` | 43,0 MB | 66.371 | 26 |
| `people.csv` | 4,3 MB | 16.943 | 11 |
| `archive (9).zip` | 43,8 MB | — | Descarga original |

**Columnas de `anime.csv`:** `mal_id`, `title`, `type`, `score`, `scored_by`, `status`,
`episodes`, `aired_from`, `aired_to`, `source`, `members`, `favorites`, `duration`,
`rating`, `nsfw`, `pending_approval`, `premiered_season`, `premiered_year`,
`broadcast_day`, `broadcast_time`, `genres`, `themes`, `demographics`, `studios`,
`producers`, `licensors`, `synopsis`, `background`, `main_picture`, `url`, `trailer_url`,
`title_english`, `title_japanese`, `title_synonyms`.

Mejora enorme respecto al que había antes (2.000 títulos sin identificador). Ahora trae
`mal_id`, `scored_by` y **géneros, temas, demografía, estudios y productoras al 100%**.

> **Filtrar `pending_approval`.** 3.849 de las 24.640 filas (15,6%) son entradas enviadas
> por usuarios y aún sin aprobar: **ninguna tiene nota y su mediana de miembros es 0**. Son
> fichas vacías que inflan el recuento. Con `pending_approval == False` quedan **20.791**
> títulos reales, de los que 14.263 tienen nota.
>
> `nsfw == True` marca otros 1.510; filtrarlos o no es decisión de análisis, no un defecto.
>
> **Cobertura de `premiered_year`: solo 20,8%.** Hay que sacar el año de `aired_from`, que
> cubre el 87,9%. El constructor del panel ya lo hace.

`characters.csv` y `people.csv` son catálogos de personajes y de personas (seiyuu, staff)
con su recuento de `favorites`, **sin vínculo al anime**: no se pueden unir a un título.
Sirven para rankings de popularidad de personajes, no para análisis por serie.

### dataset 2023 — 0,10 GB *(reemplazado)*

Volcado del mismo tipo, fechado **2023-08-07**.

| Fichero | Tamaño | Filas | Columnas |
|---|---|---|---|
| `anime.csv` | 20,1 MB | 24.985 | 39 |
| `manga.csv` | 51,9 MB | 64.833 | 30 |
| `archive (10).zip` | 27,2 MB | — | Descarga original |

**Columnas de `anime.csv`:** `anime_id`, `title`, `type`, `score`, `scored_by`, `status`,
`episodes`, `start_date`, `end_date`, `source`, `members`, `favorites`,
`episode_duration`, `total_duration`, `rating`, `sfw`, `approved`, `created_at`,
`updated_at`, `start_year`, `start_season`, `real_start_date`, `real_end_date`,
`broadcast_day`, `broadcast_time`, `genres`, `themes`, `demographics`, `studios`,
`producers`, `licensors`, `synopsis`, `background`, `main_picture`, `url`, `trailer_url`,
`title_english`, `title_japanese`, `title_synonyms`.

**Es el único año que permite fechar el snapshot con precisión.** El `updated_at` máximo es
**2023-08-07 13:57**, que coincide con la fecha del fichero. Los demás años hay que
fecharlos por la fecha del fichero, que es la de descarga y no la del dato.

Aporta sobre 2022: `created_at` / `updated_at`, `real_start_date` / `real_end_date` (fechas
corregidas), `episode_duration` y `total_duration` separadas.

> **`scored_by` está al 100% pero no significa lo que parece.** Los títulos sin votos
> traen `0`, no nulo: 322 filas están a cero y 8.935 tienen `scored_by` sin `score`. El
> indicador real de cobertura es `score`, al 64,2%.
>
> Aquí `approved` es `True` en las 24.985 filas — el volcado ya viene filtrado, al
> contrario que el de 2022.

**El 2023 nuevo ya no trae usuarios ni interacciones.** Los ficheros
`users-details-2023.csv` y `users-score-2023.csv` que había antes **siguen existiendo en
`dataset 2024`** (ver siguiente sección), así que ese análisis no se ha perdido. Lo que sí
desapareció es `final_animedataset.csv` (4,34 GB) y `user-filtered.csv` (1,47 GB); podrían
estar dentro de `dataset 2024/dataset 2023.zip`, sin comprobar.

### dataset 2024 — 6,23 GB

Contiene **dos cosas distintas**: en la raíz, otro volcado del mismo **2023** procedente de
un dataset de Kaggle distinto al de la carpeta `dataset 2023`; y en la subcarpeta
`dataset 2024 b`, **un corte propio de 2024** que sí aporta un punto temporal nuevo.

| Fichero | Tamaño | Filas |
|---|---|---|
| `anime-dataset-2023.csv` | 15,2 MB | 24.905 |
| `users-details-2023.csv` | 71 MB | 731.289 |
| `users-score-2023.csv` | 1,10 GB | ~30,4 M |
| `*-transformed-*.csv` | — | Variantes procesadas por el autor original |
| `dataset 2023.zip` | 635 MB | Descarga original |

Tras el reemplazo, **esta carpeta es la única que conserva los datos de usuarios de 2023**:
`users-details-2023.csv` (16 columnas: `Mal ID`, `Username`, `Gender`, `Birthday`,
`Location`, `Joined`, `Days Watched`, `Mean Score`, `Watching`, `Completed`, `On Hold`,
`Dropped`, `Plan to Watch`, `Total Entries`, `Rewatched`, `Episodes Watched`) y
`users-score-2023.csv` (`user_id`, `Username`, `anime_id`, `Anime Title`, `rating`).

Contiene además `assets/` con 46 imágenes de un tutorial de estadística, `benchmarks/` con
resultados de sistemas de recomendación y dos informes HTML de perfilado.

> **También guarda 3,2 GB del censo chileno** (`personas_censo2024.csv`,
> `viviendas_censo2024.csv`, `hogares_censo2024.csv`), sin relación con anime.

**Los ficheros de la raíz no aportan un punto temporal nuevo:** su catálogo es del mismo
momento que el de `dataset 2023`. Lo que sí aportan es **el corte de usuarios de 2023**,
que ninguna otra carpeta conserva. El punto temporal de 2024 lo da la subcarpeta
`dataset 2024 b`, descrita a continuación.

#### dataset 2024/dataset 2024 b — corte propio de 2024

Volcado crudo de la API de Jikan, fechado **2024-05-17**. Es el punto que faltaba en la
serie: cierra el hueco entre 2023 y 2025.

| Fichero | Tamaño | Filas | Columnas |
|---|---|---|---|
| `jikan_final.csv` | 60,6 MB | 26.720 → **26.564** tras deduplicar | 36 |
| `archive (11).zip` | 11,3 MB | — | Descarga original |

**Columnas:** `mal_id`, `url`, `images`, `trailer`, `approved`, `titles`, `title`,
`title_english`, `title_japanese`, `title_synonyms`, `type`, `source`, `episodes`,
`status`, `airing`, `aired`, `duration`, `rating`, `score`, `scored_by`, `rank`,
`popularity`, `members`, `favorites`, `synopsis`, `background`, `season`, `year`,
`broadcast`, `producers`, `licensors`, `studios`, `genres`, `explicit_genres`,
`demographics`, `themes`.

Encaja sin fricción en el panel: ρ = 0,992 con 2023 y 0,982 con 2025, y su top 3 coincide
con el de los años vecinos. Es además **el único año además de 2018/2019/2021/2025 que trae
`rank`** (77,8%) y el único junto a 2026 con `popularity` al 100%.

> **Tres cosas que hay que arreglar antes de usarlo.**
>
> 1. **156 filas duplicadas**, idénticas en las 36 columnas. Un `drop_duplicates()` las
>    elimina y deja 26.564 `mal_id` únicos.
> 2. **Los campos anidados vienen como texto de estructuras de Python**, no como texto
>    plano igual que en 2022 y 2023. `genres` es
>    `"[{'mal_id': 1, 'type': 'anime', 'name': 'Action', ...}]"` y `aired` es un dict con
>    `from`, `to` y `prop`. Hay que extraer los valores con `str.findall` o
>    `ast.literal_eval`; un `read_csv` a secas los deja como cadenas inservibles.
> 3. **La columna `year` solo cubre el 21,9%**, pero la fecha real está dentro de `aired`:
>    extrayéndola de ahí la cobertura sube al **96,9%**, la mejor de toda la serie.
>
> Ojo también con las **listas vacías `"[]"`**, que no son nulos pero no aportan nada:
> afectan al 20,6% de `genres`, 42,1% de `themes`, 62,2% de `demographics`, 41,8% de
> `studios` y 53,2% de `producers`. La columna `explicit_genres` está **vacía en el 100%**
> de las filas. Contando solo las que tienen contenido, la cobertura real de género es del
> **79,4%**.

El constructor del panel ya aplica las tres correcciones.

### dataset 2025 — 0,04 GB

Solo `mal_anime.csv`: 19.931 títulos, 25 columnas. Clave `myanimelist_id`.

Único que trae `characters` y `source_url`, y que separa `Released_Season` /
`Released_Year`. También trae `Themes` y `Demographic`.

> **Cuidado con los tipos.** `Ranked` viene como texto `"#48"` y `Members`, `Popularity` y
> `Favorites` con separador de miles (`"2,008,019"`). Un `pd.to_numeric` directo los
> convierte en nulos: sin limpiar `#` y `,`, la cobertura de `Members` aparenta 30% cuando
> es 98%.
>
> **No trae `scored_by`**: es el único año al que no se le puede aplicar un umbral de votos
> propio. `Released_Year` es nulo en el 69% de las filas.

### dataset 2026 — 34,80 GB

El proyecto actual, ya procesado. Fuentes originales de Kaggle (AniList + MyAnimeList),
pipeline en `build_clean_segmentado.ipynb` y salidas en `clean/`. Documentado aparte en
`dataset 2026/clean/README.md`.

Para el panel interesa:
- `clean/anime.parquet` — 19.384 títulos de **AniList** (nota en escala 0–100).
- `clean/anime_stats_globales.parquet` — 29.604 `anime_id` con nota media calculada de las
  listas de usuarios de MAL (escala 1–10).

> El scrape de MAL es de **febrero de 2026** y el volcado de AniList de **agosto de 2026**:
> seis meses de desfase entre las dos mitades del mismo dataset.

---

## 3. El panel temporal

### Solape de `anime_id` entre años

| Año | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|
| **2018** | 14.478 | 14.243 | 14.440 | 14.431 | 14.409 | 14.355 | 14.345 | 12.104 | 14.337 |
| **2019** |  | 15.278 | 15.199 | 15.182 | 15.160 | 15.092 | 15.074 | 12.536 | 15.059 |
| **2020** |  |  | 17.058 | 17.041 | 17.019 | 16.936 | 16.909 | 13.818 | 16.890 |
| **2021** |  |  |  | 18.353 | 18.325 | 18.217 | 18.184 | 14.631 | 18.157 |
| **2022** |  |  |  |  | 24.640 | 22.804 | 22.769 | 16.336 | 22.710 |
| **2023** |  |  |  |  |  | 24.985 | 24.943 | 17.405 | 24.874 |
| **2024** |  |  |  |  |  |  | 26.564 | 18.235 | 26.492 |
| **2025** |  |  |  |  |  |  |  | 19.931 | 19.929 |
| **2026** |  |  |  |  |  |  |  |  | 29.604 |

**11.879 títulos aparecen en los nueve años.** El `anime_id` de MyAnimeList es estable entre
datasets: no hace falta emparejar por título en ningún año.

### Coherencia entre años consecutivos

| Transición | ρ Spearman | n | Δ nota media |
|---|---|---|---|
| 2018 → 2019 | 0,981 | 13.890 | +0,021 |
| 2019 → 2020 | 0,916 | 14.667 | −0,295 |
| 2020 → 2021 | 0,965 | 12.566 | +0,084 |
| 2021 → 2022 | **0,997** | 13.039 | −0,010 |
| 2022 → 2023 | **0,996** | 14.199 | −0,015 |
| 2023 → 2024 | 0,992 | 16.042 | +0,028 |
| 2024 → 2025 | 0,982 | 14.052 | −0,046 |
| 2025 → 2026 | 0,988 | 15.239 | −0,062 |

Las dos transiciones nuevas (2021→2022→2023) son **las más limpias de toda la serie**. La
única que se desvía es la que toca **2020**, el año con la nota calculada por nosotros.

### El top a lo largo de los años

Con los títulos que superan 10.000 votos en 2023 (4.122 títulos):

| Año | 1º | 2º | 3º |
|---|---|---|---|
| 2018 | FMA: Brotherhood 9,25 | Kimi no Na wa. 9,19 | Gintama° 9,15 |
| 2019 | FMA: Brotherhood 9,24 | Steins;Gate 9,14 | Kimi no Na wa. 9,14 |
| 2020 | FMA: Brotherhood 9,17 | Gintama° 9,14 | Gintama' 9,10 |
| 2021 | FMA: Brotherhood 9,17 | Gintama: The Final 9,15 | Steins;Gate 9,10 |
| 2022 | **Kaguya-sama S3 9,15** | FMA: Brotherhood 9,13 | Steins;Gate 9,08 |
| 2023 | FMA: Brotherhood 9,10 | Steins;Gate 9,07 | Gintama° 9,06 |
| 2024 | FMA: Brotherhood 9,09 | Steins;Gate 9,07 | Gintama° 9,06 |
| 2025 | FMA: Brotherhood 9,10 | Steins;Gate 9,07 | Gintama° 9,05 |
| 2026 | Shingeki no Kyojin S3 9,03 | FMA: Brotherhood 9,00 | Steins;Gate 8,98 |

**Estabilidad del top 10:** entre 6 y 9 títulos se mantienen de un año al siguiente, y
**3 están en el top 10 de los nueve años**. La nota del primero baja de forma sostenida:
9,25 → 9,00.

El dato nuevo más llamativo: **en 2022 el primer puesto lo ocupa Kaguya-sama S3**, recién
emitida, que después desaparece del podio. Es un ejemplo perfecto del decaimiento tras el
estreno que ahora se puede medir (sección 5.2).

---

## 4. Avisos de comparabilidad — leer antes de graficar

### 4.1 Dos procedencias distintas de la nota

| Procedencia | Años |
|---|---|
| **Nota publicada por MyAnimeList** (media ponderada, con corrección antiabuso) | 2018, 2019, 2021, 2022, 2023, 2025 |
| **Media cruda calculada por nosotros** a partir de las listas | **2020, 2026** |

Medido sobre los títulos comunes, comparando cada año con la interpolación de sus vecinos:

- **2020** queda **0,113 puntos por debajo** de lo esperable.
- **2026** queda **0,058 puntos por debajo**.

Además, la media de 2020 sale de un scrape de ~300.000 usuarios y la de 2026 de una cohorte
de 2,8 millones: poblaciones distintas, no solo fórmulas distintas.

**Qué hacer.** Para la evolución del top, trabajar con **rangos o percentiles dentro de cada
año**; así el desfase de método desaparece. Si se grafican notas absolutas, marcar 2020 y
2026 como puntos calculados de otra forma.

### 4.2 Los años no están igual de separados

Con `dataset 2024 b` **el hueco de 2024 queda cerrado**: la serie es de nueve años
consecutivos. Aun así, las fechas reales de captura no caen en el mismo mes de cada año
(2022-07-23, 2023-08-07, 2024-05-17, febrero de 2026…), así que conviene usar el año como
valor numérico y no como categoría equiespaciada.

### 4.3 Solo 2025 se queda sin umbral de votos

Con los datasets nuevos, 2022 y 2024 traen `scored_by`. El único año sin recuento de
votantes es **2025**. La solución sigue siendo la misma: **fijar la elegibilidad con un año que sí lo
trae** (2023 o 2026) y aplicar ese conjunto de títulos a todos los años.

Ojo con `scored_by` de 2023: está al 100% porque los títulos sin votos traen `0`, no nulo.

### 4.4 El catálogo crece

De 14.478 títulos en 2018 a 29.604 en 2026. La nota media global de cada año **no es
comparable** entre años porque la composición cambia. Para hablar de inflación o deflación
de notas hay que usar **el conjunto fijo de 11.879 títulos comunes**.

### 4.5 Fichas vacías en 2022

Filtrar `pending_approval == False` antes de contar títulos, o el catálogo de 2022 aparenta
24.640 cuando los títulos reales son 20.791.

### 4.6 2018 escribe los ceros como si fueran notas

En `AnimeList.csv`, `score` vale `0` cuando el título no tiene nota (354 casos) y
`scored_by` también. Hay que convertirlos a nulo antes de cualquier media o ranking; en
el resto de años la ausencia ya viene como nulo. El constructor del panel lo hace.

### 4.7 La fecha del snapshot no es el nombre de la carpeta

Solo 2023 permite fecharlo con precisión (`updated_at` máximo = 2023-08-07). Para el resto,
la fecha de modificación del fichero es la mejor aproximación: 2022-07-23 para el de 2022,
**2024-05-17** para el de `dataset 2024 b` y febrero/agosto de 2026 para las dos mitades
del de 2026.

---

## 4.bis ¿Alcanza para un top 100? Sí

Comprobado sobre los datos: fijando la elegibilidad con los títulos que superan 10.000
votos en 2023 (4.122 títulos), y tomando el top 100 de cada año:

- **177 títulos distintos** pasan alguna vez por el top 100 en los nueve años.
- **52 están en el top 100 los nueve años.**
- Cobertura de esos 177 por año: 116 (2018), 125 (2019), 137 (2020), 152 (2021),
  163 (2022), 177 (2023), 177 (2024), 176 (2025), 177 (2026).

Los que faltan en los años antiguos **son títulos que aún no se habían estrenado**, no
datos ausentes: descontando esos, faltan como mucho 7 títulos en el peor año. No hace
falta ningún dataset adicional para dibujar la evolución.

La rotación del top 100 de un año al siguiente va de 5 a 25 entradas nuevas, con los
saltos mayores en 2020 y 2021 y los menores en los años recientes.

## 5. Qué más se puede analizar

Ordenado por lo que aporta frente al esfuerzo.

### 5.1 Deriva de notas por título *(lo que más aporta)*

Con nueve puntos por título ya es medible lo que con un solo snapshot era imposible:

- Trayectoria individual de cualquier anime.
- **Qué títulos más subieron y cuáles más cayeron** en ocho años. Es la lista más
  interesante que sale de estos datos.
- Si la caída es general o selectiva.

*Datos:* `score` en los 9 años. Directo con `panel_temporal/`.

### 5.2 Decaimiento tras el estreno

Los estrenos de cada ventana se observan **a distintas edades**: uno de 2019 se ve a 1, 2,
3, 4, 5, 6 y 7 años de distancia, ya sin saltos. Permite estimar la curva de caída del entusiasmo inicial.
El caso de Kaguya-sama S3 —primera en 2022, fuera del podio después— es el ejemplo de
manual.

*Datos:* `score` por año + `year_estreno`, que el constructor del panel deja ya como año
numérico en todos los años salvo 2020.

### 5.3 Rotación del canon

Cuántos títulos entran y salen del top 10 / 50 / 100 cada año, y cuánto tarda un estreno en
colarse. Ya se ve que el top es muy estable (3 títulos en los ocho años), pero la cifra de
rotación por posición es material de gráfico.

### 5.4 Crecimiento de audiencia por título

`members` está en 2018, 2019, 2021, 2022, 2023, 2024, 2025 y 2026 — ocho de los nueve años.
Permite comparar la velocidad a la que un clásico sigue acumulando público frente a la de
un estreno, y detectar títulos revalorizados años después.

### 5.5 Géneros, temas y demografía a lo largo del tiempo

**Es lo que más ha mejorado con los datasets nuevos.** Antes los géneros estaban en 4 años
con formatos dispares; ahora 2022 y 2023 los traen al 100% junto con `themes`,
`demographics`, `studios` y `producers`, que casi ningún otro año tiene.

Cobertura de género por año: 2018 ✓, 2019 ✓, **2022 ✓**, **2023 ✓**, **2024 ✓** (79,4%,
tras parsear la lista de dicts), 2025 ✓, 2026 ✓ (vía AniList). Huecos: 2020 y 2021 (el de
2021 está roto, ver 2.5). Como el género de un título
no cambia, los huecos se pueden imputar desde un año contiguo.

Con `demographics` (Shounen / Seinen / Shoujo / Josei) se puede además comparar la
evolución de la nota **por público objetivo**, no solo por género.

### 5.6 Panel de usuarios *(lo más original)*

**132.750 usuarios aparecen en los cinco datasets con usuarios** (2018, 2020, 2021, 2023 —
en `dataset 2024`— y 2026), y el 92,5% de los de 2018 siguen presentes en 2026. Cruzando
por `username` se puede analizar:

- **Supervivencia**: qué fracción de una cohorte sigue activa años después.
- **Cómo cambia una misma persona**: nota media, tamaño de lista y tasa de abandono a lo
  largo de ocho años. ¿Se vuelve más exigente quien lleva más tiempo?
- **Envejecimiento de la base de usuarios**: la fecha de alta está en todos los años.

2018 y 2020 son **la misma cohorte re-escrapeada**, un par especialmente limpio para medir
cambios a dos años vista.

### 5.7 Cambio en la generosidad al puntuar

Con las interacciones de 2018 (80,6 M), 2020 (87,9 M), 2021 (129,4 M), 2023 (30,4 M, en
`dataset 2024`) y 2026 (526,8 M) se puede ver si **la distribución de notas se ha
desplazado**. Es la pregunta que separa «este anime gusta menos» de «todo el mundo puntúa
más bajo», y sin ella la sección 5.1 no se puede interpretar.

### 5.8 Estacionalidad de estrenos

Temporada de estreno disponible en 2018, 2019, 2021, **2022** (`premiered_season`),
**2023** (`start_season`), **2024** (`season`) y 2025 (`Released_Season`). Permite ver si alguna temporada
concentra mejores estrenos y cómo evoluciona el número de estrenos por temporada.

### 5.9 Estudios y productoras

`studio` en 2018, **`studios` y `producers` en 2022, 2023 y 2024**, `Studios` en 2025 y
`anime_estudios.parquet` en 2026. Seis cortes: qué estudios mantienen nota alta, cuáles
producen más y qué relación hay entre volumen y calidad.

### 5.10 Personajes y personas *(nuevo)*

`dataset 2022` aporta 146.049 personajes y 16.943 personas con su recuento de `favorites`,
y 2026 tiene `anime_personajes_anilist.parquet`. Permite un ranking de personajes y una
comparación entre dos cortes separados por cuatro años.

*Limitación:* `characters.csv` **no enlaza con el anime**, así que no se puede analizar por
serie. Solo sirve para rankings de popularidad.

### 5.11 Manga *(nuevo)*

2022 y 2023 traen catálogo de manga (66.371 y 64.833 títulos) con las mismas columnas que
anime. Con las tablas de manga de 2018 y 2021 se podría replicar todo el análisis para
manga, o comparar la nota de una obra en manga frente a su adaptación.

---

## 6. Recomendaciones prácticas

1. **Usar `panel_temporal/` como punto de partida.** Las nueve tablas están normalizadas al
   mismo esquema y el script que las genera es reejecutable.
2. **Graficar la evolución del top con rangos**, o marcar 2020 y 2026 como calculados de
   otra forma.
3. **Fijar la elegibilidad con los votos de 2023** y aplicarla a todos los años, ya que
   2025 no trae `scored_by`.
4. **Filtrar `pending_approval == False` en 2022.**
5. **No borrar `dataset 2024`**: aunque el catálogo de su raíz duplique el de 2023, es la
   única carpeta que conserva los usuarios y las puntuaciones de ese año, y su subcarpeta
   `dataset 2024 b` es el único corte propio de 2024.
7. **Al leer `dataset 2024 b`, deduplicar y parsear los campos anidados** antes de nada;
   `construir_panel.py` sirve de referencia.
6. **Para el análisis por género, apoyarse en 2022 y 2023**, que son los dos años con
   metadatos completos, e imputar los huecos de 2020 y 2021 desde ellos.

### Espacio en disco

Las nueve carpetas ocupan **65,19 GB** (bajó desde 73,58 GB al reemplazarse 2022 y 2023 por
volcados mucho más compactos). De ellos, **14,07 GB son archivos comprimidos o volcados que
ya están extraídos al lado**:

| Fichero | Tamaño |
|---|---|
| `dataset 2021/archive (5).zip` | 6,08 GB |
| `dataset 2021/users.tar.zst` | 5,26 GB |
| `dataset 2020/archive (7).zip` | 0,88 GB |
| `dataset 2024/dataset 2023.zip` | 0,59 GB |
| `dataset 2020/mal_db.dump` | 0,59 GB |
| resto | 0,67 GB |

Sumando los 3,2 GB del censo chileno de `dataset 2024`, hay **unos 17 GB recuperables** sin
perder ningún dato original — siempre que se confirme antes que cada zip corresponde a lo
ya extraído. **Ya no aplica** la recomendación anterior de borrar `dataset 2024` entero.
