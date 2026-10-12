/* FIFO FAFO — schermata di gioco in rete: stessa interfaccia della partita normale, ma lo stato arriva dal tavolo (vista filtrata)
   e le scelte tornano al tavolo. Vale per entrambi i giocatori, anche per quello che sta sul dispositivo-tavolo: così ognuno
   sfoglia i messaggi con i propri tempi e nessuno blocca l'altro. */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const UI = FF.UI;
  const { $, esc } = UI;

  class ClientSession extends UI.Session {
    /* cfg: { players, rules, mySeat, speed, code, role:'host'|'guest' }; link: { next(), send(m), close() } */
    constructor(cfg, link) {
      super(Object.assign({}, cfg, { mode: 'net', seed: '(in rete)' }));
      this.link = link; this.mySeat = cfg.mySeat;
      this.humanSeats = [cfg.mySeat];
      this.currentActor = null;
    }
    dispose() {
      super.dispose();
      try { if (this.link && this.link.close) this.link.close(); } catch (e) { /* ok */ }
      if (this.onDispose) this.onDispose();
    }
    save() { /* in rete non si salva: la partita sta sul tavolo */ }

    // applica un messaggio del tavolo: stato filtrato + nuovi eventi del log
    apply(m) {
      const g = this.game;
      if (m.s) g.s = m.s;
      if (m.evs) for (const ev of m.evs) { if (ev.i === g.events.length) { g.events.push(ev); this.onEvent(ev); } else if (ev.i < g.events.length) g.events[ev.i] = ev; }
    }
    async start(first) {
      this.buildUI();
      const g = this.game, me = this.cfg.players[this.mySeat];
      $('#tb-info').innerHTML = `<span class="chip">in rete · stanza ${esc(this.cfg.code || '')} · tu sei ${esc(me.name)}</span>`;
      const log = $('#g-log'); log.innerHTML = '';
      if (first) { g.events = []; this.apply(first); }
      this.renderAll(null);
      this.announce({ k: 'sys', p: -1, text: 'Partita in rete! I messaggi delle mosse compaiono qui: vai avanti con i tuoi tempi.', d: {} });
      for (;;) {
        const m = await this.link.next();
        if (this.cancelled) return;
        if (m.t === 'start') { g.events = []; $('#g-log').innerHTML = ''; this.apply(m); this.renderAll(null); continue; }
        if (m.t === 'log') { this.apply(m); continue; }
        if (m.t === 'beat') {
          this.apply(m);
          const ev = g.events[m.beat];
          if (!ev) continue;
          if (this.speed !== 'instant') this.renderAll(ev.p >= 0 ? ev.p : null);
          await this.pace(ev);
          continue;
        }
        if (m.t === 'decide') {
          this.apply(m);
          const d = m.d;
          this.currentActor = d.player; this.skipTo = false;
          this.renderAll(d.player);
          this.announce({ k: 'prompt', p: d.player, text: this.promptFor(d), d: {} }, { prompt: true });
          const ans = await this.humanDecide(d);
          if (this.cancelled) return;
          this.link.send({ t: 'ans', id: m.id, i: ans });
          this.setAction('<div class="muted" style="font-weight:700">Aspetto l\'altro giocatore… ⏳</div>');
          continue;
        }
        if (m.t === 'end') {
          this.apply(m);
          g.result = m.result;
          g.stats = { p: m.statsP, g: {}, moodPF: {} };
          this.renderAll(null);
          this.endDialog();
          return;
        }
      }
    }
  }
  UI.ClientSession = ClientSession;

  UI.startNetClient = function (cfg, link, first, extra) {
    if (UI.session) UI.session.dispose();
    const s = new ClientSession(cfg, link);
    if (extra && extra.onDispose) s.onDispose = extra.onDispose;
    UI.session = s;
    s.start(first);
    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
