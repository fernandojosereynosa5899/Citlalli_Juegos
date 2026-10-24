/**
 * CITLALLI · Sala Arcade — servidor local opcional (cero dependencias).
 *
 *   node server/server.js            →  http://localhost:8080/arcade/
 *
 * - Sirve la carpeta del proyecto (arcade/, pixel-art/, brand/).
 * - API REST  GET/POST /api/records
 * - Persistencia: PostgreSQL si defines DATABASE_URL y tienes instalado el paquete `pg`
 *   (opcional: `npm i pg`). Si no, o si PostgreSQL falla, guarda en server/data/records.json.
 * El frontend funciona igual SIN este servidor (RAM + localStorage).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Carga automática de .env si existe (sin dependencias adicionales)
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const PORT = Number(process.env.PORT) || 8080;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'records.json');

const GAMES = ['snake', 'flappy', 'memorama', 'reflejos'];
const AVATARS = { bottle: '🧴', charm_qm: '🏅', jaguar: '🐆', star: '⭐', rose: '🌹', amber: '🟠' };
const DIFFS = ['facil', 'medio', 'dificil'];
const SCENARIOS = ['hidalgo', 'jaguar', 'velvet', 'penthouse'];
const MAX_SCORE = { snake: 60000, flappy: 12000, reflejos: 45000, memorama: 500 }; // alineado con el trigger SQL

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon'
};
const PUBLIC_DIRS = ['arcade', 'pixel-art', 'brand'];

/* ------------------------------------------------------------------ validación */
function validate(b) {
  if (!b || typeof b !== 'object') return null;
  const username = String(b.username || '');
  if (!/^[A-Z0-9]{1,8}$/.test(username)) return null;
  if (!GAMES.includes(b.game)) return null;
  const score = Number(b.score);
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE[b.game]) return null;
  if (b.game === 'memorama' && score < 10) return null; // 10 pares ⇒ mínimo 10 intentos
  const bestMs = b.bestMs === null || b.bestMs === undefined ? null : Number(b.bestMs);
  if (bestMs !== null && (!Number.isInteger(bestMs) || bestMs < 0 || bestMs > 60000)) return null;
  return {
    username, game: b.game, score, bestMs,
    avatar: AVATARS[b.avatar] ? b.avatar : 'bottle',
    difficulty: DIFFS.includes(b.difficulty) ? b.difficulty : 'medio',
    scenario: SCENARIOS.includes(b.scenario) ? b.scenario : 'hidalgo'
  };
}

/* ------------------------------------------------------------------ almacén JSON */
const fileStore = (() => {
  let rows = [];
  try { rows = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); if (!Array.isArray(rows)) rows = []; } catch (e) { rows = []; }
  let timer = null;
  function save() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(rows)); } catch (e) { console.error('[file] no se pudo guardar:', e.message); }
    }, 300);
  }
  return {
    async submit(r) { rows.push({ ...r, fecha: new Date().toISOString().slice(0, 10) }); if (rows.length > 5000) rows.shift(); save(); },
    async top() {
      const out = {};
      GAMES.forEach((g) => {
        const best = new Map();
        rows.filter((r) => r.game === g).forEach((r) => {
          const p = best.get(r.username);
          if (!p || (g === 'memorama' ? r.score < p.score : r.score > p.score)) best.set(r.username, r);
        });
        out[g] = Array.from(best.values())
          .sort((a, b) => (g === 'memorama' ? a.score - b.score : b.score - a.score))
          .slice(0, 10)
          .map((r) => ({ username: r.username, valor: r.score, avatar: r.avatar, scenarioId: r.scenario, difficulty: r.difficulty, fecha: r.fecha }));
      });
      return out;
    }
  };
})();

/* ------------------------------------------------------------------ almacén PostgreSQL (opcional) */
let pgStore = null;
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg'); // eslint-disable-line global-require
    const isRender = process.env.DATABASE_URL.includes('render.com') || process.env.DATABASE_URL.includes('sslmode=require');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isRender ? { rejectUnauthorized: false } : undefined,
      max: 5,
      connectionTimeoutMillis: 3500,
      statement_timeout: 3500
    });
    pool.on('error', (e) => console.error('[pg]', e.message));
    pgStore = {
      async checkUser(username) {
        const u = String(username || '').trim().toUpperCase();
        if (!u) return { checked: false, dbConnected: true };
        const chk = await pool.query('SELECT id, is_banned FROM citlalli_players WHERE username = $1', [u]);
        const cnt = await pool.query('SELECT COUNT(*)::int AS c FROM citlalli_players');
        const total = (cnt.rows[0] && cnt.rows[0].c) || 0;
        if (chk.rows.length === 0) {
          return { checked: true, username: u, exists: false, isBanned: false, totalPlayers: total, dbConnected: true };
        }
        const isBanned = !!chk.rows[0].is_banned;
        return { checked: true, username: u, exists: !isBanned, isBanned, totalPlayers: total, dbConnected: true };
      },
      async register(username, avatar) {
        const u = String(username || '').trim().toUpperCase();
        const av = AVATARS[avatar] ? avatar : 'bottle';
        const glyph = AVATARS[av] || '🧴';
        await pool.query(
          `INSERT INTO citlalli_players (username, avatar_id, avatar_emoji)
           VALUES ($1, $2, $3)
           ON CONFLICT (username) DO UPDATE
           SET avatar_id = EXCLUDED.avatar_id, avatar_emoji = EXCLUDED.avatar_emoji, last_active = CURRENT_TIMESTAMP`,
          [u, av, glyph]
        );
        return { ok: true, registered: true };
      },
      async submit(r) {
        // Verificar que el usuario exista en citlalli_players antes de insertar
        const chk = await pool.query('SELECT id, is_banned FROM citlalli_players WHERE username = $1', [r.username]);
        if (chk.rows.length === 0) {
          const err = new Error('USER_NOT_FOUND');
          err.code = 'USER_NOT_FOUND';
          throw err;
        }
        if (chk.rows[0].is_banned) {
          const err = new Error('USER_BANNED');
          err.code = 'USER_BANNED';
          throw err;
        }
        await pool.query('SELECT fn_citlalli_submit_score($1,$2,$3,$4,$5,$6,$7,$8)',
          [r.username, r.avatar, AVATARS[r.avatar], r.game, r.score, r.bestMs, r.difficulty, r.scenario]);
        return { ok: true };
      },
      async top() { return (await pool.query('SELECT fn_get_clean_arcade_records_json() AS j')).rows[0].j; }
    };
    console.log('[pg] PostgreSQL activado con conexión remota');
  } catch (e) {
    console.warn('[pg] paquete "pg" no disponible; usando archivo JSON. (npm i pg)');
  }
}

