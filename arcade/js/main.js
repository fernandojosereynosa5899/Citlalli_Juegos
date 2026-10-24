/**
 * Arranque de la Sala Arcade CITLALLI.
 * Orden: persistencia → audio → recursos locales → UI → motor → registro de jugador / lobby.
 */
(function (global) {
  'use strict';

  const A = (global.Arcade = global.Arcade || {});

  function boot() {
    const loading = document.getElementById('loading');
    const bar = document.getElementById('loadBar');

    A.store.init();
    A.audio.setMuted(A.store.prefs.muted);

    A.assets.load((p) => { bar.style.width = Math.round(p * 100) + '%'; }).then(() => {
      A.ui.init();
      A.engine.init();
      loading.hidden = true;
      if (A.store.player) A.ui.showLobby(); else { A.ui.showLobby(); A.ui.openWelcome(); }
    }).catch((e) => {
      console.error('[boot]', e);
      loading.querySelector('p').textContent = 'No se pudo iniciar. Recarga la página.';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
