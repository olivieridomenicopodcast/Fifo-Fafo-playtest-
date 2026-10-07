/* FIFO FAFO — rendering di plancia illustrata, giocatori, ruota e log */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const UI = FF.UI;
  const SP = FF.Sprites;
  const { esc } = UI;
  const N = 9;
  const R = 39.5; // raggio dell'anello (% della plancia)

  const demandTxt = (m) => (m.demand === 'any' ? 'qualsiasi' : m.demand === 'two' ? '2 qualsiasi' : m.demand ? FF.RES[m.demand].n : 'nessuna pretesa');
  UI.demandTxt = demandTxt;

  // piccole frecce orarie tra le stanze + anello
  function ringSVG() {
    let s = `<svg class="ringsvg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" fill="none" stroke="#ffe7b8" stroke-opacity=".5" stroke-width="1.6" stroke-dasharray="1 2.4" stroke-linecap="round"/>`;
    for (let i = 0; i < N; i++) {
      const a = (-90 + (i + 0.5) * 360 / N) * Math.PI / 180;
      const x = 50 + R * Math.cos(a), y = 50 + R * Math.sin(a), rot = (a * 180 / Math.PI) + 90;
      s += `<path d="M-1.6 1.4 L0 -1.6 L1.6 1.4" transform="translate(${x} ${y}) rotate(${rot})" fill="none" stroke="#ffe7b8" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return s + '</svg>';
  }

  UI.renderBoard = function (el, game, o) {
    o = o || {};
    const s = game.s, h = s.heafy;
    const m = game.curMood();
    let html = ringSVG();
    for (let pos = 0; pos < N; pos++) {
      const ang = (-90 + pos * 360 / N) * Math.PI / 180;
      const x = 50 + R * Math.cos(ang), y = 50 + R * Math.sin(ang);
      const r = game.room(pos);
      const res = s.res[pos].map((k) => SP.res(k, 'res')).join('');
      const pawns = s.players.filter((p) => p.pos === pos).map((p) => `<span class="pw" title="${esc(p.name)}">${SP.pawn(p.id)}<i>${p.id + 1}</i></span>`).join('');
      const cat = h.pos === pos ? `<span class="hf" title="Heafy">${SP.cat(m.id)}${h.carry ? '<small>' + SP.res(h.carry) + '</small>' : ''}</span>` : '';
      const tgt = o.targets && o.targets.includes(pos) ? ' target' : '';
      html += `<div class="tile${h.pos === pos ? ' has-heafy' : ''}${tgt}" style="left:${x}%;top:${y}%"><span class="tidx">${pos + 1}</span>
        <div class="art">${SP.room(r.id)}</div><div class="tres">${res}</div><div class="tfig">${pawns}${cat}</div><div class="tname">${r.name}</div></div>`;
    }
    const sp = s.special === 'offesissimo' ? `<div class="spchip">${s.offStage === 'hit' ? 'Colpirà al prossimo giro!' : 'Si calma presto'}</div>` : s.special === 'arrabbiatissimo' ? '<div class="spchip">Finché non gli dai 2 risorse!</div>' : '';
    const dem = m.demand && m.demand !== 'any' && m.demand !== 'two' ? SP.res(m.demand) : '';
    html += `<div class="core"><div class="rugwrap">${SP.use('rug')}<div class="bigcat">${SP.cat(m.id)}</div>
      <span class="dirchip">${h.dir > 0 ? '↻ orario' : '↺ antiorario'}</span>${sp}
      <div class="banner"><b>${m.name}</b><span>${dem}${demandTxt(m)}</span></div></div></div>`;
    el.innerHTML = html;
  };

  UI.renderPlayers = function (el, game, o) {
    o = o || {};
    const s = game.s;
    el.innerHTML = s.players.map((p) => {
      const active = o.active === p.id;
      const slots = Array.from({ length: game.rules.handLimit }, (_, i) => `<span class="hslot" title="${p.hand[i] ? FF.RES[p.hand[i]].n : 'vuoto'}">${p.hand[i] ? SP.res(p.hand[i]) : SP.use('slot')}</span>`).join('');
      const stars = Array.from({ length: game.rules.j2Charges }, (_, i) => `<span class="ic" style="${i < p.j2 ? '' : 'opacity:.25;filter:grayscale(1)'}">${SP.use('star')}</span>`).join('');
      const kind = p.kind === 'ai' ? '🤖' : '👤';
      return `<div class="pbox p${p.id}${active ? ' active' : ''}">
        <span class="pw">${SP.pawn(p.id)}<i>${p.id + 1}</i></span>
        <div class="body"><div class="top"><span class="nm">${kind} ${esc(p.name)}</span><span class="chip">G${p.id + 1}</span>
          <span class="score" title="Punteggio netto (PF − Rancori)">${SP.use('star')}${p.pf - p.rancor}</span></div>
        <div class="sub"><span>PF <b>${p.pf}</b></span><span class="ic" title="Rancori (−1 a fine partita)">${SP.use('rancor')}<b>${p.rancor}</b></span><span class="ic" title="Cariche del Jolly J2">J2 ${stars}</span></div>
        <div class="sub"><span class="hand">${slots}</span>
        ${s.heafy.carriedBy === p.id ? '<span>🐱 in braccio</span>' : ''}${p.interacted && s.phase === 'resolve' ? '<span>✔ ha interagito</span>' : ''}</div></div>
      </div>`;
    }).join('');
  };

  UI.renderWheel = function (el, game) {
    const s = game.s, n = s.wheel.length;
    let html = '<div class="wheel">';
    for (let k = 0; k < n; k++) {
      const idx = (s.wheelIdx + k) % n;
      const m = FF.MOODS[s.wheel[idx]];
      html += `<button class="wchip ${k === 0 ? 'cur' : ''}" data-mood="${m.id}">${SP.cat(m.id)}${m.name}</button>`;
    }
    html += '</div>';
    const dots = [0, 1, 2].map((i) => `<span class="dot ${i < s.arrab ? 'on' : ''}"></span>`).join('');
    html += `<div class="small muted" style="margin-top:10px"><b>Counter Arrabbiatissimo</b> <span class="dots">${dots}</span> ${s.arrab}/3 · la ruota continua nell'ordine mostrato</div>`;
    el.innerHTML = html;
    el.querySelectorAll('.wchip').forEach((b) => b.addEventListener('click', () => UI.moodHelp(b.dataset.mood)));
  };

  UI.moodHelp = function (id) {
    const m = FF.MOODS[id] || FF.SPECIAL[id];
    const d = UI.modal(`<div class="bigcat">${SP.cat(id)}</div><h2>${m.name}</h2><p class="mood-help">${esc(UI.MOOD_HELP[id])}</p><div class="btn-row end" style="margin-top:12px"><button class="btn primary" data-x>Ok</button></div>`);
    d.el.querySelector('[data-x]').onclick = d.close;
  };

  UI.logLine = function (ev) {
    const cls = ['le', ev.k, ev.p === 0 ? 'p0' : ev.p === 1 ? 'p1' : ''].join(' ');
    return `<div class="${cls}">${esc(ev.text)}</div>`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
