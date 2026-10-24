-- ============================================================================
-- CITLALLI ("El Aroma de los Dioses") · Salón Arcade
-- Schema y Consultas Oficiales de PostgreSQL para Tablas de Líderes y Jugadores
-- Diseñado para Juego Limpio, Sano, Alto Rendimiento y Prevención de Trampas
-- ============================================================================

-- 1. Habilitar extensión para UUIDs seguros si no está activada
-- (gen_random_uuid() es nativo desde PostgreSQL 13; pgcrypto cubre versiones anteriores)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLA DE JUGADORES (CITLALLI_PLAYERS)
-- Regla estricta: Username limitado a un MÁXIMO de 8 caracteres alfanuméricos.
-- ============================================================================
CREATE TABLE IF NOT EXISTS citlalli_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(8) NOT NULL UNIQUE,
    avatar_id VARCHAR(32) NOT NULL DEFAULT 'bottle',
    avatar_emoji VARCHAR(8) NOT NULL DEFAULT '🧴',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_hash VARCHAR(64),
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,

    -- Restricciones de integridad para Juego Limpio y Sano
    CONSTRAINT chk_username_length CHECK (char_length(trim(username)) >= 1 AND char_length(trim(username)) <= 8),
    -- El frontend sanitiza a MAYÚSCULAS alfanuméricas (A-Z, 0-9); la BD lo exige también.
    CONSTRAINT chk_username_allowed_chars CHECK (username ~ '^[A-Z0-9]{1,8}$'),
    CONSTRAINT chk_avatar_valid CHECK (avatar_id IN ('bottle', 'charm_qm', 'jaguar', 'star', 'rose', 'amber'))
);

-- Comentario documental
COMMENT ON TABLE citlalli_players IS 'Jugadores oficiales del Salón Arcade Citlalli con nombres estrictamente limitados a 8 caracteres.';

-- ============================================================================
-- 3. TABLA DE PUNTUACIONES Y RÉCORDS (CITLALLI_LEADERBOARD)
-- ============================================================================
CREATE TABLE IF NOT EXISTS citlalli_leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES citlalli_players(id) ON DELETE CASCADE,
    game_id VARCHAR(16) NOT NULL,
    score INTEGER NOT NULL,
    best_ms INTEGER,
    difficulty VARCHAR(16) NOT NULL DEFAULT 'medio',
    scenario_id VARCHAR(32) NOT NULL DEFAULT 'hidalgo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    client_ip VARCHAR(45),

    -- Validaciones de Juego Limpio
    CONSTRAINT chk_game_id_valid CHECK (game_id IN ('snake', 'flappy', 'memorama', 'reflejos')),
    CONSTRAINT chk_difficulty_valid CHECK (difficulty IN ('facil', 'medio', 'dificil')),
    CONSTRAINT chk_score_positive CHECK (score >= 0),
    CONSTRAINT chk_best_ms_positive CHECK (best_ms IS NULL OR best_ms >= 0)
);

-- ============================================================================
-- 4. ÍNDICES DE ALTO RENDIMIENTO (60 FPS / SUB-MILLISECOND LATENCY)
-- ============================================================================
-- Índice para ranking descendente en Snake, Flappy y Reflejos
CREATE INDEX IF NOT EXISTS idx_citlalli_lb_game_score_desc
ON citlalli_leaderboard (game_id, score DESC, created_at ASC);

-- Índice especial para Memorama (gana el que tiene MENOS intentos)
CREATE INDEX IF NOT EXISTS idx_citlalli_lb_memorama_asc
ON citlalli_leaderboard (score ASC, created_at ASC)
WHERE game_id = 'memorama';

-- Índice por jugador para consultar historial personal
CREATE INDEX IF NOT EXISTS idx_citlalli_lb_player_id
ON citlalli_leaderboard (player_id, game_id);

-- ============================================================================
-- 5. TRIGGER DE ANTI-TRAMPAS (PREVENCIÓN DE INYECCIONES Y PUNTUACIONES FALSAS)
-- Bloquea registros de usuarios sancionados o puntuaciones sobrehumanas.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_citlalli_anti_cheat_guard()
RETURNS TRIGGER AS $$
DECLARE
    v_is_banned BOOLEAN;
