import os
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_DIR = os.path.join(BASE_DIR, "csv")
USUARIOS_CSV_DIR = os.path.join(CSV_DIR, "usuarios")

os.makedirs(USUARIOS_CSV_DIR, exist_ok=True)

print("=== 1. Generando master consolidado por catálogo (anime_master_catalogo.csv) ===")
dim_anime = pd.read_parquet(os.path.join(BASE_DIR, "dim", "anime.parquet"))
hechos_ano = pd.read_parquet(os.path.join(BASE_DIR, "hechos", "anime_por_ano.parquet"))
hechos_stats_2026 = pd.read_parquet(os.path.join(BASE_DIR, "hechos", "anime_stats_2026.parquet"))

# Pivotar notas por año
score_pivot = hechos_ano.pivot(index="anime_id", columns="ano", values="score")
score_pivot.columns = [f"score_{col}" for col in score_pivot.columns]
score_pivot = score_pivot.reset_index()

members_2026 = hechos_ano[hechos_ano["ano"] == 2026][["anime_id", "members", "rank", "popularity"]].rename(
    columns={"members": "members_2026", "rank": "rank_2026", "popularity": "popularity_2026"}
)

# Cargar géneros principales
if os.path.exists(os.path.join(BASE_DIR, "atributos", "anime_generos_2026.parquet")):
    gen_df = pd.read_parquet(os.path.join(BASE_DIR, "atributos", "anime_generos_2026.parquet"))
    gen_grouped = gen_df.groupby("mal_id")["genre"].apply(lambda s: ", ".join(s)).reset_index().rename(columns={"genre": "generos_2026"})
else:
    gen_grouped = pd.DataFrame(columns=["mal_id", "generos_2026"])

# Cargar estudio principal
if os.path.exists(os.path.join(BASE_DIR, "atributos", "anime_estudios.parquet")):
    est_df = pd.read_parquet(os.path.join(BASE_DIR, "atributos", "anime_estudios.parquet"))
    est_main = est_df[est_df["is_main"] == True].groupby("mal_id")["studio"].first().reset_index().rename(columns={"studio": "estudio_principal"})
else:
    est_main = pd.DataFrame(columns=["mal_id", "estudio_principal"])

# Unir dimensión principal
master_df = dim_anime.merge(score_pivot, left_on="mal_id", right_on="anime_id", how="left")
master_df = master_df.merge(members_2026, on="anime_id", how="left")
master_df = master_df.merge(gen_grouped, on="mal_id", how="left")
master_df = master_df.merge(est_main, on="mal_id", how="left")
master_df = master_df.merge(
    hechos_stats_2026[["anime_id", "n_interactions", "n_completed", "mean_score"]].rename(columns={"mean_score": "mean_score_mal_2026"}),
    on="anime_id",
    how="left"
)

# Reordenar columnas clave al inicio
cols_order = [
    "mal_id", "title_romaji", "title_english", "type", "format", "status",
    "startDate_year", "episodes", "season", "seasonYear",
    "averageScore", "mean_score_mal_2026", "score_2018", "score_2020", "score_2022", "score_2024", "score_2026",
    "popularity_2026", "members_2026", "generos_2026", "estudio_principal"
]
remaining_cols = [c for c in master_df.columns if c not in cols_order and c != "anime_id"]
master_df = master_df[cols_order + remaining_cols]

master_csv_path = os.path.join(CSV_DIR, "anime_master_catalogo.csv")
master_df.to_csv(master_csv_path, index=False, encoding="utf-8-sig")
print(f"-> Guardado {master_csv_path} ({len(master_df):,} filas, {os.path.getsize(master_csv_path)/(1024*1024):.2f} MB)")

print("\n=== 2. Generando panel temporal máster consolidado (anime_master_panel_temporal.csv) ===")
panel_master = hechos_ano.merge(
    dim_anime[["mal_id", "title_romaji", "title_english", "format", "startDate_year"]],
    left_on="anime_id", right_on="mal_id", how="left"
)
panel_csv_path = os.path.join(CSV_DIR, "anime_master_panel_temporal.csv")
panel_master.to_csv(panel_csv_path, index=False, encoding="utf-8-sig")
print(f"-> Guardado {panel_csv_path} ({len(panel_master):,} filas, {os.path.getsize(panel_csv_path)/(1024*1024):.2f} MB)")

print("\n=== 3. Generando muestra representativa de usuarios (100.000 usuarios) ===")
perfiles_path = os.path.join(BASE_DIR, "usuarios", "perfiles_2026.parquet")
if os.path.exists(perfiles_path):
    print("Leyendo perfiles_2026.parquet...")
    perfiles = pd.read_parquet(perfiles_path)
    print(f"Total perfiles en fuente: {len(perfiles):,}")

    # Filtrar perfiles válidos/activos si es posible, tomar muestra fija de 100,000
    validos = perfiles[perfiles["list_fetched_ok"] == True] if "list_fetched_ok" in perfiles.columns else perfiles
    if len(validos) < 100000:
        validos = perfiles
    
    sample_perfiles = validos.sample(n=100000, random_state=42)
    sample_users_set = set(sample_perfiles["username"])

    perfiles_csv_out = os.path.join(USUARIOS_CSV_DIR, "perfiles_2026.csv")
    sample_perfiles.to_csv(perfiles_csv_out, index=False, encoding="utf-8-sig")
    print(f"-> Guardado {perfiles_csv_out} ({len(sample_perfiles):,} filas, {os.path.getsize(perfiles_csv_out)/(1024*1024):.2f} MB)")

    # Procesar tablas dependientes en usuarios/
    user_tables = [
        "favoritos_anime.parquet",
        "favoritos_personaje.parquet",
        "favoritos_manga.parquet",
        "favoritos_persona.parquet",
        "favoritos_empresa.parquet",
        "amigos.parquet",
        "insignias.parquet"
    ]

    for ut in user_tables:
        ut_path = os.path.join(BASE_DIR, "usuarios", ut)
        if os.path.exists(ut_path):
            print(f"Procesando {ut}...")
            df_u = pd.read_parquet(ut_path)
            df_sampled = df_u[df_u["username"].isin(sample_users_set)]
            out_csv_name = ut.replace(".parquet", ".csv")
            out_csv_path = os.path.join(USUARIOS_CSV_DIR, out_csv_name)
            df_sampled.to_csv(out_csv_path, index=False, encoding="utf-8-sig")
            print(f"  -> Guardado {out_csv_path} ({len(df_sampled):,} filas, {os.path.getsize(out_csv_path)/(1024*1024):.2f} MB)")
else:
    print("No se encontró la carpeta usuarios/")

print("\n=== ¡Proceso completado exitosamente! ===")
