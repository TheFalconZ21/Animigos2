# -*- coding: utf-8 -*-
"""Normaliza la tabla de anime de cada ano a un esquema comun.

Genera anime_YYYY.parquet en esta misma carpeta, todos con las mismas columnas:
    anime_id, title, score, scored_by, members, rank, popularity, favorites,
    type, genres, year_estreno

`year_estreno` sale siempre como ano numerico, extraido de la columna que mejor
cobertura da en cada fuente (ver COMENTARIOS por ano).

Reejecutar tras cambiar algo:  python construir_panel.py
Ver ../DATASETS.md para los avisos de comparabilidad entre anos.
"""
import io
from pathlib import Path

import numpy as np
import pandas as pd
import zstandard

BASE = Path(r"D:\Codigos\Visualizacion")
OUT = Path(__file__).parent

ESQUEMA = ["anime_id", "title", "score", "scored_by", "members", "rank",
           "popularity", "favorites", "type", "genres", "year_estreno"]


def zread(p):
    with open(p, "rb") as fh:
        return pd.read_csv(io.BytesIO(zstandard.ZstdDecompressor().stream_reader(fh).read()),
                           low_memory=False)


def ano_de_texto(s):
    """Extrae un ano de cuatro cifras de un texto libre ('Spring 1998', 'Apr 5, 2009...')."""
    y = s.astype("string").str.extract(r"((?:19|20)\d{2})", expand=False)
    return pd.to_numeric(y, errors="coerce")


def ano_de_fecha(s):
    return pd.to_datetime(s, errors="coerce", format="mixed", utc=True).dt.year


def generos_texto(s):
    """Normaliza la columna de generos a texto plano "A, B, C".

    Conviven tres formatos: texto plano (2018, 2025), lista de Python serializada
    (2019, 2022, 2023) y lista de dicts de Jikan (2024, ya aplanada antes de llegar aqui).
    """
    v = s.astype("string")
    lista = v.str.startswith("[").fillna(False)
    extraidos = v.where(lista).str.findall(r"'([^']+)'|\"([^\"]+)\"").apply(
        lambda m: ", ".join(a or b for a, b in m) if isinstance(m, list) and m else None)
    return v.where(~lista, extraidos).replace({"": None, "[]": None})


def norm(df, mapa, year=None):
    out = pd.DataFrame(index=df.index)
    for destino, origen in mapa.items():
        out[destino] = df[origen] if origen in df.columns else np.nan
    for c in ESQUEMA:
        if c not in out.columns:
            out[c] = np.nan
    for c in ["score", "scored_by", "members", "rank", "popularity", "favorites", "anime_id"]:
        col = out[c]
        if not pd.api.types.is_numeric_dtype(col):
            # 2025 escribe el puesto como "#48" y los miembros como "2,008,019"
            col = col.astype("string").str.replace(r"[#,\s]", "", regex=True).replace({"nan": None, "": None})
        out[c] = pd.to_numeric(col, errors="coerce")
    # La escala de MAL es 1-10: un 0 significa "sin nota", no una nota de cero.
    # 2018 lo codifica asi en 354 titulos y contaminaba medias y rankings.
    out["score"] = out["score"].where(out["score"] > 0)
    out["scored_by"] = out["scored_by"].where(out["scored_by"] > 0)
    out["genres"] = generos_texto(out["genres"])
    if year is not None:
        out["year_estreno"] = year.values
    out["year_estreno"] = pd.to_numeric(out["year_estreno"], errors="coerce")
    return out[ESQUEMA]


tablas = {}

# ---- 2018 -- premiered = "Spring 1998"; se completa con aired_string --------
d = pd.read_csv(BASE / "dataset 2018/AnimeList.csv", low_memory=False)
tablas[2018] = norm(d, dict(anime_id="anime_id", title="title", score="score",
                            scored_by="scored_by", members="members", rank="rank",
                            popularity="popularity", favorites="favorites", type="type",
                            genres="genre"),
                    year=ano_de_texto(d["premiered"]).fillna(ano_de_texto(d["aired_string"])))

# ---- 2019 -- los nombres de columna llevan un espacio inicial ---------------
d = pd.read_csv(BASE / "dataset 2019/Anime.csv", low_memory=False)
d.columns = [c.strip() for c in d.columns]
tablas[2019] = norm(d, dict(anime_id="animeID", title="name", score="score",
                            scored_by="scored_by", members="members", rank="rank",
                            popularity="popularity", favorites="favorites", type="type",
                            genres="genre"),
                    year=ano_de_texto(d["premiered"]).fillna(ano_de_texto(d["aired"])))

# ---- 2020 -- animes.csv no trae nota: se agrega de user_watches ------------
d = pd.read_csv(BASE / "dataset 2020/animes.csv", low_memory=False)
base20 = norm(d, dict(anime_id="anime_id", title="title"))
agg = None
for ch in pd.read_csv(BASE / "dataset 2020/user_watches.csv",
                      usecols=["anime_id", "score"], chunksize=5_000_000):
    ch = ch[ch["score"].between(1, 10)]
    a = ch.groupby("anime_id")["score"].agg(["sum", "count"])
    agg = a if agg is None else agg.add(a, fill_value=0)
agg["score"] = agg["sum"] / agg["count"]
base20 = base20.drop(columns=["score", "scored_by"]).merge(
    agg[["score", "count"]].rename(columns={"count": "scored_by"}),
    left_on="anime_id", right_index=True, how="left")
