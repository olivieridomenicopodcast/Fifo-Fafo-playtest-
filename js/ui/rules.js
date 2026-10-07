/* FIFO FAFO — pagina "Regole" (riassunto + interpretazioni adottate dall'implementazione) */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const UI = FF.UI;
  const { esc } = UI;

  UI.INTERPRETATIONS = [
    '<b>Un solo movimento di Heafy per turno</b>: prima cambia il mood (al turno 1 si rivela il primo), poi Heafy si muove secondo il nuovo mood (standard = 1 stanza nella direzione corrente).',
    '<b>Offesissimo</b>: se scatta durante le carte, al turno dopo Heafy si sposta di 1 e dà −2 PF a chi è nella stanza d\'arrivo; al turno ancora dopo si calma e la ruota riprende. Se scatta nella fase Heafy (interazione passiva), si calma al turno dopo senza colpire.',
    '<b>Raccogliere nella stanza di Heafy</b> senza Jolly: −1 PF e Offesissimo. Se Heafy è già Offesissimo o Arrabbiatissimo costa solo −1 PF (non lo sostituisce). In una stanza senza risorse non succede nulla.',
    '<b>Pretesa</b> = Heafy vuole una risorsa specifica. I mood <b>senza pretesa</b> (Neutro, Curioso, Iperattivo, Dispettoso) vogliono solo che gli dai <i>qualcosa</i>: una risorsa qualsiasi vale +1 PF (mai di più, nessun counter); niente = −1 PF, senza Offesissimo.',
    '<b>Irrequieto</b>: la prima risorsa qualsiasi = +2 PF e Heafy si calma (Neutro); per il resto del turno non accetta altro. Se nessuno lo soddisfa, a fine turno inverte la direzione e −1 PF a chi è con lui.',
    '<b>Bisognoso</b>: solo la Paletta (+3 PF, come nella tabella mood; la lista punti dice +1). Altrimenti −1 PF e Heafy è Irrequieto per il resto del turno (senza saltare la ruota). Attira il giocatore più vicino (a parità, dado).',
    '<b>Giocherellone</b> sequestra a caso una risorsa della stanza d\'arrivo e la rilascia nella stanza dove si ferma al movimento successivo. La risorsa sequestrata non è raccoglibile.',
    '<b>Dispettoso</b> butta definitivamente una risorsa a caso dalla stanza in cui si ferma.',
    '<b>Arrabbiatissimo</b>: il counter (risorse sbagliate) è unico per la partita e si azzera solo quando scatta: è una scelta strategica, puoi accettare il +1 PF sapendo che potresti farlo scattare. Ogni inizio turno −1 PF a chi è nella sua stanza o adiacente. Chiede 2 risorse qualsiasi (+2 PF); con meno di 2: −1 PF senza perdere nulla. Quando si calma <b>la ruota avanza</b>: il mood successivo vale subito per il resto del turno e fa il suo turno completo al giro dopo (non si torna al vecchio mood).',
    '<b>Coccolone</b>: nessun bonus per fermarsi da lui (tolto): solo la Coccola giusta (+2), altra risorsa (+1) o niente (−1 e Offesissimo). Resta come variante nelle regole avanzate.',
    '<b>Primo turno</b>: le interazioni passive valgono anche al turno 1, quando le mani sono vuote: può capitare una penalità iniziale. È un elemento di casualità voluto.',
    '<b>Interazione</b>: una sola per turno per giocatore (C1 o passiva). C1 con Heafy assente (o in braccio all\'avversario) = abbandoni una risorsa a scelta nella stanza.',
    '<b>Trasporto (J2)</b>: Heafy in braccio torna libero all\'inizio della fase Heafy del turno dopo. Mentre è in braccio l\'avversario non può interagire. La risorsa che gli fai portare viene rilasciata dove lo depositi o dove torna libero.',
    '<b>J2</b>: ogni azione (spostamento di 1-2 in uno dei due sensi, raccolta sicura, prendi Heafy, deposita Heafy) si usa al massimo una volta per attivazione, nell\'ordine che vuoi. "Prendi Heafy" non può essere l\'ultima azione.',
    '<b>Sera</b>: parte chi ha il punteggio netto (PF − Rancori) più basso; a parità, dado. Il pareggio finale è possibile.',
    '<b>Ruota</b>: i 10 mood compaiono una volta ciascuno in ordine casuale e si ripetono (15 turni). Risorse in mano e Flow rivelati prima della risoluzione sono informazione pubblica.',
    '<b>Non implementati</b> (TBD nel regolamento): Obiettivi Segreti, meccanismo di catch-up, mossa "Soffio".',
  ];

  UI.openRules = function () {
    UI.screen('rules');
    const moods = FF.MOOD_IDS.map((id) => `<tr><td>${FF.MOODS[id].e} <b>${FF.MOODS[id].name}</b></td><td style="text-align:left">${esc(UI.MOOD_HELP[id])}</td></tr>`).join('');
    const sp = ['offesissimo', 'arrabbiatissimo'].map((id) => `<tr><td>${FF.SPECIAL[id].e} <b>${FF.SPECIAL[id].name}</b></td><td style="text-align:left">${esc(UI.MOOD_HELP[id])}</td></tr>`).join('');
    const rooms = FF.ROOMS.map((r) => `${r.icon} ${r.name} → ${FF.RES[r.res].i}`).join(' · ');
    document.getElementById('s-rules').innerHTML = `<div class="wrap rules">
      <div class="card"><h2>📖 Regole come sono implementate</h2>
        <p>Due giocatori si contendono i favori di <b>Heafy</b>, il gatto di casa, per <b>15 turni</b> (Mattino 1-5, Pomeriggio 6-10, Sera 11-15). Vince chi ha più <b>PF − Rancori</b>: Heafy dorme dalla sua parte del letto.</p>
        <h3>Setup</h3><ul><li>9 stanze disposte a caso su un anello (si naviga in senso orario/antiorario). Ogni stanza ha 1 risorsa: ${rooms}.</li>
        <li>Heafy parte dalla Camera, G1 dalla Cucina, G2 dalla Mansarda. I 10 mood sono in ordine casuale nella ruota.</li>
        <li>Al cambio di periodo ogni stanza riceve di nuovo la sua risorsa originale (anche se ne ha già).</li></ul>
        <h3>Un turno</h3><ol style="padding-left:20px"><li><b>Heafy</b>: cambia mood e si muove; chi è nella sua stanza deve interagire (passivo).</li>
        <li><b>Carte</b> (segrete): ognuno sceglie 1 A, 1 B, 1 C e 1 J e le ordina nel proprio <b>Flow</b>.</li>
        <li><b>Risoluzione</b>: prima il giocatore di turno esegue il Flow, poi l'altro. Le azioni impossibili si saltano.</li></ol>
        <h3>Carte</h3><ul><li><b>A</b> movimento: A1 orario ×1, A2 orario ×2, A3 antiorario ×1, A4 antiorario ×2.</li>
        <li><b>B1</b> raccogli 1 risorsa nella stanza dove sei quando la carta viene eseguita (max 2 in mano) · B2 niente.</li>
        <li><b>C1</b> interagisci con Heafy (stessa stanza): dai 1 risorsa · C2 niente.</li>
        <li><b>J1</b> niente · <b>J2</b> Jolly (solo 2 volte per partita): spostamento 1-2, raccolta sicura vicino a Heafy, prendi/deposita Heafy.</li></ul>
        <h3>Punti</h3><ul><li>Risorsa giusta +2 PF · sbagliata +1 PF e counter Arrabbiatissimo +1 (a 3 scatta) · niente −1 PF e Offesissimo.</li>
        <li>Se i PF scendono sotto zero a fine turno, ogni punto sotto zero diventa un <b>Rancore</b> (−1 a fine partita).</li></ul></div>
      <div class="card"><h2>😼 I mood</h2><div class="tscroll"><table class="t">${moods}${sp}</table></div></div>
      <div class="card"><h2>🧩 Interpretazioni adottate</h2>
        <p class="small muted">Il regolamento lascia qualche punto aperto: ecco come l'ho risolto. Se cambi idea, è un posto solo nel motore (js/engine.js) — e alcune cose sono già parametri in “Varianti di regole”.</p>
        <ul>${UI.INTERPRETATIONS.map((t) => `<li>${t}</li>`).join('')}</ul></div>
      <div class="btn-row"><button class="btn" id="ru-back">← Indietro</button></div></div>`;
    document.getElementById('ru-back').onclick = () => UI.go('home');
  };
})(typeof window !== 'undefined' ? window : globalThis);
