/* FIFO FAFO — partita in rete a due: creare la stanza (tavolo), unirsi con il codice, caduta e rientro. */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const UI = FF.UI;
  const { $, esc } = UI;
  const SPEEDS = { step: 'Manuale (clic per avanzare)', slow: 'Lento', normal: 'Normale', fast: 'Veloce' };
  const joinLink = (code) => { const u = new URL(root.location.href); u.search = ''; u.hash = ''; u.searchParams.set('join', code); return u.toString(); };
  const speedSeg = (def) => `<div class="field"><label>Messaggi delle mosse (solo per te)</label><div class="seg" id="nl-speed">${Object.entries(SPEEDS).map(([k, v]) => `<button data-v="${k}" class="${k === def ? 'sel' : ''}">${v}</button>`).join('')}</div></div>`;
  const noNet = () => `<p class="small" style="color:var(--bad)">Il componente di collegamento non è stato caricato (serve aprire l'app una volta con internet). Riprova più tardi.</p>`;

  // ───────────── chi crea la stanza ─────────────
  UI.netHost = function () {
    UI.screen('setup');
    const el = $('#s-setup');
    const last = UI.store.get('net_host', {});
    el.innerHTML = `<div class="wrap" style="max-width:600px"><div class="card"><h2>👥 Partita in rete — crea la stanza</h2>
      <p class="small muted" style="margin-bottom:12px">Due dispositivi sullo stesso wifi (o con internet), ognuno con il proprio schermo: nessun account e nessun server tuo. Questo dispositivo fa da tavolo.</p>
      <div class="field"><label>Il tuo nome</label><input type="text" id="nl-name" value="${esc(last.name || UI.store.get('pname', 'Niky'))}" maxlength="16"></div>
      <div class="field"><label>Il tuo posto</label><div class="seg" id="nl-seat">
        <button data-v="rand" class="${(last.seat || 'rand') === 'rand' ? 'sel' : ''}">🎲 A caso</button>
        <button data-v="0" class="${last.seat === '0' ? 'sel' : ''}">G1 · Cucina · primo al mattino</button>
        <button data-v="1" class="${last.seat === '1' ? 'sel' : ''}">G2 · Mansarda · primo al pomeriggio</button></div></div>
      ${speedSeg(last.speed || 'step')}
      <div class="field"><label>Seed (vuoto = casuale)</label><input type="text" id="nl-seed" placeholder="es. prova-1" value=""></div>
      <div id="nl-room" class="card" style="margin:12px 0;text-align:center"><div class="small muted">Codice stanza</div><div id="nl-code" style="font-size:2.4rem;font-weight:900;letter-spacing:.25em">····</div><div id="nl-status" class="small muted">Mi collego al servizio per aprire la stanza…</div></div>
      <div id="nl-err" class="small" style="color:var(--bad);min-height:1.3em"></div>
      <div class="btn-row"><button class="btn" id="nl-back">← Indietro</button><button class="btn primary" id="nl-go" style="flex:1" disabled>Inizia la partita</button></div></div></div>`;
    ['nl-speed', 'nl-seat'].forEach((id) => UI.seg($('#' + id)));
    if (!UI.net.available()) { $('#nl-status').innerHTML = noNet(); $('#nl-back').onclick = () => UI.go('home'); return; }
    const room = new UI.net.Room(); UI.netRoom = room;   // (anche per le prove nel browser)
    UI.net.keepAwake();
    let guestOn = false;
    const goBack = () => { room.close(); UI.net.releaseAwake(); UI.go('home'); };
    $('#nl-back').onclick = goBack;
    room.onLobby = (g) => {
      guestOn = !!(g && g.online);
      $('#nl-status').innerHTML = guestOn ? `🟢 <b>${esc(g.name)}</b> è collegato. Puoi iniziare!` : 'Aspetto che l\'altro giocatore si colleghi…';
      $('#nl-go').disabled = !guestOn;
    };
    room.onError = (e) => { $('#nl-err').textContent = 'Problema di collegamento: ' + ((e && e.type) || 'errore'); };
    const open = async (tries) => {
      const code = UI.net.newCode();
      try { await room.open(code); } catch (e) {
        if (e && e.type === 'unavailable-id' && tries < 4) return open(tries + 1);
        $('#nl-err').textContent = 'Non riesco ad aprire la stanza (' + ((e && e.type) || 'errore') + '). Serve internet per il collegamento iniziale.';
        $('#nl-status').textContent = ''; return;
      }
      $('#nl-code').textContent = code;
      const link = joinLink(code);
      $('#nl-status').innerHTML = `L'altro giocatore sceglie «Unisciti a una stanza» e scrive questo codice, oppure apre questo link:<div style="word-break:break-all;margin:6px 0">${esc(link)}</div>
        <button class="btn sm" id="nl-share">📤 Condividi il link</button>`;
      $('#nl-share').onclick = async () => { try { if (navigator.share) await navigator.share({ title: 'FIFO FAFO', text: 'Codice stanza ' + code, url: link }); else { await navigator.clipboard.writeText(link); UI.toast('Link copiato'); } } catch (e) { /* annullato */ } };
    };
    open(0);
    $('#nl-go').onclick = () => {
      if (!guestOn) return;
      const name = $('#nl-name').value.trim() || 'Giocatore 1';
      const seatSel = UI.segVal($('#nl-seat')), speed = UI.segVal($('#nl-speed'));
      const mySeat = seatSel === 'rand' ? (Math.random() < 0.5 ? 0 : 1) : Number(seatSel);
      const other = room.guestName();
      const players = [null, null];
      players[mySeat] = { name, kind: 'human' };
      players[1 - mySeat] = { name: other.toLowerCase() === name.toLowerCase() ? other + ' 2' : other, kind: 'human' };
      UI.store.set('net_host', { name, seat: seatSel, speed }); UI.store.set('pname', name);
      const seed = $('#nl-seed').value.trim() || UI.randomSeed();
      const runner = new FF.Net.Runner({ seed, players });
      const pair = FF.Net.localPair((m) => { if (m && m.t === 'ans') runner.answer(mySeat, m.id, m.i); });
      runner.attach(mySeat, pair.toClient);
      room.begin(runner, 1 - mySeat);
      hostOfflineUI(runner, room, players, 1 - mySeat);
      const cfg = { players, rules: runner.rules, mySeat, speed, code: room.code, role: 'host' };
      UI.startNetClient(cfg, pair.client, runner.snapshot(mySeat), { onDispose: () => { runner.stop(); room.close(); UI.net.releaseAwake(); } });
      runner.run().then((res) => { if (res) UI.net.releaseAwake(); });
    };
  };

  // avviso al tavolo quando l'altro giocatore cade: aspetto / gioca l'AI al suo posto
  function hostOfflineUI(runner, room, players, seat) {
    const st = { open: false, dlg: null };
    const closeDlg = () => { if (st.dlg) { st.dlg.close(); st.dlg = null; } st.open = false; };   // azzera SEMPRE il flag, anche se si chiude per il rientro
    runner.onBack = () => { closeDlg(); UI.toast(players[seat].name + ' è tornato'); };
    runner.onOffline = () => {
      if (st.open) return;
      st.open = true;
      const nm = esc(players[seat].name);
      st.dlg = UI.modal(`<h2>📴 ${nm} si è disconnesso</h2><p class="muted" style="margin-bottom:14px">Se rientra con lo stesso nome riprende da dove era, con la scelta ancora in sospeso.</p>
        <div style="display:grid;gap:8px"><button class="btn primary" data-w>⏳ Aspetto che torni</button><button class="btn" data-ai>🤖 Gioca l'AI al posto suo</button></div>`, { dismiss: false });
      st.dlg.el.querySelector('[data-w]').onclick = () => { closeDlg(); };
      st.dlg.el.querySelector('[data-ai]').onclick = () => { closeDlg(); runner.takeOver(seat); UI.toast('Ora gioca l\'AI al posto di ' + players[seat].name); };
    };
  }

  // ───────────── chi si unisce ─────────────
  const wait = (guest, code, name) => {
    UI.screen('setup');
    const el = $('#s-setup');
    el.innerHTML = `<div class="wrap" style="max-width:560px"><div class="card"><h2>👥 Partita in rete</h2><p id="nj-info">Collegato alla stanza <b>${esc(code)}</b>. In attesa che il tavolo inizi la partita…</p><p id="nj-err" class="small" style="color:var(--bad)"></p>
      <div class="btn-row"><button class="btn" id="nj-exit">Esci</button></div></div></div>`;
    $('#nj-exit').onclick = () => { guest.close(); UI.net.releaseAwake(); UI.go('home'); };
    guest.onReject = (why) => { guest.close(); $('#nj-err').textContent = why; };
    guest.onStart = (m) => {
      const cfg = { players: m.players, rules: m.rules, mySeat: m.seat, speed: UI.store.get('net_join', {}).speed || 'step', code, role: 'guest' };
      const sess = UI.startNetClient(cfg, guest, m, { onDispose: () => UI.net.releaseAwake() });
      guest.onLost = () => {
        if (guest.closed || (UI.session !== sess)) return;
        const dlg = UI.modal(`<h2>📴 Collegamento perso</h2><p class="muted" style="margin-bottom:14px">Se il tavolo è ancora aperto puoi rientrare con lo stesso nome: riprendi da dove eri.</p>
          <div style="display:grid;gap:8px"><button class="btn primary" data-r>🔄 Riconnetti</button><button class="btn" data-q>Esci</button></div>`, { dismiss: false });
        dlg.el.querySelector('[data-r]').onclick = () => { dlg.close(); guest.close(); UI.rejoin(code, name); };
        dlg.el.querySelector('[data-q]').onclick = () => { dlg.close(); UI.go('home'); };
      };
    };
    guest.onLost = () => { const e = $('#nj-err'); if (e) e.textContent = 'Collegamento perso.'; };   // prima dell'inizio: poi onStart lo sostituisce
    guest.flush();
  };
  const doJoin = async (code, name) => {
    const guest = new UI.net.Guest();
    try { await guest.connect(code, name); } catch (e) { return { err: e.message }; }
    UI.store.set('pname', name);
    UI.net.keepAwake();
    wait(guest, code, name);
    return { ok: true };
  };
  UI.netJoin = function (prefill) {
    UI.screen('setup');
    const el = $('#s-setup');
    const sp = UI.store.get('net_join', {}).speed || 'step';
    el.innerHTML = `<div class="wrap" style="max-width:520px"><div class="card"><h2>👥 Unisciti alla partita di un amico</h2>
      <div class="field"><label>Codice stanza (4 caratteri)</label><input type="text" id="nj-code" value="${esc((prefill || '').toUpperCase())}" maxlength="4" style="font-size:1.8rem;letter-spacing:.25em;text-transform:uppercase;text-align:center"></div>
      <div class="field"><label>Il tuo nome</label><input type="text" id="nj-name" value="${esc(UI.store.get('pname', ''))}" maxlength="16"></div>
      ${speedSeg(sp)}
      <div id="nj-err" class="small" style="color:var(--bad);min-height:1.3em"></div>
      <div class="btn-row"><button class="btn" id="nj-back">← Indietro</button><button class="btn primary" id="nj-go" style="flex:1">Entra</button></div>
      <p class="small muted" style="margin-top:10px">Il codice lo vedi sul dispositivo di chi ha creato la stanza.</p></div></div>`;
    UI.seg($('#nl-speed'));
    if (!UI.net.available()) { $('#nj-err').innerHTML = noNet(); }
    $('#nj-back').onclick = () => UI.go('home');
    $('#nj-go').onclick = async () => {
      const c = $('#nj-code').value.trim().toUpperCase(), n = $('#nj-name').value.trim(), err = $('#nj-err');
      if (c.length !== 4) { err.textContent = 'Il codice ha 4 caratteri.'; return; }
      if (!n) { err.textContent = 'Scrivi il tuo nome.'; return; }
      UI.store.set('net_join', { speed: UI.segVal($('#nl-speed')) });
      $('#nj-go').disabled = true; err.textContent = 'Mi collego…';
      const r = await doJoin(c, n);
      if (r.err) { $('#nj-go').disabled = false; err.textContent = r.err; }
    };
  };
  UI.rejoin = async function (code, name) {
    UI.screen('setup');
    $('#s-setup').innerHTML = `<div class="wrap" style="max-width:520px"><div class="card"><h2>👥 Riconnessione…</h2><p>Mi ricollego alla stanza ${esc(code)}…</p><p id="nj-err" class="small" style="color:var(--bad)"></p>
      <div class="btn-row"><button class="btn primary hidden" id="nj-retry">Riprova</button><button class="btn" id="nj-exit">Esci</button></div></div></div>`;
    $('#nj-exit').onclick = () => UI.go('home');
    const r = await doJoin(code, name);
    if (r.err) { $('#nj-err').textContent = r.err; const b = $('#nj-retry'); b.classList.remove('hidden'); b.onclick = () => UI.rejoin(code, name); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
