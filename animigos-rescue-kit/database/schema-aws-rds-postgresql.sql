-- ============================================================================
-- Animigos — Esquema Consolidado para AWS RDS / Aurora PostgreSQL
-- ============================================================================
-- Compatible con: PostgreSQL 14, 15, 16+ en AWS RDS / Aurora
-- Autenticación: Adaptable a AWS Cognito o JWT propio (Node / Express / NestJS)
-- ============================================================================

-- Extensiones requeridas para generación de UUIDs y utilidades criptográficas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Función utilitaria para actualizar automáticamente 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 1. TABLA DE USUARIOS / AUTENTICACIÓN
-- (Reemplaza auth.users de Supabase para ser compatible con AWS Cognito o JWT)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),               -- Nullable si se utiliza AWS Cognito / Social OAuth
    cognito_sub VARCHAR(255) UNIQUE,          -- Sub/ID provisto por AWS Cognito User Pools
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 2. PERFILES PÚBLICOS DE USUARIO
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    bio TEXT DEFAULT '¡Hola! Estoy usando Animigos para coordinar animes con mis amigos 🍿',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 3. PREFERENCIAS Y ONBOARDING DE GUSTOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    onboarding_completed BOOLEAN DEFAULT FALSE NOT NULL,
    onboarding_stage VARCHAR(20) DEFAULT 'none' NOT NULL, -- 'none', 'quick', 'deep'
    favorite_genres TEXT[] DEFAULT '{}' NOT NULL,
    experience_level VARCHAR(20) DEFAULT 'beginner' NOT NULL, -- 'beginner', 'intermediate', 'expert'
    preferred_duration VARCHAR(50),
    privacy_settings JSONB DEFAULT '{"personalListVisibility": "public", "statsVisibility": "public"}'::JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------------------------------------------
-- 4. CACHÉ LOCAL DE ANIMES (Importación de MyAnimeList / Jikan v4 / AniList)
-- Evita rate-limiting y cuellos de botella con APIs externas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anime_cache (
    mal_id INT PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    title_english VARCHAR(300),
    title_japanese VARCHAR(300),
    synopsis TEXT,
    image_url TEXT,
    banner_url TEXT,
    score NUMERIC(4, 2),                      -- Puntuación global en MAL (ej. 8.75)
    scored_by INT DEFAULT 0,                  -- Cantidad de usuarios que votaron en MAL
    popularity INT,                           -- Ranking de popularidad
    rank INT,
    episodes INT,
    duration NUMERIC,
    status VARCHAR(50),                       -- 'Finished Airing', 'Currently Airing', etc.
    season VARCHAR(20),                       -- 'Invierno', 'Primavera', 'Verano', 'Otoño'
    season_year INT,                          -- ej. 2026
    studio VARCHAR(100),
    genres TEXT[] DEFAULT '{}' NOT NULL,
    type VARCHAR(30),                         -- 'TV', 'Movie', 'OVA', etc.
    airing_day VARCHAR(20),                   -- 'lunes', 'martes', etc.
    last_synced_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anime_cache_title ON anime_cache (title);
CREATE INDEX IF NOT EXISTS idx_anime_cache_score ON anime_cache (score DESC);
CREATE INDEX IF NOT EXISTS idx_anime_cache_season_year ON anime_cache (season_year, season);

-- ----------------------------------------------------------------------------
-- 5. LISTAS PERSONALES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    is_public BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES personal_lists(id) ON DELETE CASCADE,
    mal_id INT NOT NULL REFERENCES anime_cache(mal_id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'plan_to_watch' NOT NULL, -- 'completed', 'watching', 'plan_to_watch', 'dropped'
    personal_score NUMERIC(4, 2),                         -- Puntuación personal (1-10)
    episodes_watched INT DEFAULT 0 NOT NULL,
    notes TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_list_anime UNIQUE (list_id, mal_id)
);

-- ----------------------------------------------------------------------------
-- 6. LISTAS COMPARTIDAS (SALAS GRUPALES DE DECISIÓN)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shared_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'voting' NOT NULL, -- 'candidates', 'voting', 'selected', 'watching', 'completed'
    invite_code VARCHAR(20) UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
    selected_anime_id INT REFERENCES anime_cache(mal_id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_lists_invite_code ON shared_lists (invite_code);

-- ----------------------------------------------------------------------------
-- 7. MIEMBROS DE LISTAS COMPARTIDAS (Soporte Dual: Registrados e Invitados)
-- Permite que amigos sin cuenta participen sin fricción
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shared_list_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_list_id UUID NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,   -- NULL para invitados
    guest_token VARCHAR(100),                                 -- Token local del invitado
    guest_name VARCHAR(100),                                  -- Nombre visible del invitado
    role VARCHAR(20) DEFAULT 'member' NOT NULL,               -- 'owner', 'member', 'guest'
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_member_identity CHECK (
        (user_id IS NOT NULL AND guest_token IS NULL) OR 
        (user_id IS NULL AND guest_token IS NOT NULL)
    )
);

-- ----------------------------------------------------------------------------
-- 8. CANDIDATOS POSTULADOS A LA LISTA GRUPAL
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shared_list_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_list_id UUID NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
    mal_id INT NOT NULL REFERENCES anime_cache(mal_id) ON DELETE CASCADE,
    suggested_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    suggested_by_guest_token VARCHAR(100),
    added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_shared_candidate UNIQUE (shared_list_id, mal_id)
);

-- ----------------------------------------------------------------------------
-- 9. VOTOS NUMÉRICOS DE INTERÉS (Escala de ganas 0 a 10)
-- Alimenta el Algoritmo de Felicidad Grupal
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shared_list_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES shared_list_candidates(id) ON DELETE CASCADE,
    voter_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    voter_guest_token VARCHAR(100),
    interest_score SMALLINT NOT NULL CHECK (interest_score >= 0 AND interest_score <= 10),
    voted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_voter_identity CHECK (
        (voter_user_id IS NOT NULL AND voter_guest_token IS NULL) OR 
        (voter_user_id IS NULL AND voter_guest_token IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_candidate_votes ON shared_list_votes (candidate_id);

-- ----------------------------------------------------------------------------
-- 10. SEGUIMIENTO DE PROGRESO DE EPISODIOS EN GRUPO
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_watch_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_list_id UUID NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
    mal_id INT NOT NULL REFERENCES anime_cache(mal_id) ON DELETE CASCADE,
    current_episode INT DEFAULT 0 NOT NULL,
    total_episodes INT,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------------------------------------------
-- 11. RELACIONES DE AMISTAD SOCIAL
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_friendship_pair UNIQUE (user_id, friend_id)
);

-- ----------------------------------------------------------------------------
-- 12. NOTIFICACIONES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    type VARCHAR(40) NOT NULL, -- 'friend_request', 'friend_accepted', 'list_invite', 'vote_reminder'
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, is_read);
