# -*- coding: utf-8 -*-
"""Presencia y recepcion de los generos de anime en el tiempo, y tasas base de exito.

Dos preguntas que exigen estructuras de datos distintas:

  PRESENCIA / RECEPCION por ano de ESTRENO
      Se usa un unico snapshot y se agrupa por `year_estreno`. Asi la etiqueta de
      genero viene siempre de la misma fuente. Comparar la cuota de genero ENTRE
      snapshots de anos distintos NO es valido: cambia la practica de etiquetado
      (Comedy salta del 12% al 18% entre la familia 2018-2019 y la 2022-2024 sin
      que cambie nada en la realidad).

  DERIVA de la nota
      Esa si necesita el panel de 9 snapshots sobre los mismos titulos.

Fuente principal: dataset 2024/dataset 2024 b (volcado Jikan, 2024-05-17), el de
mejor cobertura conjunta: ano 96,9%, miembros 100%, genero 79,4%.

Salida: cuatro PNG en esta misma carpeta.
"""
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

BASE = Path(r"D:\Codigos\Visualizacion")
OUT = Path(__file__).parent
OUT.mkdir(exist_ok=True)

# --- paleta validada (dataviz: adjacent CVD dE 9.1, normal-vision 19.6) --------
SURFACE, INK, INK2, MUTED = "#fcfcfb", "#0b0b0b", "#52514e", "#898781"
GRID, AXIS = "#e1e0d9", "#c3c2b7"
S1, S2, S3, S4, S5, S6 = "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"
S1_CLARO = "#9ec5f4"

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "font.family": "sans-serif", "font.sans-serif": ["Segoe UI", "DejaVu Sans"],
    "text.color": INK, "axes.labelcolor": INK2, "xtick.color": MUTED, "ytick.color": MUTED,
    "axes.edgecolor": AXIS, "axes.linewidth": 0.8, "grid.color": GRID,
    "grid.linewidth": 0.8, "grid.linestyle": "-", "figure.dpi": 110, "savefig.dpi": 200,
})


def eje_limpio(ax, ejes=("top", "right")):
    for e in ejes:
        ax.spines[e].set_visible(False)
    ax.tick_params(length=0)


def guardar(fig, nombre):
    fig.savefig(OUT / nombre, bbox_inches="tight")
    plt.close(fig)
    print(f"  guardado: {nombre}")


def separar(valores, minimo):
    """Empuja hacia abajo las etiquetas que quedarian solapadas."""
    orden = np.argsort(-np.asarray(valores))
    salida = np.array(valores, dtype=float)
    for i in range(1, len(orden)):
        prev, act = orden[i - 1], orden[i]
        if salida[prev] - salida[act] < minimo:
            salida[act] = salida[prev] - minimo
    return salida


# ============================================================== carga de datos
def cargar():
    f = BASE / "dataset 2024/dataset 2024 b/jikan_final.csv"
    d = pd.read_csv(f, low_memory=False).drop_duplicates()        # 156 filas repetidas
    d["year"] = pd.to_numeric(d["year"], errors="coerce").fillna(
        pd.to_numeric(d["aired"].astype("string").str.extract(
            r"'from': '((?:19|20)\d{2})", expand=False), errors="coerce"))
    d["gen"] = d["genres"].astype("string").str.findall(r"'name': '([^']+)'")
    d["secuela"] = d["title"].astype("string").str.contains(
        r"(?:Season|2nd|3rd|4th|II\b|III\b|Part|Shippuuden|: Final|Zoku)", regex=True, na=False)
    return d


def explotar(df):
    return df.explode("gen").dropna(subset=["gen"])


datos = cargar()
tv = datos[(datos["type"] == "TV") & datos["year"].between(1995, 2023)].copy()
print(f"series de TV estrenadas 1995-2023: {len(tv):,}")

# =============================================================== 1) PRESENCIA
GENEROS = ["Fantasy", "Comedy", "Action", "Adventure", "Sci-Fi", "Romance"]
COLOR = dict(zip(GENEROS, [S1, S2, S3, S4, S5, S6]))

