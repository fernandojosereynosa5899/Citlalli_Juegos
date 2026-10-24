/**
 * Sintetizador de sonido con Web Audio API (osciladores nativos, sin archivos de audio).
 * Eventos: jump, point, hit, collide, win, power, flip, match, hazard, tick.
 * Botón 🔊/🔇 y tecla M (ver ui.js / input.js).
 */
(function (global) {
  'use strict';

  const A = (global.Arcade = global.Arcade || {});

  const FX = {
    ctx: null,
    master: null,
    muted: false,
    noiseBuf: null,

    /** Crea el AudioContext de forma perezosa (los navegadores exigen un gesto del usuario). */
    unlock() {
      try {
        if (!this.ctx) {
          const AC = global.AudioContext || global.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.muted ? 0 : 0.5;
          this.master.connect(this.ctx.destination);
          const len = this.ctx.sampleRate * 0.4;
          this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = this.noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { /* sin audio: el juego continúa */ }
    },

    setMuted(m) {
      this.muted = !!m;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    },

    toggle() { this.setMuted(!this.muted); return this.muted; },

    tone(freq, dur, type, vol, slideTo, delay) {
      if (!this.ctx || this.muted) return;
      try {
        const t0 = this.ctx.currentTime + (delay || 0);
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, t0);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(this.master);
        o.start(t0); o.stop(t0 + dur + 0.02);
      } catch (e) { /* ignorar */ }
    },

    noise(dur, vol, delay) {
      if (!this.ctx || this.muted || !this.noiseBuf) return;
      try {
        const t0 = this.ctx.currentTime + (delay || 0);
        const s = this.ctx.createBufferSource();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 900;
        s.buffer = this.noiseBuf;
        g.gain.setValueAtTime(vol || 0.2, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        s.connect(f); f.connect(g); g.connect(this.master);
        s.start(t0); s.stop(t0 + dur);
      } catch (e) { /* ignorar */ }
    },

    play(name) {
      switch (name) {
        case 'jump': this.tone(380, 0.13, 'square', 0.1, 820); break;
        case 'point': this.tone(880, 0.07, 'triangle', 0.16); this.tone(1320, 0.1, 'triangle', 0.16, null, 0.07); break;
        case 'hit': this.tone(520, 0.09, 'sine', 0.2, 1040); break;
        case 'power': [523, 659, 784, 1047, 1318].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.17, null, i * 0.07)); break;
        case 'collide': this.tone(240, 0.38, 'sawtooth', 0.18, 50); this.noise(0.3, 0.3); break;
        case 'hazard': this.tone(140, 0.25, 'square', 0.16, 70); this.noise(0.2, 0.2); break;
        case 'win': [523, 659, 784, 1047, 784, 1047, 1318].forEach((f, i) => this.tone(f, 0.17, 'triangle', 0.18, null, i * 0.11)); break;
        case 'flip': this.tone(420, 0.05, 'square', 0.07, 640); break;
        case 'match': this.tone(700, 0.1, 'triangle', 0.18); this.tone(1050, 0.16, 'triangle', 0.18, null, 0.09); break;
        case 'tick': this.tone(1000, 0.04, 'square', 0.06); break;
        default: break;
      }
    }
  };

  A.audio = FX;
})(window);