BEGIN
    -- 1. Verificar si el jugador está baneado
    SELECT is_banned INTO v_is_banned FROM citlalli_players WHERE id = NEW.player_id;
    IF v_is_banned THEN
        RAISE EXCEPTION 'Juego Limpio: El jugador % está sancionado y no puede registrar récords.', NEW.player_id;
    END IF;

    -- 2. Validar umbrales matemáticos razonables por juego para evitar hacks de consola
    IF NEW.game_id = 'snake' AND NEW.score > 35000 THEN
        RAISE EXCEPTION 'Juego Limpio: Puntuación de Víborita excede el umbral verificado (% pts).', NEW.score;
    ELSIF NEW.game_id = 'flappy' AND NEW.score > 5000 THEN
        RAISE EXCEPTION 'Juego Limpio: Puntuación de Flappy excede el umbral verificado (% pts).', NEW.score;
    ELSIF NEW.game_id = 'reflejos' AND NEW.score > 20000 THEN
        RAISE EXCEPTION 'Juego Limpio: Puntuación de Reflejos excede el umbral verificado (% pts).', NEW.score;
    ELSIF NEW.game_id = 'memorama' AND NEW.score < 10 THEN
        -- 10 pares requieren mínimo 10 intentos si se adivinara perfecto con suerte cósmica
        RAISE EXCEPTION 'Juego Limpio: Intentos en Memorama matemáticamente imposibles (% intentos).', NEW.score;
    END IF;

    -- 3. Actualizar última actividad del jugador
    UPDATE citlalli_players SET last_active = CURRENT_TIMESTAMP WHERE id = NEW.player_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_citlalli_anti_cheat ON citlalli_leaderboard;
CREATE TRIGGER trg_citlalli_anti_cheat
BEFORE INSERT OR UPDATE ON citlalli_leaderboard
FOR EACH ROW
EXECUTE FUNCTION fn_citlalli_anti_cheat_guard();

-- ============================================================================
-- 6. VISTAS OFICIALES PARA UN JUEGO LIMPIO Y SANO
-- Cada jugador solo compite con su MEJOR récord personal en el Top 10,
-- evitando que un solo usuario sature la tabla con 10 repeticiones.
-- ============================================================================

CREATE OR REPLACE VIEW v_citlalli_clean_leaderboard AS
WITH BestRecordPerPlayer AS (
    SELECT
        l.game_id,
        l.player_id,
        p.username,
        p.avatar_id,
        p.avatar_emoji,
        l.score,
        l.best_ms,
        l.difficulty,
        l.scenario_id,
        l.created_at,
        ROW_NUMBER() OVER (
            PARTITION BY l.game_id, l.player_id
            ORDER BY
                CASE WHEN l.game_id = 'memorama' THEN l.score ELSE -l.score END ASC,
                l.created_at ASC
        ) AS rank_in_player
    FROM citlalli_leaderboard l
    JOIN citlalli_players p ON l.player_id = p.id
    WHERE p.is_banned = FALSE
),
UniqueTopRanks AS (
    SELECT * FROM BestRecordPerPlayer WHERE rank_in_player = 1
)
SELECT
    game_id,
    ROW_NUMBER() OVER (
        PARTITION BY game_id
        ORDER BY
            CASE WHEN game_id = 'memorama' THEN score ELSE -score END ASC,
            created_at ASC
    ) AS pos,
    username,
    avatar_id,
    avatar_emoji,
    score,
    best_ms,
    difficulty,
    scenario_id,
    created_at
FROM UniqueTopRanks;

-- Vista especial de los 4 Campeones indiscutibles #1 (Premios Citlalli)
CREATE OR REPLACE VIEW v_citlalli_champions_top1 AS
SELECT *
FROM v_citlalli_clean_leaderboard
WHERE pos = 1;

-- Vista Top 10 limpio de TODOS los juegos (lista para la API REST y el Salón de la Fama)
CREATE OR REPLACE VIEW v_citlalli_top10 AS
SELECT *
FROM v_citlalli_clean_leaderboard
WHERE pos <= 10;

COMMENT ON VIEW v_citlalli_top10 IS 'Top 10 por juego: un único mejor récord por jugador, sin baneados. Memorama ordena por menos intentos.';

-- ============================================================================
-- 7. CONSULTAS SQL REUTILIZABLES (QUERIES DE OPERACIÓN DIARIA)
-- ============================================================================

-- Consulta A: Registrar o identificar jugador oficial (Máx 8 caracteres garantizado)
-- INSERT INTO citlalli_players (username, avatar_id, avatar_emoji)
-- VALUES (UPPER(SUBSTRING(TRIM('FERNANDO') FROM 1 FOR 8)), 'bottle', '🧴')
-- ON CONFLICT (username) DO UPDATE
-- SET last_active = CURRENT_TIMESTAMP, avatar_id = EXCLUDED.avatar_id, avatar_emoji = EXCLUDED.avatar_emoji
-- RETURNING id, username, avatar_id, avatar_emoji;

-- Consulta B: Insertar nueva partida jugada
-- INSERT INTO citlalli_leaderboard (player_id, game_id, score, best_ms, difficulty, scenario_id)
-- VALUES ('<UUID_DEL_JUGADOR>', 'snake', 450, NULL, 'medio', 'hidalgo');

-- Consulta C: Obtener el Top 10 limpio de un juego específico (Ej: Snake)
-- SELECT pos, username, avatar_id, avatar_emoji, score, difficulty, scenario_id, created_at
-- FROM v_citlalli_top10
-- WHERE game_id = 'snake'
-- ORDER BY pos ASC;

