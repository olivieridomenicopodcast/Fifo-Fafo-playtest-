/* FIFO FAFO — partita in rete: il "tavolo" (Runner) che fa girare le regole e parla con i due giocatori.
   Nessuna grafica e nessun PeerJS qui: il Runner conosce solo dei "link" ({ send(msg), online() }) e funziona uguale in Node (test) e nel browser.
   - Il tavolo tiene lo stato vero. A ogni giocatore manda una VISTA FILTRATA: niente seed/rng (da cui si ricostruirebbero le scelte casuali),
     niente obiettivi segreti dell'avversario (fino alla fine partita), niente Flow dell'avversario prima della rivelazione (non sono nello stato).
   - Tutti i messaggi sono JSON puro (si controlla nei test). */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const Net = (FF.Net = FF.Net || {});

  const clone = (x) => JSON.parse(JSON.stringify(x));

  // stato visto da `seat`: copia JSON senza i segreti
  Net.viewState = function (game, seat, final) {
    const s = clone(game.s);
    s.rng = (Math.floor(Math.random() * 2147483647) + 1) | 0;   // numero casuale a caso: serve solo perché le anteprime dell'interfaccia hanno un generatore
    if (!final && !game.s.over) s.objectives = s.objectives.map((l, i) => (i === seat ? l : l.map(() => '?')));
    return s;
  };

  // un evento del log senza il seed (dal seed si può ricostruire tutta la partita)
  Net.cleanEvent = function (ev, seed) {
    const e = clone(ev);
    if (seed != null && seed !== '') e.text = String(e.text).split(' — seed ' + seed).join('');
    return e;
  };

  Net.isPure = function (x) {
    try { return JSON.stringify(JSON.parse(JSON.stringify(x))) === JSON.stringify(x); } catch (e) { return false; }
  };

  class Runner {
    /* cfg: { seed, rules, players:[{name,kind:'human'|'ai',level}], takeoverLevel } — links[seat] = { send(msg), online() } */
    constructor(cfg) {
      this.cfg = cfg;
      this.seed = cfg.seed == null ? String(Math.floor(Math.random() * 1e9)) : String(cfg.seed);
      this.game = new FF.Game({ seed: this.seed, rules: cfg.rules, players: cfg.players, beats: true, log: true });
      this.rules = this.game.rules;
      this.links = [null, null];
      this.sent = [0, 0];            // quanti eventi del log ha già ricevuto ciascun giocatore
      this.pending = [null, null];   // decisione in attesa di risposta: { id, d, resolve }
      this.takeover = [null, null];  // AI che gioca al posto di un giocatore caduto
      this.ai = cfg.players.map((p, i) => (p.kind === 'ai' ? FF.AI.create(p.level, this.seed + 'a' + i) : null));
      this.seq = 0; this.finished = false; this.stopped = false;
      this.onOffline = null; this.onBack = null;
    }
    attach(seat, link) { this.links[seat] = link; }
    online(seat) { const l = this.links[seat]; return !!(l && l.online()); }

    _events(seat) {
      const ev = this.game.events.slice(this.sent[seat]).map((e) => Net.cleanEvent(e, this.seed));
      this.sent[seat] = this.game.events.length;
      return ev;
    }
    _msg(seat, msg, final) { return Object.assign({}, msg, { s: Net.viewState(this.game, seat, final), evs: this._events(seat) }); }
    _send(seat, msg, final) {
      if (!this.online(seat)) return;
      try { this.links[seat].send(this._msg(seat, msg, final)); } catch (e) { /* link caduto: lo gestisce chi lo possiede */ }
    }
    _broadcast(msg, final) { for (let seat = 0; seat < 2; seat++) this._send(seat, msg, final); }

    // dati per far entrare (o rientrare) un giocatore: giocatori, regole, stato e log fino a ora
    snapshot(seat) {
      return {
        t: 'start', seat, players: clone(this.cfg.players), rules: clone(this.rules), s: Net.viewState(this.game, seat, this.finished), evs: [],
      };
    }
    // il log fino a ora, a pezzetti (PeerJS non regge messaggi sopra ~16 KB)
    _sendLog(seat, link) {
      const all = this.game.events.map((e) => Net.cleanEvent(e, this.seed));
      for (let i = 0; i < all.length; i += 25) { try { link.send({ t: 'log', evs: all.slice(i, i + 25) }); } catch (e) { /* ok */ } }
      this.sent[seat] = this.game.events.length;
    }
    // il giocatore (ri)entra: gli si manda la situazione e, se c'è, la scelta pendente
    join(seat, link) {
      this.links[seat] = link;
      if (this.takeover[seat]) this.takeover[seat] = null;
      try { link.send(this.snapshot(seat)); } catch (e) { /* ok */ }
      this._sendLog(seat, link);
      const p = this.pending[seat];
      if (p) this._send(seat, { t: 'decide', id: p.id, d: p.d });
      if (this.finished) this._send(seat, this._endMsg(), true);
      if (this.onBack) this.onBack(seat);
    }
    drop(seat) { if (this.onOffline && !this.finished && !this.stopped) this.onOffline(seat); }
    // scelta che arriva dal giocatore
    answer(seat, id, ans) {
      const p = this.pending[seat];
      if (!p || p.id !== id) return;
      this.pending[seat] = null; p.resolve(ans);
    }
    // l'AI gioca al posto di chi è caduto (anche per la scelta pendente)
    takeOver(seat) {
      this.takeover[seat] = FF.AI.create(this.cfg.takeoverLevel || 'medium', this.seed + 't' + seat);
      const p = this.pending[seat];
      if (p) { this.pending[seat] = null; p.resolve(this._aiAnswer(this.takeover[seat], p.d)); }
    }
    _aiAnswer(ai, d) {
      try { return ai.decide(this.game, d); } catch (e) { return FF.AI.greedy(this.game, d); }
    }
    _decide(d) {
      const seat = d.player;
      if (this.ai[seat]) return Promise.resolve(this._aiAnswer(this.ai[seat], d));
      if (this.takeover[seat]) return Promise.resolve(this._aiAnswer(this.takeover[seat], d));
      return new Promise((resolve) => {
        const p = { id: ++this.seq, d, resolve };
        this.pending[seat] = p;
        if (this.online(seat)) this._send(seat, { t: 'decide', id: p.id, d });
        else this.drop(seat);
      });
    }
    _endMsg() {
      const st = this.game.stats;
      return { t: 'end', result: clone(this.game.result), statsP: clone(st.p) };
    }
    stop() { this.stopped = true; for (let i = 0; i < 2; i++) { const p = this.pending[i]; if (p) { this.pending[i] = null; p.resolve(null); } } }

    // fa girare la partita fino in fondo
    async run() {
      const g = this.game, it = g.run();
      let r = it.next(), n = 0;
      while (!r.done) {
        if (this.stopped) return null;
        const d = r.value;
        if (d.type === 'beat') {
          this._broadcast({ t: 'beat', beat: d.ev.i }, false);
          r = it.next();
          if (++n % 20 === 0) await new Promise((res) => setTimeout(res, 0));   // lascia respirare il browser
          continue;
        }
        const ans = await this._decide(d);
        if (this.stopped) return null;
        r = it.next(ans);
      }
      this.finished = true;
      this._broadcast(this._endMsg(), true);
      return g.result;
    }
  }
  Net.Runner = Runner;

  // coppia di link in memoria (per il giocatore che sta sul dispositivo-tavolo, e per i test)
  Net.localPair = function (onAnswer) {
    const q = [], waiters = [];
    let on = true;
    const toClient = { send(m) { q.push(clone(m)); const w = waiters.shift(); if (w) w(); }, online: () => on, close() { on = false; } };
    const client = {
      next() { return new Promise((res) => { const go = () => { if (q.length) res(q.shift()); else waiters.push(go); }; go(); }); },
      send(m) { onAnswer(clone(m)); },
      close() { waiters.splice(0).forEach((w) => w()); },
    };
    return { toClient, client };
  };
})(typeof window !== 'undefined' ? window : globalThis);
