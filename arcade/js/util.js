/**
 * Utilidades de dibujo y matemáticas compartidas por los 4 minijuegos.
 */
(function (global) {
  'use strict';

  const A = (global.Arcade = global.Arcade || {});
  const U = (A.util = {});

  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  /** PRNG determinista (mulberry32) para vetas de mármol reproducibles. */
  U.seeded = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.font = (px, weight) => `${weight || 'bold'} ${px}px "Courier New", ui-monospace, Consolas, monospace`;

  /**
   * Escala de alta resolución (High-DPI). El lienzo se dibuja siempre en coordenadas
   * lógicas (logicalW × logicalH) y el backing store usa devicePixelRatio para que el
   * pixel art quede 100 % nítido (imageSmoothingEnabled = false).
   */
  U.setupHighDPICanvas = function (canvas, cssW, cssH, logicalW, logicalH) {
    const dpr = U.clamp(global.devicePixelRatio || 1, 1, 3);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.setTransform(canvas.width / logicalW, 0, 0, canvas.height / logicalH, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return ctx;
  };

  /** Rectángulo redondeado (compatible con navegadores sin ctx.roundRect). */
  U.rrect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  /** Dibuja un sprite centrado en (cx, cy) con tamaño `size`, rotación y alfa opcionales. */
  U.sprite = function (ctx, img, cx, cy, size, rot, alpha) {
    if (!img) return;
    const w = size, h = size * ((img.height || 1) / (img.width || 1));
    if (alpha !== undefined && alpha !== 1) ctx.globalAlpha *= alpha;
    if (rot) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    }
    if (alpha !== undefined && alpha !== 1) ctx.globalAlpha /= alpha;
  };

  /** Dibuja una imagen de alta resolución (arte HD) con suavizado temporal. */
  U.imageSmooth = function (ctx, img, x, y, w, h) {
    if (!img) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, x, y, w, h);
    ctx.imageSmoothingEnabled = false;
  };

  /**
   * Fondo mesoamericano a pantalla completa (modo "cover"). Con `offsetX` ≠ 0 genera
   * un parallax horizontal sin costuras (las teselas impares se reflejan).
   */
  U.background = function (ctx, img, W, H, offsetX, dim) {
    if (!img) { ctx.fillStyle = '#060B1A'; ctx.fillRect(0, 0, W, H); return; }
    const scale = Math.max(W / img.width, H / img.height);
    const tw = img.width * scale, th = img.height * scale;
    const y = (H - th) / 2;
    const off = offsetX || 0;
    const startTile = Math.floor(-off / tw);
    for (let i = startTile; i * tw + off < W; i++) {
      const x = i * tw + off;
      if (x + tw < 0) continue;
      if (Math.abs(i) % 2 === 1) {
        ctx.save();
        ctx.translate(x + tw, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, tw, th);
        ctx.restore();
      } else {
        ctx.drawImage(img, x, y, tw, th);
      }
    }
    if (dim) { ctx.fillStyle = `rgba(3,5,12,${dim})`; ctx.fillRect(0, 0, W, H); }
  };

  /** Texto con contorno (legible sobre cualquier fondo). */
  U.text = function (ctx, str, x, y, o) {
    o = o || {};
    ctx.font = U.font(o.size || 16, o.weight);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    if (o.stroke !== false) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.strokeWidth || Math.max(3, (o.size || 16) / 5);
      ctx.strokeStyle = o.strokeColor || 'rgba(3,5,12,0.9)';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || '#FFE9A8';
    ctx.fillText(str, x, y);
  };

  /** Escala tipográfica relativa al tamaño real del lienzo lógico. */
  U.fs = (W, H, k) => Math.round(Math.min(W, H) * k);

  /**
   * Panel de fin de partida / victoria. Muestra el texto obligatorio
   * "👉 Toca la pantalla para reiniciar" con parpadeo.
   */
  U.gameOverPanel = function (ctx, W, H, o, time) {
    const m = Math.min(W, H);
    ctx.fillStyle = 'rgba(3,5,12,0.72)';
    ctx.fillRect(0, 0, W, H);

    const pw = Math.min(W - 24, m * 0.94), ph = Math.min(H - 24, m * 0.74);
    const px = (W - pw) / 2, py = (H - ph) / 2;
    const grad = ctx.createLinearGradient(0, py, 0, py + ph);
    grad.addColorStop(0, '#13204a');
    grad.addColorStop(1, '#0a1230');
    ctx.fillStyle = grad;
    U.rrect(ctx, px, py, pw, ph, 14);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#E8B84A';
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#8a6a22';
    U.rrect(ctx, px + 8, py + 8, pw - 16, ph - 16, 10);
    ctx.stroke();

    let y = py + ph * 0.17;
    if (o.newRecord) {
      const tr = A.img('trophy');
      const ts = Math.min(ph * 0.26, 96);
      const bob = Math.sin(time * 4) * 3;
      U.imageSmooth(ctx, tr, W / 2 - ts / 2, py + 10 + bob, ts, ts);
      y = py + 10 + ts + ph * 0.07;
    }
    U.text(ctx, o.title, W / 2, y, { size: Math.round(m * 0.075), align: 'center', color: o.titleColor || '#FFD86B' });
    y += m * 0.085;
    (o.lines || []).forEach((ln) => {
      U.text(ctx, ln, W / 2, y, { size: Math.round(m * 0.042), align: 'center', color: '#FFF3D0', strokeWidth: 3 });
      y += m * 0.058;
    });
    if (o.newRecord) {
      U.text(ctx, '★ ¡NUEVO RÉCORD! ★', W / 2, y, { size: Math.round(m * 0.048), align: 'center', color: '#7CFFB2' });
      y += m * 0.06;
    }
    const blink = 0.55 + 0.45 * Math.sin(time * 5);
    ctx.globalAlpha = blink;
    U.text(ctx, '👉 Toca la pantalla para reiniciar', W / 2, py + ph - m * 0.085, { size: Math.round(m * 0.04), align: 'center', color: '#FFFFFF' });
    ctx.globalAlpha = 1;
    U.text(ctx, 'o pulsa ENTER', W / 2, py + ph - m * 0.035, { size: Math.round(m * 0.028), align: 'center', color: '#C8B27A', stroke: false });
  };

  /** Sistema de partículas + textos flotantes ligero (objetos reutilizados por juego). */
  class Particles {
    constructor() { this.list = []; this.texts = []; }

    emit(x, y, o) {
      const n = o.count || 10;
      for (let i = 0; i < n && this.list.length < 500; i++) {
        const a = o.angle !== undefined ? o.angle + U.rand(-(o.spread || 0.5), o.spread || 0.5) : U.rand(0, Math.PI * 2);
        const sp = U.rand(o.speedMin !== undefined ? o.speedMin : 40, o.speed || 160);
        const life = U.rand((o.life || 0.7) * 0.6, o.life || 0.7);
        this.list.push({
          x: x + U.rand(-(o.jitter || 0), o.jitter || 0), y: y + U.rand(-(o.jitter || 0), o.jitter || 0),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life, max: life,
          size: U.rand(o.sizeMin || 2, o.size || 5),
          color: Array.isArray(o.colors) ? U.pick(o.colors) : (o.color || '#FFD86B'),
          grav: o.gravity || 0, grow: o.grow || 0, round: !!o.round, glow: !!o.glow
        });
      }
    }

    text(x, y, str, color, size) {
      if (this.texts.length > 30) this.texts.shift();
      this.texts.push({ x, y, str, color: color || '#FFE9A8', size: size || 20, life: 0.9, max: 0.9 });
    }

    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.life -= dt;
        if (p.life <= 0) { this.list.splice(i, 1); continue; }
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += p.grow * dt;
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        t.y -= 46 * dt;
        if (t.life <= 0) this.texts.splice(i, 1);
      }
    }

    draw(ctx) {
      for (const p of this.list) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.size / 2), 0, Math.PI * 2);
          ctx.fill();
        } else {
          const s = Math.max(1, Math.round(p.size));
          ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
        }
      }
      ctx.globalAlpha = 1;
      for (const t of this.texts) {
        ctx.globalAlpha = Math.min(1, (t.life / t.max) * 1.6);
        U.text(ctx, t.str, t.x, t.y, { size: t.size, color: t.color, align: 'center' });
      }
      ctx.globalAlpha = 1;
    }

    clear() { this.list.length = 0; this.texts.length = 0; }
  }
  U.Particles = Particles;
})(window);