-- Consulta D: Registrar partida (UPSERT del jugador + INSERT del récord) en una sola llamada.
-- La usa server/server.js. El nombre se normaliza a MAYÚSCULAS y máximo 8 caracteres;
-- el trigger anti-trampas valida la puntuación.
--   SELECT fn_citlalli_submit_score('FERNANDO', 'bottle', '🧴', 'snake', 450, NULL, 'medio', 'hidalgo');
CREATE OR REPLACE FUNCTION fn_citlalli_submit_score(
    p_username     VARCHAR,
    p_avatar_id    VARCHAR,
    p_avatar_emoji VARCHAR,
    p_game_id      VARCHAR,
    p_score        INTEGER,
    p_best_ms      INTEGER DEFAULT NULL,
    p_difficulty   VARCHAR DEFAULT 'medio',
    p_scenario     VARCHAR DEFAULT 'hidalgo'
) RETURNS UUID AS $$
DECLARE
    v_player_id UUID;
    v_record_id UUID;
BEGIN
    INSERT INTO citlalli_players (username, avatar_id, avatar_emoji)
    VALUES (UPPER(SUBSTRING(TRIM(p_username) FROM 1 FOR 8)), p_avatar_id, COALESCE(p_avatar_emoji, '🧴'))
    ON CONFLICT (username) DO UPDATE SET last_active = CURRENT_TIMESTAMP
    RETURNING id INTO v_player_id;

    INSERT INTO citlalli_leaderboard (player_id, game_id, score, best_ms, difficulty, scenario_id)
    VALUES (v_player_id, p_game_id, p_score, p_best_ms, p_difficulty, p_scenario)
    RETURNING id INTO v_record_id;

    RETURN v_record_id;
END;
$$ LANGUAGE plpgsql;

-- Consulta E: Obtener resumen JSON agrupado de los 4 juegos para la API REST (GET /api/records)
-- Formato: { "snake": [ {username, valor, avatar, scenarioId, difficulty, fecha}, ... ], "flappy": [...], ... }
CREATE OR REPLACE FUNCTION fn_get_clean_arcade_records_json()
RETURNS JSONB AS $$
    SELECT COALESCE(jsonb_object_agg(g.game_id, g.top_rows), '{}'::jsonb)
    FROM (
        SELECT gm.game_id,
               COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                       'username', t.username,
                       'valor', t.score,
                       'avatar', t.avatar_id,
                       'scenarioId', t.scenario_id,
                       'difficulty', t.difficulty,
                       'fecha', to_char(t.created_at, 'YYYY-MM-DD')
                   ) ORDER BY t.pos ASC)
                   FROM v_citlalli_top10 t
                   WHERE t.game_id = gm.game_id
               ), '[]'::jsonb) AS top_rows
        FROM (VALUES ('snake'), ('flappy'), ('memorama'), ('reflejos')) AS gm(game_id)
    ) g;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- 8. CONSULTAS DE MANTENIMIENTO: REINICIAR TABLAS A CERO (JUEGO LIMPIO)
-- ============================================================================

-- Procedimiento para reiniciar los marcadores a cero sin borrar los usuarios registrados
CREATE OR REPLACE PROCEDURE sp_citlalli_reset_leaderboards()
LANGUAGE plpgsql AS $$
BEGIN
    TRUNCATE TABLE citlalli_leaderboard RESTART IDENTITY CASCADE;
    RAISE NOTICE 'Tabla de líderes de Citlalli reiniciada exitosamente a cero absoluto.';
END;
$$;

-- Procedimiento para sancionar y eliminar récords de un tramposo
CREATE OR REPLACE PROCEDURE sp_citlalli_ban_cheater(p_username VARCHAR(8))
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE citlalli_players SET is_banned = TRUE WHERE username = UPPER(p_username);
    DELETE FROM citlalli_leaderboard WHERE player_id IN (
        SELECT id FROM citlalli_players WHERE username = UPPER(p_username)
    );
    RAISE NOTICE 'El usuario % ha sido sancionado y sus récords han sido purgados.', p_username;
END;
$$;

-- Procedimiento para vaciar COMPLETAMENTE la base de datos (jugadores y récords a cero absoluto)
-- Al ejecutar esto, el juego detectará automáticamente el reinicio, borrará el localStorage
-- del jugador y le solicitará registrarse nuevamente con un aviso claro en pantalla.
CREATE OR REPLACE PROCEDURE sp_citlalli_wipe_database()
LANGUAGE plpgsql AS $$
BEGIN
    TRUNCATE TABLE citlalli_players CASCADE;
    RAISE NOTICE 'Base de datos Citlalli vaciada por completo (jugadores y récords a cero).';
END;
$$;
