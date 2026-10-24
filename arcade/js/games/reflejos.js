/**
 * 🎯 Juego 4 — Reflejos (Destilación Alquímica)
 * Reto de 20 s: captura orbes de cristal antes de que se evaporen (anillos decrecientes)
 * y evita los frascos de Humo Amargo (-50 pts, corta la racha, tiembla la pantalla).
 * HUD en vivo: ÚLTIMO | PROM | RACHA | ¡REFLEJO RELÁMPAGO!
 */
(function (global) {
  'use strict';

  const A = (global.Arcade = global.Arcade || {});
  const U = A.util;

  const GAME_SECONDS = 20;
  const TABLE_H = 82;
  const TOP_H = 64;
  const ESSENCES = ['mandarin', 'rose_pink', 'jasmine_white', 'vanilla_pod', 'amber_crystal', 'star_citlalli'];
  const ESSENCE_COLORS = {
    mandarin: ['#ffb347', '#ff8c1a'], rose_pink: ['#ff7eb6', '#ffc2dd'], jasmine_white: ['#ffffff', '#e6f7ff'],
    vanilla_pod: ['#c28a4a', '#f5deb3'], amber_crystal: ['#ffb02e', '#ffe08a'], star_citlalli: ['#fff1b8', '#9fe8ff']
  };
  const LIGHTNING_MS = 230;

  class ReflejosGame {
    constructor(engine) {
      this.e = engine;
      this.id = 'reflejos';
      this.state = 'ready';
      this.overAt = 0;
      this.result = null;
      this.t = 0;
      this.particles = new U.Particles();
      this.reset();
    }

    /* ------------------------------------------------------------- estado */
    reset() {
      this.cfg = this.e.tuning('reflejos');
      this.items = [];
      this.score = 0;
      this.timeLeft = GAME_SECONDS;
      this.spawnTimer = 0.5;
      this.streak = 0;
      this.bestStreak = 0;
      this.times = [];
      this.lastMs = null;
      this.fastest = null;
      this.captured = 0;
      this.flashT = 0;
      this.redT = 0;
      this.shake = 0;
      this.ripples = [];
      this.result = null;
      this.state = 'ready';
      this.particles.clear();
    }

    enter() { this.reset(); A.audio.playMusic(A.store.prefs.scenario); }
    onResize() { this.reset(); }
    onSettingsChange(kind) { if (kind === 'difficulty') this.reset(); }
    restart() { this.reset(); this.state = 'playing'; A.audio.unlock(); A.audio.playMusic(A.store.prefs.scenario); A.audio.play('tick'); }

    get avg() { return this.times.length ? Math.round(this.times.reduce((a, b) => a + b, 0) / this.times.length) : null; }

    /* ------------------------------------------------------------- entrada */
    onKeyDown(e) {
      if (this.state === 'ready' && (e.key === 'Enter' || e.key === ' ')) {
        this.state = 'playing';
        A.audio.playMusic(A.store.prefs.scenario);
      }
    }

    onPointerDown(p) {
      if (this.state === 'ready') {
        this.state = 'playing';
        A.audio.playMusic(A.store.prefs.scenario);
        A.audio.play('tick');
        return;
      }
      if (this.state !== 'playing') return;
      for (let i = this.items.length - 1; i >= 0; i--) { // el más reciente primero
        const it = this.items[i];
        if (Math.hypot(p.x - it.x, p.y - it.y) <= it.r + 8) {
          if (it.kind === 'orb') this.hitOrb(it, i, p.time); else this.hitHazard(it, i);
          return;
        }
      }
      this.ripples.push({ x: p.x, y: p.y, age: 0 }); // toque en vacío: onda sutil
    }

    hitOrb(it, idx, now) {
      const ms = Math.max(1, Math.round(now - it.spawnedAt));
      this.items.splice(idx, 1);
      this.lastMs = ms;
      this.times.push(ms);
      this.fastest = this.fastest === null ? ms : Math.min(this.fastest, ms);
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.captured++;
      const speed = U.clamp(1 - ms / (it.life * 1000), 0, 1);
      const mult = 1 + Math.min(this.streak - 1, 10) * 0.1;
      const pts = Math.round((100 + 100 * speed) * mult);
      this.score += pts;
      const cols = ESSENCE_COLORS[it.sprite];
      this.particles.emit(it.x, it.y, { count: 22, speed: 240, life: 0.7, size: 6, colors: cols.concat('#ffffff'), round: true });
      this.particles.text(it.x, it.y - it.r, '+' + pts, '#FFE9A8', 22);
      if (ms < LIGHTNING_MS) { this.flashT = 1.3; A.audio.play('reflex_hit'); } else A.audio.play(this.streak % 5 === 0 ? 'spray' : 'point');
    }

    hitHazard(it, idx) {
      this.items.splice(idx, 1);
      this.score = Math.max(0, this.score - 50);
      this.streak = 0;
      this.shake = 0.4;
      this.redT = 0.4;
      A.audio.play('hazard');
      this.particles.emit(it.x, it.y, { count: 24, speed: 160, life: 0.9, size: 9, grow: 12, colors: ['#6b6b78', '#9a9aa8', '#3b3b46'], round: true });
      this.particles.text(it.x, it.y - it.r, '-50', '#ff8a8a', 26);
    }

    /* ------------------------------------------------------------- lógica */
    spawn() {
      const { W, H } = this.e;
      const hazard = Math.random() < this.cfg.hazard;
      const r = hazard ? 38 : 42;
      const elapsed = GAME_SECONDS - this.timeLeft;
      const life = this.cfg.life * (1 - 0.25 * (elapsed / GAME_SECONDS)); // la ronda se acelera
      let x = 0, y = 0, ok = false;
      for (let tries = 0; tries < 25 && !ok; tries++) {
        x = U.rand(r + 12, W - r - 12);
        y = U.rand(TOP_H + r, H - TABLE_H - r - 8);
        ok = this.items.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 14);
      }
      const a = U.rand(0, Math.PI * 2), sp = U.rand(8, 30);
      this.items.push({
        kind: hazard ? 'hazard' : 'orb', x, y, r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life, age: 0, spawnedAt: performance.now(), sprite: hazard ? 'smoke_hazard' : U.pick(ESSENCES), ph: U.rand(0, 6), fumeT: 0
      });
    }

    update(dt) {
      this.t += dt;
      this.particles.update(dt);
      if (this.shake > 0) this.shake -= dt;
      if (this.redT > 0) this.redT -= dt;
      if (this.flashT > 0) this.flashT -= dt;
      this.ripples.forEach((r) => { r.age += dt; });
      this.ripples = this.ripples.filter((r) => r.age < 0.4);
      if (this.state !== 'playing') return;

      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; return this.timeUp(); }

      const { W, H } = this.e;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        if (this.items.length < this.cfg.maxActive) this.spawn();
        this.spawnTimer = this.cfg.interval * U.rand(0.8, 1.2);
      }

      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        it.age += dt;
        it.x += it.vx * dt; it.y += it.vy * dt;
        if (it.x < it.r + 8 || it.x > W - it.r - 8) it.vx *= -1;
        if (it.y < TOP_H + it.r || it.y > H - TABLE_H - it.r - 4) it.vy *= -1;
        it.x = U.clamp(it.x, it.r + 8, W - it.r - 8);
        it.y = U.clamp(it.y, TOP_H + it.r, H - TABLE_H - it.r - 4);
        if (it.kind === 'hazard') { // humo tóxico ascendente
          it.fumeT -= dt;
          if (it.fumeT <= 0) {
            it.fumeT = 0.12;
            this.particles.emit(it.x + U.rand(-8, 8), it.y - it.r * 0.9, { count: 1, angle: -Math.PI / 2, spread: 0.3, speed: 36, speedMin: 18, life: 1, size: 7, grow: 10, colors: ['rgba(120,120,135,0.7)', 'rgba(90,90,100,0.7)'], round: true });
          }
        }
        if (it.age >= it.life) { // evaporación
          this.items.splice(i, 1);
          if (it.kind === 'orb') {
            this.streak = 0;
            this.particles.emit(it.x, it.y, { count: 10, angle: -Math.PI / 2, spread: 0.9, speed: 70, life: 0.7, size: 8, grow: 12, colors: ['rgba(255,255,255,0.6)', 'rgba(200,220,255,0.5)'], round: true });
          }
        }
      }
    }

    timeUp() {
      this.items = [];
      A.audio.play('win');
      this.e.finish(this, this.score, { bestMs: this.fastest });
    }

    /* ------------------------------------------------------------- dibujo */
    draw(ctx) {
      const { W, H } = this.e;
      ctx.save();
      if (this.shake > 0) ctx.translate(U.rand(-6, 6), U.rand(-6, 6));
      U.background(ctx, this.e.bg(), W, H, 0, 0.4);
      this.drawTable(ctx);
      this.items.forEach((it) => this.drawItem(ctx, it));
      this.ripples.forEach((r) => {
        ctx.globalAlpha = 1 - r.age / 0.4;
        ctx.strokeStyle = '#E8B84A'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(r.x, r.y, 6 + r.age * 60, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      this.particles.draw(ctx);
      if (this.redT > 0) { ctx.fillStyle = `rgba(255,40,40,${0.35 * (this.redT / 0.4)})`; ctx.fillRect(-10, -10, W + 20, H + 20); }
      ctx.restore();
      this.drawHUD(ctx);

      if (this.state === 'ready') {
        const m = Math.min(W, H);
        ctx.fillStyle = 'rgba(3,5,12,0.72)';
        ctx.fillRect(0, H / 2 - m * 0.2, W, m * 0.4);
        U.text(ctx, '🎯 REFLEJOS', W / 2, H / 2 - m * 0.06, { size: Math.round(m * 0.075), align: 'center', color: '#FFD86B' });
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 5);
        U.text(ctx, 'Captura los orbes · evita el humo amargo', W / 2, H / 2 + m * 0.02, { size: Math.round(m * 0.03), align: 'center' });
        U.text(ctx, `👉 Toca para comenzar · ${GAME_SECONDS} s`, W / 2, H / 2 + m * 0.1, { size: Math.round(m * 0.04), align: 'center', color: '#ffffff' });
        ctx.globalAlpha = 1;
      }
      if (this.state === 'over' && this.result) {
        const r = this.result;
        U.gameOverPanel(ctx, W, H, {
          title: '¡TIEMPO!', titleColor: '#FFD86B',
          lines: [`Puntos: ${r.score}`, `Capturados: ${this.captured} · Racha máx: x${this.bestStreak}`,
            this.avg !== null ? `Promedio: ${this.avg} ms · Mejor: ${this.fastest} ms` : 'Sin capturas'],
          newRecord: r.isRecord
        }, this.t);
      }
    }

    /** Mesa de alquimia: tablón oscuro con filo de oro y velas parpadeantes. */
    drawTable(ctx) {
      const { W, H } = this.e, y = H - TABLE_H;
      const g = ctx.createLinearGradient(0, y, 0, H);
      g.addColorStop(0, '#2a1a0c'); g.addColorStop(1, '#0c0703');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, W, TABLE_H);
      ctx.fillStyle = '#E8B84A'; ctx.fillRect(0, y, W, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 0; x < W; x += 46) ctx.fillRect(x, y + 6, 2, TABLE_H); // vetas del tablón
      // velas
      [28, W - 28].forEach((cx, k) => {
        const fl = 0.7 + 0.3 * Math.sin(this.t * 11 + k * 2) * Math.sin(this.t * 7.3 + k);
        ctx.fillStyle = '#f4e8c8'; ctx.fillRect(cx - 5, y - 18, 10, 20);
        ctx.fillStyle = '#d9c9a2'; ctx.fillRect(cx - 5, y - 18, 3, 20);
        const rg = ctx.createRadialGradient(cx, y - 28, 2, cx, y - 28, 46);
        rg.addColorStop(0, `rgba(255,200,90,${0.55 * fl})`); rg.addColorStop(1, 'rgba(255,200,90,0)');
        ctx.fillStyle = rg; ctx.fillRect(cx - 46, y - 74, 92, 92);
        ctx.fillStyle = '#ffd24a'; ctx.fillRect(cx - 3, y - 32 - 4 * fl, 6, 8 + 4 * fl);
        ctx.fillStyle = '#fff6c8'; ctx.fillRect(cx - 1, y - 28, 2, 5);
      });
    }

    drawItem(ctx, it) {
      const f = 1 - it.age / it.life;                 // 1 → 0 (tiempo de evaporación)
      const fade = f < 0.22 ? f / 0.22 : 1;
      const bob = Math.sin(this.t * 3 + it.ph) * 3;
      const x = it.x, y = it.y + bob, r = it.r;
      ctx.save();
      ctx.globalAlpha = fade;

      // anillos concéntricos decrecientes
      const hue = it.kind === 'hazard' ? null : U.lerp(0, 130, f); // rojo → verde
      for (let k = 0; k < 3; k++) {
        const rr = r + 5 + f * (44 - k * 8) + k * 3;
        ctx.lineWidth = 3 - k * 0.7;
        ctx.strokeStyle = hue === null ? `rgba(160,160,180,${0.75 - k * 0.2})` : `hsla(${hue},95%,60%,${0.9 - k * 0.22})`;
        if (it.kind === 'hazard') ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }

      if (it.kind === 'orb') this.drawOrb(ctx, it, x, y, r);
      else this.drawFlask(ctx, it, x, y, r);
      ctx.restore();
    }

    drawOrb(ctx, it, x, y, r) {
      const cols = ESSENCE_COLORS[it.sprite];
      const aura = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.35);
      aura.addColorStop(0, cols[0] + '88'); aura.addColorStop(1, cols[0] + '00');
      ctx.fillStyle = aura; ctx.fillRect(x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
      const gl = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      gl.addColorStop(0, 'rgba(255,255,255,0.55)'); gl.addColorStop(0.55, 'rgba(150,200,255,0.2)'); gl.addColorStop(1, 'rgba(70,110,200,0.45)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      U.sprite(ctx, A.img(it.sprite), x, y + Math.sin(this.t * 4 + it.ph) * 2, r * 1.25);
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(210,240,255,0.85)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r * 0.8, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    }

    /** Frasco alquímico con humo grisáceo tóxico (sprite smoke_hazard). */
    drawFlask(ctx, it, x, y, r) {
      const neckW = r * 0.62, neckH = r * 0.7;
      ctx.fillStyle = 'rgba(120,125,140,0.45)';
      ctx.fillRect(x - neckW / 2, y - r - neckH * 0.7, neckW, neckH);
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(x - neckW / 2 - 2, y - r - neckH * 0.7 - 6, neckW + 4, 8); // corcho
      const gl = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      gl.addColorStop(0, 'rgba(210,215,225,0.5)'); gl.addColorStop(1, 'rgba(70,75,95,0.7)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      U.sprite(ctx, A.img('smoke_hazard'), x, y + 2, r * 1.35);
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(190,195,210,0.9)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,90,90,0.9)';
      ctx.font = U.font(12); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('☠', x, y + r + 12);
    }

    drawHUD(ctx) {
      const { W, H } = this.e;
      // barra continua de tiempo
      const frac = this.timeLeft / GAME_SECONDS;
      ctx.fillStyle = 'rgba(6,11,26,0.88)'; ctx.fillRect(0, 0, W, TOP_H - 8);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, 16);
      const bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, '#1fbf7a'); bg.addColorStop(0.6, '#E8B84A'); bg.addColorStop(1, '#ff4d4d');
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W * frac, 16); ctx.clip();
      ctx.fillStyle = frac < 0.25 && Math.floor(this.t * 6) % 2 ? '#ff4d4d' : bg;
      ctx.fillRect(0, 0, W, 16);
      ctx.restore();
      ctx.fillStyle = '#E8B84A'; ctx.fillRect(0, 16, W, 2);
      U.text(ctx, 'PUNTOS ' + this.score, 12, 46, { size: 22 });
      U.text(ctx, this.timeLeft.toFixed(1) + ' s', W - 12, 46, { size: 22, align: 'right', color: frac < 0.25 ? '#ff8a8a' : '#7CFFB2' });
      const best = A.store.bestFor('reflejos');
      U.text(ctx, 'MEJOR ' + (best === null ? '-' : Math.max(best, this.score)), W / 2, 46, { size: 14, align: 'center', color: '#C8B27A', stroke: false });

      // telemetría en vivo (mesa)
      const y = H - TABLE_H;
      const last = this.lastMs === null ? '--' : this.lastMs;
      const avg = this.avg === null ? '--' : this.avg;
      let line = `ÚLTIMO: ${last} ms | PROM: ${avg} ms | RACHA: x${this.streak}`;
      const flash = this.flashT > 0;
      if (flash) line += ' | ¡REFLEJO RELÁMPAGO!';
      let fs = 16;
      ctx.font = U.font(fs);
      while (ctx.measureText(line).width > W - 20 && fs > 8) { fs--; ctx.font = U.font(fs); }
      U.text(ctx, line, W / 2, y + 34, { size: fs, align: 'center', color: flash ? '#ffee88' : '#FFE9A8' });
      U.text(ctx, this.fastest !== null ? `Mejor reflejo: ${this.fastest} ms · Racha máx: x${this.bestStreak}` : 'Toca los orbes antes de que se evaporen',
        W / 2, y + 60, { size: 12, align: 'center', color: '#C8B27A', stroke: false });
    }
  }

  A.games.reflejos = ReflejosGame;
})(window);
