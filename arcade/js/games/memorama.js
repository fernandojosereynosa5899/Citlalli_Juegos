/**
 * 🃏 Juego 3 — Memorama (Memoria Olfativa Atelier)
 * 10 pares de la firma con giro 3D, partículas al emparejar y contador de intentos
 * (menos intentos = mejor rango).
 */
(function (global) {
  'use strict';

  const A = (global.Arcade = global.Arcade || {});
  const U = A.util;

  const DECK = [
    { key: 'bottle_citlalli', name: 'Frasco Citlalli', tier: 'Joya' },
    { key: 'charm_qm', name: 'Dije QM', tier: 'Joya' },
    { key: 'jaguar_gold', name: 'Jaguar Dorado', tier: 'Cosmos' },
    { key: 'star_citlalli', name: 'Estrella Astral', tier: 'Cosmos' },
    { key: 'mandarin', name: 'Mandarina', tier: 'Salida' },
    { key: 'rose_pink', name: 'Rosa', tier: 'Corazón' },
    { key: 'jasmine_white', name: 'Jazmín', tier: 'Corazón' },
    { key: 'vanilla_pod', name: 'Vainilla', tier: 'Fondo' },
    { key: 'amber_crystal', name: 'Ámbar', tier: 'Fondo' },
    { key: 'clay_vessel', name: 'Vasija de Barro', tier: 'Fondo' }
  ];
  const TIER_COLOR = { Salida: '#e8892b', Corazón: '#d6457f', Fondo: '#9a6a32', Joya: '#2f8fc9', Cosmos: '#7a54c9' };
  const HUD_H = 52;
  const CARD_RATIO = 0.72; // ancho / alto

  function rank(att) {
    if (att <= 12) return '👑 Nariz de Oro';
    if (att <= 16) return '💎 Perfumista';
    if (att <= 22) return '🌸 Aprendiz';
    return '🍊 Novato';
  }

  class MemoramaGame {
    constructor(engine) {
      this.e = engine;
      this.id = 'memorama';
      this.state = 'ready';
      this.overAt = 0;
      this.result = null;
      this.t = 0;
      this.particles = new U.Particles();
      this.reset();
    }

    /* ------------------------------------------------------------- estado */
    reset() {
      this.cfg = this.e.tuning('memorama');
      const deck = [];
      DECK.forEach((d) => { deck.push(d, d); });
      for (let i = deck.length - 1; i > 0; i--) { const j = U.randInt(0, i); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      this.cards = deck.map((d, i) => ({ i, def: d, flip: 0, target: 0, matched: false, glow: 0, x: 0, y: 0 }));
      this.open = [];
      this.check = null;
      this.attempts = 0;
      this.pairs = 0;
      this.time = 0;
      this.peek = 0;
      this.winTimer = 0;
      this.timing = false;
      this.result = null;
      this.state = 'ready';
      this.particles.clear();
      this.layout();
    }

    enter() { this.reset(); A.audio.playMusic(A.store.prefs.scenario); }
    restart() { this.reset(); A.audio.unlock(); A.audio.playMusic(A.store.prefs.scenario); this.begin(); }
    onSettingsChange(kind) { if (kind === 'difficulty') this.reset(); }
    onResize() { this.layout(); }

    begin() {
      this.state = 'playing';
      if (this.cfg.peek > 0) {
        this.peek = this.cfg.peek;
        this.cards.forEach((c) => { c.target = 1; });
        A.audio.play('flip');
      } else {
        this.timing = true;
      }
    }

    layout() {
      const { W, H } = this.e;
      const gap = 10, mx = 12, top = HUD_H + 10, bottom = 12;
      const aw = W - mx * 2, ah = H - top - bottom;
      let best = null;
      [[5, 4], [4, 5], [10, 2], [2, 10]].forEach(([cols, rows]) => {
        const cw = Math.min((aw - gap * (cols - 1)) / cols, ((ah - gap * (rows - 1)) / rows) * CARD_RATIO);
        if (!best || cw > best.cw) best = { cols, rows, cw };
      });
      this.cw = Math.floor(best.cw);
      this.ch = Math.floor(best.cw / CARD_RATIO);
      this.gap = gap;
      const totalW = best.cols * this.cw + (best.cols - 1) * gap, totalH = best.rows * this.ch + (best.rows - 1) * gap;
      const ox = (W - totalW) / 2, oy = top + (ah - totalH) / 2;
      this.cards.forEach((c, i) => {
        c.x = ox + (i % best.cols) * (this.cw + gap) + this.cw / 2;
        c.y = oy + Math.floor(i / best.cols) * (this.ch + gap) + this.ch / 2;
      });
    }

    /* ------------------------------------------------------------- entrada */
    onKeyDown(e) { if (this.state === 'ready' && (e.key === 'Enter' || e.key === ' ')) this.begin(); }

    onPointerDown(p) {
      if (this.state === 'ready') { this.begin(); return; }
      if (this.state !== 'playing') return;
      if (this.peek > 0) { this.endPeek(); return; } // un toque acorta la vista previa
      const card = this.cards.find((c) => !c.matched && c.target === 0 &&
        Math.abs(p.x - c.x) <= this.cw / 2 && Math.abs(p.y - c.y) <= this.ch / 2);
      if (!card) return;
      if (this.check) this.resolve(); // ergonomía: no hace falta esperar a que se voltee el fallo
      this.flip(card);
    }

    endPeek() {
      this.peek = 0;
      this.cards.forEach((c) => { if (!c.matched) c.target = 0; });
      this.timing = true;
      A.audio.play('flip');
    }

    flip(card) {
      card.target = 1;
      this.open.push(card);
      A.audio.play('flip');
      if (this.open.length === 2) {
        this.attempts++;
        const [a, b] = this.open;
        this.check = { a, b, ok: a.def.key === b.def.key, t: a.def.key === b.def.key ? 0.45 : this.cfg.flipBack };
      }
    }

    resolve() {
      const ch = this.check;
      if (!ch) return;
      this.check = null;
      this.open = [];
      if (ch.ok) {
        [ch.a, ch.b].forEach((c) => {
          c.matched = true;
          c.glow = 1;
          this.particles.emit(c.x, c.y, { count: 18, speed: 210, life: 0.8, size: 6, colors: ['#FFD86B', '#fff1b8', '#7CFFB2', '#ffffff'] });
        });
        this.pairs++;
        A.audio.play('match');
        this.particles.text((ch.a.x + ch.b.x) / 2, (ch.a.y + ch.b.y) / 2, '¡PAR!', '#7CFFB2', 22);
        if (this.pairs === DECK.length) this.winTimer = 0.9;
      } else {
        ch.a.target = 0; ch.b.target = 0;
        A.audio.play('mismatch');
      }
    }

    /* ------------------------------------------------------------- lógica */
    update(dt) {
      this.t += dt;
      this.particles.update(dt);
      this.cards.forEach((c) => {
        const d = c.target - c.flip;
        c.flip += Math.sign(d) * Math.min(Math.abs(d), dt * 4.2);
        if (c.glow > 0 && c.matched) c.glow = Math.max(0.35, c.glow - dt * 0.8);
      });

      if (this.state === 'over') {
        if (Math.random() < dt * 30) { // lluvia de confeti dorado
          this.particles.emit(U.rand(0, this.e.W), -10, { count: 1, angle: Math.PI / 2, spread: 0.4, speed: 160, speedMin: 90, life: 2.4, size: 7, gravity: 120, colors: ['#FFD86B', '#fff1b8', '#E0A98B', '#7CFFB2', '#6ad0ff'] });
        }
        return;
      }
      if (this.state !== 'playing') return;

      if (this.peek > 0) {
        this.peek -= dt;
        if (this.peek <= 0) this.endPeek();
        return;
      }
      if (this.timing) this.time += dt;
      if (this.check) {
        this.check.t -= dt;
        if (this.check.t <= 0) this.resolve();
      }
      if (this.winTimer > 0) {
        this.winTimer -= dt;
        if (this.winTimer <= 0) {
          this.timing = false;
          A.audio.play('win');
          this.e.finish(this, this.attempts, {});
          for (let k = 0; k < 4; k++) this.particles.emit(this.e.W / 2, this.e.H / 2, { count: 30, speed: 420, life: 1.3, size: 7, gravity: 260, colors: ['#FFD86B', '#fff1b8', '#E0A98B', '#7CFFB2'] });
        }
      }
    }

    /* ------------------------------------------------------------- dibujo */
    draw(ctx) {
      const { W, H } = this.e;
      U.background(ctx, this.e.bg(), W, H, 0, 0.55);
      this.cards.forEach((c) => this.drawCard(ctx, c));
      this.particles.draw(ctx);
      this.drawHUD(ctx);

      if (this.state === 'ready') {
        const m = Math.min(W, H);
        ctx.fillStyle = 'rgba(3,5,12,0.72)';
        ctx.fillRect(0, H / 2 - m * 0.2, W, m * 0.4);
        U.text(ctx, '🃏 MEMORAMA ATELIER', W / 2, H / 2 - m * 0.05, { size: Math.round(m * 0.07), align: 'center', color: '#FFD86B' });
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 5);
        U.text(ctx, 'Encuentra los 10 pares · menos intentos = mejor rango', W / 2, H / 2 + m * 0.03, { size: Math.round(m * 0.026), align: 'center' });
        U.text(ctx, '👉 Toca para comenzar', W / 2, H / 2 + m * 0.11, { size: Math.round(m * 0.04), align: 'center', color: '#ffffff' });
        ctx.globalAlpha = 1;
      }
      if (this.peek > 0) {
        U.text(ctx, `¡Memoriza! ${Math.ceil(this.peek)}`, W / 2, HUD_H + 4, { size: 18, align: 'center', color: '#7CFFB2', baseline: 'top' });
      }
      if (this.state === 'over' && this.result) this.drawVictory(ctx);
    }

    /** Anverso/reverso con giro 3D (escala X = |cos|) y pequeña elevación. */
    drawCard(ctx, c) {
      const ang = c.flip * Math.PI;
      const sx = Math.abs(Math.cos(ang));
      const lift = Math.sin(ang);
      if (sx < 0.015) return;
      const sc = 1 + 0.08 * lift;
      const w = this.cw, h = this.ch;
      ctx.save();
      ctx.translate(c.x, c.y - lift * 8);
      ctx.scale(sx * sc, sc);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; // sombra
      U.rrect(ctx, -w / 2 + 3, -h / 2 + 5, w, h, 8); ctx.fill();
      if (c.flip < 0.5) this.drawBack(ctx, w, h); else this.drawFront(ctx, c, w, h);
      if (c.matched && c.glow > 0) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(124,255,178,${0.5 + 0.4 * Math.sin(this.t * 4 + c.i)})`;
        U.rrect(ctx, -w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 10); ctx.stroke();
      }
      ctx.restore();
    }

    /** Estuche de terciopelo azul marino con doble ribete de oro, nubes sagradas y estrella de 8 puntas. */
    drawBack(ctx, w, h) {
      const x = -w / 2, y = -h / 2;
      ctx.fillStyle = '#0D1736';
      U.rrect(ctx, x, y, w, h, 8); ctx.fill();
      const vg = ctx.createRadialGradient(0, 0, 4, 0, 0, h * 0.7);
      vg.addColorStop(0, 'rgba(60,80,170,0.35)'); vg.addColorStop(1, 'rgba(0,0,10,0.45)');
      ctx.fillStyle = vg; U.rrect(ctx, x, y, w, h, 8); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#E8B84A'; U.rrect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 7); ctx.stroke(); // ribete exterior
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#C9972F'; U.rrect(ctx, x + 6, y + 6, w - 12, h - 12, 4); ctx.stroke(); // ribete interior

      // nubes sagradas en las esquinas (espirales náhuatl simplificadas)
      const r = w * 0.055;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        ctx.save();
        ctx.translate(sx * (w / 2 - w * 0.17), sy * (h / 2 - w * 0.15));
        ctx.scale(sx, sy);
        ctx.strokeStyle = '#E8B84A'; ctx.lineWidth = Math.max(1, w * 0.016);
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 0.2, Math.PI * 1.7); ctx.stroke();
        ctx.beginPath(); ctx.arc(r * 1.7, r * 0.3, r * 0.75, Math.PI * 0.9, Math.PI * 2.2); ctx.stroke();
        ctx.fillStyle = '#E8B84A';
        ctx.fillRect(-r * 0.5, r * 1.4, r * 3, Math.max(1, w * 0.014));
        ctx.restore();
      });

      // estrella central de 8 puntas
      const R = w * 0.3;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const rad = i % 2 ? R * 0.42 : R, a = (Math.PI / 8) * i - Math.PI / 2;
        i ? ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad - h * 0.04) : ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad - h * 0.04);
      }
      ctx.closePath();
      const sg = ctx.createLinearGradient(-R, -R, R, R);
      sg.addColorStop(0, '#fff1b8'); sg.addColorStop(0.5, '#E8B84A'); sg.addColorStop(1, '#a8741c');
      ctx.fillStyle = sg; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = '#5a3d0c'; ctx.stroke();
      ctx.fillStyle = '#0D1736'; ctx.beginPath(); ctx.arc(0, -h * 0.04, R * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#E8B84A'; ctx.beginPath(); ctx.arc(0, -h * 0.04, R * 0.09, 0, Math.PI * 2); ctx.fill();

      // leyenda
      const fs = Math.max(6, w * 0.082);
      U.text(ctx, '✦ CITLALLI ✦', 0, h * 0.3, { size: fs, align: 'center', color: '#E8B84A', stroke: false, baseline: 'middle' });
      U.text(ctx, 'ATELIER', 0, h * 0.3 + fs * 1.25, { size: fs, align: 'center', color: '#C9972F', stroke: false, baseline: 'middle' });
    }

    drawFront(ctx, c, w, h) {
      const x = -w / 2, y = -h / 2;
      // al estar volteada la carta (escala continua), el anverso se dibuja sin espejo
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#FFF8E4'); g.addColorStop(1, '#F1DDAA');
      ctx.fillStyle = g; U.rrect(ctx, x, y, w, h, 8); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#E8B84A'; U.rrect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 7); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = '#C9972F'; U.rrect(ctx, x + 5, y + 5, w - 10, h - 10, 4); ctx.stroke();

      const s = w * 0.7;
      U.sprite(ctx, A.img(c.def.key), 0, y + h * 0.36, s);
      const nameSize = Math.max(8, Math.min(w * 0.125, 16));
      U.text(ctx, c.def.name, 0, y + h * 0.69, { size: nameSize, align: 'center', color: '#1b1a3a', stroke: false, baseline: 'middle' });
      // categoría piramidal
      const bh = h * 0.13;
      ctx.fillStyle = TIER_COLOR[c.def.tier];
      U.rrect(ctx, x + 9, y + h - bh - 9, w - 18, bh, 4); ctx.fill();
      U.text(ctx, c.def.tier.toUpperCase(), 0, y + h - bh / 2 - 9, { size: Math.max(7, Math.min(w * 0.095, 13)), align: 'center', color: '#fff', stroke: false, baseline: 'middle' });
    }

    drawHUD(ctx) {
      const { W } = this.e;
      ctx.fillStyle = 'rgba(6,11,26,0.88)';
      ctx.fillRect(0, 0, W, HUD_H);
      ctx.fillStyle = '#E8B84A';
      ctx.fillRect(0, HUD_H - 2, W, 2);
      const fs = W < 700 ? 15 : 19;
      U.text(ctx, 'INTENTOS ' + this.attempts, 12, 22, { size: fs, color: '#FFE9A8' });
      U.text(ctx, `PARES ${this.pairs}/${DECK.length}`, W / 2, 22, { size: fs, align: 'center', color: '#7CFFB2' });
      const mm = Math.floor(this.time / 60), ss = Math.floor(this.time % 60);
      U.text(ctx, `⏱ ${mm}:${String(ss).padStart(2, '0')}`, W - 12, 22, { size: fs, align: 'right', color: '#FFE9A8' });
      const best = A.store.bestFor('memorama');
      U.text(ctx, 'MEJOR ' + (best === null ? '-' : best) + ' intentos', 12, 44, { size: 12, color: '#C8B27A', stroke: false });
    }

    /** Victoria: banner dorado interactivo que reinicia con un toque. */
    drawVictory(ctx) {
      const { W, H } = this.e;
      const m = Math.min(W, H), r = this.result;
      ctx.fillStyle = 'rgba(3,5,12,0.7)';
      ctx.fillRect(0, 0, W, H);
      const ts = Math.min(m * 0.2, 120);
      U.imageSmooth(ctx, A.img('trophy'), W / 2 - ts / 2, H * 0.1 + Math.sin(this.t * 3) * 4, ts, ts);
      let y = H * 0.1 + ts + m * 0.07;
      U.text(ctx, '¡MEMORAMA COMPLETO!', W / 2, y, { size: Math.round(m * 0.065), align: 'center', color: '#FFD86B' });
      y += m * 0.075;
      const mm = Math.floor(this.time / 60), ss = Math.floor(this.time % 60);
      [`Intentos: ${r.score}   ·   Tiempo: ${mm}:${String(ss).padStart(2, '0')}`, `Rango: ${rank(r.score)}`].forEach((ln) => {
        U.text(ctx, ln, W / 2, y, { size: Math.round(m * 0.04), align: 'center', color: '#FFF3D0' });
        y += m * 0.058;
      });
      if (r.isRecord) { U.text(ctx, '★ ¡NUEVO RÉCORD! ★', W / 2, y, { size: Math.round(m * 0.046), align: 'center', color: '#7CFFB2' }); y += m * 0.06; }

      // banner dorado
      const bw = Math.min(W - 24, m * 1.15), bh = m * 0.15, bx = (W - bw) / 2, by = Math.min(H - bh - 18, y + m * 0.03);
      const pulse = 1 + 0.025 * Math.sin(this.t * 5);
      ctx.save();
      ctx.translate(W / 2, by + bh / 2);
      ctx.scale(pulse, pulse);
      const bg = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
      bg.addColorStop(0, '#fff1b8'); bg.addColorStop(0.5, '#E8B84A'); bg.addColorStop(1, '#b57c1e');
      ctx.fillStyle = bg; U.rrect(ctx, -bw / 2, -bh / 2, bw, bh, 14); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#5a3d0c'; ctx.stroke();
      const label = '👉 TOCAR AQUÍ PARA JUGAR DE NUEVO ↻';
      let fs = Math.round(m * 0.05);
      ctx.font = U.font(fs);
      while (ctx.measureText(label).width > bw - 24 && fs > 8) { fs--; ctx.font = U.font(fs); }
      U.text(ctx, label, 0, 0, { size: fs, align: 'center', baseline: 'middle', color: '#2a1700', stroke: false });
      ctx.restore();
    }
  }

  A.games.memorama = MemoramaGame;
})(window);
