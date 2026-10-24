/**
 * CITLALLI · Sala Arcade — configuración global.
 *
 * Todo el arcade cuelga del espacio de nombres `window.Arcade` (scripts clásicos,
 * sin módulos ES) para que funcione igual abriendo `index.html` con doble clic
 * (file://) que servido desde `server/server.js`.
 */
(function (global) {
  'use strict';

  const A = (global.Arcade = global.Arcade || {});

  A.CONFIG = {
    /** Carpeta de recursos, relativa a /arcade/index.html */
    ASSET_BASE: '../pixel-art/',
    /** Endpoint REST opcional (PostgreSQL). Si falla, el juego sigue en RAM + localStorage. */
    API_URL: '/api/records',
    /** Timeout duro de toda llamada a la API (requisito: 3.5 s). */
    API_TIMEOUT_MS: 3500,
    /** Segundos de espera antes de reintentar la API tras un fallo. */
    API_RETRY_COOLDOWN_MS: 15000,
    NAME_MAX: 8,
    /** La dimensión menor del lienzo lógico siempre mide esto (el resto se adapta a la pantalla). */
    DESIGN_MIN: 540,
    /** Tiempo tras el fin de partida durante el cual un toque NO reinicia (evita reinicios accidentales). */
    OVER_LOCK_MS: 450,

    SPRITES: {
      bottle_citlalli: 'sprites/bottle_citlalli.png',
      bottle_winged: 'sprites/bottle_winged.png',
      charm_qm: 'sprites/charm_qm.png',
      jaguar_gold: 'sprites/jaguar_gold.png',
      star_citlalli: 'sprites/star_citlalli.png',
      mandarin: 'sprites/mandarin.png',
      rose_pink: 'sprites/rose_pink.png',
      jasmine_white: 'sprites/jasmine_white.png',
      vanilla_pod: 'sprites/vanilla_pod.png',
      amber_crystal: 'sprites/amber_crystal.png',
      clay_vessel: 'sprites/clay_vessel.png',
      snake_head_gold: 'sprites/snake_head_gold.png',
      snake_head_rosegold: 'sprites/snake_head_rosegold.png',
      smoke_hazard: 'sprites/smoke_hazard.png',
      card_back_velvet: 'sprites/card_back_velvet.png'
    },

    SCENARIOS: {
      hidalgo: { label: 'Noche en Hidalgo', file: 'scenarios/scenario_hidalgo.png', tint: '#060B1A' },
      jaguar: { label: 'Cueva del Jaguar', file: 'scenarios/scenario_jaguar.png', tint: '#120A05' },
      velvet: { label: 'Atelier Velvet', file: 'scenarios/scenario_velvet.png', tint: '#091124' },
      penthouse: { label: 'Penthouse Cósmico', file: 'scenarios/scenario_penthouse.png', tint: '#05070F' }
    },

    /** Imágenes sueltas del gabinete. */
    CABINET: {
      marquee: 'cabinet/citlalli_arcade_marquee.png',
      trophy: 'cabinet/citlalli_trophy_emblem.png'
    },

    /** Avatares oficiales (id → sprite). */
    AVATARS: [
      { id: 'bottle', sprite: 'bottle_citlalli', label: 'Frasco' },
      { id: 'charm_qm', sprite: 'charm_qm', label: 'Dije QM' },
      { id: 'jaguar', sprite: 'jaguar_gold', label: 'Jaguar' },
      { id: 'star', sprite: 'star_citlalli', label: 'Estrella' },
      { id: 'rose', sprite: 'rose_pink', label: 'Rosa' },
      { id: 'amber', sprite: 'amber_crystal', label: 'Ámbar' }
    ],

    DIFFICULTIES: [
      { id: 'facil', label: '🟢 Fácil · 1x', short: '🟢 1x' },
      { id: 'medio', label: '🟡 Medio · 1.5x', short: '🟡 1.5x' },
      { id: 'dificil', label: '🔴 Difícil · 2.5x', short: '🔴 2.5x' }
    ],

    /** Parámetros por juego y dificultad (velocidad, aperturas, tiempos y multiplicadores de recompensa). */
    TUNING: {
      snake: {
        // pasos/seg iniciales, aceleración por segmento, ¿las paredes atraviesan?, obstáculos, multiplicador de puntos
        facil:   { speed: 6.5,  accel: 0.10, wrap: true,  initObs: 1, maxObs: 3, obsStep: 800, scoreMult: 1.0 },
        medio:   { speed: 10.0, accel: 0.16, wrap: false, initObs: 3, maxObs: 6, obsStep: 500, scoreMult: 1.5 },
        dificil: { speed: 13.5, accel: 0.22, wrap: false, initObs: 5, maxObs: 9, obsStep: 380, scoreMult: 2.5 }
      },
      flappy: {
        // apertura entre columnas, velocidad horizontal, separación entre columnas, puntos por columna, bonus dije
        facil:   { gap: 215, speed: 135, spacing: 360, ptsPerCol: 1, charmBonus: 2,  scoreMult: 1.0 },
        medio:   { gap: 168, speed: 185, spacing: 325, ptsPerCol: 2, charmBonus: 6,  scoreMult: 1.5 },
        dificil: { gap: 140, speed: 230, spacing: 295, ptsPerCol: 4, charmBonus: 12, scoreMult: 2.5 }
      },
      memorama: {
        // peek: segundos que se muestran las cartas al inicio; flipBack: segundos antes de voltear un fallo; streakBonus
        facil:   { peek: 3.5, flipBack: 1.10, streakBonus: 0, scoreMult: 1.0 },
        medio:   { peek: 1.4, flipBack: 0.70, streakBonus: 1, scoreMult: 1.5 },
        dificil: { peek: 0.0, flipBack: 0.45, streakBonus: 1, scoreMult: 2.5 }
      },
      reflejos: {
        // vida del orbe (s), orbes simultáneos máx., intervalo de aparición (s), prob. de frasco con humo, multiplicador
        facil:   { life: 2.5, maxActive: 2, interval: 0.95, hazard: 0.15, scoreMult: 1.0 },
        medio:   { life: 1.6, maxActive: 4, interval: 0.65, hazard: 0.28, scoreMult: 1.6 },
        dificil: { life: 1.2, maxActive: 5, interval: 0.48, hazard: 0.38, scoreMult: 2.5 }
      }
    },

    GAMES: [
      { id: 'snake', icon: 'snake_head_gold', name: 'La Víborita', desc: 'Devora la pirámide olfativa.', unit: 'pts' },
      { id: 'flappy', icon: 'bottle_winged', name: 'Flappy Citlalli', desc: 'Vuela entre columnas de jaguar.', unit: 'pts' },
      { id: 'memorama', icon: 'card_back_velvet', name: 'Memorama Atelier', desc: 'Memoria olfativa · 10 pares.', unit: 'intentos' },
      { id: 'reflejos', icon: 'smoke_hazard', name: 'Reflejos', desc: 'Destilación alquímica · 20 s.', unit: 'pts' }
    ]
  };

  A.games = A.games || {};
})(window);
