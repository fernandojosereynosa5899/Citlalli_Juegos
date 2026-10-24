/**
 * Motor del arcade: bucle principal (requestAnimationFrame + delta-time), lienzo High-DPI
 * adaptativo, entrada unificada (teclado / puntero / táctil) y bloqueo total de scroll.
 *
 * Contrato que debe cumplir cada minijuego (A.games.<id> = class):
 *   constructor(engine)           → crea el estado
 *   enter()                       → se llama al seleccionar el juego (estado 'ready')
 *   restart()                     → reinicia y arranca de inmediato (tras Game Over)
 *   update(dt) / draw(ctx)        → un fotograma
 *   onKeyDown(e) / onPointerDown(p) / onPointerMove(p) / onPointerUp(p)
 *   onResize() / onSettingsChange(kind)
 *   state: 'ready' | 'playing' | 'over'
 */
(function (global) {
  'use strict';

  const A = (global.Arcade = global.Arcade || {});
  const U = A.util;
  const C = A.CONFIG;

  const BLOCKED_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar']);

  const E = (A.engine = {
    canvas: null,
    ctx: null,
    stage: null,
    W: 960,
    H: 540,
    time: 0,
    lastTime: 0,
    game: null,
    gameId: null,
    instances: {},
    modalOpen: false,
    ready: false,

    /* ------------------------------------------------------------ ciclo de vida */
    init() {
      this.stage = document.getElementById('stage');
      this.canvas = document.getElementById('game');
      this.resize();

      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.resize()).observe(this.stage);
      global.addEventListener('resize', () => this.resize());
      global.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));

      this.attachInput();
      this.lastTime = performance.now();
      global.requestAnimationFrame((t) => this.loop(t));
    },

    /** Escenario actual (imagen de fondo). */
    bg() { return A.img('bg_' + A.store.prefs.scenario); },
    difficulty() { return A.store.prefs.difficulty; },
    tuning(gameId) { return C.TUNING[gameId][this.difficulty()]; },

    start(id) {
      if (!A.games[id]) return;
      if (!this.instances[id]) this.instances[id] = new A.games[id](this);
      this.gameId = id;
      this.game = this.instances[id];
      this.game.enter();
    },

    leave() { this.game = null; this.gameId = null; },

    /** Fin de partida: guarda récord (RAM + localStorage + API) y bloquea el reinicio unos ms. */
    finish(game, score, extra) {
      const r = A.store.submitScore(game.id, score, extra);
      game.result = { score, isRecord: r.isRecord, best: r.best };
      game.state = 'over';
      game.overAt = performance.now();
      if (A.ui) A.ui.refreshBest();
      return game.result;
    },

    /** ¿Ya pasó el tiempo de seguridad tras Game Over? */
    canRestart(game) { return game.state === 'over' && performance.now() - game.overAt > C.OVER_LOCK_MS; },

    /* ------------------------------------------------------------ lienzo */
    resize() {
      if (!this.stage) return;
      const sw = this.stage.clientWidth, sh = this.stage.clientHeight;
      if (sw < 10 || sh < 10) return;
      const aspect = U.clamp(sw / sh, 0.5, 2.2);
      let cssW, cssH;
      if (sw / sh > aspect) { cssH = sh; cssW = Math.round(sh * aspect); } else { cssW = sw; cssH = Math.round(sw / aspect); }
      const m = C.DESIGN_MIN;
      const oldW = this.W, oldH = this.H;
      if (aspect >= 1) { this.H = m; this.W = Math.round(m * aspect); } else { this.W = m; this.H = Math.round(m / aspect); }
      this.ctx = U.setupHighDPICanvas(this.canvas, cssW, cssH, this.W, this.H);
      if (this.game && (oldW !== this.W || oldH !== this.H) && this.game.onResize) this.game.onResize();
      this.draw(); // evita parpadeo en blanco al redimensionar
    },

    /* ------------------------------------------------------------ bucle principal */
    loop(now) {
      global.requestAnimationFrame((t) => this.loop(t));
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.time += dt;
      if (!this.modalOpen && this.game) {
        try { this.game.update(dt); } catch (e) { console.error('[update]', e); }
      }
      this.draw();
    },

    draw() {
      const ctx = this.ctx;
      if (!ctx) return;
      try {
        if (this.game) {
          this.game.draw(ctx);
        } else {
          this.drawAmbient(ctx);
        }
      } catch (e) { console.error('[draw]', e); }
    },

    /** Fondo animado de la sala (detrás del lobby). */
    drawAmbient(ctx) {
      const W = this.W, H = this.H, t = this.time;
      U.background(ctx, this.bg(), W, H, -((t * 14) % 100000), 0.35);
      for (let i = 0; i < 26; i++) {
        const x = (i * 97.3 + Math.sin(t * 0.6 + i) * 18) % W;
        const y = (i * 61.7 + Math.cos(t * 0.5 + i * 2) * 14) % H;
        ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t * 1.4 + i));
        ctx.fillStyle = i % 3 ? '#FFD86B' : '#9fe8ff';
        ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
      }
      ctx.globalAlpha = 1;
    },

    /* ------------------------------------------------------------ entrada */
    toLogical(ev) {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: (ev.clientX - r.left) * (this.W / r.width),
        y: (ev.clientY - r.top) * (this.H / r.height),
        cx: ev.clientX, cy: ev.clientY, id: ev.pointerId, time: performance.now()
      };
    },

    attachInput() {
      const stage = this.stage, canvas = this.canvas;
      const interactive = (t) => t && t.closest && t.closest('#lobby, #dpad, button, a, input, select');

      /* --- Teclado: anti-scroll + atajos --- */
      global.addEventListener('keydown', (e) => {
        A.audio.unlock();
        const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
        if (this.modalOpen && typing) return; // permite escribir el nombre
        if (BLOCKED_KEYS.has(e.key) || e.code === 'Space') e.preventDefault(); // la página NUNCA se mueve
        if (e.repeat && (e.key === 'Enter' || e.key === ' ')) return;
        if (e.key === 'm' || e.key === 'M') { if (A.ui) A.ui.toggleMute(); return; }
        if (this.modalOpen || !this.game) return;
        if ((e.key === 'Enter' || e.key === ' ') && this.game.state === 'over') {
          if (this.canRestart(this.game)) this.game.restart();
          return;
        }
        if (this.game.onKeyDown) this.game.onKeyDown(e);
      }, { passive: false });
      global.addEventListener('keyup', (e) => { if (BLOCKED_KEYS.has(e.key) || e.code === 'Space') e.preventDefault(); }, { passive: false });

      /* --- Puntero (ratón + táctil unificados) --- */
      stage.addEventListener('pointerdown', (e) => {
        A.audio.unlock();
        if (this.modalOpen || !this.game || interactive(e.target)) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignorar */ }
        const p = this.toLogical(e);
        // Reinicio inmediato con un simple toque en CUALQUIER parte de la pantalla de juego.
        if (this.game.state === 'over') {
          if (this.canRestart(this.game)) this.game.restart();
          return;
        }
        if (this.game.onPointerDown) this.game.onPointerDown(p);
      }, { passive: false });
      stage.addEventListener('pointermove', (e) => {
        if (this.modalOpen || !this.game || !this.game.onPointerMove) return;
        this.game.onPointerMove(this.toLogical(e));
      }, { passive: true });
      const up = (e) => {
        if (this.modalOpen || !this.game || !this.game.onPointerUp) return;
        this.game.onPointerUp(this.toLogical(e));
      };
      stage.addEventListener('pointerup', up, { passive: true });
      stage.addEventListener('pointercancel', up, { passive: true });

      /* --- Anti-scroll táctil y de rueda dentro del área de juego --- */
      const inScrollable = (t) => t && t.closest && t.closest('.modal-card, #lobby:not([hidden])');
      const stop = (e) => { if (!this.modalOpen && !inScrollable(e.target) && e.cancelable) e.preventDefault(); };
      stage.addEventListener('touchmove', stop, { passive: false });
      stage.addEventListener('touchstart', (e) => { if (!interactive(e.target)) stop(e); }, { passive: false });
      stage.addEventListener('wheel', stop, { passive: false });
      stage.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('gesturestart', (e) => e.preventDefault()); // pinch-zoom iOS
      document.addEventListener('touchmove', (e) => {
        // Sólo se permite arrastrar dentro de los modales (lista de récords).
        if (!inScrollable(e.target) && e.cancelable) e.preventDefault();
      }, { passive: false });
    }
  });
})(window);
