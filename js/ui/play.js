/* FIFO FAFO — schermata di gioco: setup, sessione (umano / AI / hotseat / spettatore), pannelli di decisione */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const UI = FF.UI;
  const { $, $$, esc } = UI;
  const { CARDS, RES, MOODS } = FF;
  const mod = FF.mod;

  // ───────────────────────── form regole (condiviso con la simulazione) ─────────────────────────
  UI.rulesFields = function (idPrefix, values) {
    const v = Object.assign({}, FF.DEFAULT_RULES, values || {});
    let html = '<div class="rulegrid">';
    for (const k of Object.keys(FF.DEFAULT_RULES)) {
      const def = FF.DEFAULT_RULES[k];
      if (typeof def === 'boolean') html += `<label for="${idPrefix}${k}">${FF.RULE_LABELS[k]}</label><input type="checkbox" id="${idPrefix}${k}" data-rule="${k}" ${v[k] ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent2)">`;
      else html += `<label for="${idPrefix}${k}">${FF.RULE_LABELS[k]} <span class="muted">(std ${def})</span></label><input type="number" id="${idPrefix}${k}" data-rule="${k}" value="${v[k]}" step="${k === 'turns' ? 3 : 1}" min="${k === 'turns' ? 3 : 0}">`;
    }
    return html + '</div>';
  };
  UI.readRules = function (container) {
    const r = {};
    $$('[data-rule]', container).forEach((el) => {
      const k = el.dataset.rule;
      r[k] = el.type === 'checkbox' ? el.checked : Number(el.value);
    });
    if (r.turns) r.turns = Math.max(3, Math.round(r.turns / 3) * 3);
    const diff = {};
    for (const k in r) if (r[k] !== FF.DEFAULT_RULES[k]) diff[k] = r[k];
    return diff;
  };

  // ───────────────────────── setup ─────────────────────────
  const SPEEDS = { step: 'Manuale (clic per avanzare)', slow: 'Lento', normal: 'Normale', fast: 'Veloce', instant: 'Istantaneo' };
  const SPEED_MS = { slow: 1500, normal: 800, fast: 280, instant: 0 };

  UI.openSetup = function (mode) {
    UI.screen('setup');
    const el = $('#s-setup');
    const last = UI.store.get('setup2_' + mode, {});
    const name = UI.store.get('pname', 'Niky');
    const speedDef = last.speed || (mode === 'watch' ? 'normal' : 'step');
    const title = { ai: '🤖 Contro l\'AI', hotseat: '👥 Due giocatori', watch: '🍿 AI contro AI' }[mode];
    const speedSeg = `<div class="field"><label>Messaggi delle mosse</label><div class="seg" id="su-speed">${Object.entries(SPEEDS).map(([k, v]) => `<button data-v="${k}" class="${k === speedDef ? 'sel' : ''}">${v}</button>`).join('')}</div></div>`;
    const levelSeg = (id, def) => `<div class="seg" id="${id}">${Object.entries(FF.LEVELS).map(([k, v]) => `<button data-v="${k}" class="${k === def ? 'sel' : ''}">${v}</button>`).join('')}</div>`;
    let body = '';
    if (mode === 'ai') {
      body = `<div class="field"><label>Il tuo nome</label><input type="text" id="su-name" value="${esc(name)}" maxlength="16"></div>
        <div class="field"><label>Difficoltà dell'avversario</label>${levelSeg('su-level', last.level || 'medium')}</div>
        <div class="field"><label>Il tuo posto</label><div class="seg" id="su-seat">
          <button data-v="rand" class="${(last.seat || 'rand') === 'rand' ? 'sel' : ''}">🎲 Sorteggio</button>
          <button data-v="0" class="${last.seat === '0' ? 'sel' : ''}">G1 · Cucina · primo al mattino</button>
          <button data-v="1" class="${last.seat === '1' ? 'sel' : ''}">G2 · Mansarda · primo al pomeriggio</button></div></div>${speedSeg}`;
    } else if (mode === 'hotseat') {
      body = `<div class="row2"><div class="field"><label>Giocatore 1 (G1 · Cucina)</label><input type="text" id="su-n0" value="${esc(last.n0 || name)}" maxlength="16"></div>
        <div class="field"><label>Giocatore 2 (G2 · Mansarda)</label><input type="text" id="su-n1" value="${esc(last.n1 || 'Erika')}" maxlength="16"></div></div>
        <p class="small muted" style="margin-bottom:14px">Quando si sceglie il Flow comparirà una schermata di passaggio: l'altro giocatore non deve guardare. Il resto della partita è informazione pubblica.</p>${speedSeg}`;
    } else {
      body = `<div class="row2"><div class="field"><label>G1 · Cucina</label>${levelSeg('su-l0', last.l0 || 'hard')}</div>
        <div class="field"><label>G2 · Mansarda</label>${levelSeg('su-l1', last.l1 || 'medium')}</div></div>${speedSeg}`;
    }
    el.innerHTML = `<div class="wrap" style="max-width:560px"><div class="card"><h2>${title}</h2>${body}
      <div class="field"><label>Seed (vuoto = casuale)</label><div style="display:flex;gap:8px"><input type="text" id="su-seed" placeholder="es. prova-1" value="${esc(last.seed || '')}"><button class="btn" id="su-dice" title="Genera un seed">🎲</button></div></div>
      <details class="adv"><summary>⚙ Varianti di regole (avanzate)</summary>${UI.rulesFields('su-r-', last.rules)}</details>
      <div class="btn-row"><button class="btn" id="su-back">← Indietro</button><button class="btn primary" id="su-go" style="flex:1">Inizia la partita</button></div></div></div>`;
    ['su-speed', 'su-level', 'su-seat', 'su-l0', 'su-l1'].forEach((id) => { const c = $('#' + id); if (c) UI.seg(c); });
    $('#su-dice').onclick = () => { $('#su-seed').value = UI.randomSeed(); };
    $('#su-back').onclick = () => UI.go('home');
    $('#su-go').onclick = () => {
      const val = (id) => { const c = $('#' + id); return c ? UI.segVal(c) : null; };
      const seed = $('#su-seed').value.trim() || UI.randomSeed();
      const rules = UI.readRules(el);
      const speed = val('su-speed');
      let players, saved;
      if (mode === 'ai') {
        const pn = $('#su-name').value.trim() || 'Niky'; UI.store.set('pname', pn);
        let seat = val('su-seat'); const level = val('su-level');
        const seatNum = seat === 'rand' ? (Math.random() < 0.5 ? 0 : 1) : Number(seat);
        players = [null, null];
        players[seatNum] = { name: pn, kind: 'human' };
        players[1 - seatNum] = { name: 'Avversario', kind: 'ai', level };
        saved = { level, seat, seed: $('#su-seed').value.trim(), speed, rules };
      } else if (mode === 'hotseat') {
        const n0 = $('#su-n0').value.trim() || 'Giocatore 1', n1 = $('#su-n1').value.trim() || 'Giocatore 2';
        players = [{ name: n0, kind: 'human' }, { name: n1, kind: 'human' }];
        saved = { n0, n1, seed: $('#su-seed').value.trim(), speed, rules };
      } else {
        const l0 = val('su-l0'), l1 = val('su-l1');
        players = [{ name: 'AI ' + FF.LEVELS[l0], kind: 'ai', level: l0 }, { name: 'AI ' + FF.LEVELS[l1], kind: 'ai', level: l1 }];
        saved = { l0, l1, seed: $('#su-seed').value.trim(), speed, rules };
      }
      UI.store.set('setup2_' + mode, saved);
      UI.startSession({ mode, seed, rules, players, speed });
    };
  };

  UI.startSession = function (cfg, history) {
    if (UI.session) UI.session.dispose();
    UI.session = new Session(cfg, history);
    UI.session.start();
  };

  // ───────────────────────── anteprima del flow ─────────────────────────
  function previewFlow(game, pid, order) {
    const s = game.s, p = s.players[pid], h = s.heafy;
    let pos = p.pos, hpos = h.pos, carrying = h.carriedBy === pid, hand = p.hand.length;
    const out = [];
    for (const code of order) {
      const c = CARDS[code];
      if (c.t === 'A') {
        pos = mod(pos + c.dir * c.steps); if (carrying) hpos = pos;
        out.push([code, `→ ${game.rname(pos)}${hpos === pos ? ' · 🐱 Heafy qui' : ''}`, '']);
      } else if (code === 'B1') {
        const here = s.res[pos];
        if (hand >= game.rules.handLimit) out.push([code, 'mano piena: niente', 'note-bad']);
        else if (!here.length) out.push([code, `${game.rname(pos)} è vuota (ora)`, 'note-bad']);
        else if (hpos === pos) out.push([code, `⚠ Heafy è qui: raccogliere = −1 PF e Offesissimo`, 'note-bad', `B1: in ${game.rname(pos)} c'è Heafy. Raccogliere senza Jolly fa arrabbiare Heafy: −1 PF e diventa Offesissimo.`]);
        else { out.push([code, `raccogli ${here.map((r) => RES[r].i).join('/')} in ${game.rname(pos)}`, 'note-ok']); hand++; }
      } else if (code === 'C1') {
        if (p.interacted) out.push([code, 'hai già interagito in questo turno', 'note-bad']);
        else if (hpos === pos) out.push([code, '✔ Heafy è qui: interagisci', 'note-ok']);
        else out.push([code, p.hand.length || hand ? '✘ Heafy non è qui: dovrai abbandonare una risorsa' : 'Heafy non è qui', 'note-bad',
          (p.hand.length || hand) ? `C1: quando la esegui sei in ${game.rname(pos)} ma Heafy è in ${game.rname(hpos)}. Non puoi interagire e dovrai ABBANDONARE una risorsa in quella stanza. Metti C1 dopo la carta A che ti porta da Heafy!` : '']);
      } else if (code === 'J2') {
        out.push([code, '✨ potrai: spostarti di 1-2, raccolta sicura, prendere/depositare Heafy', '']);
      }
    }
    return out;
  }

  function giveOutcome(game, d, sel) {
    const s = game.s;
    if (s.irreqDone) return ['Heafy ha già avuto la sua risorsa: non accetta altro', ''];
    if (d.special === 'arrabbiatissimo') return sel.length === 2 ? ['+2 PF · lo calmi e la ruota avanza', 'good'] : ['−1 PF', 'bad'];
    if (d.mood === 'bisognoso') return sel[0] === 'paletta' ? ['+3 PF', 'good'] : ['−1 PF · diventa Irrequieto', 'bad'];
    if (d.mood === 'irrequieto') {
      return sel.length ? ['+2 PF · si calma, non accetta altro', 'good'] : ['−1 PF', 'bad'];
    }
    const m = MOODS[d.mood];
    if (m.demand) {
      if (!sel.length) return ['−1 PF · 😡 Offesissimo', 'bad'];
      if (sel[0] === m.demand) return ['+2 PF ✓', 'good'];
      const c = s.arrab + 1;
      return [`+1 PF · counter ${c}/3${c >= 3 ? ' → 🔥 ARRABBIATISSIMO' : ''}`, c >= 3 ? 'bad' : ''];
    }
    return sel.length ? [`${game.rules.noDemandGive >= 0 ? '+' : ''}${game.rules.noDemandGive} PF`, 'good'] : ['−1 PF', 'bad'];
  }

  // ───────────────────────── sessione ─────────────────────────
  const WEIGHT = { turn: 0.5, sys: 0.5, mood: 1.3, heafy: 1.1, dice: 1, flow: 0.8, move: 1, act: 0.9, pf: 1.2, warn: 0.8, end: 1, note: 0 };

  class Session {
    constructor(cfg, history) {
      this.cfg = cfg; this.mode = cfg.mode;
      this.speed = cfg.speed || 'normal';
      this.paused = false; this.cancelled = false; this.waiter = null; this.timer = null;
      this.game = new FF.Game({ seed: cfg.seed, rules: cfg.rules, players: cfg.players, beats: true, log: true, replay: history || [] });
      this.ai = cfg.players.map((p, i) => (p.kind === 'ai' ? FF.AI.create(p.level, cfg.seed + 'a' + i) : null));
      this.humanSeats = cfg.players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
      this.pending = null;
      this.fast = !!(history && history.length); // fast-forward durante il ripristino
    }

    dispose() { this.cancelled = true; if (this.timer) clearTimeout(this.timer); this.waiter = null; if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler); }

    // ── interfaccia ──
    buildUI() {
      UI.screen('game');
      const el = $('#s-game');
      el.innerHTML = `<div class="gbar"><span class="turn" id="g-turn"></span><span class="chip" id="g-per"></span><span class="chip" id="g-first"></span><span style="flex:1"></span>
        <div class="ctrl" id="g-ctrl"></div></div>
        <div class="glayout"><aside class="legendcol"><div class="panel"><details open><summary class="ptitle" style="cursor:pointer">Legenda</summary><div class="legend">${UI.legendHTML()}</div></details></div></aside><div class="maincol">
          <div class="announce" id="g-announce"></div>
          <div class="tablefelt"><div class="board" id="g-board"></div></div>
          <div class="panel action" id="g-action"></div>
        </div><div class="sidecol">
          <div class="panel"><div class="ptitle">Giocatori</div><div id="g-players"></div></div>
          <div class="panel"><div class="ptitle">🎯 Obiettivi segreti</div><div id="g-objs"></div></div>
          <div class="panel"><div class="ptitle">Heafy e la ruota dei mood</div><div id="g-wheel"></div></div>
          <div class="panel"><div class="ptitle">Cronaca</div><div class="logbox" id="g-log"></div></div>
        </div></div>`;
      const c = $('#g-ctrl');
      c.innerHTML = `<select id="g-speed" title="Velocità">${Object.entries(SPEEDS).map(([k, v]) => `<option value="${k}" ${k === this.speed ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <button class="btn sm" id="g-pause">⏸</button><button class="btn sm" id="g-next">⏭ Avanti</button>
        <button class="btn sm ${this.humanSeats.length ? '' : 'hidden'}" id="g-skip" title="Salta i messaggi fino alla tua prossima scelta">⏩ Fino alla mia mossa</button>
        <button class="btn sm" id="g-note" title="Aggiungi una nota al log">📝</button><button class="btn sm" id="g-menu">☰</button>`;
      $('#g-speed').onchange = (e) => { this.speed = e.target.value; this.paused = false; this.syncCtrl(); this.release(); };
      $('#g-pause').onclick = () => { this.paused = !this.paused; this.syncCtrl(); if (!this.paused) this.release(); };
      $('#g-next').onclick = () => this.release();
      $('#g-skip').onclick = () => { this.skipTo = true; this.release(); };
      $('#g-announce').addEventListener('click', (e) => { if (this.waiter && !e.target.closest('button')) this.release(); });
      this.keyHandler = (e) => {
        if ((e.code === 'Space' || e.code === 'Enter') && this.waiter && !document.querySelector('.overlay') && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes((document.activeElement || {}).tagName)) { e.preventDefault(); this.release(); }
      };
      document.addEventListener('keydown', this.keyHandler);
      $('#g-note').onclick = () => this.addNote();
      $('#g-menu').onclick = () => this.menu();
      this.game.onEvent = (ev) => this.onEvent(ev);
      this.syncCtrl();
    }
    syncCtrl() {
      const stepping = this.speed === 'step' || this.paused;
      $('#g-pause').textContent = this.paused ? '▶ Riprendi' : '⏸ Pausa';
      $('#g-pause').classList.toggle('hidden', this.speed === 'step');
      $('#g-next').classList.toggle('hidden', !stepping);
    }
    onEvent(ev) {
      if (this.cancelled || this.fast) return;
      const box = $('#g-log'); if (!box) return;
      box.insertAdjacentHTML('beforeend', UI.logLine(ev));
      box.scrollTop = box.scrollHeight;
    }
    renderAll(active) {
      if (this.cancelled) return;
      const g = this.game, s = g.s;
      $('#g-turn').textContent = `Turno ${Math.min(Math.max(1, s.turn), g.rules.turns)}/${g.rules.turns}`;
      const per = g.period(Math.max(1, s.turn));
      const pc = $('#g-per'); pc.textContent = ['🌄 Mattino', '☀️ Pomeriggio', '🌙 Sera'][per]; pc.className = 'chip per' + per;
      const fc = $('#g-first'); fc.textContent = s.turn ? `Primo: ${s.players[s.first].name}` : ''; fc.className = 'chip p' + s.first + (s.turn ? '' : ' hidden');
      UI.renderBoard($('#g-board'), g, { targets: this.targets });
      UI.renderPlayers($('#g-players'), g, { active: active == null ? (s.phase === 'resolve' ? this.currentActor : null) : active });
      UI.renderWheel($('#g-wheel'), g);
      this.renderObjs();
    }
    // pannello obiettivi segreti: tuoi (vs AI), a richiesta (hotseat), di entrambi (spettatore)
    renderObjs() {
      const box = $('#g-objs'); if (!box) return;
      const g = this.game, s = g.s;
      if (!g.rules.objectives || !s.objectives[0].length) { box.innerHTML = '<div class="muted small">Nessun obiettivo in questa partita.</div>'; return; }
      const card = (pid) => s.objectives[pid].map((id) => UI.objCard(id, g.objectiveDone(pid, id) ? 'ok' : 'ko')).join('');
      if (this.mode === 'ai') {
        const me = this.humanSeats[0];
        box.innerHTML = `<div class="small muted" style="margin-bottom:6px">Solo tu li vedi. Si rivelano a fine partita: ✔ = punti, ✘ = +1 Rancore. Lo stato è quello di adesso: conta quello dell'ultimo turno.</div>${card(me)}`;
      } else if (this.mode === 'watch') {
        box.innerHTML = [0, 1].map((p) => `<div class="lbl">${FF.PLAYER_ICONS[p]} ${esc(s.players[p].name)}</div>${card(p)}`).join('');
      } else {
        box.innerHTML = `<div class="small muted" style="margin-bottom:6px">Passa il dispositivo prima di guardare: gli obiettivi sono segreti.</div><div class="btn-row">${[0, 1].map((p) => `<button class="btn sm" data-o="${p}">👁 ${esc(s.players[p].name)}</button>`).join('')}</div>`;
        box.querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => { const p = Number(b.dataset.o); const dlg = UI.modal(`<h2>🎯 Obiettivi di ${esc(s.players[p].name)}</h2>${card(p)}<div class="btn-row end" style="margin-top:12px"><button class="btn primary" data-x>Nascondi</button></div>`, { left: true }); dlg.el.querySelector('[data-x]').onclick = dlg.close; }));
      }
    }
    setAction(html) { const a = $('#g-action'); if (a) a.innerHTML = html; return a; }

    // ── pacing ──
    release() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } const w = this.waiter; this.waiter = null; if (w) w(); }
    // messaggio grande sopra al tabellone
    announce(ev, opts) {
      const box = $('#g-announce'); if (!box) return;
      opts = opts || {};
      const g = this.game, SPR = FF.Sprites;
      let icon;
      if (ev.k === 'period') icon = `<span class="aemoji">${['🌄', '☀️', '🌙'][ev.d.period]}</span>`;
      else if (ev.k === 'end') icon = '<span class="aemoji">🏆</span>';
      else if (ev.k === 'dice') icon = '<span class="aemoji">🎲</span>';
      else if (ev.k === 'turn') icon = '<span class="aemoji">📅</span>';
      else if (ev.k === 'mood' || ev.k === 'heafy') icon = SPR.cat(ev.d && ev.d.mood ? ev.d.mood : g.curMood().id);
      else if (ev.p >= 0) icon = `<span class="apawn">${SPR.pawn(ev.p)}</span>`;
      else icon = SPR.cat(g.curMood().id);
      const text = ev.text.replace(/━+/g, '').trim();
      const sub = ev.k === 'mood' && ev.d && UI.MOOD_HELP[ev.d.mood] ? `<div class="asub">${esc(UI.MOOD_HELP[ev.d.mood])}</div>` : '';
      const who = ev.p === 0 ? 'p0' : ev.p === 1 ? 'p1' : '';
      const per = ev.k === 'period' ? ' per' + ev.d.period : '';
      box.className = `announce k-${ev.k} ${who}${per}${opts.prompt ? ' prompt' : ''}`;
      box.innerHTML = `<div class="aicon">${icon}</div><div class="atext"><div class="amain">${esc(text)}</div>${sub}</div>${opts.button ? '<button class="btn primary abtn" id="a-next">Avanti ▶</button>' : ''}`;
      const b = $('#a-next'); if (b) b.onclick = () => this.release();
    }
    promptFor(d) {
      const n = this.game.s.players[d.player].name;
      return {
        flow: `Tocca a ${n}: scegli il tuo Flow`, give: d.passive ? `Heafy è con ${n}: deve dargli qualcosa` : `${n} interagisce con Heafy: cosa gli dai?`,
        objectives: `${n}: scegli i tuoi obiettivi segreti`, b1: `${n}: cosa raccogli?`, abandon: `${n}: devi abbandonare una risorsa`, j2step: `${n}: usa il Jolly ✨`,
      }[d.type] || `Tocca a ${n}`;
    }
    async pace(ev) {
      if (this.fast || this.cancelled) return;
      const always = (ev.k === 'period' || ev.k === 'end') && this.speed !== 'instant';
      const stepping = this.speed === 'step' || this.paused || always;
      if (this.skipTo && !always) { this.announce(ev); return; }
      this.setAction('<div class="muted" style="font-weight:700">Segui i messaggi qui sopra ☝️</div>');
      if (stepping) {
        this.announce(ev, { button: true });
        await new Promise((r) => { this.waiter = r; });
        return;
      }
      const base = SPEED_MS[this.speed];
      this.announce(ev);
      if (!base) { if (ev.i % 12 === 0) await UI.sleep(0); return; }
      const w = (WEIGHT[ev.k] == null ? 1 : WEIGHT[ev.k]) * (this.humanSeats.includes(ev.p) ? 0.8 : 1);
      await new Promise((r) => { this.waiter = r; this.timer = setTimeout(() => { this.timer = null; this.waiter = null; r(); }, base * w * 1.4); });
    }

    // ── ciclo principale ──
    async start() {
      this.buildUI();
      const g = this.game;
      UI.$('#tb-info').innerHTML = `<span class="chip">seed ${esc(this.cfg.seed)}</span>`;
      this.renderAll(null);
      const log = $('#g-log'); log.innerHTML = '';
      this.announce({ k: 'sys', p: -1, text: 'Si comincia! I messaggi delle mosse compaiono qui.', d: {} });
      const it = g.run();
      let r = it.next();
      while (!r.done) {
        if (this.cancelled) return;
        const d = r.value;
        if (d.type === 'beat') {
          if (!this.fast && this.speed !== 'instant') this.renderAll(d.ev.p >= 0 ? d.ev.p : null);
          await this.pace(d.ev);
          if (this.fast && g.replay.length === 0) { this.fast = false; this.rebuildLog(); this.renderAll(); }
          r = it.next();
          continue;
        }
        // decisione
        if (this.fast) { this.fast = false; this.rebuildLog(); }
        this.currentActor = d.player;
        this.renderAll(d.player);
        const pl = this.cfg.players[d.player];
        if (pl.kind === 'human') { this.skipTo = false; this.announce({ k: 'prompt', p: d.player, text: this.promptFor(d), d: {} }, { prompt: true }); }
        let ans;
        if (pl.kind === 'human') ans = await this.humanDecide(d);
        else { ans = this.aiDecide(d); }
        if (this.cancelled) return;
        r = it.next(ans);
        this.save();
      }
      if (this.cancelled) return;
      UI.store.del('save');
      this.renderAll(null);
      this.endDialog();
    }
    rebuildLog() {
      const box = $('#g-log'); box.innerHTML = this.game.events.map(UI.logLine).join(''); box.scrollTop = box.scrollHeight;
    }
    aiDecide(d) {
      try { return this.ai[d.player].decide(this.game, d); }
      catch (e) { console.error('AI error', e); return FF.AI.greedy(this.game, d); }
    }
    save() {
      if (this.mode === 'watch') return;
      UI.store.set('save', { cfg: this.cfg, history: this.game.history, turn: this.game.s.turn, t: Date.now() });
    }

    // ── decisioni umane ──
    async humanDecide(d) {
      const g = this.game;
      const hot = this.mode === 'hotseat';
      if (d.type === 'flow') {
        if (hot) {
          await this.cover(d.player, 'Scegli il tuo Flow in segreto');
        }
        const flow = await this.flowPanel(d);
        if (hot) this.setAction('<h3>Flow scelto ✔</h3>');
        return flow;
      }
      if (d.type === 'objectives') {
        if (hot) await this.cover(d.player, 'Scegli i tuoi obiettivi segreti');
        const picks = await this.objectivesPanel(d);
        if (hot) this.setAction('<h3>Obiettivi scelti ✔</h3>');
        return picks;
      }
      if (d.type === 'give') return this.givePanel(d);
      if (d.type === 'b1') return this.b1Panel(d);
      if (d.type === 'abandon') return this.abandonPanel(d);
      if (d.type === 'j2step') return this.j2Panel(d);
      return null;
    }

    cover(pid, why) {
      const p = this.cfg.players[pid];
      return new Promise((resolve) => {
        const dlg = UI.modal(`<div class="bigcat" style="width:90px;height:110px">${FF.Sprites.pawn(pid)}</div><h2>Tocca a ${esc(p.name)}</h2><p class="muted" style="margin-bottom:6px">${esc(why)}</p>
          <p class="small muted" style="margin-bottom:14px">Passa il dispositivo: l'altro giocatore non deve guardare lo schermo.</p>
          <button class="btn primary block" data-x>Sono ${esc(p.name)} — mostra</button>`, { solid: true, dismiss: false });
        dlg.el.querySelector('[data-x]').onclick = () => { dlg.close(); resolve(); };
      });
    }

    flowPanel(d) {
      const g = this.game, pid = d.player, p = g.s.players[pid];
      const chosen = { A: null, B: null, C: null, J: null };
      let order = [];
      const types = [
        ['A', 'Movimento', ['A1', 'A2', 'A3', 'A4']],
        ['B', 'Raccolta', ['B1', 'B2']],
        ['C', 'Interazione con Heafy', ['C1', 'C2']],
        ['J', `Jolly · cariche J2: ${p.j2}`, ['J1', 'J2']],
      ];
      const sub = (code) => {
        const c = CARDS[code];
        if (c.t === 'A') return `verso ${g.room(mod(p.pos + c.dir * c.steps)).name}`;
        return c.label;
      };
      return new Promise((resolve) => {
        const render = () => {
          const ord = order.map((t) => chosen[t]);
          const prev = previewFlow(g, pid, ord);
          const pcard = (c, extra) => `<button class="pcard ${CARDS[c].t} ${chosen[CARDS[c].t] === c && !extra ? 'sel' : ''}" ${extra ? '' : `data-c="${c}"`} ${c === 'J2' && p.j2 <= 0 && !extra ? 'disabled' : ''}>${extra || ''}${FF.Sprites.card(c, 'ci')}<b>${c}</b><small>${esc(sub(c))}</small></button>`;
          const groups = types.map(([t, title, codes]) => `<div class="cgroup ${t}"><div class="gt">${title}</div><div class="cards">${codes.map((c) => pcard(c)).join('')}</div></div>`).join('');
          const row = order.length ? order.map((t, i) => `<div class="slotwrap">${pcard(chosen[t], `<span class="num">${i + 1}</span>`)}
            <div class="mvrow"><button data-mv="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>◀</button><button data-mv="${i}" data-dir="1" ${i === order.length - 1 ? 'disabled' : ''}>▶</button></div></div>${i < order.length - 1 ? '<span class="farrow">➜</span>' : ''}`).join('')
            : '<span class="flowhint">Scegli una carta per tipo: l\'ordine in cui le scegli è l\'ordine del Flow (poi puoi spostarle con le frecce).</span>';
          const full = order.length === 4;
          this.setAction(`<h3>${FF.Sprites.pawn(pid, 'inl')} ${esc(p.name)}: costruisci il tuo Flow</h3>
            <div class="small muted" style="margin-bottom:6px">📍 Sei in ${esc(g.rname(p.pos))} · 🐱 Heafy in ${esc(g.rname(g.s.heafy.pos))} · mano: ${p.hand.map((r) => RES[r].i).join(' ') || 'vuota'}</div>
            ${groups}<div class="lbl" style="margin-top:6px">Il tuo Flow (ordine di esecuzione)</div><div class="flowrow">${row}</div>
            ${prev.filter((x) => x[3]).map((x) => `<div class="warnbox">⚠️ <b>Attenzione</b> — ${esc(x[3])}</div>`).join('')}
            ${prev.length ? `<div class="pv">${prev.map(([c, t, cls]) => `<div class="${cls}"><b>${c}</b> ${esc(t)}</div>`).join('')}<div class="muted">Stima: non considera cosa farà l'avversario.</div></div>` : ''}
            <div class="btn-row"><button class="btn" id="f-hint" title="Chiede un consiglio all'AI difficile">💡 Suggerimento</button><button class="btn" id="f-clear">Azzera</button>
            <button class="btn primary" id="f-ok" style="flex:1" ${full ? '' : 'disabled'}>Conferma Flow</button></div>`);
          $$('#g-action [data-c]').forEach((b) => b.onclick = () => {
            const c = b.dataset.c, t = CARDS[c].t;
            if (chosen[t] === c) { chosen[t] = null; order = order.filter((x) => x !== t); }
            else { chosen[t] = c; if (!order.includes(t)) order.push(t); }
            render();
          });
          $$('#g-action [data-mv]').forEach((b) => b.onclick = () => {
            const i = Number(b.dataset.mv), j = i + Number(b.dataset.dir);
            [order[i], order[j]] = [order[j], order[i]]; render();
          });
          $('#f-clear').onclick = () => { order = []; for (const t in chosen) chosen[t] = null; render(); };
          $('#f-hint').onclick = () => {
            UI.toast('Sto pensando…');
            setTimeout(() => {
              const f = FF.AI.create('hard', 7).decide(g, d);
              order = []; for (const t in chosen) chosen[t] = null;
              f.forEach((c) => { chosen[CARDS[c].t] = c; order.push(CARDS[c].t); });
              render(); UI.toast('Suggerimento: ' + f.join(' → '));
            }, 30);
          };
          $('#f-ok').onclick = () => {
            if (order.length !== 4) return;
            const danger = prev.filter((x) => x[3]);
            if (!danger.length) return resolve(order.map((t) => chosen[t]));
            const dlg = UI.modal(`<div class="bigcat" style="width:90px;height:90px">${FF.Sprites.cat('bisognoso')}</div><h2>Sicuro?</h2>${danger.map((x) => `<p class="warnbox" style="text-align:left">⚠️ ${esc(x[3])}</p>`).join('')}
              <div class="btn-row" style="margin-top:14px"><button class="btn primary" style="flex:1" data-no>← Torna a modificare</button><button class="btn danger" data-yes>Confermo comunque</button></div>`, { dismiss: false });
            dlg.el.querySelector('[data-no]').onclick = dlg.close;
            dlg.el.querySelector('[data-yes]').onclick = () => { dlg.close(); resolve(order.map((t) => chosen[t])); };
          };
        };
        render();
      });
    }

    objectivesPanel(d) {
      return new Promise((resolve) => {
        let sel = [];
        const render = () => {
          const group = (title, ids) => `<div class="cgroup J"><div class="gt">${title}</div><div class="ogrid">${ids.map((id) => `<button class="opick ${sel.includes(id) ? 'sel' : ''}" data-id="${esc(id)}">${UI.objCard(id)}</button>`).join('')}</div></div>`;
          this.setAction(`<h3>🎯 Scegli ${d.keep} obiettivi segreti da tenere (su 4)</h3>
            <div class="small muted" style="margin-bottom:8px">Si controllano a fine partita guardando il tavolo. Se lo completi prendi i punti; se no, +1 Rancore (−1 PF). Quelli che scarti restano segreti.</div>
            ${group('Posizione', d.offer.filter((id) => FF.OBJECTIVES[id].deck === 'A'))}${group('Mano e stile', d.offer.filter((id) => FF.OBJECTIVES[id].deck === 'B'))}
            <div class="btn-row"><button class="btn primary" id="o-ok" style="flex:1" ${sel.length === d.keep ? '' : 'disabled'}>Tengo questi ${d.keep} (${sel.length}/${d.keep})</button></div>`);
          $$('#g-action [data-id]').forEach((b) => (b.onclick = () => {
            const id = b.dataset.id;
            if (sel.includes(id)) sel = sel.filter((x) => x !== id);
            else { if (sel.length >= d.keep) sel.shift(); sel.push(id); }
            render();
          }));
          $('#o-ok').onclick = () => { if (sel.length === d.keep) resolve(sel.slice()); };
        };
        render();
      });
    }

    givePanel(d) {
      const g = this.game, p = g.s.players[d.player];
      const m = g.curMood();
      const arrab = d.special === 'arrabbiatissimo';
      const maxSel = arrab ? 2 : 1;
      const dem = d.mood === 'bisognoso' ? '🪣 solo Paletta' : arrab ? '2 risorse qualsiasi' : m.demand === 'any' ? 'qualsiasi risorsa' : m.demand ? RES[m.demand].i + ' ' + RES[m.demand].n : 'nessuna pretesa';
      return new Promise((resolve) => {
        let sel = []; // indici in mano
        const render = () => {
          const picked = sel.map((i) => d.hand[i]);
          const out = giveOutcome(g, d, picked);
          const btns = d.hand.map((r, i) => {
            const o = giveOutcome(g, d, arrab ? [r, r] : [r]);
            return `<button class="opt ${sel.includes(i) ? 'sel' : ''} ${o[1]}" data-i="${i}">${FF.Sprites.res(r, 'res')}${RES[r].n}<small>${arrab ? 'sceglila' : esc(o[0])}</small></button>`;
          }).join('') || '<span class="muted small">Non hai risorse.</span>';
          const none = giveOutcome(g, d, []);
          this.setAction(`<h3>${m.e} ${d.passive ? 'Heafy è con te' : 'Interagisci con Heafy'} — ${m.name}</h3>
            <div class="small muted">Pretesa: <b>${dem}</b> · ${arrab ? 'devi darne 2' : 'puoi dare 1 risorsa'}</div>
            <div class="opts">${btns}</div>
            <div class="small" style="min-height:1.4em">${picked.length ? 'Esito: <b>' + esc(out[0]) + '</b>' : 'Non dare nulla: <b>' + esc(none[0]) + '</b>'}</div>
            <div class="btn-row" style="margin-top:8px"><button class="btn" id="g-none">Non dare nulla</button><button class="btn primary" id="g-give" style="flex:1" ${picked.length ? '' : 'disabled'}>Dai${picked.length ? ' ' + picked.map((r) => RES[r].i).join('') : ''}</button></div>`);
          $$('#g-action [data-i]').forEach((b) => b.onclick = () => {
            const i = Number(b.dataset.i);
            if (sel.includes(i)) sel = sel.filter((x) => x !== i);
            else { if (sel.length >= maxSel) sel.shift(); sel.push(i); }
            render();
          });
          $('#g-none').onclick = () => resolve([]);
          $('#g-give').onclick = () => resolve(picked);
        };
        render();
      });
    }

    b1Panel(d) {
      return new Promise((resolve) => {
        const btns = d.options.map((r) => `<button class="opt ${d.near ? 'bad' : ''}" data-r="${r}">${FF.Sprites.res(r, 'res')}${RES[r].n}<small>${d.near ? '−1 PF e Offesissimo' : 'raccogli'}</small></button>`).join('');
        this.setAction(`<h3>B1 — Raccolta in ${esc(this.game.rname(this.game.s.players[d.player].pos))}</h3>
          ${d.near ? '<div class="small note-bad">⚠ Heafy è in questa stanza: raccogliere (senza Jolly) fa arrabbiare Heafy.</div>' : '<div class="small muted">Più risorse presenti: scegli quale prendere.</div>'}
          <div class="opts">${btns}</div>${d.skip ? '<div class="btn-row"><button class="btn" id="b-skip">Non raccogliere</button></div>' : ''}`);
        $$('#g-action [data-r]').forEach((b) => b.onclick = () => resolve(b.dataset.r));
        const s = $('#b-skip'); if (s) s.onclick = () => resolve(null);
      });
    }

    abandonPanel(d) {
      return new Promise((resolve) => {
        const btns = d.hand.map((r) => `<button class="opt bad" data-r="${r}">${FF.Sprites.res(r, 'res')}${RES[r].n}<small>abbandona</small></button>`).join('');
        this.setAction(`<h3>C1 — Heafy non è qui</h3><div class="small note-bad">Devi abbandonare una risorsa nella stanza. Quale?</div><div class="opts">${btns}</div>`);
        $$('#g-action [data-r]').forEach((b) => b.onclick = () => resolve(b.dataset.r));
      });
    }

    j2Panel(d) {
      const g = this.game, p = g.s.players[d.player];
      return new Promise((resolve) => {
        const label = (o) => {
          if (o.k === 'move') { const dest = g.room(mod(p.pos + o.dir * o.steps)); return [`${o.dir > 0 ? '↻' : '↺'} ${o.steps} stanz${o.steps > 1 ? 'e' : 'a'}`, `${dest.icon} ${dest.name}`]; }
          if (o.k === 'collect') return ['🛡 Raccolta sicura', `${RES[o.res].i} ${RES[o.res].n} · niente Offesissimo`];
          if (o.k === 'pickup') return ['🐱 Prendi Heafy', o.carry ? `gli fai portare ${RES[o.carry].i}` : 'senza risorsa'];
          return ['📍 Deposita Heafy', 'lascialo qui'];
        };
        const h = g.s.heafy, done = d.done || {};
        const btn = (o) => { const i = d.options.indexOf(o); const [a, b] = label(o); return `<button class="opt" data-i="${i}" data-mv="${o.k === 'move' ? mod(p.pos + o.dir * o.steps) : ''}">${a}<small>${esc(b)}</small></button>`; };
        const off = (title, why) => `<button class="opt" disabled style="opacity:.55;cursor:not-allowed">${title}<small>${esc(why)}</small></button>`;
        const of = (k) => d.options.filter((o) => o.k === k);
        const sec = (title, items, hint) => `<div class="cgroup J"><div class="gt">${title}</div><div class="opts">${items}</div>${hint ? `<div class="small muted">${hint}</div>` : ''}</div>`;
        const room = g.s.res[p.pos];
        const moveS = sec('🏃 Spostamento (1 o 2 stanze, in un senso o nell\'altro)', done.move ? off('✔ già fatto', 'una sola volta per Jolly') : of('move').map(btn).join(''));
        const colS = sec('🛡 Raccolta sicura (anche con Heafy nella stanza)', done.collect ? off('✔ già fatta', 'una sola volta per Jolly')
          : of('collect').length ? of('collect').map(btn).join('') : off('Non disponibile', p.hand.length >= g.rules.handLimit ? 'hai la mano piena' : !room.length ? 'nessuna risorsa in questa stanza' : ''));
        let pickWhy = '';
        if (done.pickup) pickWhy = 'già fatto';
        else if (h.carriedBy === p.id) pickWhy = 'Heafy è già in braccio a te';
        else if (h.carriedBy != null) pickWhy = 'Heafy è in braccio all\'avversario';
        else if (h.pos !== p.pos) pickWhy = `Heafy è in ${g.rname(h.pos)}: devi essere nella sua stanza. Usa prima lo spostamento per raggiungerlo!`;
        const pickS = sec('🐱 Prendi Heafy (lo porti con te)', of('pickup').length ? of('pickup').map(btn).join('') : off('🐱 Prendi Heafy — non disponibile', pickWhy), 'Non può essere l\'ultima azione del Jolly: dopo averlo preso devi spostarti o depositarlo. Torna libero all\'inizio del turno dopo.');
        const depS = sec('📍 Deposita Heafy', of('deposit').length ? of('deposit').map(btn).join('') : off('📍 Deposita Heafy — non disponibile', done.deposit ? 'già fatto' : 'non hai Heafy in braccio'));
        this.setAction(`<h3>✨ Jolly J2 — scegli un'azione (cariche rimaste dopo questa: ${p.j2})</h3>
          <div class="small muted" style="margin-bottom:6px">📍 Sei in ${esc(g.rname(p.pos))} · 🐱 Heafy è in ${esc(g.rname(h.pos))}${h.carriedBy === p.id ? ' (in braccio a te)' : ''}. Ogni azione si usa una sola volta, nell'ordine che vuoi; quando hai finito premi “Ho finito”.</div>
          ${pickS}${moveS}${colS}${depS}
          <div class="btn-row"><button class="btn primary" id="j-done" ${d.canFinish ? '' : 'disabled'}>✔ Ho finito</button></div>`);
        $$('#g-action [data-i]').forEach((b) => {
          b.onclick = () => { this.targets = null; resolve(d.options[Number(b.dataset.i)]); };
          b.onmouseenter = () => { if (b.dataset.mv !== '') { this.targets = [Number(b.dataset.mv)]; UI.renderBoard($('#g-board'), g, { targets: this.targets }); } };
          b.onmouseleave = () => { this.targets = null; UI.renderBoard($('#g-board'), g); };
        });
        $('#j-done').onclick = () => { this.targets = null; resolve({ k: 'done' }); };
      });
    }

    // ── menu, note, fine ──
    addNote() {
      const dlg = UI.modal(`<h2>📝 Nota di playtest</h2><textarea id="n-txt" rows="4" placeholder="Es. “Il Coccolone è troppo forte” — resta nel log esportato"></textarea><div class="btn-row end" style="margin-top:10px"><button class="btn" data-c>Annulla</button><button class="btn primary" data-s>Salva</button></div>`, { left: true });
      dlg.el.querySelector('[data-c]').onclick = dlg.close;
      dlg.el.querySelector('[data-s]').onclick = () => {
        const t = dlg.el.querySelector('#n-txt').value.trim();
        if (t) { const g = this.game; g.emit('note', `📝 Nota (T${g.s.turn}): ${t}`); UI.toast('Nota salvata nel log'); }
        dlg.close();
      };
    }
    logText() {
      const g = this.game, c = this.cfg;
      const head = [`FIFO FAFO — log di playtest`, `Seed: ${c.seed}`, `Modalità: ${c.mode}`, `Giocatori: ${c.players.map((p, i) => `G${i + 1}=${p.name}${p.kind === 'ai' ? ' (AI ' + p.level + ')' : ''}`).join(', ')}`,
        `Regole modificate: ${Object.keys(c.rules).length ? JSON.stringify(c.rules) : 'nessuna'}`, ''];
      return head.concat(g.events.map((e) => e.text)).join('\n');
    }
    menu() {
      const dlg = UI.modal(`<h2>☰ Menu partita</h2><div style="display:grid;gap:8px">
        <button class="btn" data-a="log">📄 Esporta log (.txt)</button><button class="btn" data-a="copy">📋 Copia log</button>
        <button class="btn" data-a="seed">🌱 Copia seed</button><button class="btn danger" data-a="quit">Abbandona la partita</button>
        <button class="btn primary" data-a="close">Continua</button></div>`);
      dlg.el.addEventListener('click', (e) => {
        const a = e.target.dataset.a; if (!a) return;
        if (a === 'log') UI.download(`fifo-fafo-${this.cfg.seed}.txt`, this.logText());
        else if (a === 'copy') UI.copy(this.logText());
        else if (a === 'seed') UI.copy(this.cfg.seed);
        else if (a === 'quit') { if (confirm('Abbandonare la partita?')) { dlg.close(); this.dispose(); UI.store.del('save'); UI.go('home'); return; } }
        if (a === 'close') dlg.close();
      });
    }
    endDialog() {
      const g = this.game, r = g.result, c = this.cfg;
      const nm = (i) => esc(g.s.players[i].name);
      const title = r.winner == null ? 'Pareggio! 🤝' : `Vince ${nm(r.winner)}! 🏆`;
      const breakdown = [0, 1].map((i) => {
        const st = g.stats.p[i];
        const rows = Object.keys(st).filter((k) => k.startsWith('pf+') || k.startsWith('pf-')).sort().map((k) => `<tr><td>${esc(FF.Sim.STAT_LABELS[k] || k)}</td><td>${k.startsWith('pf+') ? '+' : '−'}${st[k]}</td></tr>`).join('');
        return `<div><div class="lbl">${FF.PLAYER_ICONS[i]} ${nm(i)}</div><table class="t">${rows || '<tr><td class="muted">nessun punto</td><td></td></tr>'}</table></div>`;
      }).join('');
      const dlg = UI.modal(`<div class="bigcat">${FF.Sprites.cat(r.winner == null ? 'neutro' : 'coccolone')}</div><h2>${title}</h2>
        <p class="muted">${r.winner == null ? 'Heafy dorme in mezzo al letto.' : 'Heafy dorme dalla parte di ' + nm(r.winner) + '!'}</p>
        <div class="scoreline">${[0, 1].map((i) => `<div><div class="sc ${r.winner === i ? 'win' : ''}">${r.scores[i]}</div><div class="small muted">${nm(i)}<br>${r.pf[i]} PF − ${r.rancor[i]} rancori${r.objPts && r.objPts[i] ? ' + ' + r.objPts[i] + ' obiettivi' : ''}</div></div>`).join('')}</div>
        ${r.objs && r.objs.some((l) => l.length) ? `<div class="lbl" style="text-align:left">🎯 Obiettivi segreti rivelati</div><div class="row2" style="text-align:left;margin-bottom:12px">${[0, 1].map((i) => `<div><div class="lbl">${FF.PLAYER_ICONS[i]} ${nm(i)} · ${r.objPts[i] ? '+' + r.objPts[i] : '0'} PF</div>${r.objs[i].map((o) => UI.objCard(o.id, o.ok ? 'ok' : 'ko', true)).join('')}</div>`).join('')}</div>` : ''}
        <details style="text-align:left;margin-bottom:12px"><summary class="small" style="cursor:pointer;color:var(--accent)">Da dove sono arrivati i punti</summary><div class="row2" style="margin-top:8px">${breakdown}</div></details>
        <div style="display:grid;gap:8px"><button class="btn primary" data-a="again">↺ Nuova partita</button>
        <button class="btn" data-a="log">📄 Esporta log</button><button class="btn" data-a="seed">🌱 Copia seed (${esc(c.seed)})</button><button class="btn" data-a="home">🏠 Menu principale</button></div>`, { left: false, dismiss: false, wide: true });
      dlg.el.addEventListener('click', (e) => {
        const a = e.target.dataset.a; if (!a) return;
        if (a === 'log') UI.download(`fifo-fafo-${c.seed}.txt`, this.logText());
        else if (a === 'seed') UI.copy(c.seed);
        else if (a === 'home') { dlg.close(); UI.go('home'); }
        else if (a === 'again') { dlg.close(); UI.openSetup(c.mode); }
      });
    }
  }

  UI.Session = Session;
})(typeof window !== 'undefined' ? window : globalThis);
