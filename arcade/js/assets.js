/**
 * Cargador de recursos locales (sprites, escenarios, gabinete).
 * Resiliente: si una imagen falta, se sustituye por un marcador y el juego continúa.
 */
(function (global) {
  'use strict';

  const A = (global.Arcade = global.Arcade || {});
  const images = {};

  function placeholder() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#2a1a4a'; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = '#E8B84A'; x.lineWidth = 4; x.strokeRect(2, 2, 60, 60);
    x.fillStyle = '#E8B84A'; x.font = 'bold 36px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('?', 32, 34);
    return c;
  }

  function loadOne(name, url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images[name] = img; resolve(true); };
      img.onerror = () => { images[name] = placeholder(); resolve(false); };
      img.src = url;
    });
  }

  A.assets = {
    /** URL pública (para <img> del DOM) de un sprite. */
    spriteUrl: (name) => A.CONFIG.ASSET_BASE + A.CONFIG.SPRITES[name],
    scenarioUrl: (id) => A.CONFIG.ASSET_BASE + A.CONFIG.SCENARIOS[id].file,
    cabinetUrl: (name) => A.CONFIG.ASSET_BASE + A.CONFIG.CABINET[name],

    /** Carga todo en paralelo y notifica progreso 0..1. Nunca rechaza. */
    load(onProgress) {
      const C = A.CONFIG;
      const jobs = [];
      Object.keys(C.SPRITES).forEach((k) => jobs.push([k, C.ASSET_BASE + C.SPRITES[k]]));
      Object.keys(C.SCENARIOS).forEach((k) => jobs.push(['bg_' + k, C.ASSET_BASE + C.SCENARIOS[k].file]));
      Object.keys(C.CABINET).forEach((k) => jobs.push([k, C.ASSET_BASE + C.CABINET[k]]));
      let done = 0;
      return Promise.all(jobs.map(([n, u]) => loadOne(n, u).then(() => {
        done++;
        if (onProgress) onProgress(done / jobs.length);
      })));
    }
  };

  /** Acceso rápido: A.img('mandarin'), A.img('bg_hidalgo'), A.img('trophy'). */
  A.img = (name) => images[name] || null;
})(window);
