/* FIFO FAFO — partita in rete: collegamento fra due dispositivi (WebRTC tramite PeerJS).
   Il dispositivo che crea la stanza (Room) fa da tavolo: tiene lo stato vero e fa girare le regole (FF.Net.Runner); l'altro (Guest) riceve la sua
   vista filtrata e rimanda le proprie scelte. Il servizio pubblico di PeerJS serve solo a far trovare i dispositivi (serve internet al momento del
   collegamento); poi i dati passano direttamente fra i dispositivi. Per i test: ?peerhost=localhost&peerport=9000 usa un server locale. */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const UI = FF.UI;
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const PREFIX = 'fifo-fafo-';
  const net = (UI.net = {});
  net.available = () => typeof root.Peer === 'function';
  net.newCode = () => { let c = ''; for (let i = 0; i < 4; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return c; };
  net.peerOpts = () => {
    const q = new URLSearchParams(root.location ? root.location.search : '');
    const o = { debug: 0 };
    if (q.get('peerhost')) { o.host = q.get('peerhost'); o.port = +q.get('peerport') || 9000; o.path = q.get('peerpath') || '/'; o.secure = q.get('peersecure') === '1'; }
    return o;
  };
  net.keepAwake = async () => { try { if (navigator.wakeLock) net._lock = await navigator.wakeLock.request('screen'); } catch (e) { /* non supportato */ } };
  net.releaseAwake = () => { try { if (net._lock) net._lock.release(); } catch (e) { /* ok */ } net._lock = null; };

  // ───────────── tavolo (chi crea la stanza) ─────────────
  class Room {
    constructor() {
      this.guest = null; this.started = false; this.runner = null; this.seat = null;
      this.onLobby = null; this.onError = null;
      this.dog = setInterval(() => {      // un dispositivo che sparisce di colpo (schermo spento) non sempre avvisa: si controlla il battito
        const g = this.guest; if (!g || !g.online || !g.conn) return;
        if (Date.now() - (g.seen || Date.now()) > 12000) this._closed(g.conn); else try { g.conn.send({ t: 'ping' }); } catch (e) { /* ok */ }
      }, 4000);
    }
    open(code) {
      this.code = code;
      return new Promise((resolve, reject) => {
        this.peer = new root.Peer(PREFIX + code, net.peerOpts());
        this.peer.on('open', () => { this.opened = true; resolve(code); });
        this.peer.on('error', (e) => { if (!this.opened) reject(e); else if (this.onError) this.onError(e); });
        this.peer.on('connection', (conn) => {
          conn.on('data', (m) => this._data(conn, m));
          conn.on('close', () => this._closed(conn));
          conn.on('error', () => this._closed(conn));
        });
        this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch (e) { /* ok */ } });
      });
    }
    _data(conn, m) {
      if (!m || typeof m !== 'object') return;
      if (this.guest && this.guest.conn === conn) this.guest.seen = Date.now();
      if (m.t === 'ping') return;
      if (m.t === 'hello') {
        const name = String(m.name || 'Amico').slice(0, 20).trim() || 'Amico';
        const g = this.guest;
        if (g && g.name === name && !g.online) {        // rientra lo stesso giocatore
          g.conn = conn; g.online = true; g.seen = Date.now();
          if (this.started && this.runner) this.runner.join(this.seat, this._link());
          else this._lobby();
          return;
        }
        if (g && g.online) { try { conn.send({ t: 'reject', why: 'La stanza è già piena: si gioca in due.' }); } catch (e) { /* ok */ } return; }
        if (this.started) { try { conn.send({ t: 'reject', why: 'La partita è già iniziata.' }); } catch (e) { /* ok */ } return; }
        this.guest = { name, conn, online: true, seen: Date.now() };
        this._lobby();
      } else if (m.t === 'ans') {
        if (this.guest && this.guest.conn === conn && this.runner) this.runner.answer(this.seat, m.id, m.i);
      }
    }
    _closed(conn) {
      const g = this.guest; if (!g || g.conn !== conn || !g.online) return;
      g.online = false;
      if (!this.started) { this.guest = null; this._lobby(); return; }
      if (this.runner) this.runner.drop(this.seat);
    }
    _lobby() {
      if (this.onLobby) this.onLobby(this.guest ? { name: this.guest.name, online: this.guest.online } : null);
      const g = this.guest; if (g && g.online && !this.started) { try { g.conn.send({ t: 'lobby', you: g.name, info: this.lobbyInfo || '' }); } catch (e) { /* ok */ } }
    }
    _link() {
      const room = this;
      return { send(m) { const g = room.guest; if (g && g.online) g.conn.send(m); }, online: () => !!(room.guest && room.guest.online) };
    }
    // inizio partita: il giocatore in rete siede al posto `seat` del Runner
    begin(runner, seat) {
      this.started = true; this.runner = runner; this.seat = seat;
      runner.join(seat, this._link());
    }
    guestName() { return this.guest ? this.guest.name : ''; }
    close() { clearInterval(this.dog); try { if (this.guest && this.guest.conn) this.guest.conn.close(); if (this.peer) this.peer.destroy(); } catch (e) { /* ok */ } }
  }

  // ───────────── giocatore che si unisce ─────────────
  class Guest {
    constructor() { this.q = []; this.waiters = []; this.onLobby = null; this.onStart = null; this.onReject = null; this.onLost = null; this.closed = false; }
    connect(code, name) {
      this.code = code; this.name = name;
      return new Promise((resolve, reject) => {
        let done = false;
        const fail = (why) => { if (!done) { done = true; reject(new Error(why)); } };
        this.peer = new root.Peer(undefined, net.peerOpts());
        this.peer.on('error', (e) => fail(e && e.type === 'peer-unavailable' ? 'Stanza non trovata: controlla il codice.' : 'Impossibile collegarsi (' + ((e && e.type) || 'errore') + '). Serve internet per il primo collegamento.'));
        this.peer.on('open', () => {
          this.conn = this.peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
          this.conn.on('open', () => {
            this.conn.send({ t: 'hello', name }); this.seen = Date.now();
            this.dog = setInterval(() => {
              if (this.closed) return;
              try { this.conn.send({ t: 'ping' }); } catch (e) { /* ok */ }
              if (Date.now() - this.seen > 14000) { clearInterval(this.dog); if (this.onLost) this.onLost(); }
            }, 4000);
            if (!done) { done = true; resolve(); }
          });
          this.conn.on('data', (m) => this._data(m));
          this.conn.on('close', () => { if (!this.closed && this.onLost) this.onLost(); });
          this.conn.on('error', () => { if (!this.closed && this.onLost) this.onLost(); });
        });
        setTimeout(() => fail('Nessuna risposta dalla stanza: controlla il codice e che il tavolo sia aperto.'), 20000);
      });
    }
    _data(m) {
      if (!m || typeof m !== 'object') return;
      this.seen = Date.now();
      if (m.t === 'ping') return;
      // messaggi che arrivano prima che l'interfaccia sia pronta (es. rientro: il tavolo risponde subito) restano in attesa di flush()
      if (m.t === 'lobby') { if (this.onLobby) this.onLobby(m); return; }
      if (m.t === 'reject') { if (this.onReject) this.onReject(m.why); else (this.early = this.early || []).push(m); return; }
      if (m.t === 'start' && !this.started) { if (this.onStart) { this.started = true; this.onStart(m); } else (this.early = this.early || []).push(m); return; }
      this.q.push(m);
      const w = this.waiters.shift(); if (w) w();
    }
    flush() { const e = this.early || []; this.early = []; e.forEach((m) => this._data(m)); }
    // interfaccia "link" del giocatore: next() / send()
    next() { return new Promise((res) => { const go = () => { if (this.q.length) res(this.q.shift()); else this.waiters.push(go); }; go(); }); }
    send(m) { try { this.conn.send(m); } catch (e) { /* connessione persa */ } }
    close() { this.closed = true; clearInterval(this.dog); try { this.peer.destroy(); } catch (e) { /* ok */ } this.waiters.splice(0).forEach((w) => w()); }
  }
  net.Room = Room; net.Guest = Guest;
})(typeof window !== 'undefined' ? window : globalThis);
