/**
 * 🐍 Juego 1 — La Víborita (Snake Olfativa)
 * Serpiente esmeralda con cresta de Quetzal dorada que devora la pirámide olfativa.
 * Mandarina +100 · Rosa/Jazmín +250 · Vainilla/Ámbar +400 · Frasco +600 · Estrella +500 y Fiebre Astral (x2, 8 s).
 */
(function (global) {
  'use strict';

  const A = (global.Arcade = global.Arcade || {});
  const U = A.util;

  const CELL = 30;
  const HUD_H = 46;
  const FEVER_SECONDS = 8;

  const FOODS = {
    mandarin: { pts: 100, tier: 'Salida' },
    rose_pink: { pts: 250, tier: 'Corazón' },
    jasmine_white: { pts: 250, tier: 'Corazón' },
    vanilla_pod: { pts: 400, tier: 'Fondo' },
    amber_crystal: { pts: 400, tier: 'Fondo' },
    bottle_citlalli: { pts: 600, tier: 'Joya', special: true },
    star_citlalli: { pts: 500, tier: 'Astral', special: true }
  };
  const NORMAL_POOL = ['mandarin', 'mandarin', 'mandarin', 'mandarin', 'rose_pink', 'jasmine_white', 'vanilla_pod', 'amber_crystal'];

  class SnakeGame {
    constructor(engine) {
      this.e = engine;
      this.id = 'snake';
      this.state = 'ready';
      this.overAt = 0;
      this.result = null;
      this.t = 0;
      this.particles = new U.Particles();
      this.layout();
      this.reset();
    }

    /* ------------------------------------------------------------- estado */
    layout() {
      const { W, H } = this.e;
      this.cols = Math.max(8, Math.floor(W / CELL));
      this.rows = Math.max(8, Math.floor((H - HUD_H - 8) / CELL));
      this.ox = Math.floor((W - this.cols * CELL) / 2);
      this.oy = HUD_H + Math.floor((H - HUD_H - this.rows * CELL) / 2);
    }

    reset() {
      this.cfg = this.e.tuning('snake');
      const cx = Math.floor(this.cols / 2), cy = Math.floor(this.rows / 2);
      this.snake = [];
      for (let i = 0; i < 4; i++) this.snake.push({ x: cx - i, y: cy });
      this.dir = { x: 1, y: 0 };
      this.queue = [];
      this.foods = [];
      this.obstacles = [];
      this.score = 0;
      this.fever = 0;
      this.stepAcc = 0;
      this.specialTimer = U.rand(6, 10);
      this.nextObstacleScore = this.cfg.obsStep || 600;
      this.shake = 0;
      this.result = null;
      this.state = 'ready';
      this.particles.clear();
      for (let i = 0; i < (this.cfg.initObs || 0); i++) this.spawnObstacle();
      this.topUp();
    }

    enter() { this.layout(); this.reset(); A.audio.playMusic(A.store.prefs.scenario); }
    restart() { this.reset(); this.state = 'playing'; A.audio.unlock(); A.audio.playMusic(A.store.prefs.scenario); A.audio.play('tick'); }
    onResize() { this.layout(); this.reset(); }
    onSettingsChange(kind) { if (kind === 'difficulty') this.reset(); }

    /* ------------------------------------------------------------- entrada */
    onKeyDown(e) {
      const map = {
        ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
        ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
        ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
        ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
      };
      const v = map[e.key];
      if (v) this.setDir(v[0], v[1]);
      else if (this.state === 'ready' && (e.key === 'Enter' || e.key === ' ')) this.state = 'playing';
    }

    onPointerDown(p) {
      this.swipe = { x: p.cx, y: p.cy, id: p.id };
      if (this.state === 'ready') this.state = 'playing';
    }

    onPointerMove(p) {
      const s = this.swipe;
      if (!s || s.id !== p.id) return;
      const dx = p.cx - s.x, dy = p.cy - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return; // umbral de deslizamiento
      if (Math.abs(dx) > Math.abs(dy)) this.setDir(Math.sign(dx), 0); else this.setDir(0, Math.sign(dy));
      s.x = p.cx; s.y = p.cy; // permite encadenar deslizamientos sin soltar
    }

    onPointerUp() { this.swipe = null; }

    /** Cambia de dirección (usado por teclado, swipe y D-Pad). Evita giros de 180°. */
    setDir(dx, dy) {
      if (this.state === 'over') return;
      if (this.state === 'ready') this.state = 'playing';
      const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
      if ((dx === last.x && dy === last.y) || (dx === -last.x && dy === -last.y)) return;
      if (this.queue.length < 3) this.queue.push({ x: dx, y: dy });
    }

    /* ------------------------------------------------------------- comida y obstáculos */
    freeCell() {
      for (let i = 0; i < 300; i++) {
        const x = U.randInt(0, this.cols - 1), y = U.randInt(0, this.rows - 1);
        if (!this.snake.some((s) => s.x === x && s.y === y) &&
            !this.foods.some((f) => f.x === x && f.y === y) &&
            !this.obstacles.some((o) => o.x === x && o.y === y)) return { x, y };
      }
      return null;
    }

    spawnObstacle() {
      const head = this.snake && this.snake[0] ? this.snake[0] : { x: -10, y: -10 };
      for (let i = 0; i < 300; i++) {
        const x = U.randInt(1, this.cols - 2);
        const y = U.randInt(1, this.rows - 2);
        if (Math.hypot(x - head.x, y - head.y) < 3.2) continue; // seguridad inicial
        if (this.snake.some((s) => s.x === x && s.y === y)) continue;
        if (this.foods.some((f) => f.x === x && f.y === y)) continue;
        if (this.obstacles.some((o) => o.x === x && o.y === y)) continue;
        this.obstacles.push({ x, y, age: 0 });
        const px = this.ox + x * CELL + CELL / 2, py = this.oy + y * CELL + CELL / 2;
        this.particles.emit(px, py, {
          count: 12, speed: 80, life: 0.5, size: 4,
          colors: ['#7a7268', '#423d38', '#E8B84A']
        });
        return true;
      }
      return false;
    }

    spawn(type, ttl) {
      const c = this.freeCell();
      if (c) this.foods.push({ type, x: c.x, y: c.y, ttl: ttl || 0, age: 0 });
    }

    /** Mantiene 2 notas normales en pantalla. */
    topUp() {
      while (this.foods.filter((f) => !FOODS[f.type].special).length < 2) this.spawn(U.pick(NORMAL_POOL));
    }

    /* ------------------------------------------------------------- lógica */
    update(dt) {
      this.t += dt;
      this.particles.update(dt);
      if (this.shake > 0) this.shake -= dt;
      this.obstacles.forEach((o) => { o.age += dt; });
      if (this.state !== 'playing') return;

      if (this.fever > 0) {
        this.fever = Math.max(0, this.fever - dt);
        if (Math.random() < dt * 40) {
          const h = this.snake[0];
          this.particles.emit(this.ox + h.x * CELL + 15, this.oy + h.y * CELL + 15, {
            count: 1, speed: 70, life: 0.6, size: 5, colors: ['#ff4d6d', '#ffd23f', '#3ddc84', '#4cc9f0', '#c77dff'], round: true
          });
        }
      }

      // comidas especiales: aparecen y caducan
      for (let i = this.foods.length - 1; i >= 0; i--) {
        const f = this.foods[i];
        f.age += dt;
        if (f.ttl && f.age > f.ttl) this.foods.splice(i, 1);
      }
      this.specialTimer -= dt;
      if (this.specialTimer <= 0) {
        if (!this.foods.some((f) => FOODS[f.type].special)) this.spawn(Math.random() < 0.45 ? 'star_citlalli' : 'bottle_citlalli', 9);
        this.specialTimer = U.rand(9, 15);
      }

      const speed = this.cfg.speed + Math.min(this.snake.length - 4, 30) * this.cfg.accel;
      const interval = 1 / speed;
      this.stepAcc += dt;
      let guard = 0;
      while (this.stepAcc >= interval && this.state === 'playing' && guard++ < 4) {
        this.stepAcc -= interval;
        this.step();
      }
    }

    step() {
      if (this.queue.length) this.dir = this.queue.shift();
      const head = this.snake[0];
      let nx = head.x + this.dir.x, ny = head.y + this.dir.y;

      if (this.cfg.wrap) {
        nx = (nx + this.cols) % this.cols;
        ny = (ny + this.rows) % this.rows;
      } else if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) {
        return this.die();
      }

      const foodIdx = this.foods.findIndex((f) => f.x === nx && f.y === ny);
      const body = foodIdx >= 0 ? this.snake : this.snake.slice(0, -1); // la cola se aparta si no crece
      if (body.some((s) => s.x === nx && s.y === ny)) return this.die();
      if (this.obstacles.some((o) => o.x === nx && o.y === ny)) return this.die();

      this.snake.unshift({ x: nx, y: ny });
      if (foodIdx >= 0) this.eat(this.foods.splice(foodIdx, 1)[0]);
      else this.snake.pop();
    }

    eat(f) {
      const def = FOODS[f.type];
      const mult = this.fever > 0 ? 2 : 1;
      const pts = def.pts * mult;
      this.score += pts;
      const px = this.ox + f.x * CELL + CELL / 2, py = this.oy + f.y * CELL + CELL / 2;
      this.particles.emit(px, py, { count: 14, speed: 150, life: 0.6, size: 5, colors: ['#FFD86B', '#fff1b8', '#7CFFB2'] });
      this.particles.text(px, py - 8, '+' + pts, mult > 1 ? '#ff9cf0' : '#FFE9A8', mult > 1 ? 24 : 20);
      if (f.type === 'bottle_citlalli') this.snake.push({ ...this.snake[this.snake.length - 1] });

      if (f.type === 'star_citlalli') {
        this.fever = FEVER_SECONDS;
        A.audio.play('power');
        this.particles.emit(px, py, { count: 36, speed: 260, life: 1, size: 6, colors: ['#ff4d6d', '#ffd23f', '#3ddc84', '#4cc9f0', '#c77dff'], round: true });
        this.particles.text(px, py - 34, '¡FIEBRE ASTRAL x2!', '#ffffff', 22);
      } else {
        A.audio.play(def.pts >= 400 ? 'spray' : 'collect');
      }

      // Generar obstáculo sutil con el progreso de puntuación para aumentar el reto
      if (this.score >= this.nextObstacleScore && this.obstacles.length < (this.cfg.maxObs || 5)) {
        if (this.spawnObstacle()) {
          this.nextObstacleScore += (this.cfg.obsStep || 600);
          this.particles.text(this.ox + (this.cols * CELL) / 2, this.oy + 14, '¡MONOLITO!', '#E8B84A', 18);
        }
      }

      this.topUp();
    }

    die() {
      this.shake = 0.4;
      A.audio.play('collide');
      const h = this.snake[0];
      this.particles.emit(this.ox + h.x * CELL + 15, this.oy + h.y * CELL + 15, { count: 30, speed: 240, life: 0.9, size: 6, colors: ['#1fbf7a', '#FFD86B', '#0b5d36'] });
      this.e.finish(this, this.score, {});
    }

    /* ------------------------------------------------------------- dibujo */
    draw(ctx) {
      const { W, H } = this.e;
      const t = this.t;
      ctx.save();
      if (this.shake > 0) ctx.translate(U.rand(-5, 5), U.rand(-5, 5));
      U.background(ctx, this.e.bg(), W, H, 0, 0.45);

      if (this.fever > 0) {
        const g = ctx.createLinearGradient(0, 0, W, H);
        for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, `hsla(${(t * 200 + i * 80) % 360},95%,60%,0.22)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      this.drawBoard(ctx);
      this.drawObstacles(ctx);
      this.drawFoods(ctx);
      this.drawSnake(ctx);
      this.particles.draw(ctx);
      ctx.restore();
      this.drawHUD(ctx);

      if (this.state === 'ready') {
        const m = Math.min(W, H);
        ctx.fillStyle = 'rgba(3,5,12,0.55)';
        ctx.fillRect(0, H / 2 - m * 0.16, W, m * 0.32);
        U.text(ctx, '🐍 LA VÍBORITA', W / 2, H / 2 - m * 0.04, { size: Math.round(m * 0.075), align: 'center', color: '#7CFFB2' });
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5);
        U.text(ctx, 'Desliza o usa flechas / WASD', W / 2, H / 2 + m * 0.04, { size: Math.round(m * 0.038), align: 'center' });
        U.text(ctx, this.cfg.wrap ? 'Sin paredes · ¡Esquiva los monolitos sagrados!' : '¡Cuidado con las paredes y monolitos!', W / 2, H / 2 + m * 0.095, { size: Math.round(m * 0.03), align: 'center', color: '#C8B27A' });
        ctx.globalAlpha = 1;
      }
      if (this.state === 'over' && this.result) {
        const r = this.result;
        U.gameOverPanel(ctx, W, H, {
          title: 'GAME OVER', titleColor: '#ff8a8a',
          lines: [`Puntos: ${r.score}`, `Longitud: ${this.snake.length}`, r.best !== null ? `Tu mejor: ${r.best}` : ''].filter(Boolean),
          newRecord: r.isRecord
        }, t);
      }
    }

    drawBoard(ctx) {
      const { ox, oy, cols, rows } = this;
      ctx.fillStyle = 'rgba(5,10,28,0.55)';
      ctx.fillRect(ox, oy, cols * CELL, rows * CELL);
      ctx.fillStyle = 'rgba(232,184,74,0.05)';
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if ((x + y) % 2 === 0) ctx.fillRect(ox + x * CELL, oy + y * CELL, CELL, CELL);
      ctx.lineWidth = 3;
      ctx.strokeStyle = this.cfg.wrap ? 'rgba(232,184,74,0.35)' : '#E8B84A';
      if (this.cfg.wrap) ctx.setLineDash([10, 8]);
      ctx.strokeRect(ox - 1.5, oy - 1.5, cols * CELL + 3, rows * CELL + 3);
      ctx.setLineDash([]);
    }

    /** Monolitos de basalto sagrado con glifo dorado y gema de ámbar */
    drawObstacles(ctx) {
      const { ox, oy } = this;
      const t = this.t;
      for (const ob of this.obstacles) {
        const x = ox + ob.x * CELL, y = oy + ob.y * CELL;
        const pop = ob.age < 0.25 ? Math.min(1, ob.age / 0.25) : 1;

        ctx.save();
        if (pop < 1) {
          ctx.translate(x + CELL / 2, y + CELL / 2);
          ctx.scale(pop, pop);
          ctx.translate(-(x + CELL / 2), -(y + CELL / 2));
        }

        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x + 2, y + 4, CELL - 4, CELL - 4);

        // Bloque de basalto oscuro
        ctx.fillStyle = '#211f2c';
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);

        // Biseles de relieve 3D
        ctx.fillStyle = '#444055';
        ctx.fillRect(x + 2, y + 2, CELL - 4, 2);
        ctx.fillRect(x + 2, y + 2, 2, CELL - 4);
        ctx.fillStyle = '#100e16';
        ctx.fillRect(x + 2, y + CELL - 4, CELL - 4, 2);
        ctx.fillRect(x + CELL - 4, y + 2, 2, CELL - 4);

        // Relieve geométrico escalonado mesoamericano
        ctx.fillStyle = '#C9972F';
        ctx.fillRect(x + 5, y + 5, CELL - 10, 2);
        ctx.fillRect(x + 5, y + CELL - 7, CELL - 10, 2);
        ctx.fillRect(x + 5, y + 7, 2, 4);
        ctx.fillRect(x + CELL - 7, y + CELL - 11, 2, 4);

        // Núcleo de ámbar / resina sagrada pulsante
        const pulse = 0.65 + 0.35 * Math.sin(t * 4 + ob.x * 2 + ob.y);
        ctx.fillStyle = `rgba(232,184,74,${0.35 * pulse})`;
        ctx.fillRect(x + 9, y + 9, CELL - 18, CELL - 18);

        ctx.fillStyle = '#e86b24';
        ctx.fillRect(x + 10, y + 10, CELL - 20, CELL - 20);
        ctx.fillStyle = '#fff1b8';
        ctx.fillRect(x + 11, y + 11, 2, 2);

        // Ribete fino
        ctx.strokeStyle = '#8a6a22';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5);

        ctx.restore();
      }
    }

    drawFoods(ctx) {
      for (const f of this.foods) {
        const def = FOODS[f.type];
        const cx = this.ox + f.x * CELL + CELL / 2;
        const bob = Math.sin(this.t * 4 + f.x) * 2;
        if (f.ttl && f.ttl - f.age < 3 && Math.floor(this.t * 8) % 2 === 0) continue; // parpadea al caducar
        if (def.special) {
          const r = 22 + Math.sin(this.t * 6) * 3;
          const g = ctx.createRadialGradient(cx, this.oy + f.y * CELL + 15, 2, cx, this.oy + f.y * CELL + 15, r);
          g.addColorStop(0, f.type === 'star_citlalli' ? 'rgba(255,255,255,0.7)' : 'rgba(255,216,107,0.6)');
          g.addColorStop(1, 'rgba(255,216,107,0)');
          ctx.fillStyle = g;
          ctx.fillRect(cx - r, this.oy + f.y * CELL + 15 - r, r * 2, r * 2);
        }
        U.sprite(ctx, A.img(f.type), cx, this.oy + f.y * CELL + CELL / 2 + bob, 32);
      }
    }

    /** Cuerpo de escamas en diamante + cabeza con cresta de Quetzal, ojos con destello y lengua bífida. */
    drawSnake(ctx) {
      const s = this.snake, t = this.t, fever = this.fever > 0;
      const px = (c) => this.ox + c.x * CELL, py = (c) => this.oy + c.y * CELL;

      for (let i = s.length - 1; i >= 1; i--) {
        const c = s[i], x = px(c), y = py(c);
        const tail = i === s.length - 1;
        const inset = tail ? 6 : 3;
        let base = i % 2 ? '#13975c' : '#17a867', hi = '#27d68a';
        if (fever) { const h = (t * 240 + i * 28) % 360; base = `hsl(${h},85%,48%)`; hi = `hsl(${h},95%,66%)`; }

        const prev = s[i - 1];
        ctx.fillStyle = base;
        if (Math.abs(prev.x - c.x) + Math.abs(prev.y - c.y) === 1) { // conector con el segmento anterior
          const dx = prev.x - c.x, dy = prev.y - c.y;
          ctx.fillRect(x + 6 + dx * 13, y + 6 + dy * 13, 18, 18);
        }
        ctx.fillRect(x + inset, y + inset, CELL - inset * 2, CELL - inset * 2);
        ctx.fillStyle = hi;
        ctx.fillRect(x + inset + 2, y + inset + 2, CELL - inset * 2 - 4, 3);
        ctx.fillStyle = '#0a5a36';
        ctx.fillRect(x + inset, y + CELL - inset - 3, CELL - inset * 2, 3);
        if (!tail) this.diamond(ctx, x + 15, y + 15, i % 2 ? '#FFD86B' : '#E8A93A');
      }
      this.drawHead(ctx, px(s[0]), py(s[0]), fever);
    }

    diamond(ctx, cx, cy, color) { // diamante pixelado de 5 filas (unidad 3 px)
      ctx.fillStyle = color;
      const rows = [1, 3, 5, 3, 1];
      for (let r = 0; r < 5; r++) ctx.fillRect(cx - rows[r] * 1.5, cy - 7.5 + r * 3, rows[r] * 3, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(cx - 1.5, cy - 4.5, 3, 3);
    }

    drawHead(ctx, x, y, fever) {
      const t = this.t, d = this.dir;
      const ang = Math.atan2(d.y, d.x);
      ctx.save();
      ctx.translate(Math.round(x + 15), Math.round(y + 15));
      ctx.rotate(ang);
      const R = (rx, ry, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(rx, ry, w, h); };

      // lengua bífida animada (sale por el hocico)
      const ph = (t * 2.6) % 1;
      if (ph < 0.6) {
        const L = 4 + 9 * Math.sin((ph / 0.6) * Math.PI);
        const wob = Math.sin(t * 40) * 1;
        R(15, -1 + wob, L, 2, '#ff3b5c');
        R(15 + L, -4 + wob, 4, 2, '#ff3b5c');
        R(15 + L, 2 + wob, 4, 2, '#ff3b5c');
      }
      // cresta de Quetzal dorada (plumas hacia atrás)
      const sway = Math.sin(t * 6) * 1.5;
      R(-16, -3 + sway, 12, 6, '#FFD86B');
      R(-15, -11 + sway, 9, 5, '#E8A93A');
      R(-15, 6 + sway, 9, 5, '#E8A93A');
      R(-13, -14 + sway, 6, 4, '#19d3c5');
      R(-13, 10 + sway, 6, 4, '#19d3c5');
      R(-16, -2 + sway, 3, 4, '#fff1b8');
      // cráneo y hocico
      const body = fever ? `hsl(${(t * 300) % 360},90%,50%)` : '#17a867';
      R(-11, -12, 24, 24, '#0a5a36');
      R(-9, -10, 20, 20, body);
      R(8, -8, 8, 16, fever ? `hsl(${(t * 300 + 40) % 360},90%,58%)` : '#27d68a');
      R(-9, -10, 20, 3, 'rgba(255,255,255,0.28)');
      R(13, -4, 2, 2, '#063d24'); R(13, 2, 2, 2, '#063d24'); // fosas nasales
      // ojos brillantes con destello
      const glow = 0.6 + 0.4 * Math.sin(t * 7);
      for (const ey of [-9, 4]) {
        ctx.globalAlpha = glow * 0.55;
        ctx.fillStyle = '#d6ff5c';
        ctx.beginPath(); ctx.arc(5, ey + 2.5, 7, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        R(2, ey, 6, 5, '#fffbe0');
        R(5, ey + 1, 3, 3, '#0b1a10');
        R(2, ey, 2, 2, '#ffffff'); // destello
      }
      ctx.restore();
    }

    drawHUD(ctx) {
      const { W } = this.e;
      ctx.fillStyle = 'rgba(6,11,26,0.85)';
      ctx.fillRect(0, 0, W, HUD_H);
      ctx.fillStyle = '#E8B84A';
      ctx.fillRect(0, HUD_H - 2, W, 2);
      U.text(ctx, 'PUNTOS ' + this.score, 12, 30, { size: 22, color: '#FFE9A8' });
      const best = A.store.bestFor('snake');
      U.text(ctx, 'MEJOR ' + (best === null ? '-' : Math.max(best, this.score)), W - 12, 30, { size: 18, align: 'right', color: '#7CFFB2' });
      if (this.fever > 0) {
        const w = Math.min(220, W * 0.3), x = W / 2 - w / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, 14, w, 16);
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, `hsl(${(this.t * 200 + i * 70) % 360},95%,60%)`);
        ctx.fillStyle = g;
        ctx.fillRect(x, 14, w * (this.fever / FEVER_SECONDS), 16);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x, 14, w, 16);
        U.text(ctx, '⭐ x2', x - 8, 29, { size: 15, align: 'right', color: '#fff' });
      }
    }
  }

  A.games.snake = SnakeGame;
})(window);