/** Intenta PostgreSQL; si falla, cae al archivo JSON sin romper la API. */
const store = {
  async checkUser(username) {
    if (pgStore) {
      try { return await pgStore.checkUser(username); }
      catch (e) { console.error('[pg] checkUser:', e.message); }
    }
    return { checked: false, dbConnected: false };
  },
  async register(username, avatar) {
    if (pgStore) {
      try { return await pgStore.register(username, avatar); }
      catch (e) { console.error('[pg] register:', e.message); }
    }
    return { ok: true, registered: true };
  },
  async submit(r) {
    if (pgStore) {
      return await pgStore.submit(r);
    }
    await fileStore.submit(r);
    return { ok: true };
  },
  async top() {
    if (pgStore) { try { return await pgStore.top(); } catch (e) { console.error('[pg] top:', e.message); } }
    return fileStore.top();
  }
};

/* ------------------------------------------------------------------ HTTP */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), h = (hits.get(ip) || []).filter((t) => now - t < 60000);
  h.push(now); hits.set(ip, h);
  return h.length > 60;
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

async function api(req, res) {
  if (rateLimited(req.socket.remoteAddress)) return sendJSON(res, 429, { error: 'demasiadas solicitudes' });
  const reqUrl = new URL(req.url, 'http://localhost');
  if (req.method === 'GET') {
    const checkUser = reqUrl.searchParams.get('user');
    const topData = await store.top();
    let userCheck = null;
    if (checkUser) {
      userCheck = await store.checkUser(checkUser);
    }
    return sendJSON(res, 200, { ...(topData || {}), userCheck });
  }
  if (req.method === 'POST') {
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > 2048) return sendJSON(res, 413, { error: 'cuerpo demasiado grande' }); chunks.push(c); }
    let body = null;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { /* inválido */ }
    if (!body || typeof body !== 'object') return sendJSON(res, 400, { error: 'cuerpo inválido' });

    // Registro explícito de jugador
    if (body.action === 'register') {
      const username = String(body.username || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{1,8}$/.test(username)) return sendJSON(res, 400, { error: 'nombre inválido (máx 8)' });
      const avatar = AVATARS[body.avatar] ? body.avatar : 'bottle';
      await store.register(username, avatar);
      return sendJSON(res, 201, { ok: true, registered: true });
    }

    const rec = validate(body);
    if (!rec) return sendJSON(res, 400, { error: 'registro inválido' });

    try {
      await store.submit(rec);
      return sendJSON(res, 201, { ok: true });
    } catch (err) {
      if (err.code === 'USER_NOT_FOUND') {
        return sendJSON(res, 403, { error: 'user_not_found', userExists: false, message: 'La cuenta no existe o la base de datos fue reiniciada.' });
      }
      if (err.code === 'USER_BANNED') {
        return sendJSON(res, 403, { error: 'user_banned', userExists: false, isBanned: true, message: 'La cuenta está sancionada.' });
      }
      console.error('[store.submit error]', err.message);
      // Fallback a archivo si falló la conexión puntual
      await fileStore.submit(rec);
      return sendJSON(res, 201, { ok: true, fallback: true });
    }
  }
  return sendJSON(res, 405, { error: 'método no permitido' });
}

function serveStatic(req, res) {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') { res.writeHead(302, { Location: '/arcade/' }); return res.end(); }
  const rel = path.normalize(url).replace(/^([/\\])+/, '');
  const top = rel.split(/[/\\]/)[0];
  if (!PUBLIC_DIRS.includes(top)) { res.writeHead(404); return res.end('No encontrado'); }
  let file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  if (p === '/api/records') api(req, res).catch((e) => { console.error(e); sendJSON(res, 500, { error: 'error interno' }); });
  else serveStatic(req, res);
}).listen(PORT, () => console.log(`CITLALLI Arcade → http://localhost:${PORT}/arcade/`));
