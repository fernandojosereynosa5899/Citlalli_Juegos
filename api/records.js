// Vercel Serverless Function: /api/records
const { Pool } = require('pg');

let pool = null;
function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    const isRender = process.env.DATABASE_URL.includes('render.com') || process.env.DATABASE_URL.includes('sslmode=require');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isRender ? { rejectUnauthorized: false } : undefined,
      max: 3,
      connectionTimeoutMillis: 3500
    });
  }
  return pool;
}

const GAMES = ['snake', 'flappy', 'memorama', 'reflejos'];
const AVATARS = { bottle: '🧴', charm_qm: '🏅', jaguar: '🐆', star: '⭐', rose: '🌹', amber: '🟠' };
const DIFFS = ['facil', 'medio', 'dificil'];
const SCENARIOS = ['hidalgo', 'jaguar', 'velvet', 'penthouse'];
const MAX_SCORE = { snake: 35000, flappy: 5000, reflejos: 20000, memorama: 500 };

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const p = getPool();
    const checkUser = (req.query && req.query.user) ? String(req.query.user).trim().toUpperCase() : null;
    if (!p) {
      return res.status(200).json({
        snake: [], flappy: [], memorama: [], reflejos: [],
        userCheck: { checked: false, dbConnected: false }
      });
    }
    try {
      const q = await p.query('SELECT fn_get_clean_arcade_records_json() AS j');
      const topData = q.rows[0].j || {};
      let userCheck = null;
      if (checkUser) {
        const chk = await p.query('SELECT id, is_banned FROM citlalli_players WHERE username = $1', [checkUser]);
        const cnt = await p.query('SELECT COUNT(*)::int AS c FROM citlalli_players');
        const total = (cnt.rows[0] && cnt.rows[0].c) || 0;
        if (chk.rows.length === 0) {
          userCheck = { checked: true, username: checkUser, exists: false, isBanned: false, totalPlayers: total, dbConnected: true };
        } else {
          const isBanned = !!chk.rows[0].is_banned;
          userCheck = { checked: true, username: checkUser, exists: !isBanned, isBanned, totalPlayers: total, dbConnected: true };
        }
      }
      return res.status(200).json({ ...topData, userCheck });
    } catch (err) {
      console.error('Vercel API GET error:', err.message);
      return res.status(200).json({ snake: [], flappy: [], memorama: [], reflejos: [], userCheck: { checked: false, dbConnected: false } });
    }
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const p = getPool();

    // Registro explícito
    if (b.action === 'register') {
      const username = String(b.username || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{1,8}$/.test(username)) return res.status(400).json({ error: 'Nombre inválido (máx 8)' });
      const avatar = AVATARS[b.avatar] ? b.avatar : 'bottle';
      const glyph = AVATARS[avatar] || '🧴';
      if (p) {
        try {
          await p.query(
            `INSERT INTO citlalli_players (username, avatar_id, avatar_emoji)
             VALUES ($1, $2, $3)
             ON CONFLICT (username) DO UPDATE
             SET avatar_id = EXCLUDED.avatar_id, avatar_emoji = EXCLUDED.avatar_emoji, last_active = CURRENT_TIMESTAMP`,
            [username, avatar, glyph]
          );
        } catch (err) {
          console.error('Vercel API register error:', err.message);
        }
      }
      return res.status(201).json({ ok: true, registered: true });
    }

    const username = String(b.username || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{1,8}$/.test(username)) return res.status(400).json({ error: 'Nombre inválido (máx 8)' });
    if (!GAMES.includes(b.game)) return res.status(400).json({ error: 'Juego inválido' });
    const score = Number(b.score);
    if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE[b.game]) return res.status(400).json({ error: 'Puntuación fuera de rango' });
    if (b.game === 'memorama' && score < 10) return res.status(400).json({ error: 'Intentos inválidos' });

    const bestMs = b.bestMs === null || b.bestMs === undefined ? null : Number(b.bestMs);
    const avatar = AVATARS[b.avatar] ? b.avatar : 'bottle';
    const difficulty = DIFFS.includes(b.difficulty) ? b.difficulty : 'medio';
    const scenario = SCENARIOS.includes(b.scenario) ? b.scenario : 'hidalgo';

    if (p) {
      try {
        const chk = await p.query('SELECT id, is_banned FROM citlalli_players WHERE username = $1', [username]);
        if (chk.rows.length === 0) {
          return res.status(403).json({ error: 'user_not_found', userExists: false, message: 'La cuenta no existe o la base de datos fue reiniciada.' });
        }
        if (chk.rows[0].is_banned) {
          return res.status(403).json({ error: 'user_banned', userExists: false, isBanned: true, message: 'La cuenta está sancionada.' });
        }
        await p.query('SELECT fn_citlalli_submit_score($1,$2,$3,$4,$5,$6,$7,$8)',
          [username, avatar, AVATARS[avatar], b.game, score, bestMs, difficulty, scenario]);
      } catch (err) {
        console.error('Vercel API POST error:', err.message);
      }
    }
    return res.status(201).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
};