tablas[2020] = base20[ESQUEMA]

# ---- 2021 -------------------------------------------------------------------
d = zread(BASE / "dataset 2021/anime.csv.zst")
tablas[2021] = norm(d, dict(anime_id="anime_id", title="title", score="score",
                            scored_by="scored_by", members="members", rank="rank",
                            popularity="popularity", favorites="favorites", type="type"),
                    year=ano_de_fecha(d["aired_from"]))

# ---- 2022 -- volcado Jikan; premiered_year solo cubre el 21%, aired_from 88% -
d = pd.read_csv(BASE / "dataset 2022/anime.csv", low_memory=False)
tablas[2022] = norm(d, dict(anime_id="mal_id", title="title", score="score",
                            scored_by="scored_by", members="members",
                            favorites="favorites", type="type", genres="genres"),
                    year=pd.to_numeric(d["premiered_year"], errors="coerce")
                         .fillna(ano_de_fecha(d["aired_from"])))

# ---- 2023 -- volcado Jikan; start_year 81%, start_date 96% -----------------
d = pd.read_csv(BASE / "dataset 2023/anime.csv", low_memory=False)
tablas[2023] = norm(d, dict(anime_id="anime_id", title="title", score="score",
                            scored_by="scored_by", members="members",
                            favorites="favorites", type="type", genres="genres"),
                    year=pd.to_numeric(d["start_year"], errors="coerce")
                         .fillna(ano_de_fecha(d["start_date"])))

# ---- 2024 -- volcado Jikan crudo: campos anidados y duplicados exactos --------
d = pd.read_csv(BASE / "dataset 2024/dataset 2024 b/jikan_final.csv", low_memory=False)
d = d.drop_duplicates()                       # 156 filas repetidas identicas
# `year` solo cubre el 22%; la fecha real vive dentro del dict serializado `aired`
y24 = pd.to_numeric(
    d["aired"].astype("string").str.extract(r"'from': '((?:19|20)\d{2})", expand=False),
    errors="coerce")
# genres llega como lista de dicts; se aplana a texto para igualar al resto de anos
d["genres_txt"] = (d["genres"].astype("string").str.findall(r"'name': '([^']+)'")
                   .apply(lambda v: ", ".join(v) if isinstance(v, list) and v else None))
tablas[2024] = norm(d, dict(anime_id="mal_id", title="title", score="score",
                            scored_by="scored_by", members="members", rank="rank",
                            popularity="popularity", favorites="favorites", type="type",
                            genres="genres_txt"),
                    year=pd.to_numeric(d["year"], errors="coerce").fillna(y24))

# ---- 2025 -------------------------------------------------------------------
d = pd.read_csv(BASE / "dataset 2025/mal_anime.csv", low_memory=False)
tablas[2025] = norm(d, dict(anime_id="myanimelist_id", title="title", score="Score",
                            members="Members", rank="Ranked", popularity="Popularity",
                            favorites="Favorites", type="Type", genres="Genres",
                            year_estreno="Released_Year"))

# ---- 2026 -- AniList para la ficha + agregado propio de las listas de MAL ---
c26 = BASE / "dataset 2026/clean"
a = pd.read_parquet(c26 / "anime.parquet",
                    columns=["mal_id", "title_english", "title_romaji", "popularity",
                             "favourites", "type", "startDate_year"])
s = pd.read_parquet(c26 / "anime_stats_globales.parquet",
                    columns=["anime_id", "mean_score", "n_scored", "n_interactions"])
m = s.merge(a, left_on="anime_id", right_on="mal_id", how="left")
# los generos de 2026 viven en su propia tabla larga (AniList)
g26 = (pd.read_parquet(c26 / "anime_generos.parquet", columns=["mal_id", "genre"])
       .groupby("mal_id")["genre"].agg(lambda v: ", ".join(v)))
tablas[2026] = pd.DataFrame({
    "anime_id": m["anime_id"],
    "title": m["title_english"].fillna(m["title_romaji"]),
    "score": m["mean_score"], "scored_by": m["n_scored"], "members": m["n_interactions"],
    "rank": np.nan, "popularity": m["popularity"], "favorites": m["favourites"],
    "type": m["type"], "genres": m["anime_id"].map(g26),
    "year_estreno": pd.to_numeric(m["startDate_year"], errors="coerce"),
})[ESQUEMA]

# ---- informe ---------------------------------------------------------------
print(f"{'ano':>5} {'filas':>8} {'con id':>8} {'con score':>10} {'con votos':>10} "
      f"{'con ano':>9} {'score medio':>11}")
for ano, t in sorted(tablas.items()):
    print(f"{ano:>5} {len(t):>8,} {int(t['anime_id'].notna().sum()):>8,} "
          f"{int(t['score'].notna().sum()):>10,} {int(t['scored_by'].notna().sum()):>10,} "
          f"{int(t['year_estreno'].notna().sum()):>9,} {t['score'].mean():>11.3f}")
    t.to_parquet(OUT / f"anime_{ano}.parquet", index=False)

ids = {a: set(t["anime_id"].dropna().astype(int)) for a, t in tablas.items()}
anos = sorted(ids)
print("\n=== SOLAPE DE anime_id ===")
print("      " + "".join(f"{a:>8}" for a in anos))
for a in anos:
    print(f"{a:>5} " + "".join(f"{len(ids[a] & ids[b]):>8,}" for b in anos))
print(f"\npresentes en los {len(anos)} anos: {len(set.intersection(*ids.values())):,}")
