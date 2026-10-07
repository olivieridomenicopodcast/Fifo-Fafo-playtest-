/* FIFO FAFO — rendering di plancia illustrata, giocatori, ruota e log */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const UI = FF.UI;
  const SP = FF.Sprites;
  const { esc } = UI;
  const N = 9;
  const R = 39.5; // raggio dell'anello (% della plancia)

  const demandTxt = (m) => (m.id === 'offesissimo' ? 'non accetta niente' : m.demand === 'any' ? 'qualsiasi' : m.demand === 'two' ? '2 qualsiasi' : m.demand ? FF.RES[m.demand].n : 'nessuna pretesa');
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

  // ── ruota dei mood: una vera ruota che gira, con il mood attuale in alto ──
  const WCOL = ['#ffd9a8', '#cfe8c0', '#c9dcf2', '#f6c9d4', '#fff0a8', '#e1d0f0', '#d7ecdf', '#ffcfb0', '#c8e6ee', '#f3dcb0'];
  const demandSprite = (m) => (m.demand && m.demand !== 'any' && m.demand !== 'two' ? SP.res(m.demand) : '');
  const demandLine = (m) => {
    if (m.id === 'offesissimo') return '<span><b>niente</b>: non accetta nulla</span>';
    if (m.id === 'bisognoso') return `${SP.res('paletta')}<span>solo <b>Paletta</b></span>`;
    if (m.demand === 'any') return '<span>una risorsa <b>qualsiasi</b></span>';
    if (m.demand === 'two') return '<span><b>2 risorse</b> qualsiasi</span>';
    if (m.demand) return `${SP.res(m.demand)}<span><b>${FF.RES[m.demand].n}</b></span>`;
    return '<span>niente di preciso: <b>basta dargli qualcosa</b> (+1)</span>';
  };
  const moodCard = (label, cls, m, note) => `<div class="mcard ${cls}"><div class="mlabel">${label}</div>
    <div class="mrow"><span class="mcat" data-mood="${m.id}">${SP.cat(m.id)}</span><div class="mbody"><b>${m.name}</b><div class="mdem">Pretende: ${demandLine(m)}</div></div></div>
    <div class="mwhat">${esc(FF.MOOD_MOVE[m.id] || UI.MOOD_HELP[m.id])}</div>${note ? `<div class="mnote">${note}</div>` : ''}</div>`;

  function wheelSVG(wheel) {
    const n = wheel.length, step = 360 / n;
    const pt = (deg, r) => { const a = (deg - 90) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; };
    let svg = `<svg class="wheelsvg" viewBox="-165 -185 330 350" role="img" aria-label="Ruota dei mood"><circle r="158" fill="#6b4426"/><g class="wheelrot">`;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pt(i * step - step / 2, 150), [x2, y2] = pt(i * step + step / 2, 150), [x3, y3] = pt(i * step + step / 2, 44), [x4, y4] = pt(i * step - step / 2, 44);
      const m = FF.MOODS[wheel[i]];
      svg += `<g class="wseg" data-i="${i}" data-mood="${m.id}"><path d="M${x1} ${y1} A150 150 0 0 1 ${x2} ${y2} L${x3} ${y3} A44 44 0 0 0 ${x4} ${y4}Z" fill="${WCOL[i % WCOL.length]}" stroke="#3b2410" stroke-width="3"/>`;
      const [cx, cy] = pt(i * step, 100), [tx, ty] = pt(i * step, 133);
      const dm = m.demand && m.demand !== 'any' ? m.demand : null;
      svg += `<g transform="translate(${cx} ${cy})"><g class="up" data-i="${i}"><use href="#s-cat-${m.id}" x="-24" y="-24" width="48" height="48"/></g></g>`;
      svg += `<g transform="translate(${tx} ${ty})"><g class="up" data-i="${i}">${dm ? `<use href="#s-res-${dm}" x="-14" y="-14" width="28" height="28"/>` : m.demand === 'any' ? '<text y="7" text-anchor="middle" font-size="20" font-weight="900" fill="#3b2410">★</text>' : '<text y="6" text-anchor="middle" font-size="17" font-weight="900" fill="#7a5a3c">–</text>'}</g></g></g>`;
    }
    svg += `</g><circle r="42" fill="#fff6dc" stroke="#3b2410" stroke-width="4"/><text y="-4" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="17" fill="#a8480f">MOOD</text><text y="16" text-anchor="middle" font-size="22">🐾</text>`;
    svg += `<path d="M-14 -178 L14 -178 L0 -152Z" fill="#c0392b" stroke="#3b2410" stroke-width="3" stroke-linejoin="round"/></svg>`;
    return svg;
  }

  UI.renderWheel = function (el, game) {
    const s = game.s, n = s.wheel.length;
    const cur = game.curMood();
    const nowNote = s.special ? `<span class="tag">Fuori ruota</span>` : s.override ? `<span class="tag">Cambiato (era ${FF.MOODS[s.wheel[s.wheelIdx]].name})</span>` : '';
    const next = FF.MOODS[s.wheel[(s.wheelIdx + (s.noAdvance ? 0 : 1)) % n]];
    const sig = s.wheel.join(',');
    if (el._sig !== sig) { // prima volta: costruisce l'intera ruota
      el._sig = sig; el._tot = 0; el._last = s.wheelIdx;
      el.innerHTML = `<div class="nownext"></div><div class="wheelwrap">${wheelSVG(s.wheel)}</div><div class="wheelfoot"></div><div class="specials"></div>`;
      el.querySelector('.wheelsvg').addEventListener('click', (e) => { const g = e.target.closest('[data-mood]'); if (g) UI.moodHelp(g.dataset.mood); });
      el.addEventListener('click', (e) => { const g = e.target.closest('.mcat[data-mood]'); if (g) UI.moodHelp(g.dataset.mood); });
    }
    el._tot += ((s.wheelIdx - el._last) % n + n) % n; el._last = s.wheelIdx;
    const step = 360 / n, A = -el._tot * step;
    el.querySelector('.wheelrot').style.transform = `rotate(${A}deg)`;
    el.querySelectorAll('.up').forEach((g) => { g.style.transform = `rotate(${el._tot * step}deg)`; }); // controruota: i gatti restano dritti
    el.querySelectorAll('.wseg').forEach((g) => g.classList.toggle('cur', Number(g.dataset.i) === s.wheelIdx && !s.special));
    el.querySelector('.nownext').innerHTML = moodCard('ORA', 'now', cur, nowNote) + moodCard('DOPO', 'next', next, s.special ? 'quando si calma' : '');
    const dots = [0, 1, 2].map((i) => `<span class="dot ${i < s.arrab ? 'on' : ''}"></span>`).join('');
    el.querySelector('.wheelfoot').innerHTML = `<b>Counter Arrabbiatissimo</b> <span class="dots">${dots}</span> ${s.arrab}/3<br><span class="muted">★ = qualsiasi risorsa · – = nessuna pretesa · tocca un mood per l'aiuto</span>`;
    el.querySelector('.specials').innerHTML = ['offesissimo', 'arrabbiatissimo'].map((id) => {
      const m = FF.SPECIAL[id], on = s.special === id;
      return `<div class="mcard special ${on ? 'on' : ''}"><div class="mrow"><span class="mcat" data-mood="${id}">${SP.cat(id)}</span><div class="mbody"><b>${m.name}</b>${on ? ' <span class="tag red">ATTIVO</span>' : ' <span class="tag">fuori ruota</span>'}</div></div><div class="mwhat">${esc(UI.MOOD_HELP[id])}</div></div>`;
    }).join('');
  };

  // ── legenda ──
  UI.legendHTML = function () {
    const row = (spr, txt) => `<div class="lg"><span class="lgi">${spr}</span><span>${txt}</span></div>`;
    return [
      row(SP.pawn(0) + SP.pawn(1), '<b>Giocatori</b>: G1 parte dalla Cucina, G2 dalla Mansarda'),
      row(SP.cat('neutro'), '<b>Heafy</b>, il gatto. La sua faccia dice il mood; la stanza illuminata è dove si trova'),
      row(SP.res('snack') + SP.res('cuscino') + SP.res('giochino') + SP.res('paletta') + SP.res('coccola'), '<b>Risorse</b>: Snack, Cuscino, Giochino, Paletta, Coccola. Stanno sulle stanze (in alto a destra) o nella tua mano'),
      row(SP.use('slot'), '<b>Slot mano</b>: puoi tenere al massimo 2 risorse'),
      row(SP.use('star'), '<b>Stella con numero</b>: punteggio netto (PF − Rancori). Le stelline "J2" sono le cariche del Jolly'),
      row(SP.use('rancor'), '<b>Rancore</b>: ogni PF sotto zero a fine turno; vale −1 a fine partita'),
      row('<span class="tidx-demo">1</span>', '<b>Numeri sulle stanze</b>: ordine in senso orario ↻'),
      row('<span class="rugdemo">' + SP.use('rug') + '</span>', '<b>Tappeto al centro</b>: il mood attuale di Heafy'),
      row(SP.card('A2'), '<b>Carta A</b> freccia: ti muovi di 1 o 2 stanze (↻ orario, ↺ antiorario)'),
      row(SP.card('B1'), '<b>Carta B</b> cestino: raccogli 1 risorsa nella stanza in cui sei'),
      row(SP.card('C1'), '<b>Carta C</b> zampa: interagisci con Heafy (devi essere nella sua stanza)'),
      row(SP.card('J2'), '<b>Carta J</b> stella: Jolly (J2 solo 2 volte a partita)'),
    ].join('');
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