e = explotar(tv)
tot = tv.groupby("year").size()
cuota = (e.groupby(["year", "gen"]).size().unstack(fill_value=0)
         .div(tot, axis=0).mul(100).rolling(3, center=True, min_periods=2).mean())

finales = [cuota[g].dropna().iloc[-1] for g in GENEROS]
etiq_y = separar(finales, 1.9)

fig, ax = plt.subplots(figsize=(12, 7))
for g, real, ey in zip(GENEROS, finales, etiq_y):
    ax.plot(cuota.index, cuota[g], color=COLOR[g], linewidth=2, solid_capstyle="round", label=g)
    ax.annotate(f"{g} {real:.0f}%", (cuota.index[-1] + 0.4, ey), color=INK2, fontsize=9,
                va="center", fontweight="bold")
ax.set_xlim(1995, 2030)
ax.set_ylim(0, 52)
ax.yaxis.grid(True)
ax.set_axisbelow(True)
eje_limpio(ax)
ax.set_title("La fantasía desplaza a la comedia\n"
             "Porcentaje de series de TV estrenadas cada año con cada etiqueta de género",
             fontsize=14, fontweight="bold", loc="left", pad=16)
ax.set_xlabel("Año de estreno", fontsize=10)
ax.set_ylabel("% de los estrenos del año", fontsize=10)
ax.legend(frameon=False, ncol=6, loc="upper center", bbox_to_anchor=(0.5, -0.10), fontsize=9)
ax.text(0, -0.20, "Media móvil de 3 años. Un título lleva varias etiquetas, así que las series "
        "suman más de 100%.\nFuente: volcado de MyAnimeList, mayo de 2024 "
        f"({len(tv):,} series de TV).",
        transform=ax.transAxes, fontsize=8, color=MUTED, va="top")
guardar(fig, "1_presencia_generos.png")

# ================================================== 2) TASAS BASE: LA RESPUESTA
vent = tv[tv["year"].between(2013, 2022)]
ev = explotar(vent)
r = ev.groupby("gen").agg(n=("mal_id", "size"))
r["p500k"] = ev.assign(x=ev["members"] >= 500_000).groupby("gen")["x"].mean() * 100
r["p8"] = ev.assign(x=ev["score"] >= 8).groupby("gen")["x"].mean() * 100
r = r[r["n"] >= 40]

fig, ax = plt.subplots(figsize=(12, 8))
ax.scatter(r["p500k"], r["p8"], s=r["n"] * 1.1, color=S1, alpha=0.28,
           edgecolors=SURFACE, linewidths=2, zorder=3)
ax.scatter(r["p500k"], r["p8"], s=26, color=S1, zorder=4)
ax.set_xlim(-2, 46)
ax.set_ylim(1.5, 27.5)
# los puntos de la derecha llevan la etiqueta a la izquierda para no salirse del eje
DESPLAZA = {"Fantasy": (9, -12), "Gourmet": (9, 9), "Mystery": (9, -13), "Ecchi": (9, -12)}
for g, row in r.iterrows():
    derecha = row["p500k"] > 30
    dx, dy = DESPLAZA.get(g, (9, 8))
    ax.annotate(f"{g} ({int(row['n'])})", (row["p500k"], row["p8"]),
                textcoords="offset points", xytext=(-dx if derecha else dx, dy),
                ha="right" if derecha else "left", fontsize=9, color=INK,
                fontweight="bold" if (row["p500k"] > 20 or row["p8"] > 15) else "normal")
mx, my = r["p500k"].median(), r["p8"].median()
ax.axvline(mx, color=AXIS, linewidth=0.8, zorder=1)
ax.axhline(my, color=AXIS, linewidth=0.8, zorder=1)
ax.text(mx + 0.5, 27.2, "más audiencia →", color=MUTED, fontsize=8, va="top")
ax.text(45.5, my + 0.4, "más aclamación ↑", color=MUTED, fontsize=8, ha="right")
ax.xaxis.grid(True)
ax.yaxis.grid(True)
ax.set_axisbelow(True)
eje_limpio(ax)
ax.set_title("Suspense y drama ganan en las dos cosas; comedia y fantasía en ninguna\n"
             "Cada punto es un género; el tamaño es cuántas series de TV se estrenaron con él",
             fontsize=14, fontweight="bold", loc="left", pad=16)
