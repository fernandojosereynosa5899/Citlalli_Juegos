/**
 * ✨ Juego 2 — Flappy Citlalli
 * Frasco alado modelado en Canvas vuela entre columnas de mármol negro coronadas por
 * cabezas de Jaguar Dorado. Los medallones QM otorgan un escudo esmeralda contra 1 impacto.
 */
(function (global) {
  'use strict';

  const A = (global.Arcade = global.Arcade || {});
  const U = A.util;

  const COL_W = 76;      // ancho del fuste
  const CAP_W = 100;     // ancho del capitel
  const CAP_H = 62;      // alto del capitel
  const GRAVITY = 1550;
  const JUMP = 470;
  const MAX_FALL = 720;
  const BIRD_R = 14;     // radio de colisión (más pequeño que el dibujo: juego justo)
  const GROUND_H = 44;

  class FlappyGame {
    constructor(engine) {
      this.e = engine;
      this.id = 'flappy';
      this.state = 'ready';
      this.overAt = 0;
      this.result = null;
      this.t = 0;
      this.particles = new U.Particles();
      this.reset();
    }

    /* ------------------------------------------------------------- estado */
    reset() {
      const { W, H } = this.e;
      this.cfg = this.e.tuning('flappy');
      this.groundY = H - GROUND_H;
      this.bird = { x: Math.max(120, W * 0.26), y: H * 0.45, vy: 0, angle: 0, squash: 0, wing: 0 };
      this.cols = [];
      this.charms = [];
      this.score = 0;
      this.shield = false;
      this.invuln = 0;
      this.nextColX = W + 140;
      this.lastGapY = H * 0.45;
      this.charmCountdown = U.randInt(2, 4);
      this.bgOff = 0;
      this.groundOff = 0;
      this.shake = 0;
      this.result = null;
      this.state = 'ready';
      this.particles.clear();
    }

    enter() { this.reset(); A.audio.playMusic(A.store.prefs.scenario); }
    onResize() { this.reset(); }
    onSettingsChange(kind) { if (kind === 'difficulty') this.reset(); }
    restart() { this.reset(); this.state = 'playing'; A.audio.unlock(); A.audio.playMusic(A.store.prefs.scenario); this.flap(); }

    /* ------------------------------------------------------------- entrada */
    onKeyDown(e) {
      if (e.key === ' ' || e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'Enter') this.flap();
    }
    onPointerDown() { this.flap(); }

    /** Salto suave: impulso, compresión del atomizador y bocanada de perfume. */
    flap() {
      if (this.state === 'over') return;
      if (this.state === 'ready') this.state = 'playing';
      const b = this.bird;
      b.vy = -JUMP;
      b.squash = 1;
      A.audio.play('jump');
      this.particles.emit(b.x - 10, b.y + 14, {
        count: 6, angle: Math.PI * 0.75, spread: 0.7, speed: 120, speedMin: 30, life: 0.6, size: 9, grow: 14,
        colors: ['rgba(255,214,150,0.8)', 'rgba(255,240,210,0.8)', 'rgba(255,190,120,0.7)'], round: true
      });
    }

    /* ------------------------------------------------------------- generación */
    spawnColumn(x) {
      const { H } = this.e;
      const gap = this.cfg.gap;
      const minY = CAP_H + 40 + gap / 2, maxY = this.groundY - CAP_H - 40 - gap / 2;
      const gapY = U.clamp(this.lastGapY + U.rand(-230, 230), minY, Math.max(minY, maxY));
      this.lastGapY = gapY;
      const rnd = U.seeded((Math.random() * 1e9) | 0);
      const veins = [];
      for (let v = 0; v < 7; v++) {
        const pts = [];
        let vx = rnd() * COL_W;
        for (let y = -20; y <= H + 20; y += H / 7) { vx = U.clamp(vx + (rnd() - 0.5) * 34, 2, COL_W - 2); pts.push([vx, y]); }
        veins.push({ pts, gold: rnd() > 0.6, w: 0.6 + rnd() * 1.2 });
      }
      this.cols.push({ x, gapY, gap, passed: false, veins, eyePhase: rnd() * 6 });

      if (--this.charmCountdown <= 0 && !this.shield && this.charms.length === 0) {
        this.charms.push({ x: x + this.cfg.spacing / 2 + COL_W / 2, y: U.rand(130, this.groundY - 130), ph: rnd() * 6 });
        this.charmCountdown = U.randInt(3, 5);
      } else if (this.charmCountdown <= 0) {
        this.charmCountdown = 2;
      }
    }

    /* ------------------------------------------------------------- lógica */
    update(dt) {
      this.t += dt;
      const b = this.bird;
      this.particles.update(dt);
      if (this.shake > 0) this.shake -= dt;
      b.squash = Math.max(0, b.squash - dt * 5);
      b.wing += dt * (this.state === 'playing' ? 24 : 11);

      if (this.state === 'ready') {
        b.y = this.e.H * 0.45 + Math.sin(this.t * 3) * 10;
        b.angle = Math.sin(this.t * 3) * 0.1;
        this.groundOff -= 60 * dt;
        return;
      }
      if (this.state === 'over') { // caída tras el impacto
        if (b.y + BIRD_R < this.groundY) {
          b.vy = Math.min(b.vy + GRAVITY * dt, MAX_FALL);
          b.y = Math.min(b.y + b.vy * dt, this.groundY - BIRD_R);
          b.angle += (Math.PI / 2 - b.angle) * Math.min(1, dt * 8);
        }
        return;
      }

      // --- física del frasco ---
      b.vy = Math.min(b.vy + GRAVITY * dt, MAX_FALL);
      b.y += b.vy * dt;
      if (b.y < BIRD_R) { b.y = BIRD_R; if (b.vy < 0) b.vy = 0; }
      const k = U.clamp((b.vy + 260) / 760, 0, 1); // inclinación dinámica -18° … +45°
      const target = U.lerp(-18, 45, k) * Math.PI / 180;
      b.angle += (target - b.angle) * Math.min(1, dt * 14);

      // --- desplazamiento del mundo ---
      const dx = this.cfg.speed * dt;
      this.bgOff -= dx * 0.18;
      this.groundOff -= dx;
      this.nextColX -= dx;
      this.cols.forEach((c) => { c.x -= dx; });
      this.charms.forEach((c) => { c.x -= dx; });
      while (this.nextColX < this.e.W + 220) { this.spawnColumn(this.nextColX); this.nextColX += this.cfg.spacing; }

      // --- estela de perfume ---
      if (Math.random() < dt * 55) {
        this.particles.emit(b.x - 14, b.y + 6, {
          count: 1, angle: Math.PI, spread: 0.4, speed: 60, speedMin: 20, life: 0.8, size: 6, grow: 10,
          colors: ['rgba(255,225,170,0.7)', 'rgba(255,200,140,0.6)', 'rgba(255,255,255,0.5)'], round: true
        });
      }

      if (this.invuln > 0) this.invuln -= dt;

      // --- columnas: puntuación y colisión ---
      for (let i = this.cols.length - 1; i >= 0; i--) {
        const c = this.cols[i];
        if (!c.passed && c.x + COL_W < b.x - BIRD_R) {
          c.passed = true;
          const pts = this.cfg.ptsPerCol || 1;
          this.score += pts;
          A.audio.play('point');
          this.particles.text(b.x + 30, b.y - 30, '+' + pts, pts > 1 ? '#7CFFB2' : '#FFE9A8', pts > 1 ? 26 : 22);
        }
        if (c.x + CAP_W < -20) { this.cols.splice(i, 1); continue; }
        if (this.invuln <= 0 && this.hits(c)) {
          if (this.shield) {
            this.shield = false;
            this.invuln = 1.1;
            this.shake = 0.25;
            A.audio.play('hazard');
            this.particles.emit(b.x, b.y, { count: 26, speed: 230, life: 0.8, size: 6, colors: ['#1fbf7a', '#7CFFB2', '#d6fff0'], round: true });
            this.particles.text(b.x, b.y - 40, '¡ESCUDO ROTO!', '#7CFFB2', 20);
          } else {
            return this.die();
          }
        }
      }

      // --- medallones QM ---
      for (let i = this.charms.length - 1; i >= 0; i--) {
        const c = this.charms[i];
        if (c.x < -40) { this.charms.splice(i, 1); continue; }
        const cy = c.y + Math.sin(this.t * 3 + c.ph) * 8;
        if (Math.hypot(c.x - b.x, cy - b.y) < 34) {
          this.charms.splice(i, 1);
          this.shield = true;
          const bonus = this.cfg.charmBonus || 2;
          this.score += bonus;
          A.audio.play('power');
          this.particles.emit(c.x, cy, { count: 22, speed: 200, life: 0.8, size: 6, colors: ['#1fbf7a', '#FFD86B', '#fff1b8'], round: true });
          this.particles.text(c.x, cy - 30, `¡ESCUDO +${bonus}!`, '#7CFFB2', 22);
        }
      }

      if (b.y + BIRD_R >= this.groundY) { b.y = this.groundY - BIRD_R; this.die(); }
    }

    hits(c) {
      const b = this.bird;
      const gapTop = c.gapY - c.gap / 2, gapBot = c.gapY + c.gap / 2;
      const capX = c.x - (CAP_W - COL_W) / 2;
      return circleRect(b.x, b.y, BIRD_R, c.x, -200, COL_W, gapTop - CAP_H + 200) ||
        circleRect(b.x, b.y, BIRD_R, capX, gapTop - CAP_H, CAP_W, CAP_H) ||
        circleRect(b.x, b.y, BIRD_R, capX, gapBot, CAP_W, CAP_H) ||
        circleRect(b.x, b.y, BIRD_R, c.x, gapBot + CAP_H, COL_W, 2000);
    }

    die() {
      if (this.state !== 'playing') return;
      this.shake = 0.35;
      A.audio.play('collide');
      const b = this.bird;
      this.particles.emit(b.x, b.y, { count: 28, speed: 260, life: 0.9, size: 6, colors: ['#bfe9ff', '#ffb02e', '#E0A98B', '#ffffff'] });
      this.e.finish(this, this.score, {});
    }

    /* ------------------------------------------------------------- dibujo */
    draw(ctx) {
      const { W, H } = this.e;
      ctx.save();
      if (this.shake > 0) ctx.translate(U.rand(-5, 5), U.rand(-5, 5));
      U.background(ctx, this.e.bg(), W, H, this.bgOff, 0.3);

      this.cols.forEach((c) => this.drawColumn(ctx, c));
      this.charms.forEach((c) => this.drawCharm(ctx, c));
      this.particles.draw(ctx);
      this.drawBird(ctx);
      this.drawGround(ctx);
      ctx.restore();
      this.drawHUD(ctx);

      if (this.state === 'ready') {
        const m = Math.min(W, H);
        U.text(ctx, '✨ FLAPPY CITLALLI', W / 2, H * 0.24, { size: Math.round(m * 0.075), align: 'center', color: '#FFD86B' });
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 5);
        U.text(ctx, 'Toca · clic · ESPACIO para volar', W / 2, H * 0.68, { size: Math.round(m * 0.038), align: 'center' });
        U.text(ctx, 'Recoge el medallón QM = escudo', W / 2, H * 0.68 + m * 0.06, { size: Math.round(m * 0.03), align: 'center', color: '#7CFFB2' });
        ctx.globalAlpha = 1;
      }
      if (this.state === 'over' && this.result) {
        const r = this.result;
        U.gameOverPanel(ctx, W, H, {
          title: 'CHOQUE', titleColor: '#ff8a8a',
          lines: [`Columnas: ${r.score}`, r.best !== null ? `Tu mejor: ${r.best}` : ''].filter(Boolean),
          newRecord: r.isRecord
        }, this.t);
      }
    }

    drawGround(ctx) {
      const { W, H } = this.e, y = this.groundY;
      const g = ctx.createLinearGradient(0, y, 0, H);
      g.addColorStop(0, '#1a1208'); g.addColorStop(1, '#070504');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, W, H - y);
      ctx.fillStyle = '#E8B84A';
      ctx.fillRect(0, y, W, 4);
      const u = 6, period = u * 12;
      const off = ((this.groundOff % period) + period) % period;
      for (let x = -period + off; x < W; x += period) this.greca(ctx, x, y + 12, period, 18, u);
    }

    /** Greca escalonada dorada (patrón triangular de escalones). */
    greca(ctx, x, y, w, h, u) {
      ctx.fillStyle = '#C9972F';
      const n = Math.floor(w / u);
      for (let i = 0; i < n; i++) {
        const p = i % 6, s = p < 3 ? p + 1 : 6 - p;
        const hh = Math.min(h, s * (h / 3));
        ctx.fillRect(x + i * u, y + h - hh, u, hh);
      }
      ctx.fillStyle = '#7a5a18';
      ctx.fillRect(x, y + h, w, 2);
    }

    drawColumn(ctx, c) {
      const gapTop = c.gapY - c.gap / 2, gapBot = c.gapY + c.gap / 2;
      this.shaft(ctx, c, c.x, -10, gapTop - CAP_H, true);
      this.shaft(ctx, c, c.x, gapBot + CAP_H, this.groundY, false);
      this.capital(ctx, c, c.x + COL_W / 2, gapTop - CAP_H, true);
      this.capital(ctx, c, c.x + COL_W / 2, gapBot, false);
    }

    /** Fuste de mármol negro veteado con grecas escalonadas doradas. */
    shaft(ctx, c, x, y0, y1, anchorBottom) {
      const h = y1 - y0;
      if (h <= 0) return;
      const g = ctx.createLinearGradient(x, 0, x + COL_W, 0);
      g.addColorStop(0, '#040406'); g.addColorStop(0.45, '#1d1d27'); g.addColorStop(0.6, '#15151d'); g.addColorStop(1, '#040406');
      ctx.fillStyle = g;
      ctx.fillRect(x, y0, COL_W, h);

      ctx.save();
      ctx.beginPath(); ctx.rect(x, y0, COL_W, h); ctx.clip();
      ctx.translate(x, 0);
      for (const v of c.veins) {
        ctx.beginPath();
        v.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.strokeStyle = v.gold ? 'rgba(232,184,74,0.35)' : 'rgba(235,235,255,0.16)';
        ctx.lineWidth = v.w;
        ctx.stroke();
      }
      // estrías verticales
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(COL_W * 0.25, y0, 2, h); ctx.fillRect(COL_W * 0.75, y0, 2, h);
      // grecas: ancladas junto al capitel y repetidas cada 170 px
      const anchor = anchorBottom ? y1 : y0;
      const dir = anchorBottom ? -1 : 1;
      for (let k = 0; k < 8; k++) {
        const by = anchor + dir * (14 + k * 170) + (anchorBottom ? -18 : 0);
        if (by < y0 - 20 || by > y1 + 20) continue;
        ctx.fillStyle = 'rgba(6,6,10,0.9)'; ctx.fillRect(0, by - 3, COL_W, 24);
        this.greca(ctx, 3, by, COL_W - 6, 18, 5);
        ctx.fillStyle = '#E8B84A'; ctx.fillRect(0, by - 3, COL_W, 2); ctx.fillRect(0, by + 21, COL_W, 2);
      }
      ctx.restore();
      ctx.fillStyle = '#C9972F';
      ctx.fillRect(x, y0, 2, h); ctx.fillRect(x + COL_W - 2, y0, 2, h);
    }

    /** Capitel esculpido con cabeza de Jaguar Dorado (ojos esmeralda luminiscentes y colmillos). */
    capital(ctx, c, cx, y, isTop) {
      const x = cx - CAP_W / 2;
      const g = ctx.createLinearGradient(0, y, 0, y + CAP_H);
      g.addColorStop(0, '#22222c'); g.addColorStop(0.5, '#0a0a0f'); g.addColorStop(1, '#1b1b24');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, CAP_W, CAP_H);
      // escalones dorados en el borde que mira al hueco
      const edge = isTop ? y + CAP_H - 6 : y;
      ctx.fillStyle = '#E8B84A';
      ctx.fillRect(x - 4, edge, CAP_W + 8, 6);
      ctx.fillStyle = '#7a5a18';
      ctx.fillRect(x - 4, isTop ? edge + 5 : edge, CAP_W + 8, 1);
      const far = isTop ? y : y + CAP_H - 5;
      ctx.fillStyle = '#C9972F';
      ctx.fillRect(x, far, CAP_W, 5);
      ctx.fillRect(x, y, 3, CAP_H); ctx.fillRect(x + CAP_W - 3, y, 3, CAP_H);

      const cy = y + CAP_H / 2 + (isTop ? -2 : 2);
      const S = 54;
      U.sprite(ctx, A.img('jaguar_gold'), cx, cy, S);
      // ojos esmeralda luminiscentes
      const pulse = 0.55 + 0.45 * Math.sin(this.t * 4 + c.eyePhase);
      for (const sx of [-1, 1]) {
        const ex = cx + sx * 0.19 * S, ey = cy - 0.1 * S;
        ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(ex, ey, 1, ex, ey, 12);
        rg.addColorStop(0, `rgba(60,255,160,${0.8 * pulse})`); rg.addColorStop(1, 'rgba(60,255,160,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(ex - 12, ey - 12, 24, 24);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#12c46f'; ctx.fillRect(ex - 3, ey - 3, 6, 6);
        ctx.fillStyle = '#d6fff0'; ctx.fillRect(ex - 1, ey - 2, 2, 2);
      }
    }

    drawCharm(ctx, c) {
      const y = c.y + Math.sin(this.t * 3 + c.ph) * 8;
      const r = 28 + Math.sin(this.t * 6) * 3;
      const g = ctx.createRadialGradient(c.x, y, 4, c.x, y, r);
      g.addColorStop(0, 'rgba(60,255,160,0.55)'); g.addColorStop(1, 'rgba(60,255,160,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c.x - r, y - r, r * 2, r * 2);
      U.sprite(ctx, A.img('charm_qm'), c.x, y, 42);
    }

    /** Frasco Alado Citlalli: cristal facetado, líquido ámbar, tapón oro rosa, dije QM y alas de luz. */
    drawBird(ctx) {
      const b = this.bird, t = this.t;
      if (this.invuln > 0 && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha = 0.45;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);

      // alas de luz translúcidas (aleteo senoidal)
      const flap = Math.sin(b.wing);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * 13, 0);
        ctx.scale(side, 1);
        ctx.rotate(-0.25 - flap * 0.75);
        [[30, -0.45], [26, -0.1], [20, 0.3]].forEach(([len, a], i) => {
          ctx.save();
          ctx.rotate(a);
          const wg = ctx.createLinearGradient(0, 0, len, 0);
          wg.addColorStop(0, 'rgba(255,255,255,0.75)');
          wg.addColorStop(1, i === 1 ? 'rgba(140,220,255,0.12)' : 'rgba(255,230,170,0.12)');
          ctx.fillStyle = wg;
          ctx.beginPath(); ctx.ellipse(len / 2 + 2, 0, len / 2 + 2, 6 - i, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        });
        ctx.restore();
      }

      // cuerpo (se comprime al saltar)
      const sq = b.squash;
      ctx.save();
      ctx.scale(1 + 0.1 * sq, 1 - 0.14 * sq);
      const body = [[-15, -4], [-11, -12], [11, -12], [15, -4], [15, 14], [11, 19], [-11, 19], [-15, 14]];
      const path = () => { ctx.beginPath(); body.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
      const gl = ctx.createLinearGradient(-15, -12, 15, 19);
      gl.addColorStop(0, 'rgba(210,240,255,0.95)'); gl.addColorStop(0.5, 'rgba(120,180,235,0.85)'); gl.addColorStop(1, 'rgba(60,110,190,0.9)');
      path(); ctx.fillStyle = gl; ctx.fill();
      // líquido ámbar
      ctx.save();
      path(); ctx.clip();
      const lg = ctx.createLinearGradient(0, 2, 0, 19);
      lg.addColorStop(0, '#ffc245'); lg.addColorStop(1, '#d9700f');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(-16, 20);
      for (let x = -16; x <= 16; x += 2) ctx.lineTo(x, 3 + Math.sin(t * 7 + x * 0.35) * 1.3 + b.vy * -0.0012);
      ctx.lineTo(16, 20); ctx.closePath(); ctx.fill();
      ctx.restore();
      // facetas y brillos
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-8, 19); ctx.moveTo(0, -12); ctx.lineTo(9, 19); ctx.moveTo(-15, -4); ctx.lineTo(15, -4); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.moveTo(-13, -3); ctx.lineTo(-9, -10); ctx.lineTo(-6, -10); ctx.lineTo(-9, 15); ctx.lineTo(-13, 12); ctx.closePath(); ctx.fill();
      path(); ctx.strokeStyle = '#d8f1ff'; ctx.lineWidth = 1.5; ctx.stroke();
      // cuello y tapón oro rosa con atomizador comprimible
      ctx.fillStyle = 'rgba(190,225,250,0.9)'; ctx.fillRect(-5, -17, 10, 6);
      const cap = 5 * sq;
      const cg = ctx.createLinearGradient(-7, 0, 7, 0);
      cg.addColorStop(0, '#f6cdb3'); cg.addColorStop(0.5, '#e0a98b'); cg.addColorStop(1, '#b97a5c');
      ctx.fillStyle = cg; ctx.fillRect(-7, -29 + cap, 14, 13);
      ctx.fillStyle = '#fff0e0'; ctx.fillRect(-6, -28 + cap, 3, 11);
      ctx.fillStyle = '#E8B84A'; ctx.fillRect(-7, -17 + cap, 14, 2);
      ctx.fillStyle = '#d9a35b'; ctx.fillRect(5, -26 + cap * 0.5, 9, 3); // boquilla
      ctx.restore();

      // dije QM oscilante
      const sw = Math.sin(t * 5.5) * 0.45 - b.vy * 0.0007;
      const hx = Math.sin(sw) * 15, hy = -10 + Math.cos(sw) * 15;
      ctx.strokeStyle = '#E8B84A'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = '#E0A98B'; ctx.beginPath(); ctx.arc(hx, hy + 4, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a4a30'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#4a2a18'; ctx.font = U.font(6.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('QM', hx, hy + 4.5);

      // escudo esmeralda
      if (this.shield) {
        const p = 0.5 + 0.5 * Math.sin(t * 6);
        ctx.beginPath(); ctx.arc(0, 0, 33, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(31,191,122,${0.14 + 0.1 * p})`; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = `rgba(124,255,178,${0.65 + 0.3 * p})`; ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(214,255,240,0.6)';
        ctx.beginPath(); ctx.arc(0, 0, 33, t * 2, t * 2 + 1.1); ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    drawHUD(ctx) {
      const { W } = this.e;
      if (this.state !== 'ready') {
        U.text(ctx, String(this.score), W / 2, 74, { size: 64, align: 'center', color: '#FFFFFF', strokeWidth: 8 });
      }
      const best = A.store.bestFor('flappy');
      U.text(ctx, 'MEJOR ' + (best === null ? '-' : Math.max(best, this.score)), W - 12, 28, { size: 18, align: 'right', color: '#7CFFB2' });
      if (this.shield) {
        U.sprite(ctx, A.img('charm_qm'), 28, 30, 36);
        U.text(ctx, 'ESCUDO', 52, 36, { size: 16, color: '#7CFFB2' });
      }
    }
  }

  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = U.clamp(cx, rx, rx + rw), ny = U.clamp(cy, ry, ry + rh);
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  A.games.flappy = FlappyGame;
})(window);
