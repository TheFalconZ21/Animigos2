# Anime Dataset 2018–2026

Un dataset derivado sobre anime, construido cruzando **nueve volcados anuales** de
MyAnimeList y AniList. No es una descarga más: los originales suman 65 GB y aquí caben en
menos de 700 MB porque lo que se comparte son **tablas limpias, normalizadas y unidas**, con
la procedencia de cada dato documentada.

Lo que tiene de particular frente a los datasets sueltos de los que parte:

- **Nueve cortes del mismo catálogo**, con el mismo identificador y el mismo esquema, lo que
  permite ver **cómo cambia la nota de un título con el tiempo** — imposible con un solo
  volcado.
- **Los avisos de comparabilidad viajan como datos**, en `fuentes.parquet`, no solo como
  prosa en un README que nadie lee.
- **Errores de los originales ya corregidos** y documentados uno por uno.

---

## Empezar en treinta segundos

```python
import pandas as pd

panel = pd.read_parquet("hechos/anime_por_ano.parquet")
anime = pd.read_parquet("dim/anime.parquet")

# Evolución de Fullmetal Alchemist: Brotherhood
panel[panel.anime_id == 5114][["ano", "score", "members"]]
```

| ano | score | members |
|---|---|---|
| 2018 | 9,25 | 1.200.000 |
| 2019 | 9,24 | 1.360.000 |
| … | … | … |
| 2026 | 9,00 | 3.340.000 |

---

## Estructura

Modelo en estrella: una dimensión central, tablas de hechos con las métricas y tablas puente
para los atributos 1:N.

| Carpeta | Contenido | Tamaño |
|---|---|---|
| `fuentes.parquet` · `.csv` | **Procedencia y avisos de cada año.** Empieza por aquí | 9 filas |
| `dim/` | `anime.parquet` — catálogo de 19.384 títulos | 5,9 MB |
| `hechos/` | `anime_por_ano` (el panel), `anime_stats_2026`, `estados_2026` | 5 MB |
| `atributos/` | Géneros, tags, estudios, staff, personajes, rankings, relaciones | 8 MB |
| `agregados/` | Resultados ya calculados: tasas de éxito, deriva, cruces demográficos | < 1 MB |
| `usuarios/` | 18,2 M perfiles, favoritos, amistades | 670 MB |
| `codigo/` | El notebook del pipeline y los scripts de análisis | 0,3 MB |
| `graficos/` | Los 18 gráficos en PNG | 4,6 MB |
| `csv/` | Las 22 tablas que caben en una hoja de cálculo, en CSV | 76 MB |

**El núcleo son 27 MB** (todo menos `usuarios/` y `csv/`). Si no vas a analizar
comportamiento de usuario, borra esa carpeta y el dataset sigue completo para cualquier
análisis de catálogo.

### Parquet o CSV: cuál usar

Las tablas están en **Parquet**, y las que caben en una hoja de cálculo están además en
**CSV** dentro de `csv/`. Mismos datos, distinto envase.

| | Parquet | CSV |
|---|---|---|
| Tamaño | 3,5 MB | 14,0 MB |
| Tiempo de lectura | 0,06 s | 0,42 s |
| Se abre en Excel o Sheets | No | Sí |
| Conserva tipos y nulos | Sí | No: se readivinan al leer |

*(medido sobre `anime_por_ano`; en el resto de tablas Parquet sale entre 2 y 7 veces más
pequeño y entre 7 y 30 veces más rápido)*

**Usa CSV** si vas a abrirlo en Excel, Google Sheets o cualquier herramienta que no lea
Parquet. Es lo universal.

**Usa Parquet** si trabajas con pandas, polars, R, DuckDB o Power BI. Además de pesar menos,
guarda los tipos: en CSV, un `anime_id` puede leerse como texto, una fecha como cadena y un
nulo como la palabra `NA`, y hay que volver a declararlo todo al cargar.

**Las seis tablas de `usuarios/` solo están en Parquet.** No es una preferencia: tienen entre
4,5 y 18,2 millones de filas y **Excel se detiene en 1.048.576**. En CSV pesarían 265 MB cada
una y aun así no se abrirían. Para esas hay que usar pandas, polars o DuckDB.

Los CSV van en `utf-8-sig` (UTF-8 con BOM) porque Excel en Windows destroza los acentos sin
esa marca.

### Las tres tablas que importan

**`hechos/anime_por_ano.parquet`** — 190.891 filas, una por *(título, año)*. Es la razón de
ser del dataset: `anime_id`, `ano`, `score`, `scored_by`, `members`, `rank`, `popularity`,
`favorites`, `type`, `year_estreno`. Hay **11.879 títulos presentes en los nueve años**.

**`dim/anime.parquet`** — 19.384 títulos de AniList: títulos en cuatro idiomas, formato,
episodios, fechas, sinopsis limpia, puntuación y popularidad. Se une por `mal_id`.

**`fuentes.parquet`** — una fila por año con la fecha de captura, si la nota es la publicada
por MyAnimeList o calculada por nosotros, el desfase medido y qué columnas trae. **Léela
antes de comparar años.**

---

## Cómo unir las tablas

```
dim/anime.mal_id  ─┬─  hechos/anime_por_ano.anime_id
                   ├─  hechos/anime_stats_2026.anime_id
                   ├─  atributos/anime_generos_por_ano.anime_id   (+ ano)
                   ├─  atributos/anime_{tags,estudios,staff,personajes,rankings}.mal_id
                   └─  atributos/anime_{relaciones,recomendaciones}.mal_id_from / _to

usuarios/perfiles_2026.username ─┬─ usuarios/favoritos_*.username
                                 └─ usuarios/amigos.username
```

