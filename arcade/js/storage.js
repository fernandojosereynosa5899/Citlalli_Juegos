/**
 * Persistencia resiliente ("para que no se muera todo").
 *
 * Capas, de la más a la menos fiable:
 *   1. RAM (`mem`)              → siempre disponible durante la sesión.
 *   2. localStorage (respaldo)  → si está bloqueado/lleno, se ignora sin romper nada.
 *   3. API REST /api/records    → PostgreSQL. TODA llamada va en try/catch con timeout
 *                                 de 3.5 s; si falla, las partidas quedan en cola y se
 *                                 reenvían cuando el servidor vuelva.
 *
 * Ninguna función pública de este módulo lanza excepciones ni bloquea el bucle de juego.
 */
(function (global) {
  'use strict';

  const A = (global.Arcade = global.Arcade || {});
  const C = A.CONFIG;
  const LS_KEY = 'citlalli.arcade.v1';
  const GAME_IDS = ['snake', 'flappy', 'memorama', 'reflejos'];
  const MAX_LOCAL = 60;
  const MAX_PENDING = 120;

  /** Estado volátil en RAM. */
  const mem = {
    player: null, // { name, avatar }  → bloqueado una vez creado
    prefs: { difficulty: 'medio', scenario: 'hidalgo', muted: false },
    records: { snake: [], flappy: [], memorama: [], reflejos: [] },
    pending: [] // registros aún no confirmados por la API
  };
  const remoteCache = {}; // último top recibido de la API por juego
  const net = { enabled: global.location.protocol !== 'file:', online: null, retryAt: 0, flushing: false };
  const listeners = [];
  const purgeListeners = [];

  /* ---------- localStorage seguro ---------- */
  const ls = {
    get(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { global.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };

  function persist() { ls.set(LS_KEY, JSON.stringify(mem)); }

  /** Normaliza un nombre: MAYÚSCULAS alfanuméricas, sin acentos, máx. 8. */
  function sanitizeName(raw) {
    return String(raw || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]/g, '')
      .slice(0, C.NAME_MAX);
  }

  function isLowerBetter(game) { return game === 'memorama'; }

  function compare(game) {
    return isLowerBetter(game) ? (a, b) => a.valor - b.valor : (a, b) => b.valor - a.valor;
  }

  function restore() {
    try {
      const raw = ls.get(LS_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (o.player && sanitizeName(o.player.name)) {
        const av = C.AVATARS.some((a) => a.id === o.player.avatar) ? o.player.avatar : 'bottle';
        mem.player = { name: sanitizeName(o.player.name), avatar: av };
      }
      if (o.prefs) {
        if (C.DIFFICULTIES.some((d) => d.id === o.prefs.difficulty)) mem.prefs.difficulty = o.prefs.difficulty;
        if (C.SCENARIOS[o.prefs.scenario]) mem.prefs.scenario = o.prefs.scenario;
        mem.prefs.muted = !!o.prefs.muted;
      }
      GAME_IDS.forEach((g) => {
        if (o.records && Array.isArray(o.records[g])) {
          mem.records[g] = o.records[g].filter((r) => r && Number.isFinite(r.valor)).slice(0, MAX_LOCAL);
        }
      });
      if (Array.isArray(o.pending)) mem.pending = o.pending.filter((r) => r && r.game && Number.isFinite(r.score)).slice(0, MAX_PENDING);
    } catch (e) { /* datos corruptos: se ignoran y se parte de cero */ }
  }

  /** Notifica y purga el usuario local si la BD fue borrada o el usuario eliminado */
  function handleUserPurged(reason, info) {
    const oldName = mem.player ? mem.player.name : '';
    if (!oldName && !mem.player) return;
    mem.player = null;
    GAME_IDS.forEach((g) => { mem.records[g] = []; delete remoteCache[g]; });
    mem.pending = [];
    persist();
    purgeListeners.forEach((cb) => {
      try { cb({ reason: reason || 'deleted', username: oldName, info }); } catch (e) { /* ignorar */ }
    });
  }

  function setOnline(v) {
    if (net.online !== v) {
      net.online = v;
      listeners.forEach((cb) => { try { cb(v); } catch (e) { /* ignorar */ } });
    }
  }

  /**
   * fetch con timeout duro de 3.5 s. Devuelve { ok, status, data } o null si hubo fallo de red/timeout.
   * Un error 4xx (registro inválido) NO cuenta como servidor caído.
   */
  async function api(method, body, query) {
    if (!net.enabled || Date.now() < net.retryAt) return null;
    let timer;
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeout = new Promise((_, rej) => { timer = setTimeout(() => { if (ctrl) ctrl.abort(); rej(new Error('timeout')); }, C.API_TIMEOUT_MS); });
      const fullUrl = C.API_URL + (query ? (C.API_URL.includes('?') ? '&' : '?') + query : '');
      const req = fetch(fullUrl, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl ? ctrl.signal : undefined,
        cache: 'no-store'
      }).then(async (res) => {
        let data = null;
        try { data = await res.json(); } catch (e) { /* cuerpo vacío */ }
        return { ok: res.ok, status: res.status, data };
      });
      const out = await Promise.race([req, timeout]);
      if (out.status >= 500) throw new Error('server ' + out.status);
      setOnline(true);
      return out;
    } catch (e) {
      net.retryAt = Date.now() + C.API_RETRY_COOLDOWN_MS;
      setOnline(false);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Reenvía en orden las partidas pendientes. Se detiene en el primer fallo de red. */
  async function flush() {
    if (net.flushing || !mem.pending.length) return;
    net.flushing = true;
    try {
      while (mem.pending.length) {
        const r = mem.pending[0];
        const res = await api('POST', {
          username: r.username, avatar: r.avatar, game: r.game, score: r.score,
          bestMs: r.bestMs, difficulty: r.difficulty, scenario: r.scenario
        });
        if (!res) break; // servidor caído: reintentar luego
        if (res.data && res.data.userExists === false) {
          // La base de datos fue reseteada o el usuario fue borrado/sancionado
          mem.pending = [];
          persist();
          handleUserPurged(res.data.isBanned ? 'banned' : 'deleted', res.data);
          break;
        }
        mem.pending.shift(); // aceptado (2xx) o rechazado definitivamente (4xx)
        persist();
      }
    } catch (e) { /* ignorar */ } finally { net.flushing = false; }
  }

  function bestPerUser(game, rows) {
    const map = new Map();
    rows.forEach((r) => {
      const prev = map.get(r.username);
      if (!prev || compare(game)(r, prev) < 0) map.set(r.username, r);
    });
    return Array.from(map.values()).sort(compare(game));
  }

  A.store = {
    sanitizeName,
    isLowerBetter,
    get prefs() { return mem.prefs; },
    get player() { return mem.player; },
    get online() { return net.online; },
    get apiEnabled() { return net.enabled; },
    get pendingCount() { return mem.pending.length; },

    init() {
      restore();
      persist();
      flush();
    },

    onStatus(cb) { listeners.push(cb); },
    onUserPurged(cb) { purgeListeners.push(cb); },

    setPref(key, value) { mem.prefs[key] = value; persist(); },

    /** Registra al jugador UNA sola vez. Si ya existe, el nombre queda bloqueado. */
    registerPlayer(rawName, avatar) {
      if (mem.player) return mem.player;
      const name = sanitizeName(rawName);
      if (!name) return null;
      const av = C.AVATARS.some((a) => a.id === avatar) ? avatar : 'bottle';
      mem.player = { name, avatar: av };
      persist();
      // Notificar al servidor inmediatamente para registrar en citlalli_players
      api('POST', { action: 'register', username: name, avatar: av }).catch(() => {});
      return mem.player;
    },

    /** Verifica con el servidor si la cuenta o la base de datos fue purgada */
    async verifyPlayerWithServer() {
      if (!mem.player) return;
      try {
        const res = await api('GET', null, 'user=' + encodeURIComponent(mem.player.name));
        if (res && res.data && res.data.userCheck) {
          const uc = res.data.userCheck;
          if (uc.checked && uc.dbConnected && uc.exists === false) {
            handleUserPurged(uc.isBanned ? 'banned' : 'deleted', uc);
          }
        }
      } catch (e) { /* ignorar */ }
    },

    /** Purga voluntaria o reseteo local */
    resetLocalUser() {
      handleUserPurged('manual');
    },

    /** Mejor marca local del jugador actual en un juego (o null). */
    bestFor(game) {
      if (!mem.player) return null;
      const mine = mem.records[game].filter((r) => r.username === mem.player.name);
      if (!mine.length) return null;
      return mine.sort(compare(game))[0].valor;
    },

    /** Guarda la partida en RAM + localStorage y la encola para la API. Devuelve { isRecord, best }. */
    submitScore(game, score, extra) {
      extra = extra || {};
      const p = mem.player;
      if (!p || !GAME_IDS.includes(game) || !Number.isFinite(score)) return { isRecord: false, best: null };
      score = Math.max(0, Math.round(score));
      const prevBest = this.bestFor(game);
      const isRecord = prevBest === null ? score > 0 : (isLowerBetter(game) ? score < prevBest : score > prevBest);

      const bestMs = Number.isFinite(extra.bestMs) ? Math.round(extra.bestMs) : null;
      const fecha = new Date().toISOString().slice(0, 10);
      const difficulty = mem.prefs.difficulty, scenario = mem.prefs.scenario;

      mem.records[game].push({ username: p.name, valor: score, avatar: p.avatar, scenarioId: scenario, difficulty, fecha });
      mem.records[game] = bestPerUser(game, mem.records[game]).slice(0, MAX_LOCAL);
      // bestPerUser sólo conserva 1 por usuario: suficiente para el Top 10 local.

      if (score > 0 || game === 'memorama') {
        mem.pending.push({ username: p.name, avatar: p.avatar, game, score, bestMs, difficulty, scenario });
        if (mem.pending.length > MAX_PENDING) mem.pending.shift();
      }
      persist();
      flush(); // asíncrono: nunca bloquea el juego
      return { isRecord, best: isRecord ? score : prevBest };
    },

    /** Top 10 de un juego: mezcla API (si responde) y registros locales. Nunca rechaza. */
    async fetchTop(game) {
      let source = 'local';
      try {
        const q = mem.player ? ('user=' + encodeURIComponent(mem.player.name)) : '';
        const res = await api('GET', null, q);
        if (res && res.data && res.data.userCheck) {
          const uc = res.data.userCheck;
          if (uc.checked && uc.dbConnected && uc.exists === false) {
            handleUserPurged(uc.isBanned ? 'banned' : 'deleted', uc);
          }
        }
        if (res && res.ok && res.data && Array.isArray(res.data[game])) {
          remoteCache[game] = res.data[game].map((r) => ({
            username: String(r.username), valor: Number(r.valor), avatar: r.avatar || 'bottle',
            scenarioId: r.scenarioId, difficulty: r.difficulty, fecha: r.fecha
          })).filter((r) => Number.isFinite(r.valor));
        }
      } catch (e) { /* ignorar */ }
      if (remoteCache[game]) source = net.online ? 'online' : 'cache';
      const rows = bestPerUser(game, (remoteCache[game] || []).concat(mem.records[game]));
      return { rows: rows.slice(0, 10), source };
    }
  };
})(window);
