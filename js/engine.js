/* FIFO FAFO — motore di gioco.
   - Nessuna UI: tutto lo stato è in `game.s` (JSON puro, clonabile).
   - La partita è un generatore: `game.run()` fa `yield` di "decisioni" ({type:'flow'|'give'|...})
     e riceve la risposta; con `cfg.beats` emette anche {type:'beat'} dopo ogni evento (per animare).
   - RNG con seed → partite riproducibili. Le risposte date vengono registrate in `game.history`
     e si possono rigiocare con `cfg.replay`.
   Le interpretazioni delle regole ambigue sono elencate in docs/REGOLE_IMPLEMENTATE.md */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const { ROOMS, RES, MOODS, SPECIAL, CARDS } = FF;
  const N = ROOMS.length; // 9 stanze, disposte ad anello

  const mod = (a) => ((a % N) + N) % N;
  const dist = (a, b) => { const d = mod(a - b); return Math.min(d, N - d); };

  FF.hashSeed = function (x) {
    if (typeof x === 'number') return x | 0;
    let h = 2166136261;
    const s = String(x);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h | 0;
  };
  // mulberry32 con stato esterno: ritorna [valore, nuovoStato]
  FF.makeRng = function (seed) {
    let a = FF.hashSeed(seed);
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function newStats() { return { p: [{}, {}], g: {}, moodPF: {} }; }

  class Game {
    /* cfg: { seed, rules, players:[{name,kind}], beats, log, stats, replay } */
    constructor(cfg) {
      cfg = cfg || {};
      this.cfg = cfg;
      this.rules = Object.assign({}, FF.DEFAULT_RULES, cfg.rules || {});
      this.logOn = cfg.log !== false;
      this.statsOn = cfg.stats !== false;
      this.beats = !!cfg.beats;
      this.events = [];
      this.history = [];
      this.replay = (cfg.replay || []).slice();
      this.stats = newStats();
      this.result = null;
      this.onEvent = null;
      this.s = this._setup(cfg);
    }

    clone() {
      const g = Object.create(Game.prototype);
      g.cfg = {}; g.rules = this.rules; g.logOn = false; g.statsOn = false; g.beats = false;
      g.events = []; g.history = []; g.replay = []; g.stats = newStats(); g.result = null; g.onEvent = null;
      const t = this.s; // ring, base e wheel non cambiano dopo il setup → condivisi
      g.s = Object.assign({}, t, {
        res: t.res.map((r) => r.slice()), heafy: Object.assign({}, t.heafy),
        players: t.players.map((p) => Object.assign({}, p, { hand: p.hand.slice() })),
      });
      return g;
    }

    // ───────────────────────── setup ─────────────────────────
    _setup(cfg) {
      const s = { rng: FF.hashSeed(cfg.seed == null ? Date.now() : cfg.seed) };
      this.s = s;
      const idx = [...Array(N).keys()];
      this._shuffle(idx);
      s.ring = idx; // ring[pos] = indice in ROOMS (le posizioni vanno in senso orario)
      s.base = idx.map((ri) => ROOMS[ri].res);
      s.res = idx.map((ri) => [ROOMS[ri].res]);
      const wheel = FF.MOOD_IDS.slice();
      this._shuffle(wheel);
      s.wheel = wheel; s.wheelIdx = 0;
      s.override = null;      // mood sostitutivo temporaneo (es. Bisognoso→Irrequieto)
      s.special = null;       // 'offesissimo' | 'arrabbiatissimo'
      s.offStage = null;      // 'hit' (colpisce al prossimo giro) | 'calm' (si calma al prossimo giro)
      s.arrab = 0;            // counter Arrabbiatissimo
      s.irreqDone = false;    // Irrequieto già soddisfatto in questo turno (non accetta altro)
      s.noAdvance = false;    // la ruota è già avanzata (Arrabbiatissimo calmato): non avanzare al prossimo giro
      s.heafy = { pos: this.posOf('camera'), dir: 1, carriedBy: null, carry: null };
      const pl = cfg.players || [{ name: 'G1', kind: 'ai' }, { name: 'G2', kind: 'ai' }];
      s.players = [0, 1].map((i) => ({
        id: i, name: pl[i].name || ('G' + (i + 1)), kind: pl[i].kind || 'ai', level: pl[i].level || null,
        pos: this.posOf(i === 0 ? 'cucina' : 'mansarda'),
        pf: 0, rancor: 0, hand: [], j2: this.rules.j2Charges, interacted: false, waste: 0,
      }));
      s.turn = 0; s.first = 0; s.phase = 'setup'; s.over = false;
      s.lastFlows = null;
      s.objectives = [[], []]; // id degli obiettivi segreti tenuti da ciascun giocatore
      s.eveningFirst = null;   // chi parte per primo per tutta la sera (deciso a inizio sera)
      return s;
    }

    // ───────────────────────── utilità ─────────────────────────
    rand() {
      const s = this.s;
      let a = (s.rng + 0x6D2B79F5) | 0; s.rng = a;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    randInt(n) { return Math.floor(this.rand() * n); }
    _shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = this.randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    posOf(roomId) { return this.s.ring.findIndex((ri) => ROOMS[ri].id === roomId); }
    room(pos) { return ROOMS[this.s.ring[pos]]; }
    rname(pos) { const r = this.room(pos); return `${r.icon} ${r.name}`; }
    period(t) { return Math.floor((t - 1) / (this.rules.turns / 3)); } // 0 mattino, 1 pomeriggio, 2 sera
    static periodName(p) { return ['Mattino', 'Pomeriggio', 'Sera'][p]; }
    curMood() {
      const s = this.s;
      if (s.special) return SPECIAL[s.special];
      return MOODS[s.override || s.wheel[s.wheelIdx]];
    }
    wheelMood(offset) { const s = this.s; return MOODS[s.wheel[(s.wheelIdx + offset) % s.wheel.length]]; }
    score(pid) { const p = this.s.players[pid]; return p.pf - p.rancor; }
    pn(pid) { const p = this.s.players[pid]; return `${FF.PLAYER_ICONS[pid]} ${p.name}`; }
    resTxt(r) { return `${RES[r].i} ${RES[r].n}`; }

    stat(name, pid, n) {
      if (!this.statsOn) return;
      n = n == null ? 1 : n;
      if (pid == null || pid < 0) this.stats.g[name] = (this.stats.g[name] || 0) + n;
      else this.stats.p[pid][name] = (this.stats.p[pid][name] || 0) + n;
    }

    emit(k, text, p, data) {
      if (!this.logOn) return null;
      const ev = { i: this.events.length, t: this.s.turn, ph: this.s.phase, k, p: p == null ? -1 : p, text, d: data };
      this.events.push(ev);
      if (this.onEvent) this.onEvent(ev);
      return ev;
    }
    // ritorna un "beat" da yieldare (solo in modalità animata) oppure null
    say(k, text, p, data) { const ev = this.emit(k, text, p, data); return this.beats && ev ? { type: 'beat', ev } : null; }

    addPF(pid, d, tag) {
      const p = this.s.players[pid];
      p.pf += d;
      if (this.statsOn) {
        this.stat((d >= 0 ? 'pf+' : 'pf-') + tag, pid, Math.abs(d));
        const m = this.curMood().id;
        const mp = (this.stats.moodPF[m] = this.stats.moodPF[m] || [0, 0]);
        mp[pid] += d;
      }
    }

    // dado "a sfida": ritorna l'indice vincente (tie → ritira)
    rollOff(a, b, why) {
      let ra, rb;
      do { ra = 1 + this.randInt(6); rb = 1 + this.randInt(6); } while (ra === rb);
      const win = ra > rb ? a : b;
      return { win, ra, rb, text: `🎲 ${why}: ${this.pn(a)} ${ra} vs ${this.pn(b)} ${rb} → ${this.pn(win)}` };
    }

    // ───────────────────────── decisioni ─────────────────────────
    // Chiede una decisione al controller (o dalla coda di replay) e registra la risposta.
    *ask(dec) {
      let ans;
      if (this.replay.length) ans = this.replay.shift();
      else ans = yield dec;
      this.history.push(ans);
      return ans;
    }

    // ───────────────────────── partita ─────────────────────────
    *run() {
      const s = this.s;
      let b;
      b = this.say('sys', `🎮 Partita iniziata — seed ${this.cfg.seed}. ${this.pn(0)} (G1) parte dalla ${this.rname(s.players[0].pos)}, ${this.pn(1)} (G2) dalla ${this.rname(s.players[1].pos)}. 🐱 Heafy dorme in ${this.rname(s.heafy.pos)}.`);
      if (b) yield b;
      this.emit('sys', '🌀 Ruota Mood: ' + s.wheel.map((m) => MOODS[m].e + MOODS[m].name).join(' → '));
      if (this.rules.objectives) yield* this.dealObjectives();
      for (s.turn = 1; s.turn <= this.rules.turns; s.turn++) yield* this.turnGen();
      s.turn = this.rules.turns;
      s.phase = 'end'; s.over = true;
      // rivelazione degli obiettivi segreti
      const objs = [[], []], objPts = [0, 0];
      for (let pid = 0; pid < 2; pid++) {
        for (const id of s.objectives[pid]) {
          const o = FF.OBJECTIVES[id], ok = this.objectiveDone(pid, id);
          objs[pid].push({ id, ok, pts: o.pts });
          this.stat('obj_scelto:' + id, pid);
          if (ok) { objPts[pid] += o.pts; this.stat('obj_riuscito:' + id, pid); } else { s.players[pid].rancor += this.rules.objectiveFailRancor; this.stat('obj_fallito', pid); }
          b = this.say('obj', `🎯 ${this.pn(pid)} rivela «${o.name}»: ${ok ? `✔ riuscito → +${o.pts} PF` : `✘ non riuscito → +${this.rules.objectiveFailRancor} Rancore`}`, pid);
          if (b) yield b;
        }
      }
      const sc = [0, 1].map((i) => this.score(i) + objPts[i]);
      this.result = { scores: sc, pf: [s.players[0].pf, s.players[1].pf], rancor: [s.players[0].rancor, s.players[1].rancor], objPts, objs, winner: sc[0] === sc[1] ? null : (sc[0] > sc[1] ? 0 : 1) };
      b = this.say('end', `🏁 Fine partita! ${this.pn(0)} ${sc[0]} — ${this.pn(1)} ${sc[1]} → ` + (this.result.winner == null ? 'PAREGGIO' : `vince ${this.pn(this.result.winner)}`));
      if (b) yield b;
      return this.result;
    }

    *turnGen() {
      const s = this.s;
      s.players.forEach((p) => { p.interacted = false; });
      s.irreqDone = false;
      // primo giocatore
      const per = this.period(s.turn);
      if (per === 0) s.first = 0;
      else if (per === 1) s.first = 1;
      else if (this.rules.eveningLowestFirst) {
        // l'ordine della sera si decide una volta sola, a inizio sera (chi ha meno punti; a parità dado), e vale per tutti i turni
        if (s.eveningFirst == null) {
          const a = this.score(0), c = this.score(1);
          s.eveningFirst = a < c ? 0 : c < a ? 1 : this.rollOff(0, 1, 'Sera, parità: chi parte').win;
        }
        s.first = s.eveningFirst;
      } else s.first = 0;
      let b;
      const tp = this.rules.turns / 3;
      if ((s.turn - 1) % tp === 0) {
        const who = per === 0 ? `Per tutto il mattino parte per primo ${this.pn(0)} (G1).` : per === 1 ? `Per tutto il pomeriggio parte per primo ${this.pn(1)} (G2).` : 'Di sera parte per primo, per tutti e 5 i turni, chi ha meno punti adesso (a parità, dado).';
        b = this.say('period', `${['🌄', '☀️', '🌙'][per]} Comincia ${['il MATTINO', 'il POMERIGGIO', 'la SERA'][per]} (turni ${s.turn}–${s.turn + tp - 1}). ${who}${per > 0 ? ' Ogni stanza ha ricevuto di nuovo la sua risorsa.' : ''}`, -1, { period: per });
        if (b) yield b;
      }
      b = this.say('turn', `━━ Turno ${s.turn}/${this.rules.turns} · ${Game.periodName(per)} · parte ${this.pn(s.first)} ━━`, s.first);
      if (b) yield b;

      yield* this.heafyPhase();

      // scelta carte: simultanea e segreta
      s.phase = 'flows';
      const flows = [null, null];
      for (let pid = 0; pid < 2; pid++) {
        const p = s.players[pid];
        let f = yield* this.ask({ type: 'flow', player: pid, turn: s.turn, j2: p.j2, first: s.first });
        if (!this.validFlow(pid, f)) { f = ['A1', 'B2', 'C2', 'J1']; this.emit('warn', `⚠ Flow non valido di ${this.pn(pid)}: uso A1 B2 C2 J1`); }
        flows[pid] = f;
      }
      s.phase = 'resolve';
      s.lastFlows = flows;
      for (let pid = 0; pid < 2; pid++) {
        b = this.say('flow', `🃏 ${this.pn(pid)} — Flow: ${flows[pid].join(' → ')}`, pid, { flow: flows[pid] });
        if (b) yield b;
      }
      const order = [s.first, 1 - s.first];
      for (const pid of order) yield* this.resolveFlow(pid, flows[pid]);
      yield* this.endTurn();
    }

    // pesca (2 da A + 2 da B) e scelta degli obiettivi segreti
    *dealObjectives() {
      const s = this.s, keep = this.rules.objectivesKeep;
      const A = this._shuffle(FF.OBJECTIVE_IDS.filter((id) => FF.OBJECTIVES[id].deck === 'A'));
      const B = this._shuffle(FF.OBJECTIVE_IDS.filter((id) => FF.OBJECTIVES[id].deck === 'B'));
      for (let pid = 0; pid < 2; pid++) {
        const offer = [A.pop(), A.pop(), B.pop(), B.pop()];
        const ans = yield* this.ask({ type: 'objectives', player: pid, offer, keep });
        let picks = Array.isArray(ans) ? ans.filter((id, i, a) => offer.includes(id) && a.indexOf(id) === i).slice(0, keep) : [];
        for (const id of [offer[0], offer[2], offer[1], offer[3]]) if (picks.length < keep && !picks.includes(id)) picks.push(id);
        s.objectives[pid] = picks;
        const b = this.say('sys', `🎯 ${this.pn(pid)} ha scelto ${keep} obiettivi segreti (si rivelano a fine partita).`, pid);
        if (b) yield b;
      }
    }

    // l'obiettivo è soddisfatto ADESSO (guardando il tavolo)?
    objectiveDone(pid, id) {
      const s = this.s, p = s.players[pid], o = FF.OBJECTIVES[id];
      switch (o.kind) {
        case 'angolo': return this.room(p.pos).id === o.room;
        case 'compagno': return p.pos === s.heafy.pos;
        case 'tasche': return p.hand.length >= this.rules.handLimit;
        case 'coppia': return p.hand.length === 2 && p.hand[0] === p.hand[1];
        case 'set': return p.hand.length === 2 && p.hand.includes(o.a) && p.hand.includes(o.b);
        case 'risparmiatore': return p.j2 === this.rules.j2Charges;
        case 'primoSera': return s.eveningFirst === pid;
        default: return false;
      }
    }

    validFlow(pid, f) {
      if (!Array.isArray(f) || f.length !== 4) return false;
      const c = { A: 0, B: 0, C: 0, J: 0 };
      for (const k of f) { if (!CARDS[k]) return false; c[CARDS[k].t]++; }
      if (c.A !== 1 || c.B !== 1 || c.C !== 1 || c.J !== 1) return false;
      if (f.includes('J2') && this.s.players[pid].j2 <= 0) return false;
      return true;
    }

    // ───────────────────────── fase di Heafy ─────────────────────────
    *heafyPhase() {
      const s = this.s, h = s.heafy;
      s.phase = 'heafy';
      let b;
      // 1) Heafy in braccio → torna libero all'inizio del turno
      if (h.carriedBy != null) {
        b = this.say('heafy', `🐱 Heafy torna libero (era in braccio a ${this.pn(h.carriedBy)}) in ${this.rname(h.pos)}`);
        if (b) yield b;
        h.carriedBy = null;
        this.dropCarry();
      }
      let skipInteract = false;
      const skipAdv = s.noAdvance; s.noAdvance = false;
      if (s.special === 'arrabbiatissimo') {
        b = this.say('heafy', '🔥 Heafy Arrabbiatissimo: non cambia mood, resta fermo');
        if (b) yield b;
        const near = [mod(h.pos - 1), h.pos, mod(h.pos + 1)];
        for (const p of s.players) {
          if (near.includes(p.pos)) {
            this.addPF(p.id, -1, 'arrab_vicino');
            b = this.say('pf', `🔥 ${this.pn(p.id)} è ${p.pos === h.pos ? 'nella stanza di' : 'vicino a'} Heafy Arrabbiatissimo → −1 PF`, p.id);
            if (b) yield b;
          }
        }
      } else if (s.special === 'offesissimo' && s.offStage === 'hit') {
        const from = h.pos;
        h.pos = mod(h.pos + h.dir);
        b = this.say('heafy', `😡 Heafy Offesissimo si sposta ${this.rname(from)} → ${this.rname(h.pos)}`);
        if (b) yield b;
        for (const p of s.players) if (p.pos === h.pos) {
          this.addPF(p.id, -2, 'offesissimo_stanza');
          b = this.say('pf', `😡 Offesissimo finisce nella stanza di ${this.pn(p.id)} → −2 PF`, p.id);
          if (b) yield b;
        }
        s.offStage = 'calm';
        skipInteract = true;
      } else {
        if (s.special === 'offesissimo') { // 'calm'
          s.special = null; s.offStage = null;
          b = this.say('heafy', '😮‍💨 Heafy si calma');
          if (b) yield b;
        }
        if (s.turn > 1 && !skipAdv) s.wheelIdx = (s.wheelIdx + 1) % s.wheel.length;
        s.override = null;
        const m = this.curMood();
        this.stat('mood_' + m.id, -1);
        const dem = m.demand === 'any' ? 'qualsiasi risorsa' : m.demand ? this.resTxt(m.demand) : 'nessuna pretesa';
        b = this.say('mood', `😼 Heafy è ${m.e} ${m.name} · pretesa: ${dem}. ${FF.MOOD_MOVE[m.id]}`, -1, { mood: m.id });
        if (b) yield b;
        yield* this.moveHeafy();
      }

      // interazioni passive: chi è nella stanza di Heafy deve interagire
      if (!skipInteract) {
        const here = s.players.filter((p) => p.pos === h.pos && !p.interacted).map((p) => p.id);
        let order = here;
        if (here.length === 2) {
          const r = this.rollOff(0, 1, 'Entrambi con Heafy, chi interagisce per primo');
          b = this.say('dice', r.text);
          if (b) yield b;
          order = [r.win, 1 - r.win];
        }
        for (const pid of order) {
          if (s.special === 'offesissimo') break;
          const p = s.players[pid];
          p.interacted = true;
          b = this.say('heafy', `😼 Heafy è con ${this.pn(pid)}: interazione obbligatoria`, pid);
          if (b) yield b;
          this.stat('interact_passive', pid);
          yield* this.interact(pid, true);
        }
      }
    }

    // movimento di Heafy secondo il mood attuale
    *moveHeafy() {
      const s = this.s, h = s.heafy, m = this.curMood();
      const from = h.pos;
      let b;
      let pulled = null;
      if (m.move === 'stay') {
        b = this.say('heafy', `${m.e} Heafy resta in ${this.rname(h.pos)}`);
      } else if (m.move === 'double') {
        h.pos = mod(h.pos + 2 * h.dir);
        b = this.say('heafy', `⚡ Heafy sfreccia di 2 stanze: ${this.rname(from)} → ${this.rname(h.pos)}`);
      } else if (m.move === 'explore') {
        for (let i = 0; i < N; i++) { h.pos = mod(h.pos + h.dir); if (s.res[h.pos].length > 0) break; }
        b = this.say('heafy', `🔍 Heafy esplora: ${this.rname(from)} → ${this.rname(h.pos)}`);
      } else if (m.move.startsWith('to:')) {
        h.pos = this.posOf(m.move.slice(3));
        b = this.say('heafy', `${m.e} Heafy corre in ${this.rname(h.pos)}`);
      } else {
        h.pos = mod(h.pos + h.dir);
        b = this.say('heafy', `🐾 Heafy si sposta ${this.rname(from)} → ${this.rname(h.pos)}`);
      }
      if (b) yield b;

      // Giocherellone: sequestra una risorsa a caso della stanza d'arrivo (prima rilascia quella vecchia)
      let seq = null;
      if (m.id === 'giocherellone' && s.res[h.pos].length) seq = s.res[h.pos].splice(this.randInt(s.res[h.pos].length), 1)[0];
      if (h.carry) {
        const r = h.carry; this.dropCarry();
        b = this.say('heafy', `📍 Heafy rilascia ${this.resTxt(r)} in ${this.rname(h.pos)}`);
        if (b) yield b;
      }
      if (seq) {
        h.carry = seq;
        b = this.say('heafy', `🎾 Heafy sequestra ${this.resTxt(seq)} (non raccoglibile finché non la rilascia)`);
        if (b) yield b;
      }
      // Dispettoso: butta via una risorsa a caso dalla stanza
      if (m.id === 'dispettoso' && s.res[h.pos].length) {
        const r = s.res[h.pos].splice(this.randInt(s.res[h.pos].length), 1)[0];
        this.stat('dispettoso_buttate', -1);
        b = this.say('heafy', `😈 Heafy butta fuori dal gioco ${this.resTxt(r)} da ${this.rname(h.pos)}`);
        if (b) yield b;
      }
      // Bisognoso: attira il giocatore più vicino al Bagno
      if (m.id === 'bisognoso') {
        const d0 = dist(s.players[0].pos, h.pos), d1 = dist(s.players[1].pos, h.pos);
        if (d0 === d1) {
          if (d0 > 0) {
            const r = this.rollOff(0, 1, 'Bisognoso, stessa distanza');
            b = this.say('dice', r.text); if (b) yield b;
            pulled = r.win;
          }
        } else pulled = d0 < d1 ? 0 : 1;
        if (pulled != null && s.players[pulled].pos !== h.pos) {
          s.players[pulled].pos = h.pos;
          b = this.say('heafy', `🚽 Bisognoso attira ${this.pn(pulled)} in ${this.rname(h.pos)}`, pulled);
          if (b) yield b;
        }
      }
    }

    // rilascia la risorsa trasportata da Heafy nella stanza dove si trova
    dropCarry() { const h = this.s.heafy; if (h.carry) { this.s.res[h.pos].push(h.carry); h.carry = null; } }

    // ───────────────────────── interazione con Heafy ─────────────────────────
    // (la usano sia C1 sia l'interazione passiva)
    *interact(pid, passive) {
      const s = this.s, p = s.players[pid];
      let b;
      if (s.special === 'offesissimo') {
        if (!passive) p.waste += 1.5; // C1 inutile: Heafy non accetta niente
        b = this.say('heafy', `😡 Heafy Offesissimo non accetta nulla da ${this.pn(pid)}`, pid);
        if (b) yield b;
        return;
      }
      const m = this.curMood();
      const arrab = s.special === 'arrabbiatissimo';
      const ans = yield* this.ask({ type: 'give', player: pid, passive, mood: m.id, special: s.special, hand: p.hand.slice(), arrab: s.arrab });
      let picks = Array.isArray(ans) ? ans.slice() : [];
      // sanifica: solo risorse davvero in mano, max 1 (2 con Arrabbiatissimo)
      const tmp = p.hand.slice(); const ok = [];
      for (const r of picks) { const i = tmp.indexOf(r); if (i >= 0 && ok.length < (arrab ? 2 : 1)) { ok.push(r); tmp.splice(i, 1); } }
      picks = ok;
      const take = (rs) => { for (const r of rs) p.hand.splice(p.hand.indexOf(r), 1); this.stat('risorse_date', pid, rs.length); };
      this.stat('interact', pid);

      if (arrab) {
        if (picks.length === 2) {
          take(picks); this.addPF(pid, 2, 'arrab_calmato');
          s.special = null; s.offStage = null; s.arrab = 0;
          s.wheelIdx = (s.wheelIdx + 1) % s.wheel.length; s.override = null; s.noAdvance = true; // la ruota avanza: non si torna al vecchio mood
          const nm = this.curMood();
          b = this.say('pf', `🔥 ${this.pn(pid)} dà ${picks.map((r) => this.resTxt(r)).join(' + ')} → +2 PF. Heafy Arrabbiatissimo si calma e la ruota avanza: ora è ${nm.e} ${nm.name}`, pid);
        } else {
          this.addPF(pid, -1, 'arrab_non_soddisfatto');
          b = this.say('pf', `🔥 ${this.pn(pid)} non riesce a dare 2 risorse → −1 PF`, pid);
        }
        if (b) yield b; return;
      }
      if (s.irreqDone) { // Irrequieto ha già avuto la sua risorsa: non accetta altro in questo turno
        b = this.say('heafy', `😤 Heafy ha già avuto la sua risorsa: non accetta altro da ${this.pn(pid)}`, pid);
        if (b) yield b; return;
      }
      if (m.id === 'bisognoso') {
        if (picks[0] === 'paletta') {
          take(picks); this.addPF(pid, 3, 'bisognoso_ok');
          b = this.say('pf', `🚽 ${this.pn(pid)} dà ${this.resTxt('paletta')} → +3 PF`, pid);
        } else {
          this.addPF(pid, -1, 'bisognoso_ko');
          s.override = 'irrequieto'; this.stat('bisognoso_to_irrequieto', -1);
          b = this.say('pf', `🚽 ${this.pn(pid)} non ha la paletta → −1 PF, Heafy diventa 😤 Irrequieto`, pid);
        }
        if (b) yield b; return;
      }
      if (m.id === 'irrequieto') {
        if (s.irreqDone) {
          b = this.say('heafy', `😤 Heafy ha già avuto la sua risorsa: non accetta altro da ${this.pn(pid)}`, pid);
        } else if (picks.length) {
          take(picks); this.addPF(pid, 2, 'irrequieto_ok'); s.irreqDone = true;
          s.override = 'neutro';
          b = this.say('pf', `😤 ${this.pn(pid)} dà ${this.resTxt(picks[0])} → +2 PF, Heafy si calma (😐 Neutro) e non accetta altro`, pid);
        } else {
          this.addPF(pid, -1, 'nulla');
          b = this.say('pf', `😤 ${this.pn(pid)} non dà nulla → −1 PF`, pid);
        }
        if (b) yield b; return;
      }
      if (m.demand) { // pretesa specifica
        if (!picks.length) {
          this.addPF(pid, -1, 'nulla');
          const trig = this.triggerOffesissimo(pid);
          b = this.say('pf', `${m.e} ${this.pn(pid)} non dà nulla → −1 PF${trig ? ' · 😡 Heafy diventa Offesissimo!' : ''}`, pid);
        } else if (picks[0] === m.demand) {
          take(picks); this.addPF(pid, 2, 'giusta');
          b = this.say('pf', `${m.e} ${this.pn(pid)} dà ${this.resTxt(picks[0])} (giusta) → +2 PF`, pid);
        } else {
          take(picks); this.addPF(pid, 1, 'sbagliata');
          s.arrab++;
          let extra = '';
          if (s.arrab >= 3) { s.arrab = 0; if (!s.special) { s.special = 'arrabbiatissimo'; s.offStage = null; this.stat('arrab_scattato', -1); extra = ' · 🔥 Heafy diventa ARRABBIATISSIMO!'; } }
          b = this.say('pf', `${m.e} ${this.pn(pid)} dà ${this.resTxt(picks[0])} (sbagliata) → +1 PF · counter Arrabbiatissimo ${s.arrab}/3${extra}`, pid);
        }
        if (b) yield b; return;
      }
      // mood senza pretesa
      if (picks.length) {
        take(picks); const g = this.rules.noDemandGive;
        if (g) this.addPF(pid, g, 'senza_pretesa');
        b = this.say('pf', `${m.e} ${this.pn(pid)} dà ${this.resTxt(picks[0])} → ${g >= 0 ? '+' : ''}${g} PF`, pid);
      } else {
        this.addPF(pid, -1, 'nulla');
        b = this.say('pf', `${m.e} ${this.pn(pid)} non dà nulla → −1 PF`, pid);
      }
      if (b) yield b;
    }

    // Heafy diventa Offesissimo (se non lo è già / non è Arrabbiatissimo). Ritorna true se è scattato.
    triggerOffesissimo(pid) {
      const s = this.s;
      if (s.special) return false;
      s.special = 'offesissimo';
      s.offStage = 'hit'; // sempre: al prossimo giro si sposta e dà −2 PF, quello dopo si calma
      this.stat('offesissimo_scattato', -1);
      this.stat('offesissimo_causato', pid);
      return true;
    }

    // ───────────────────────── risoluzione di un Flow ─────────────────────────
    *resolveFlow(pid, flow) {
      const s = this.s, p = s.players[pid], h = s.heafy;
      let b;
      for (let i = 0; i < flow.length; i++) {
        const code = flow[i], c = CARDS[code];
        if (c.t === 'A') {
          const from = p.pos;
          p.pos = mod(p.pos + c.dir * c.steps);
          const withH = h.carriedBy === pid;
          if (withH) h.pos = p.pos;
          this.stat('mosse', pid, c.steps);
          b = this.say('move', `${code}: ${this.pn(pid)} ${this.rname(from)} → ${this.rname(p.pos)}${withH ? ' (con Heafy in braccio)' : ''}`, pid);
          if (b) yield b;
        } else if (code === 'B1') {
          yield* this.collect(pid);
        } else if (code === 'B2') {
          b = this.say('act', `B2: ${this.pn(pid)} non raccoglie`, pid); if (b) yield b;
        } else if (code === 'C1') {
          if (p.interacted) {
            this.stat('c1_sprecata', pid); p.waste += 0.6;
            b = this.say('act', `C1: ${this.pn(pid)} ha già interagito con Heafy in questo turno → azione saltata`, pid);
            if (b) yield b;
          } else if (p.pos === h.pos && (h.carriedBy == null || h.carriedBy === pid)) {
            p.interacted = true;
            b = this.say('act', `C1: ${this.pn(pid)} interagisce con Heafy`, pid); if (b) yield b;
            yield* this.interact(pid, false);
          } else {
            this.stat('c1_senza_heafy', pid); p.waste += p.hand.length ? 1.5 : 0.6;
            if (p.hand.length) {
              const ans = yield* this.ask({ type: 'abandon', player: pid, hand: p.hand.slice() });
              const r = p.hand.includes(ans) ? ans : p.hand[0];
              p.hand.splice(p.hand.indexOf(r), 1); s.res[p.pos].push(r);
              b = this.say('act', `C1: Heafy non è qui → ${this.pn(pid)} abbandona ${this.resTxt(r)} in ${this.rname(p.pos)}`, pid);
            } else b = this.say('act', `C1: Heafy non è qui (nessuna risorsa da abbandonare)`, pid);
            if (b) yield b;
          }
        } else if (code === 'C2') {
          b = this.say('act', `C2: ${this.pn(pid)} non interagisce`, pid); if (b) yield b;
        } else if (code === 'J1') {
          b = this.say('act', `J1: nessun effetto`, pid); if (b) yield b;
        } else if (code === 'J2') {
          yield* this.jolly(pid, flow.slice(i + 1));
        }
      }
      // Coccolone: bonus per chi finisce il flow da Heafy
      if (this.curMood().id === 'coccolone' && !s.special && p.pos === h.pos && this.rules.coccolonePF) {
        this.addPF(pid, this.rules.coccolonePF, 'coccolone_stop');
        b = this.say('pf', `🤗 ${this.pn(pid)} si ferma da Heafy Coccolone → +${this.rules.coccolonePF} PF`, pid);
        if (b) yield b;
      }
    }

    // B1: raccolta nella stanza di fermata
    *collect(pid) {
      const s = this.s, p = s.players[pid], h = s.heafy;
      const room = s.res[p.pos];
      const near = h.pos === p.pos;
      let b;
      if (p.hand.length >= this.rules.handLimit) {
        this.stat('b1_mano_piena', pid); p.waste += 0.2;
        b = this.say('act', `B1: ${this.pn(pid)} ha la mano piena → niente`, pid); if (b) yield b; return;
      }
      if (!room.length) {
        this.stat('b1_vuota', pid); p.waste += 0.2;
        b = this.say('act', `B1: ${this.pn(pid)} — ${this.rname(p.pos)} è vuota`, pid); if (b) yield b; return;
      }
      const options = [...new Set(room)];
      let pick = options[0];
      if (options.length > 1 || near) {
        const ans = yield* this.ask({ type: 'b1', player: pid, options, near, skip: near });
        if (ans == null) {
          b = this.say('act', `B1: ${this.pn(pid)} sceglie di non raccogliere (Heafy è qui)`, pid); if (b) yield b; return;
        }
        pick = options.includes(ans) ? ans : options[0];
      }
      room.splice(room.indexOf(pick), 1); p.hand.push(pick);
      this.stat('b1_raccolte', pid);
      b = this.say('act', `B1: ${this.pn(pid)} raccoglie ${this.resTxt(pick)} in ${this.rname(p.pos)}`, pid); if (b) yield b;
      if (near) { b = this.penaltyNear(pid, 'B1'); if (b) yield b; }
    }

    // raccolta nella stanza di Heafy senza jolly: −1 PF e (se possibile) Offesissimo
    penaltyNear(pid, via) {
      this.addPF(pid, -1, 'raccolta_vicino_heafy');
      const trig = this.triggerOffesissimo(pid);
      return this.say('pf', `⚠ ${this.pn(pid)} ha raccolto con Heafy presente → −1 PF${trig ? ' · 😡 Heafy diventa Offesissimo!' : ''}`, pid);
    }

    // ───────────────────────── Jolly (J2) ─────────────────────────
    j2Options(pid, done, lastPickup) {
      const s = this.s, p = s.players[pid], h = s.heafy;
      const o = [];
      if (!done.move) for (const dir of [1, -1]) for (const steps of [1, 2]) o.push({ k: 'move', dir, steps });
      if (!done.collect && s.res[p.pos].length && p.hand.length < this.rules.handLimit) {
        for (const r of new Set(s.res[p.pos])) o.push({ k: 'collect', res: r });
      }
      if (!done.pickup && h.pos === p.pos && h.carriedBy == null) {
        const rs = h.carry ? [null] : [null, ...new Set(s.res[p.pos])];
        for (const r of rs) o.push({ k: 'pickup', carry: r });
      }
      if (!done.deposit && h.carriedBy === pid) o.push({ k: 'deposit' });
      return { options: o, canFinish: !lastPickup };
    }

    // applica una singola azione del Jolly; ritorna un eventuale beat
    j2Apply(pid, a) {
      const s = this.s, p = s.players[pid], h = s.heafy;
      let b = null;
      if (a.k === 'move') {
        const from = p.pos; p.pos = mod(p.pos + a.dir * a.steps);
        const withH = h.carriedBy === pid; if (withH) h.pos = p.pos;
        this.stat('j2_mosse', pid);
        b = this.say('move', `J2 spostamento ${a.dir > 0 ? '↻' : '↺'}×${a.steps}: ${this.rname(from)} → ${this.rname(p.pos)}${withH ? ' (con Heafy)' : ''}`, pid);
      } else if (a.k === 'collect') {
        s.res[p.pos].splice(s.res[p.pos].indexOf(a.res), 1); p.hand.push(a.res);
        this.stat('j2_raccolte', pid);
        b = this.say('act', `J2 🛡 raccolta sicura: ${this.pn(pid)} prende ${this.resTxt(a.res)} (nessun Offesissimo)`, pid);
      } else if (a.k === 'pickup') {
        h.carriedBy = pid;
        if (a.carry) { s.res[p.pos].splice(s.res[p.pos].indexOf(a.carry), 1); h.carry = a.carry; }
        this.stat('j2_trasporti', pid);
        b = this.say('act', `J2 🐱 ${this.pn(pid)} prende Heafy in braccio${a.carry ? ' (gli fa portare ' + this.resTxt(a.carry) + ')' : ''}`, pid);
      } else if (a.k === 'deposit') {
        h.carriedBy = null; h.pos = p.pos;
        const c = h.carry; this.dropCarry();
        b = this.say('act', `J2 📍 ${this.pn(pid)} deposita Heafy in ${this.rname(p.pos)}${c ? ' · rilascia ' + this.resTxt(c) : ''}`, pid);
      }
      return b;
    }

    *jolly(pid, rest) {
      const s = this.s, p = s.players[pid], h = s.heafy;
      p.j2--;
      this.stat('j2_usate', pid);
      let b = this.say('act', `J2 ✨ ${this.pn(pid)} attiva il Jolly (cariche rimaste: ${p.j2})`, pid); if (b) yield b;
      const done = { move: false, collect: false, pickup: false, deposit: false };
      let last = null;
      for (let guard = 0; guard < 8; guard++) {
        const { options, canFinish } = this.j2Options(pid, done, last === 'pickup');
        if (!options.length) break;
        const ans = yield* this.ask({ type: 'j2step', player: pid, options, canFinish, rest, done: { ...done } });
        if (ans == null || ans.k === 'done') { if (canFinish) break; }
        let a = options.find((x) => ans && x.k === ans.k && x.dir === ans.dir && x.steps === ans.steps && x.res === ans.res && x.carry === ans.carry);
        if (!a) { if (canFinish) break; a = options[0]; }
        done[a.k] = true; last = a.k;
        b = this.j2Apply(pid, a);
        if (b) yield b;
      }
    }

    // ───────────────────────── fine turno ─────────────────────────
    *endTurn() {
      const s = this.s, h = s.heafy;
      let b;
      const m = this.curMood();
      if (m.id === 'irrequieto' && !s.irreqDone) {
        h.dir *= -1;
        const natural = !s.override;
        this.stat('irrequieto_inversioni', -1);
        b = this.say('heafy', `😤 Irrequieto non soddisfatto: Heafy inverte la direzione (${h.dir > 0 ? '↻ oraria' : '↺ antioraria'})`);
        if (b) yield b;
        if (natural) for (const p of s.players) if (p.pos === h.pos) {
          this.addPF(p.id, -1, 'irrequieto_cambio');
          b = this.say('pf', `😤 ${this.pn(p.id)} è con Heafy che cambia direzione → −1 PF`, p.id);
          if (b) yield b;
        }
      }
      for (const p of s.players) while (p.pf < 0) {
        p.pf++; p.rancor++;
        this.stat('rancori', p.id);
        b = this.say('pf', `😤 ${this.pn(p.id)} scende sotto zero: +1 Rancore (tot ${p.rancor})`, p.id);
        if (b) yield b;
      }
      const nextT = s.turn + 1;
      if (nextT <= this.rules.turns && this.period(nextT) !== this.period(s.turn)) {
        for (let pos = 0; pos < N; pos++) s.res[pos].push(s.base[pos]);
        b = this.say('sys', `🔄 Cambio periodo (${Game.periodName(this.period(nextT))}): ogni stanza riceve la sua risorsa originale`);
        if (b) yield b;
      }
      s.phase = 'turn_end';
    }
  }

  FF.Game = Game;
  FF.mod = mod; FF.dist = dist; FF.N = N;

  // Esegue un generatore con una "policy" sincrona: policy(game, decision) → risposta.
  FF.drive = function (game, gen, policy) {
    let r = gen.next();
    while (!r.done) {
      const d = r.value;
      r = gen.next(d.type === 'beat' ? undefined : policy(game, d));
    }
    return r.value;
  };
})(typeof window !== 'undefined' ? window : globalThis);
