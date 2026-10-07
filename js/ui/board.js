/* FIFO FAFO — rendering di plancia, giocatori, ruota e log */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const UI = FF.UI;
  const { esc } = UI;
  const N = 9;

  UI.renderBoard = function (el, game, o) {
    o = o || {};
    const s = game.s, h = s.heafy;
    const m = game.curMood();
    let html = '';
    for (let pos = 0; pos < N; pos++) {
      const ang = (-90 + pos * 360 / N) * Math.PI / 180;
      const x = 50 + 38 * Math.cos(ang), y = 50 + 38 * Math.sin(ang);
      const r = game.room(pos);
      const res = s.res[pos].map((k) => FF.RES[k].i).join('');
      const toks = s.players.filter((p) => p.pos === pos).map((p) => `<span class="tok p${p.id}" title="${esc(p.name)}">${p.id + 1}</span>`).join('');
      const hh = h.pos === pos
        ? `<span class="tok h ${h.carriedBy != null ? 'carry' : ''}" title="Heafy">🐱${m.e}${h.carriedBy != null ? '🤲' : ''}${h.carry ? '<small>' + FF.RES[h.carry].i + '</small>' : ''}</span>` : '';
      const tgt = o.targets && o.targets.includes(pos) ? ' target' : '';
      html += `<div class="tile${h.pos === pos ? ' has-heafy' : ''}${tgt}" style="left:${x}%;top:${y}%"><span class="t-idx">${pos + 1}</span>
        <div class="t-name">${r.icon} ${r.name}</div><div class="t-res">${res || '&nbsp;'}</div><div class="t-tok">${toks}${hh}</div></div>`;
    }
    const dem = m.demand === 'any' ? 'qualsiasi risorsa' : m.demand === 'two' ? '2 risorse qualsiasi' : m.demand ? FF.RES[m.demand].i + ' ' + FF.RES[m.demand].n : 'nessuna pretesa';
    const sp = s.special === 'offesissimo' ? `<div class="sp-mood">😡 Offesissimo ${s.offStage === 'hit' ? '(colpirà al prossimo giro)' : '(si calma al prossimo giro)'}</div>`
      : s.special === 'arrabbiatissimo' ? '<div class="sp-mood">🔥 Arrabbiatissimo</div>' : '';
    const ov = s.override && !s.special ? `<div class="mood-d">(era ${FF.MOODS[s.wheel[s.wheelIdx]].e} ${FF.MOODS[s.wheel[s.wheelIdx]].name})</div>` : '';
    html += `<div class="core"><div class="mood-e">${m.e}</div><div class="mood-n">${m.name}</div><div class="mood-d">${dem}</div>${ov}
      <div class="dir">${h.dir > 0 ? '↻ orario' : '↺ antiorario'}</div>${sp}</div>`;
    el.innerHTML = html;
  };

  UI.renderPlayers = function (el, game, o) {
    o = o || {};
    const s = game.s;
    el.innerHTML = s.players.map((p) => {
      const active = o.active === p.id;
      const slots = [0, 1, 2].slice(0, game.rules.handLimit).map((i) => `<span class="slot ${p.hand[i] ? 'f' : ''}" title="${p.hand[i] ? FF.RES[p.hand[i]].n : 'vuoto'}">${p.hand[i] ? FF.RES[p.hand[i]].i : ''}</span>`).join('');
      const j2 = '✨'.repeat(p.j2) + `<span style="opacity:.3">${'✨'.repeat(Math.max(0, game.rules.j2Charges - p.j2))}</span>`;
      const kind = p.kind === 'ai' ? '🤖' : '👤';
      return `<div class="pbox p${p.id}${active ? ' active' : ''}">
        <div class="top"><span class="tok p${p.id}">${p.id + 1}</span><span class="nm">${kind} ${esc(p.name)}</span>
          <span class="chip">G${p.id + 1}</span><span class="pts">${p.pf - p.rancor}<small> netto</small></span></div>
        <div class="sub"><span>PF <b>${p.pf}</b></span><span>Rancori <b>${p.rancor}</b></span><span title="Cariche Jolly">J2 ${j2}</span><span class="hand">${slots}</span>
        ${s.heafy.carriedBy === p.id ? '<span>🐱 in braccio</span>' : ''}${p.interacted && s.phase === 'resolve' ? '<span>✔ interagito</span>' : ''}</div>
      </div>`;
    }).join('');
  };

  UI.renderWheel = function (el, game) {
    const s = game.s, n = s.wheel.length;
    let html = '<div class="wheel">';
    for (let k = 0; k < n; k++) {
      const idx = (s.wheelIdx + k) % n;
      const m = FF.MOODS[s.wheel[idx]];
      html += `<button class="wchip ${k === 0 ? 'cur' : ''}" data-mood="${m.id}" title="${esc(UI.MOOD_HELP[m.id])}">${k === 0 ? '▶ ' : ''}${m.e} ${m.name}</button>`;
    }
    html += '</div>';
    const dots = [0, 1, 2].map((i) => `<span class="dot ${i < s.arrab ? 'on' : ''}"></span>`).join('');
    html += `<div class="small muted" style="margin-top:8px">Counter Arrabbiatissimo <span class="dots">${dots}</span> ${s.arrab}/3 · prossimi mood in ordine dalla ruota</div>`;
    el.innerHTML = html;
    el.querySelectorAll('.wchip').forEach((b) => b.addEventListener('click', () => UI.moodHelp(b.dataset.mood)));
  };

  UI.moodHelp = function (id) {
    const m = FF.MOODS[id] || FF.SPECIAL[id];
    const d = UI.modal(`<div class="big">${m.e}</div><h2>${m.name}</h2><p class="mood-help">${esc(UI.MOOD_HELP[id])}</p><div class="btn-row end"><button class="btn primary" data-x>Ok</button></div>`);
    d.el.querySelector('[data-x]').onclick = d.close;
  };

  UI.logLine = function (ev) {
    const cls = ['le', ev.k, ev.p === 0 ? 'p0' : ev.p === 1 ? 'p1' : ''].join(' ');
    return `<div class="${cls}">${esc(ev.text)}</div>`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
