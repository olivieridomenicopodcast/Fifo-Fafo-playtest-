/* FIFO FAFO — avvio, navigazione, ripresa partita, service worker */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const UI = FF.UI;
  const { $, esc } = UI;

  UI.go = function (where) {
    if (UI.session) { UI.session.dispose(); UI.session = null; }
    $('#modal-root').innerHTML = '';
    if (where === 'home') { UI.screen('home'); renderResume(); }
    else if (where === 'sim') UI.openSim();
    else if (where === 'rules') UI.openRules();
    else UI.openSetup(where);
  };

  function renderResume() {
    const box = $('#resume-box');
    const sv = UI.store.get('save', null);
    if (!sv || !sv.cfg) { box.innerHTML = ''; return; }
    const names = sv.cfg.players.map((p) => esc(p.name)).join(' vs ');
    box.innerHTML = `<div class="card" style="border-color:var(--accent2)"><h2>💾 Partita in corso</h2>
      <p class="small muted" style="margin-bottom:10px">${names} · turno ${Math.min(sv.turn || 1, sv.cfg.rules.turns || 15)} · seed ${esc(sv.cfg.seed)}</p>
      <div class="btn-row"><button class="btn primary" id="rs-go">▶ Riprendi</button><button class="btn danger" id="rs-del">Elimina</button></div></div>`;
    $('#rs-go').onclick = () => { UI.startSession(Object.assign({}, sv.cfg, { speed: sv.cfg.speed || 'normal' }), sv.history); };
    $('#rs-del').onclick = () => { UI.store.del('save'); renderResume(); };
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('afterbegin', FF.Sprites.sheet());
    $('#logo-cat').innerHTML = FF.Sprites.cat('neutro');
    document.querySelectorAll('[data-cat]').forEach((e) => { e.outerHTML = FF.Sprites.cat(e.dataset.cat); });
    $('#hero-stage').innerHTML = `<div class="bg">${FF.Sprites.room('camera')}</div><div class="cat">${FF.Sprites.cat('assonnato')}</div>`;
    $('#btn-home').onclick = () => UI.go('home');
    $('#btn-rules').onclick = () => UI.go('rules');
    document.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => UI.go(b.dataset.mode)));
    renderResume();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  });
})(typeof window !== 'undefined' ? window : globalThis);
