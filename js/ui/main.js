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
    else if (where === 'net-host') UI.netHost();
    else if (where === 'net-join') UI.netJoin();
    else UI.openSetup(where);
  };

  function renderResume() {
    const box = $('#resume-box');
    const sv = UI.store.get('save', null);
    const ns = UI.store.get('net_save', null);
    const netHtml = ns && ns.players ? `<div class="card" style="border-color:var(--accent2)"><h2>📡 Partita in rete in sospeso</h2>
      <p class="small muted" style="margin-bottom:10px">${esc(ns.players[ns.mySeat].name)} (tu, tavolo) vs ${esc(ns.players[1 - ns.mySeat].name)} · turno ${Math.min(ns.turn || 1, 15)} · l'altro giocatore deve rientrare con lo stesso nome</p>
      <div class="btn-row"><button class="btn primary" id="nrs-go">▶ Riapri la stanza</button><button class="btn danger" id="nrs-del">Elimina</button></div></div>` : '';
    if (!sv || !sv.cfg) {
      box.innerHTML = netHtml;
      if (netHtml) { $('#nrs-go').onclick = () => UI.netHost(ns); $('#nrs-del').onclick = () => { UI.store.del('net_save'); renderResume(); }; }
      return;
    }
    const names = sv.cfg.players.map((p) => esc(p.name)).join(' vs ');
    box.innerHTML = `<div class="card" style="border-color:var(--accent2)"><h2>💾 Partita in corso</h2>
      <p class="small muted" style="margin-bottom:10px">${names} · turno ${Math.min(sv.turn || 1, sv.cfg.rules.turns || 15)} · seed ${esc(sv.cfg.seed)}</p>
      <div class="btn-row"><button class="btn primary" id="rs-go">▶ Riprendi</button><button class="btn danger" id="rs-del">Elimina</button></div></div>`;
    $('#rs-go').onclick = () => { UI.startSession(Object.assign({}, sv.cfg, { speed: sv.cfg.speed || 'normal' }), sv.history); };
    $('#rs-del').onclick = () => { UI.store.del('save'); renderResume(); };
    if (netHtml) { box.insertAdjacentHTML('beforeend', netHtml); $('#nrs-go').onclick = () => UI.netHost(ns); $('#nrs-del').onclick = () => { UI.store.del('net_save'); renderResume(); }; }
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
    const jc = new URLSearchParams(location.search).get('join');
    if (jc) UI.netJoin(jc);
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  });
})(typeof window !== 'undefined' ? window : globalThis);
