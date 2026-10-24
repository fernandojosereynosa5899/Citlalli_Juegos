/**
 * Interfaz HTML: modal de registro, selectores de dificultad/escenario, lobby de la sala,
 * tabla de líderes Top 10, botón de silencio y botonera D-Pad.
 */
(function (global) {
  'use strict';

  const A = (global.Arcade = global.Arcade || {});
  const C = A.CONFIG;
  const $ = (id) => document.getElementById(id);

  const UI = (A.ui = {
    topGame: 'snake',
    openModals: 0,

    init() {
      this.buildSelectors();
      this.buildLobby();
      this.buildWelcome();
      this.buildTopModal();
      this.buildDpad();

      $('btnHome').addEventListener('click', () => this.showLobby());
      $('btnTop').addEventListener('click', () => this.openTop(A.engine.gameId || this.topGame));
      $('btnMute').addEventListener('click', () => this.toggleMute());
      $('lobbyMarquee').src = A.assets.cabinetUrl('marquee');

      // Tras cualquier clic en botón, quita el foco para que ESPACIO/ENTER no lo vuelvan a activar.
      document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('button');
        if (b) b.blur();
      });

      A.store.onStatus(() => this.refreshNet());
      this.syncMute();
      this.refreshNet();
      this.refreshPlayerChip();
      this.syncSelectors();
    },

    /* ---------------------------------------------------------------- utilidades */
    avatarSprite(id) {
      const a = C.AVATARS.find((x) => x.id === id) || C.AVATARS[0];
      return a.sprite;
    },
    avatarUrl(id) { return A.assets.spriteUrl(this.avatarSprite(id)); },

    setModal(open) {
      this.openModals += open ? 1 : -1;
      if (this.openModals < 0) this.openModals = 0;
      A.engine.modalOpen = this.openModals > 0;
    },

    /* ---------------------------------------------------------------- silencio */
    syncMute() {
      const m = A.audio.muted;
      const b = $('btnMute');
      b.textContent = m ? '🔇' : '🔊';
      b.setAttribute('aria-pressed', String(m));
      b.title = (m ? 'Activar sonido' : 'Silenciar') + ' (M)';
    },
    toggleMute() {
      A.audio.unlock();
      const m = A.audio.toggle();
      A.store.setPref('muted', m);
      this.syncMute();
      if (!m) A.audio.play('hit');
    },

    /* ---------------------------------------------------------------- red */
    refreshNet() {
      const el = $('netBadge');
      let icon = '💾', txt = 'Modo local (RAM + localStorage)';
      if (A.store.online === true) { icon = '☁️'; txt = 'Conectado a la base de datos'; }
      else if (A.store.apiEnabled && A.store.online === false) { txt = 'Servidor sin respuesta · guardando localmente'; }
      if (A.store.pendingCount) txt += ` · ${A.store.pendingCount} pendiente(s)`;
      el.textContent = icon;
      el.title = txt;
      const note = $('topNet');
      if (note) note.textContent = icon + ' ' + txt;
    },

    /* ---------------------------------------------------------------- jugador */
    refreshPlayerChip() {
      const p = A.store.player;
      $('chipName').textContent = p ? p.name : '--------';
      const img = $('chipAvatar');
      if (p) { img.src = this.avatarUrl(p.avatar); img.hidden = false; } else { img.hidden = true; }
    },

    buildWelcome() {
      const grid = $('avatarGrid');
      C.AVATARS.forEach((a, i) => {
        const lab = document.createElement('label');
        lab.className = 'avatar-opt';
        lab.innerHTML = `<input type="radio" name="avatar" value="${a.id}" ${i === 0 ? 'checked' : ''}><img alt="${a.label}" src="${A.assets.spriteUrl(a.sprite)}"><span>${a.label}</span>`;
        grid.appendChild(lab);
      });

      const input = $('nameInput');
      const count = $('nameCount');
      const btn = $('btnEnter');
      const refresh = () => {
        const clean = A.store.sanitizeName(input.value);
        if (input.value !== clean) input.value = clean; // sanitizado en vivo
        count.textContent = `${clean.length}/${C.NAME_MAX}`;
        btn.disabled = clean.length < 1;
      };
      input.addEventListener('input', refresh);
      input.addEventListener('compositionend', refresh);
      input.setAttribute('maxlength', String(C.NAME_MAX));
      refresh();

      $('welcomeForm').addEventListener('submit', (e) => {
        e.preventDefault();
        A.audio.unlock();
        const av = (document.querySelector('input[name="avatar"]:checked') || {}).value || 'bottle';
        const p = A.store.registerPlayer(input.value, av);
        if (!p) return;
        this.closeWelcome();
        A.audio.play('power');
      });
    },

    openWelcome() {
      $('welcome').hidden = false;
      this.setModal(true);
      setTimeout(() => { try { $('nameInput').focus(); } catch (e) { /* ignorar */ } }, 80);
    },

    closeWelcome() {
      $('welcome').hidden = true;
      this.setModal(false);
      this.refreshPlayerChip();
      this.showLobby();
    },

    /* ---------------------------------------------------------------- selectores */
    buildSelectors() {
      const diff = $('diffSeg');
      C.DIFFICULTIES.forEach((d) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'seg-btn';
        b.dataset.id = d.id;
        b.innerHTML = `<span class="long">${d.label}</span><span class="short">${d.short}</span>`;
        b.title = d.label.replace(/^\S+\s/, '');
        b.addEventListener('click', () => {
          A.store.setPref('difficulty', d.id);
          this.syncSelectors();
          if (A.engine.game && A.engine.game.onSettingsChange) A.engine.game.onSettingsChange('difficulty');
          this.refreshBest();
        });
        diff.appendChild(b);
      });

      const sc = $('scenSeg');
      Object.keys(C.SCENARIOS).forEach((id) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'seg-btn scen';
        b.dataset.id = id;
        b.title = C.SCENARIOS[id].label;
        b.setAttribute('aria-label', C.SCENARIOS[id].label);
        b.innerHTML = `<img alt="" src="${A.assets.scenarioUrl(id)}">`;
        b.addEventListener('click', () => {
          A.store.setPref('scenario', id); // cambio "al vuelo": no reinicia la partida
          this.syncSelectors();
          if (A.engine.game && A.engine.game.onSettingsChange) A.engine.game.onSettingsChange('scenario');
        });
        sc.appendChild(b);
      });
    },

    syncSelectors() {
      const p = A.store.prefs;
      document.querySelectorAll('#diffSeg .seg-btn').forEach((b) => b.classList.toggle('on', b.dataset.id === p.difficulty));
      document.querySelectorAll('#scenSeg .seg-btn').forEach((b) => b.classList.toggle('on', b.dataset.id === p.scenario));
    },

    /* ---------------------------------------------------------------- lobby */
    buildLobby() {
      const grid = $('lobbyGrid');
      C.GAMES.forEach((g) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'game-card';
        b.dataset.game = g.id;
        b.innerHTML = `<img alt="" src="${A.assets.spriteUrl(g.icon)}"><strong>${g.name}</strong><small>${g.desc}</small><em data-best="${g.id}"></em>`;
        b.addEventListener('click', () => { A.audio.unlock(); A.audio.play('hit'); this.startGame(g.id); });
        grid.appendChild(b);
      });
    },

    showLobby() {
      A.engine.leave();
      $('lobby').hidden = false;
      $('dpad').hidden = true;
      $('gameTitle').textContent = 'SALA ARCADE';
      this.refreshBest();
    },

    startGame(id) {
      $('lobby').hidden = true;
      const g = C.GAMES.find((x) => x.id === id);
      $('gameTitle').textContent = g ? g.name : '';
      this.topGame = id;
      A.engine.start(id);
      $('dpad').hidden = id !== 'snake';
    },

    refreshBest() {
      document.querySelectorAll('[data-best]').forEach((el) => {
        const id = el.dataset.best;
        const b = A.store.bestFor(id);
        const g = C.GAMES.find((x) => x.id === id);
        el.textContent = b === null ? 'Sin récord' : `★ ${b} ${g.unit}`;
      });
    },

    /* ---------------------------------------------------------------- Top 10 */
    buildTopModal() {
      $('trophyImg').src = A.assets.cabinetUrl('trophy');
      const tabs = $('topTabs');
      C.GAMES.forEach((g) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tab';
        b.dataset.game = g.id;
        b.textContent = g.name;
        b.addEventListener('click', () => this.loadTop(g.id));
        tabs.appendChild(b);
      });
      $('btnCloseTop').addEventListener('click', () => this.closeTop());
      $('topModal').addEventListener('pointerdown', (e) => { if (e.target === $('topModal')) this.closeTop(); });
      global.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('topModal').hidden) this.closeTop(); });
    },

    openTop(gameId) {
      if (!$('topModal').hidden) return;
      $('topModal').hidden = false;
      this.setModal(true);
      this.loadTop(gameId || 'snake');
    },

    closeTop() {
      if ($('topModal').hidden) return;
      $('topModal').hidden = true;
      this.setModal(false);
    },

    async loadTop(gameId) {
      this.topGame = gameId;
      document.querySelectorAll('#topTabs .tab').forEach((t) => t.classList.toggle('on', t.dataset.game === gameId));
      const list = $('topList');
      list.textContent = '';
      const loading = document.createElement('li');
      loading.className = 'empty';
      loading.textContent = 'Consultando…';
      list.appendChild(loading);

      const res = await A.store.fetchTop(gameId);
      if (this.topGame !== gameId) return; // el usuario cambió de pestaña
      const g = C.GAMES.find((x) => x.id === gameId);
      const me = A.store.player ? A.store.player.name : null;
      list.textContent = '';
      if (!res.rows.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'Aún no hay récords. ¡Sé el primero!';
        list.appendChild(li);
      }
      res.rows.forEach((r, i) => {
        const li = document.createElement('li');
        if (r.username === me) li.className = 'me';
        const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
        const img = document.createElement('img'); img.alt = ''; img.src = this.avatarUrl(r.avatar);
        const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.username;
        const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = `${r.valor} ${g.unit}`;
        li.append(pos, img, nm, sc);
        list.appendChild(li);
      });
      this.refreshNet();
    },

    /* ---------------------------------------------------------------- D-Pad táctil */
    buildDpad() {
      document.querySelectorAll('#dpad button').forEach((b) => {
        const fire = (e) => {
          e.preventDefault();
          e.stopPropagation();
          A.audio.unlock();
          const g = A.engine.game;
          if (!g || A.engine.modalOpen) return;
          if (g.state === 'over') { if (A.engine.canRestart(g)) g.restart(); return; }
          const d = b.dataset.dir;
          const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
          if (g.setDir) g.setDir(v[0], v[1]);
        };
        b.addEventListener('pointerdown', fire, { passive: false });
      });
    }
  });
})(window);