---

## Antes de comparar años: lee esto

Estas son las trampas reales del dataset. Están medidas, no supuestas.

**1. Dos años traen la nota calculada por nosotros, no la publicada.** Son 2020 y 2026, y
quedan 0,113 y 0,058 puntos por debajo de lo esperable. La columna `nota_publicada` de
`fuentes.parquet` los marca. **Para comparar entre años, usa rangos o percentiles**, no la
nota absoluta.

```python
fuentes = pd.read_parquet("fuentes.parquet")
comparables = fuentes.loc[fuentes.nota_publicada, "ano"]   # 2018, 2019, 2021-2025
```

**2. La cuota de género no es comparable entre años.** La taxonomía cambia entre familias de
volcado: AniList usa *Thriller, Psychological, Mecha*; MyAnimeList usa *Suspense, Award
Winning, Gourmet*. Solo 14 etiquetas coinciden, y *Comedy* salta del 12% al 18% entre 2019 y
2022 sin que cambie nada en la realidad. **La nota por género sí es comparable; la cuota
no.** Por eso `anime_generos_por_ano` lleva el año en la clave.

**3. El eje temporal no es uniforme.** Las capturas caen en meses distintos (2022-07-23,
2023-08-07, 2024-05-17, febrero de 2026). Trata el año como número, no como categoría
equiespaciada.

**4. 2020 y 2021 no tienen géneros utilizables.** El de 2021 venía roto en origen: la tabla
de géneros perdió la referencia al anime. Como el género de un título no cambia, se pueden
imputar desde un año contiguo.

**5. El grafo de amistades está truncado.** La fuente devuelve como mucho 10 amigos por
usuario, así que `usuarios/amigos.parquet` es un grafo **parcial** y cualquier métrica de red
estará sesgada.

**6. `anime_stats_2026` no cubre la misma población que la cohorte.** Los agregados se
calcularon sobre las 968 M de filas del origen; la cohorte escrita eran 527 M. Es
deliberado, para que los agregados por título no queden sesgados por el filtro.

---

## Qué se corrigió respecto a los originales

Cada uno detectado con evidencia, no por precaución:

| Origen | Problema | Corrección |
|---|---|---|
| 2018 | `score = 0` significa «sin nota», no un cero | Convertido a nulo. La media pasa de 6,142 a 6,296 |
| 2019 | Nombres de columna con espacio inicial | Normalizados |
| 2021 | Géneros y estudios sin referencia al anime | Documentado como inservible; se imputa de otro año |
| 2022 | 3.849 fichas pendientes de aprobación, sin nota ni miembros | Marcadas para filtrar |
| 2024 | 156 filas duplicadas; campos anidados como texto de Python | Deduplicado y parseado |
| 2024 | `year` cubría el 22%; la fecha real está dentro de `aired` | Extraída: cobertura del 97% |
| 2025 | `Ranked` como `"#48"` y `Members` como `"2,008,019"` | Convertidos a número |
| 2026 | `comm` vale la cadena `"null"` en el 98% de los perfiles | Tratado como nulo |
| 2026 | El código de `gender` no estaba documentado | **Deducido** cruzando 222.619 usuarios con el volcado de 2023, que lo trae en texto: 1 = *Male*, 2 = *Female*, 3 = *Non-Binary* |

---

## Qué se puede responder con esto

Cosas que un volcado suelto no permite:

- **¿Cómo envejece la nota de un anime?** Fullmetal Alchemist: Brotherhood pasa de 9,25 a
  9,00 en ocho años, y sigue siendo el primero en 8 de los 9 cortes.
- **¿Qué títulos más subieron y bajaron?** Boku no Hero Academia 3ª temporada cae del puesto
  35 al 571.
- **¿Se puntúa más bajo con el tiempo?** Sobre una cohorte fija de 9.497 títulos, la nota
  media baja de 6,691 a 6,509.
- **¿Qué género conviene producir?** El origen del material pesa más que el género: una
  adaptación de novela ligera supera el medio millón de miembros el 28% de las veces; un
  guion original, el 2%. Ver `agregados/exito_por_origen_y_genero.parquet`.
- **¿Cambian los gustos con la edad?** La ciencia ficción es lo más generacional: +2,1 puntos
  sobre la media entre los cuarentones, −1,4 entre los veinteañeros.

---

## Procedencia y licencia

Construido a partir de nueve datasets públicos de Kaggle de MyAnimeList y AniList,
capturados entre 2018 y 2026. El detalle de cada uno —ficheros, columnas, defectos— está en
[`INVENTARIO_FUENTES.md`](INVENTARIO_FUENTES.md). El pipeline de limpieza está en
[`codigo/build_clean_segmentado.ipynb`](codigo/build_clean_segmentado.ipynb), documentado
celda a celda.

Los datos originales son de MyAnimeList y AniList y pertenecen a sus respectivos titulares.
Este paquete redistribuye datos derivados con fines de análisis; **antes de publicarlo
abiertamente conviene revisar los términos de uso de cada fuente original**, sobre todo por
la carpeta `usuarios/`, que contiene nombres de usuario reales.

**Formato:** Parquet con compresión zstd. Se lee con pandas, polars, DuckDB o Spark.
Dependencias en `requirements.txt`.