ax.set_xlabel("Probabilidad de superar 500.000 miembros (%)", fontsize=10)
ax.set_ylabel("Probabilidad de alcanzar nota ≥ 8 (%)", fontsize=10)
ax.text(0, -0.11, "Series de TV estrenadas entre 2013 y 2022, con al menos 40 títulos por género. "
        "Las líneas marcan la mediana.\nEntre paréntesis, el número de series estrenadas con esa "
        "etiqueta. Suspense está dominado por pocas franquicias: 6 de sus 37 éxitos son "
        "Shingeki no Kyojin.",
        transform=ax.transAxes, fontsize=8, color=MUTED, va="top")
guardar(fig, "2_tasas_de_exito.png")

# ====================================== 3) EL ORIGEN CONDICIONA AL GENERO
nuevas = vent[~vent["secuela"]]
src = nuevas.groupby("source").agg(n=("mal_id", "size"))
src["p500k"] = nuevas.assign(x=nuevas["members"] >= 500_000).groupby("source")["x"].mean() * 100
src = src[src["n"] >= 40].sort_values("p500k")

en = explotar(nuevas)
en["ok"] = en["members"] >= 500_000
piv = en.pivot_table(index="gen", columns="source", values="ok", aggfunc=["mean", "size"])
med, cnt = piv["mean"], piv["size"]
comun = [g for g in med.index
         if cnt.loc[g, "Manga"] >= 30 and cnt.loc[g, "Original"] >= 30]
inter = pd.DataFrame({"manga": 100 * med.loc[comun, "Manga"],
                      "original": 100 * med.loc[comun, "Original"]}).sort_values("manga")

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14.5, 6.8), gridspec_kw={"width_ratios": [1, 1.05]})

ax1.barh(range(len(src)), src["p500k"], color=S1, height=0.62)
ax1.set_yticks(range(len(src)))
ax1.set_yticklabels([f"{i}  ({n})" for i, n in zip(src.index, src["n"])], fontsize=9)
for i, v in enumerate(src["p500k"]):
    ax1.text(v + 0.6, i, f"{v:.1f}%", va="center", fontsize=9, color=INK, fontweight="bold")
ax1.set_xlim(0, 36)
ax1.xaxis.grid(True)
ax1.set_axisbelow(True)
eje_limpio(ax1, ("top", "right", "left"))
ax1.set_title("El origen del material, por sí solo", fontsize=11, fontweight="bold", loc="left", pad=10)
ax1.set_xlabel("Probabilidad de superar 500.000 miembros (%)", fontsize=9)

y = np.arange(len(inter))
ax2.hlines(y, inter["original"], inter["manga"], color=AXIS, linewidth=1.6, zorder=2)
ax2.scatter(inter["original"], y, s=64, color=S2, zorder=4,
            edgecolors=SURFACE, linewidths=2, label="Guion original")
ax2.scatter(inter["manga"], y, s=64, color=S1, zorder=4,
            edgecolors=SURFACE, linewidths=2, label="Adaptado de manga")
ax2.set_yticks(y)
ax2.set_yticklabels(inter.index, fontsize=9.5)
for i, (_, row) in enumerate(inter.iterrows()):
    # cada etiqueta va por el lado exterior de su punto, tambien cuando el
    # original supera al manga (caso Sports) y el orden se invierte
    der = row["manga"] >= row["original"]
    ax2.text(row["manga"] + (1.1 if der else -1.1), i, f"{row['manga']:.0f}%",
             va="center", ha="left" if der else "right", fontsize=9, color=INK, fontweight="bold")
    ax2.text(row["original"] + (-1.1 if der else 1.1), i, f"{row['original']:.0f}%",
             va="center", ha="right" if der else "left", fontsize=9, color=INK2)
ax2.set_xlim(-4, 40)
ax2.xaxis.grid(True)
ax2.set_axisbelow(True)
eje_limpio(ax2, ("top", "right", "left"))
ax2.set_title("El mismo género, según de dónde salga la historia",
              fontsize=11, fontweight="bold", loc="left", pad=10)
