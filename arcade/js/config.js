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
      { id: 'facil', label: '🟢 Fácil', short: '🟢' },
      { id: 'medio', label: '🟡 Medio', short: '🟡' },
      { id: 'dificil', label: '🔴 Difícil', short: '🔴' }
    ],

    /** Parámetros por juego y dificultad (velocidad, aperturas, tiempos). */
    TUNING: {
      snake: {
        // pasos/seg iniciales, aceleración por segmento, ¿las paredes atraviesan?, obstáculos
        facil: { speed: 6.5, accel: 0.10, wrap: true, initObs: 1, maxObs: 3, obsStep: 800 },
        medio: { speed: 9, accel: 0.14, wrap: false, initObs: 2, maxObs: 5, obsStep: 600 },
        dificil: { speed: 12, accel: 0.20, wrap: false, initObs: 4, maxObs: 7, obsStep: 500 }
      },
      flappy: {
        // apertura entre columnas, velocidad horizontal, separación entre columnas
        facil: { gap: 215, speed: 135, spacing: 360 },
        medio: { gap: 178, speed: 175, spacing: 340 },
        dificil: { gap: 150, speed: 215, spacing: 320 }
      },
      memorama: {
        // peek: segundos que se muestran las cartas al inicio; flipBack: segundos antes de voltear un fallo
        facil: { peek: 3.5, flipBack: 1.1 },
        medio: { peek: 1.8, flipBack: 0.8 },
        dificil: { peek: 0, flipBack: 0.55 }
      },
      reflejos: {
        // vida del orbe (s), orbes simultáneos máx., intervalo de aparición (s), prob. de frasco con humo
        facil: { life: 2.5, maxActive: 2, interval: 0.95, hazard: 0.15 },
        medio: { life: 1.9, maxActive: 3, interval: 0.75, hazard: 0.25 },
        dificil: { life: 1.4, maxActive: 4, interval: 0.6, hazard: 0.33 }
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
