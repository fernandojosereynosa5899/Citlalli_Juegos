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
const MAX_SCORE = { snake: 35000, flappy: 5000, reflejos: 20000, memorama: 500 }; // alineado con el trigger SQL

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
      async submit(r) {
        await pool.query('SELECT fn_citlalli_submit_score($1,$2,$3,$4,$5,$6,$7,$8)',
          [r.username, r.avatar, AVATARS[r.avatar], r.game, r.score, r.bestMs, r.difficulty, r.scenario]);
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
  async submit(r) {
    if (pgStore) { try { await pgStore.submit(r); return; } catch (e) { console.error('[pg] submit:', e.message); } }
    await fileStore.submit(r);
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
  if (req.method === 'GET') return sendJSON(res, 200, await store.top());
  if (req.method === 'POST') {
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > 2048) return sendJSON(res, 413, { error: 'cuerpo demasiado grande' }); chunks.push(c); }
    let body = null;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { /* inválido */ }
    const rec = validate(body);
    if (!rec) return sendJSON(res, 400, { error: 'registro inválido' });
    await store.submit(rec);
    return sendJSON(res, 201, { ok: true });
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