ax2.set_xlabel("Probabilidad de superar 500.000 miembros (%)", fontsize=9)
ax2.legend(frameon=False, loc="lower right", fontsize=9)

fig.suptitle("De dónde viene la historia pesa más que de qué va\n"
             "Obras nuevas de TV (sin secuelas) estrenadas entre 2013 y 2022",
             fontsize=14, fontweight="bold", x=0.045, ha="left", y=1.04)
fig.text(0.045, -0.03,
         "Solo géneros con al menos 30 series de cada origen. La fantasía adaptada de manga "
         "supera el medio millón de miembros 19 veces más a menudo que la fantasía original;\n"
         "en drama y deportes esa distancia casi desaparece, y son los únicos géneros donde "
         "un guion propio compite de tú a tú.",
         fontsize=8, color=MUTED, va="top")
guardar(fig, "3_origen_vs_genero.png")

# ============================================ 4) DERIVA DE LA NOTA (panel 9 anos)
P = BASE / "panel_temporal"
p18 = pd.read_parquet(P / "anime_2018.parquet").dropna(subset=["anime_id"]).drop_duplicates("anime_id")
p26 = pd.read_parquet(P / "anime_2026.parquet").dropna(subset=["anime_id"]).drop_duplicates("anime_id")
p18["anime_id"] = p18["anime_id"].astype(int)
p26["anime_id"] = p26["anime_id"].astype(int)
g18 = p18.assign(gen=p18["genres"].astype("string").str.split(", ")).explode("gen")
g18 = g18.dropna(subset=["gen"]).set_index("anime_id")
notas = pd.DataFrame({"n18": p18.set_index("anime_id")["score"],
                      "n26": p26.set_index("anime_id")["score"]}).dropna()
dv = g18[["gen"]].join(notas, how="inner").groupby("gen").agg(
    n=("gen", "size"), n18=("n18", "mean"), n26=("n26", "mean"))
dv = dv[dv["n"] >= 300]
dv["deriva"] = dv["n26"] - dv["n18"]
dv = dv.sort_values("deriva")

col = [S2 if v > 0 else S1 for v in dv["deriva"]]
fig, ax = plt.subplots(figsize=(11.5, 9))
y = np.arange(len(dv))
ax.barh(y, dv["deriva"], color=col, height=0.64)
ax.set_yticks(y)
ax.set_yticklabels([f"{g}  ({int(n):,})" for g, n in zip(dv.index, dv["n"])], fontsize=9.5)
for i, (_, row) in enumerate(dv.iterrows()):
    lado = 0.006 if row["deriva"] > 0 else -0.006
    ax.text(row["deriva"] + lado, i, f"{row['deriva']:+.2f}",
            va="center", ha="left" if row["deriva"] > 0 else "right",
            fontsize=8.5, color=INK, fontweight="bold")
    ax.text(-0.004 if row["deriva"] > 0 else 0.004, i, f"desde {row['n18']:.2f}",
            va="center", ha="right" if row["deriva"] > 0 else "left", fontsize=8, color=MUTED)
ax.axvline(0, color=AXIS, linewidth=1)
ax.set_xlim(-0.40, 0.14)
ax.xaxis.grid(True)
ax.set_axisbelow(True)
eje_limpio(ax, ("top", "right", "left"))
ax.set_title("Casi todos los géneros envejecen a la baja, y las modas son las que más caen\n"
             "Variación de la nota media de los mismos títulos entre 2018 y 2026",
             fontsize=14, fontweight="bold", loc="left", pad=16)
ax.set_xlabel("Variación de la nota media (puntos sobre 10)", fontsize=10)
ax.text(0, -0.075, "Géneros con al menos 300 títulos presentes en ambos cortes; entre paréntesis, "
        "cuántos. Al lado de cada barra, la nota de partida en 2018.\nHarem, ecchi y artes "
        "marciales son los que más se desinflan; drama, slice of life y shoujo los que mejor "
        "aguantan. Kids y música son los únicos que suben.",
        transform=ax.transAxes, fontsize=8, color=MUTED, va="top")
guardar(fig, "4_deriva_por_genero.png")

print("\nlisto ->", OUT)
