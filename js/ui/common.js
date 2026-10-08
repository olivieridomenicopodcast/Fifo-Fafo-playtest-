/* FIFO FAFO — utilità UI condivise */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const UI = (FF.UI = FF.UI || {});

  UI.$ = (sel, el) => (el || document).querySelector(sel);
  UI.$$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  UI.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  UI.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  UI.nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  // localStorage "sicuro" (può essere bloccato in navigazione privata)
  UI.store = {
    get(k, d) { try { const v = localStorage.getItem('ff_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ff_' + k, JSON.stringify(v)); } catch (e) { /* ignora */ } },
    del(k) { try { localStorage.removeItem('ff_' + k); } catch (e) { /* ignora */ } },
  };

  let toastT;
  UI.toast = function (msg) {
    const t = UI.$('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  };

  UI.screen = function (id) {
    UI.$$('.screen').forEach((s) => s.classList.toggle('active', s.id === 's-' + id));
    window.scrollTo(0, 0);
    UI.$('#tb-info').innerHTML = '';
  };

  // Finestra modale. ritorna { el, close }
  UI.modal = function (html, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'overlay' + (opts.solid ? ' solid' : '');
    wrap.innerHTML = `<div class="dlg ${opts.left ? 'left' : ''} ${opts.wide ? 'wide' : ''}">${html}</div>`;
    UI.$('#modal-root').appendChild(wrap);
    const api = { el: wrap.firstElementChild, close() { wrap.remove(); } };
    if (opts.dismiss !== false) wrap.addEventListener('click', (e) => { if (e.target === wrap) api.close(); });
    return api;
  };

  UI.download = function (name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  UI.copy = async function (text) {
    try { await navigator.clipboard.writeText(text); UI.toast('Copiato negli appunti ✓'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); UI.toast('Copiato negli appunti ✓'); } catch (e2) { UI.toast('Copia non riuscita'); }
      ta.remove();
    }
  };

  UI.seg = function (container, onChange) { // gruppo di bottoni a selezione singola
    container.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]'); if (!b) return;
      UI.$$('button', container).forEach((x) => x.classList.toggle('sel', x === b));
      if (onChange) onChange(b.dataset.v);
    });
  };
  UI.segVal = (container) => { const b = UI.$('button.sel', container); return b ? b.dataset.v : null; };

  UI.randomSeed = () => 'ff-' + Math.random().toString(36).slice(2, 8);

  // Aiuto sui mood (testo breve per i giocatori)
  UI.MOOD_HELP = {
    affamato: 'Corre in Cucina. Vuole 🍬 Snack: +2 PF; altra risorsa +1 PF (counter Arrabbiatissimo); niente −1 PF e Offesissimo.',
    assonnato: 'Resta dov\'è. Vuole 🛏 Cuscino: +2 PF; altra risorsa +1 PF (counter); niente −1 PF e Offesissimo.',
    curioso: 'Si sposta finché trova una stanza con risorse. Nessuna pretesa: una risorsa data vale +1 PF (senza counter), niente −1 PF.',
    coccolone: 'Resta fermo. Vuole 🤗 Coccola: +2 PF; altra risorsa +1 PF (counter Arrabbiatissimo); niente −1 PF e Offesissimo.',
    giocherellone: 'Si sposta di 1; sequestra una risorsa a caso della stanza d\'arrivo e la rilascia al movimento successivo. Vuole 🎾 Giochino (+2 / +1 counter / −1 e Offesissimo).',
    irrequieto: 'Vuole una risorsa qualsiasi: la prima gli dà +2 PF e lo calma (Neutro), poi non ne accetta altre in quel turno. Se nessuno lo soddisfa, a fine turno inverte direzione e −1 PF a chi è con lui. Senza risorsa: −1 PF.',
    neutro: 'Si sposta di 1, nessuna pretesa. Una risorsa data vale +1 PF (senza counter), niente −1 PF.',
    bisognoso: 'Corre in Bagno e attira il giocatore più vicino. Solo 🪣 Paletta: +3 PF. Altrimenti −1 PF e diventa Irrequieto (non Offesissimo).',
    iperattivo: 'Si sposta di 2 stanze. Nessuna pretesa: risorsa data +1 PF, niente −1 PF.',
    dispettoso: 'Si sposta di 1 e butta fuori dal gioco una risorsa a caso dalla stanza d\'arrivo. Nessuna pretesa: risorsa +1 PF, niente −1 PF.',
    offesissimo: 'Scatta se non gli dai nulla o se raccogli nella sua stanza. Non accetta niente. Al turno dopo si sposta di 1 e dà −2 PF a chi è nella stanza d\'arrivo; poi si calma e la ruota riprende.',
    arrabbiatissimo: 'Scatta quando il counter di risorse sbagliate arriva a 3. Resta fermo finché non gli dai 2 risorse qualsiasi (+2 PF, poi la ruota avanza). Ogni turno −1 PF a chi è nella sua stanza o adiacente.',
  };
})(typeof window !== 'undefined' ? window : globalThis);
