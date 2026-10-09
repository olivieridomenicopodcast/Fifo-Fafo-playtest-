#!/usr/bin/env node
/* Genera il kit "stampa e gioca" in stampa/:
   - carte-fronte-retro.html/.pdf : tutte le carte, 9 per foglio A4 (formato poker 63,5 × 88,9 mm), pagine fronte/retro alternate
   - carte-solo-fronti.html/.pdf  : solo i fronti (per bustine con una carta qualunque dietro)
   - tabellone-e-plance.html/.pdf : tabellone, tracciati + schema dell'anello, 2 plance giocatore (A4 orizzontale)
   - foglio-punti.html/.pdf (A4 verticale, con esempio compilato), regolamento.pdf, index.html (istruzioni, scritta a mano)
   Uso: node tools/build-print.js [--no-pdf]    (i PDF si fanno con Chromium/Playwright) */
'use strict';
const fs = require('fs'), path = require('path');
require('../js/data.js'); require('../js/ui/sprites.js'); require('../js/rulebook.js');
const FF = globalThis.FF, S = FF.Sprites;
const root = path.join(__dirname, '..'), out = path.join(root, 'stampa');
fs.mkdirSync(out, { recursive: true });

const CW = 63.5, CH = 88.9, GX = (210 - 3 * CW) / 2, GY = (297 - 3 * CH) / 2;   // griglia 3×3 centrata su A4
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sp = (id) => `<span class="sp">${S.use(id)}</span>`;
const resSp = (r) => sp('res-' + r);
const PCOL = ['#f08a2b', '#3f86d0'], PNAME = ['arancione', 'blu'];

// ───────────────────────── testi delle carte (dal regolamento docs/REGOLAMENTO.md) ─────────────────────────
const MOVE = {
  neutro: '1 stanza nella direzione corrente.', bisognoso: 'Corre in Bagno e attira il giocatore più vicino (a parità, dado), che deve interagire.',
  affamato: 'Corre in Cucina.', irrequieto: '1 stanza nella direzione corrente.', curioso: 'Si sposta finché trova una stanza con risorse (al massimo un giro).',
  iperattivo: '2 stanze nella direzione corrente.', dispettoso: '1 stanza; poi butta fuori dal gioco per sempre una risorsa a caso di quella stanza.',
  assonnato: 'Resta fermo.', giocherellone: '1 stanza; rilascia la risorsa che portava e ne sequestra una a caso della stanza (nessuno può raccoglierla finché non la rilascia).', coccolone: 'Resta fermo.',
};
const DEMAND_EFF = '<b>+2 PF</b> risorsa giusta · <b>+1 PF</b> altra risorsa (counter Arrabbiatissimo +1) · niente: <b>−1 PF</b> e Heafy diventa Offesissimo.';
const FREE_EFF = 'Una risorsa qualsiasi: <b>+1 PF</b> (mai di più). Niente: <b>−1 PF</b>.';
const EFF = {
  neutro: FREE_EFF, curioso: FREE_EFF, iperattivo: FREE_EFF, dispettoso: FREE_EFF,
  affamato: DEMAND_EFF, assonnato: DEMAND_EFF, coccolone: DEMAND_EFF, giocherellone: DEMAND_EFF,
  bisognoso: 'Solo la Paletta: <b>+3 PF</b>. Altrimenti <b>−1 PF</b> e Heafy è Irrequieto per il resto del turno.',
  irrequieto: 'La prima risorsa (qualsiasi): <b>+2 PF</b> e si calma; poi non accetta altro nel turno. Niente: <b>−1 PF</b>. Se a fine turno nessuno l\'ha soddisfatto: inverte la direzione e <b>−1 PF</b> a chi è con lui.',
};
const DEMAND_TXT = (m) => (m.demand === 'any' ? '<span>una risorsa qualsiasi</span>' : m.demand ? `${resSp(m.demand)}<span><b>${FF.RES[m.demand].n}</b></span>` : '<span>niente di preciso: basta dargli qualcosa</span>');
const FLOW = {
  A1: ['MOVIMENTO', 'Ti muovi di <b>1 stanza</b> in senso <b>orario ↻</b>.'], A2: ['MOVIMENTO', 'Ti muovi di <b>2 stanze</b> in senso <b>orario ↻</b>.'],
  A3: ['MOVIMENTO', 'Ti muovi di <b>1 stanza</b> in senso <b>antiorario ↺</b>.'], A4: ['MOVIMENTO', 'Ti muovi di <b>2 stanze</b> in senso <b>antiorario ↺</b>.'],
  B1: ['RACCOLTA', '<b>Raccogli</b> 1 risorsa nella stanza in cui sei quando esegui la carta (max 2 in mano). Se Heafy è lì: −1 PF e Offesissimo.'], B2: ['RACCOLTA', 'Non raccogli.'],
  C1: ['INTERAZIONE', '<b>Interagisci</b> con Heafy: devi essere nella sua stanza. Se non c\'è, abbandoni 1 risorsa nella stanza.'], C2: ['INTERAZIONE', 'Non interagisci.'],
  J1: ['JOLLY', 'Nessun effetto.'], J2: ['JOLLY', '<b>Jolly</b> (solo 2 volte a partita). Una volta ciascuna e in ordine libero: spostamento 1–2 · raccolta sicura · prendi Heafy · deposita Heafy.'],
};
const FLOWCOL = { A: '#2f6fb0', B: '#8a5a1a', C: '#c4691f', J: '#c79a12' };

// ───────────────────────── elenco carte ─────────────────────────
const cards = [];   // { g: gruppo, f: html fronte, b: html retro }
const back = (cls, inner) => `<div class="cd back ${cls}">${inner}</div>`;
const BACKS = {
  room: back('b-room', `<div class="bb">${sp('room-camera')}</div><div class="bt">STANZE</div>`),
  flow0: back('b-flow0', `<div class="bb">${S.use('pawn-0')}</div><div class="bt">FLOW<br><small>mazzo ${PNAME[0]}</small></div>`),
  flow1: back('b-flow1', `<div class="bb">${S.use('pawn-1')}</div><div class="bt">FLOW<br><small>mazzo ${PNAME[1]}</small></div>`),
  mood: back('b-mood', `<div class="bb">${S.use('rug')}</div><div class="bb c">${S.use('cat-neutro')}</div><div class="bt">MOOD</div>`),
  objA: back('b-objA', `<div class="bb">${S.use('star')}</div><div class="bt">OBIETTIVO SEGRETO<br><small>posizione</small></div>`),
  objB: back('b-objB', `<div class="bb">${S.use('star')}</div><div class="bt">OBIETTIVO SEGRETO<br><small>mano e stile</small></div>`),
  ref: back('b-ref', '<div class="bt">CARTA DA TENERE<br>SCOPERTA<br><small>non va nei mazzi</small></div>'),
};
const card = (cls, inner, style) => `<div class="cd ${cls}"${style ? ` style="${style}"` : ''}>${inner}</div>`;

FF.ROOMS.forEach((r) => cards.push({ g: 'Stanze (si dispongono ad anello)', b: BACKS.room, f: card('room',
  `<div class="art">${S.use('room-' + r.id)}</div><h3>${esc(r.name.toUpperCase())}</h3>
   <div class="rs">${resSp(r.res)}<span>Risorsa: <b>${esc(FF.RES[r.res].n)}</b></span></div>
   <p class="sm">Mettici sopra 1 gettone ${esc(FF.RES[r.res].n)}. A inizio Pomeriggio e Sera la stanza ne riceve un altro (anche se ne ha già).</p>`) }));

[0, 1].forEach((pl) => ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'C1', 'C2', 'J1', 'J2'].forEach((code) => {
  const t = code[0], [title, txt] = FLOW[code];
  cards.push({ g: 'Carte Flow ' + PNAME[pl], b: BACKS['flow' + pl], f: card('flow', `<div class="band" style="background:${FLOWCOL[t]}">${t} · ${title}</div>
    <div class="ic">${S.use('card-' + code)}</div><h2>${code}</h2><p>${txt}</p><div class="pl" style="background:${PCOL[pl]}">${sp('pawn-' + pl)}<span>mazzo ${PNAME[pl]}</span></div>`) });
}));

FF.MOOD_IDS.forEach((id) => { const m = FF.MOODS[id];
  cards.push({ g: 'Carte mood (la ruota)', b: BACKS.mood, f: card('mood', `<div class="cat">${S.use('cat-' + id)}</div><h2>${esc(m.name.toUpperCase())}</h2>
    <div class="lab">PRETENDE</div><div class="dm">${DEMAND_TXT(m)}</div><div class="lab">MOVIMENTO</div><p>${MOVE[id]}</p><div class="lab">QUANDO GLI DAI QUALCOSA</div><p>${EFF[id]}</p>`) }); });
cards.push({ g: 'Mood fuori ruota (si tengono scoperte)', b: BACKS.ref, f: card('mood sp', `<div class="cat">${S.use('cat-offesissimo')}</div><h2>OFFESISSIMO</h2>
  <div class="lab">NON PRETENDE NIENTE E NON ACCETTA NIENTE</div>
  <p><b>Scatta</b> se non gli dai nulla (con un mood con pretesa) o se raccogli nella sua stanza, anche in un'interazione passiva. <b>Turno dopo</b>: si sposta di 1 nella direzione corrente e dà <b>−2 PF</b> a chi è nella stanza d'arrivo. Ancora dopo: <b>si calma</b> e la ruota riprende.</p>`) });
cards.push({ g: 'Mood fuori ruota (si tengono scoperte)', b: BACKS.ref, f: card('mood sp', `<div class="cat">${S.use('cat-arrabbiatissimo')}</div><h2>ARRABBIATISSIMO</h2>
  <div class="lab">PRETENDE 2 RISORSE QUALSIASI</div>
  <p><b>Scatta</b> quando il counter (risorse sbagliate) arriva a 3. Resta fermo e la ruota non avanza. Inizio Fase Heafy: <b>−1 PF</b> a chi è nella sua stanza o adiacente. Gli dai 2 risorse: <b>+2 PF</b>, si calma e <b>la ruota avanza</b>. Meno di 2: −1 PF, non perdi nulla.</p>`) });

for (const id of FF.OBJECTIVE_IDS) { const o = FF.OBJECTIVES[id];
  const art = o.kind === 'angolo' ? S.use('room-' + o.room) : o.kind === 'compagno' ? `<span class="two">${S.use('pawn-0')}${S.use('cat-coccolone')}</span>`
    : o.kind === 'tasche' ? `<span class="two">${S.use('slot')}${S.use('slot')}</span>` : o.kind === 'coppia' ? `<span class="two">${S.use('res-snack')}${S.use('res-snack')}</span>`
    : o.kind === 'set' ? `<span class="two">${S.use('res-' + o.a)}${S.use('res-' + o.b)}</span>` : o.kind === 'risparmiatore' ? `<span class="two">${S.use('card-J2')}<b class="x">✘</b></span>`
    : `<span class="two"><b class="moon">☾</b>${S.use('pawn-1')}<b class="one">1°</b></span>`;
  cards.push({ g: o.deck === 'A' ? 'Obiettivi segreti · posizione' : 'Obiettivi segreti · mano e stile', b: o.deck === 'A' ? BACKS.objA : BACKS.objB, f: card('obj ' + (o.deck === 'A' ? 'oa' : 'ob'),
    `<div class="band">OBIETTIVO SEGRETO · ${o.deck === 'A' ? 'POSIZIONE' : 'MANO E STILE'}</div><div class="art">${art}</div><h3>${esc(o.name)}</h3><p>${esc(o.desc)}</p>
     <div class="pts">+${o.pts}</div><div class="fail">Non riuscito: +1 Rancore</div>`) });
}

const REF = [
  ['IL TURNO', `<ol><li><b>Fase Heafy</b>: torna libero se era in braccio · cambia mood (ruota avanti di 1) · si muove · chi è nella sua stanza <b>deve interagire</b> (se due: dado).</li><li><b>Carte</b> segrete: 1 A, 1 B, 1 C, 1 J.</li><li><b>Flow</b>: metti le 4 carte in ordine, rivelale ed eseguile. Prima chi parte per primo.</li><li><b>Fine turno</b>: Irrequieto non soddisfatto → direzione inversa e −1 PF a chi è con lui · PF sotto zero → Rancori.</li></ol><p class="sm"><b>Primo:</b> Mattino G1 · Pomeriggio G2 · Sera chi ha meno PF−Rancori all'inizio della Sera (parità: dado), per tutti e 5 i turni.</p>`],
  ['INTERAZIONE CON HEAFY', `<ul><li>Risorsa <b>giusta</b>: <b>+2 PF</b></li><li>Risorsa <b>sbagliata</b>: <b>+1 PF</b> e counter Arrabbiatissimo +1 (a 3 scatta)</li><li><b>Niente</b>: <b>−1 PF</b> e Offesissimo</li><li>Mood <b>senza pretesa</b>: qualsiasi risorsa +1 PF, niente −1 PF</li><li><b>Irrequieto</b>: 1ª risorsa +2 PF, poi non accetta altro</li><li><b>Bisognoso</b>: solo Paletta +3 PF, altrimenti −1 PF</li></ul><p class="sm">Una sola interazione per turno a testa. C1 senza Heafy: abbandoni 1 risorsa nella stanza.</p>`],
  ['PUNTI E FINE', `<ul><li><b>Rancore</b>: PF sotto zero a fine turno → ogni punto sotto zero è 1 Rancore e i PF tornano a 0.</li><li><b>Obiettivo non riuscito</b>: +1 Rancore.</li></ul><p><b>Punteggio finale = PF − Rancori + punti degli obiettivi riusciti.</b></p><p class="sm">Dopo il turno 15 si rivelano gli obiettivi. Più punti vince; parità = pareggio. Usa il foglio punti.</p>`],
];
REF.forEach(([t, body]) => cards.push({ g: 'Promemoria (si tengono scoperte)', b: BACKS.ref, f: card('refc', `<div class="band">PROMEMORIA</div><h3>${t}</h3><div class="rb">${body}</div>`) }));

const sheets = [];
for (let i = 0; i < cards.length; i += 9) sheets.push(cards.slice(i, i + 9));
const ns = sheets.length;
while (sheets[ns - 1].length < 9) sheets[ns - 1].push(null);   // controllo: i fogli devono essere pieni

function cropMarks() {
  const xs = [0, 1, 2, 3].map((i) => GX + i * CW), ys = [0, 1, 2, 3].map((i) => GY + i * CH), L = 4, G = 1;
  let h = '';
  for (const x of xs) h += `<i class="m v" style="left:${x}mm;top:${GY - G - L}mm;height:${L}mm"></i><i class="m v" style="left:${x}mm;top:${GY + 3 * CH + G}mm;height:${L}mm"></i>`;
  for (const y of ys) h += `<i class="m h" style="top:${y}mm;left:${GX - G - L}mm;width:${L}mm"></i><i class="m h" style="top:${y}mm;left:${GX + 3 * CW + G}mm;width:${L}mm"></i>`;
  return h;
}
function sheetPage(cs, idx, side) {
  // il retro si stampa ribaltando sul lato lungo: le colonne si specchiano
  const cells = cs.map((c, i) => {
    const r = Math.floor(i / 3), col = i % 3, cc = side === 'b' ? 2 - col : col;
    return `<div class="c" style="left:${GX + cc * CW}mm;top:${GY + r * CH}mm">${c ? (side === 'b' ? c.b : c.f) : ''}</div>`;
  }).join('');
  const groups = [...new Set(cs.filter(Boolean).map((c) => c.g))].join(' · ');
  return `<section class="sheet">${cropMarks()}${cells}<div class="foot">FIFO FAFO · foglio ${idx + 1}/${ns} · ${side === 'b' ? '<b>RETRO</b> (ribalta sul lato lungo)' : '<b>FRONTE</b>'} · ${esc(groups)}</div></section>`;
}
const CSS_CARDS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; } html, body { margin: 0; background: #888; font-family: "Trebuchet MS", Verdana, "DejaVu Sans", sans-serif; }
.sheet { position: relative; width: 210mm; height: 297mm; background: #fff; overflow: hidden; page-break-after: always; break-after: page; margin: 0 auto 6mm; }
.c { position: absolute; width: ${CW}mm; height: ${CH}mm; }
.m { position: absolute; background: #000; display: block; } .m.v { width: .2mm; margin-left: -.1mm; } .m.h { height: .2mm; margin-top: -.1mm; }
.foot { position: absolute; left: 0; right: 0; bottom: 4mm; text-align: center; font: 7pt "Trebuchet MS", Verdana, sans-serif; color: #444; }
.sp, .sp svg { display: block; width: 100%; height: 100%; }
.cd { position: relative; width: 100%; height: 100%; overflow: hidden; color: #3b2410; padding: 3mm 3.5mm 3mm; display: flex; flex-direction: column; align-items: center; text-align: center; background: #fff6dc; }
.cd::after { content: ''; position: absolute; inset: 1.6mm; border: .5mm solid #3b2410; border-radius: 3mm; pointer-events: none; }
.cd h2 { margin: 0; font-size: 14pt; line-height: 1.1; } .cd h3 { margin: 1.2mm 0 0; font-size: 11pt; line-height: 1.1; } .cd p { margin: 1.4mm 0 0; font-size: 7.6pt; line-height: 1.28; } .cd p.sm { font-size: 6.8pt; color: #5a4430; }
.cd .band { align-self: stretch; margin: 0 -1mm; padding: .9mm 1mm; color: #fff; font-weight: 800; font-size: 7.2pt; letter-spacing: .4pt; border-radius: 1.6mm; }
.room .art { width: 100%; aspect-ratio: 4/3; border-radius: 2mm; overflow: hidden; margin-top: 1.5mm; border: .4mm solid #3b2410; } .room h3 { font-size: 13pt; margin-top: 2mm; }
.room .rs { display: flex; align-items: center; gap: 2mm; margin-top: 2mm; font-size: 9pt; } .room .rs .sp { width: 12mm; height: 12mm; flex: none; }
.flow .ic { width: 25mm; height: 25mm; margin-top: 2mm; } .flow h2 { font-size: 22pt; margin-top: 1mm; } .flow p { font-size: 8.2pt; margin-top: 2mm; }
.flow .pl { position: absolute; left: 3.6mm; right: 3.6mm; bottom: 3.6mm; border-radius: 2mm; color: #fff; font-weight: 800; font-size: 7pt; display: flex; align-items: center; justify-content: center; gap: 2mm; padding: .6mm 0; } .flow .pl .sp { width: 4.4mm; height: 6mm; flex: none; }
.flow { background: #fffaf0; }
.mood .cat { width: 24mm; height: 24mm; margin-top: 1mm; } .mood h2 { font-size: 12.5pt; margin-top: .6mm; }
.mood .lab { align-self: stretch; text-align: left; font-size: 6.3pt; font-weight: 800; letter-spacing: .6pt; color: #a8480f; margin-top: 1.7mm; border-bottom: .2mm solid #c9a46a; }
.mood .dm { display: flex; align-items: center; gap: 1.6mm; font-size: 8.6pt; margin-top: .8mm; text-align: left; align-self: stretch; } .mood .dm .sp { width: 8mm; height: 8mm; flex: none; }
.mood p { text-align: left; align-self: stretch; margin-top: .8mm; font-size: 7.2pt; line-height: 1.24; } .mood.sp { background: #ffe1d6; }
.obj .band { background: #5a3a22; } .obj.ob .band { background: #6b3f93; } .obj .art { width: 100%; height: 30mm; margin-top: 1.8mm; display: flex; align-items: center; justify-content: center; border-radius: 2mm; overflow: hidden; background: #efdcb4; border: .4mm solid #3b2410; }
.obj .art > svg { width: 100%; height: 100%; } .obj .art .two { display: flex; align-items: center; justify-content: center; gap: 2mm; height: 100%; } .obj .art .two svg { width: 15mm; height: 22mm; }
.obj .art .two svg[viewBox="0 0 48 48"] { width: 18mm; height: 18mm; } .obj .art .two svg[viewBox="0 0 64 64"] { width: 22mm; height: 22mm; } .obj .art .two svg[viewBox="-4 -4 108 108"] { width: 22mm; height: 22mm; }
.obj .art .x { font-size: 30pt; color: #c0392b; line-height: 1; } .obj .art .moon { font-size: 26pt; line-height: 1; } .obj .art .one { font-size: 17pt; color: #a8480f; }
.obj h3 { font-size: 11.5pt; margin-top: 2.5mm; } .obj p { font-size: 8.4pt; margin-top: 2mm; }
.obj .pts { position: absolute; right: 4mm; bottom: 9mm; width: 14mm; height: 14mm; border-radius: 50%; background: #e3a82b; border: .6mm solid #3b2410; font-weight: 900; font-size: 15pt; display: flex; align-items: center; justify-content: center; }
.obj .fail { position: absolute; left: 4mm; right: 4mm; bottom: 3.6mm; font-size: 6.6pt; color: #7a1a10; font-weight: 700; }
.refc { background: #eef3f6; } .refc .band { background: #555; } .refc h3 { font-size: 10.5pt; } .refc .rb { text-align: left; align-self: stretch; font-size: 7pt; line-height: 1.25; margin-top: 1mm; } .refc ol, .refc ul { margin: 1mm 0 0; padding-left: 4mm; } .refc li { margin-bottom: 1mm; } .refc p { font-size: 7pt; margin-top: 1mm; text-align: left; } .refc p.sm { font-size: 6.4pt; }
.back { justify-content: center; color: #fff; } .back .bt { font-weight: 900; font-size: 14pt; letter-spacing: 1pt; margin-top: 3mm; line-height: 1.2; text-shadow: 0 .3mm 0 rgba(0,0,0,.4); } .back .bt small { font-size: 8pt; font-weight: 700; letter-spacing: .3pt; }
.back .bb { width: 28mm; height: 28mm; } .back::after { border-color: rgba(255,255,255,.7); }
.b-room { background: #6b4426; } .b-room .bb { height: 21mm; width: 28mm; border-radius: 2mm; overflow: hidden; border: .5mm solid #ffe7b8; }
.b-flow0 { background: #d9741a; } .b-flow1 { background: #2f6fb0; } .b-flow0 .bb, .b-flow1 .bb { width: 18mm; height: 25mm; }
.b-mood { background: #8f2f2f; position: relative; } .b-mood .bb.c { position: absolute; left: 50%; top: 24mm; width: 24mm; height: 24mm; margin-left: -12mm; } .b-mood .bb:first-child { width: 44mm; height: 44mm; }
.b-objA { background: #2f6b57; } .b-objB { background: #6b3f93; } .b-objA .bb, .b-objB .bb { width: 24mm; height: 24mm; }
.b-ref { background: #dfe5ea; color: #333; text-shadow: none; } .b-ref::after { border-color: #777; } .b-ref .bt { font-size: 11pt; text-shadow: none; }
@media print { html, body { background: none; } .sheet { margin: 0; } .noprint { display: none; } }
.noprint { position: fixed; top: 6px; right: 6px; z-index: 9; font: 700 14px sans-serif; } .noprint button { padding: 8px 14px; font: inherit; border: 2px solid #333; border-radius: 8px; background: #ffd54a; cursor: pointer; }`;
const wrapHtml = (title, css, body) => `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style></head><body>${S.sheet()}<div class="noprint"><button onclick="window.print()">🖨 Stampa</button></div>${body}</body></html>`;

const both = []; sheets.forEach((cs, i) => { both.push(sheetPage(cs, i, 'f')); both.push(sheetPage(cs, i, 'b')); });
fs.writeFileSync(path.join(out, 'carte-fronte-retro.html'), wrapHtml('FIFO FAFO — carte (fronte/retro)', CSS_CARDS, both.join('')));
fs.writeFileSync(path.join(out, 'carte-solo-fronti.html'), wrapHtml('FIFO FAFO — carte (solo fronti)', CSS_CARDS, sheets.map((cs, i) => sheetPage(cs, i, 'f')).join('')));

// ───────────────────────── tabellone, tracciati, plance (A4 orizzontale) ─────────────────────────
const SW = 65, SH = 91;   // un po' più grandi della carta, per posarla senza precisione
const spot = (x, y, title, sub, extra) => `<div class="spot" style="left:${x}mm;top:${y}mm"><b>${title}</b><span>${sub || ''}</span>${extra || ''}</div>`;
const page = (inner, foot) => `<section class="land">${inner}<div class="foot">${foot}</div></section>`;
const rowX = (n, i) => { const gap = 4, total = n * SW + (n - 1) * gap; return (297 - total) / 2 + i * (SW + gap); };

function tabellone() {
  const y1 = 7, y2 = y1 + SH + 4;
  return page([
    spot(rowX(4, 0), y1, 'MOOD · ORA', 'la carta mood attuale di Heafy, scoperta'),
    spot(rowX(4, 1), y1, 'MOOD · DOPO', 'il prossimo mood: si vede (la ruota è pubblica)'),
    spot(rowX(4, 2), y1, 'RUOTA · IN ARRIVO', 'le altre carte mood, scoperte, nell\'ordine in cui usciranno<br>(dopo l\'ultima si ricomincia dalla prima)'),
    spot(rowX(4, 3), y1, 'RUOTA · GIÀ PASSATI', 'ogni mood finito va qui, scoperto'),
    spot(rowX(4, 0), y2, 'OBIETTIVI · POSIZIONE', 'mazzo coperto<br>(10 carte)'),
    spot(rowX(4, 1), y2, 'OBIETTIVI · MANO E STILE', 'mazzo coperto<br>(9 carte)'),
    spot(rowX(4, 2), y2, 'MOOD FUORI RUOTA', 'qui la carta <b>Offesissimo</b> o <b>Arrabbiatissimo</b> quando è attivo (scoperta)'),
    spot(rowX(4, 3), y2, 'RISERVA RISORSE', 'i gettoni Snack, Cuscino, Giochino, Paletta, Coccola'),
  ].join(''), 'FIFO FAFO · tabellone · stampa su A4 orizzontale · le 9 carte Stanza si dispongono ad anello, vedi pagina 2');
}
function tracciati() {
  const turn = (n) => `<u class="tb">${n}</u>`;
  const grp = (name, from, cls, rule) => `<div class="tg ${cls}"><b>${name}</b><small>${rule}</small><div>${[0, 1, 2, 3, 4].map((i) => turn(from + i)).join('')}</div></div>`;
  const ring = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => { const a = (-90 + i * 40) * Math.PI / 180; return `<div class="rk" style="left:${50 + 38 * Math.cos(a)}%;top:${50 + 38 * Math.sin(a)}%">${i + 1}</div>`; }).join('');
  return page(`
    <div class="tk"><div class="th">TRACCIATO DEI TURNI <small>segna il turno con un segnalino</small></div>
      ${grp('MATTINO', 1, 'g0', 'parte sempre G1')}${grp('POMERIGGIO', 6, 'g1', 'parte sempre G2')}${grp('SERA', 11, 'g2', 'parte chi ha meno PF−Rancori a inizio Sera (dado se pari): per tutti e 5 i turni')}
      <div class="tn">A ogni cambio di periodo (turno 6 e turno 11): ogni stanza riceve di nuovo la sua risorsa originale, anche se ne ha già.</div></div>
    <div class="bx" style="left:10mm;top:84mm;width:88mm"><div class="th">COUNTER ARRABBIATISSIMO <small>unico per tutta la partita</small></div><div class="cnt"><u>0</u><u>1</u><u>2</u><u>3</u></div><div class="tn">+1 a ogni risorsa <b>sbagliata</b> data a Heafy. A <b>3</b> scatta Arrabbiatissimo e il counter torna a 0. Non si azzera al cambio di mood.</div></div>
    <div class="bx" style="left:10mm;top:134mm;width:88mm"><div class="th">DIREZIONE DI HEAFY <small>segnalino sul verso attuale</small></div><div class="dir"><div>↻<br><small>ORARIO</small><br><small>(all'inizio)</small></div><div>↺<br><small>ANTIORARIO</small></div></div><div class="tn">Si inverte quando Heafy è Irrequieto e nessuno lo soddisfa a fine turno.</div></div>
    <div class="bx ring" style="left:108mm;top:84mm;width:180mm;height:116mm"><div class="th">SCHEMA DELL'ANELLO <small>non in scala: le carte Stanza vanno disposte in cerchio sul tavolo</small></div>
      <div class="rg">${ring}<div class="rc">1. Mescola le 9 carte Stanza e mettile in cerchio, a faccia in su.<br>2. Heafy parte dalla <b>Camera</b>, G1 dalla <b>Cucina</b>, G2 dalla <b>Mansarda</b>.<br>3. Ci si muove in senso <b>orario ↻</b> (numeri crescenti) o antiorario ↺.<br>4. 1 gettone risorsa su ogni stanza.</div></div></div>`,
    'FIFO FAFO · tracciati e schema dell\'anello · stampa su A4 orizzontale');
}
function plancia(p) {
  const y1 = 6, x0 = rowX(4, 0);
  const slots = [0, 1, 2, 3].map((i) => spot(rowX(4, i), y1, `${i + 1}° CARTA DEL FLOW`, i === 0 ? 'metti le carte <b>coperte</b>, in ordine; poi si rivelano' : i === 3 ? 'ricorda: A, B, C e J, una per tipo' : '')).join('');
  const hand = `<div class="hd"><div class="th">MANO <small>max 2 risorse</small></div><div class="hs"><i></i><i></i></div></div><div class="hd"><div class="th">JOLLY J2 <small>2 volte, con gettoni</small></div><div class="hs j"><i>✦</i><i>✦</i></div></div>`;
  const memo = `<ol class="memo"><li><b>Fase Heafy</b>: cambia mood e si muove; chi è nella sua stanza interagisce.</li><li><b>Carte</b>: scegli 1 A, 1 B, 1 C, 1 J in segreto.</li><li><b>Flow</b>: ordinale, rivelale, eseguile (prima chi parte per primo).</li><li><b>Interagisci</b>: giusta +2 · sbagliata +1 (counter) · niente −1 e Offesissimo.</li><li><b>Fine</b>: PF sotto zero → Rancori. <b>Finale: PF − Rancori + obiettivi.</b></li></ol>`;
  return page(`${slots}<div class="who" style="background:${PCOL[p]}">GIOCATORE ${PNAME[p].toUpperCase()}</div>
    <div class="ll">${hand}${memo}</div>
    ${spot(rowX(4, 2), 101, 'OBIETTIVO SEGRETO 1', 'coperto: lo riveli a fine partita')}${spot(rowX(4, 3), 101, 'OBIETTIVO SEGRETO 2', 'coperto: lo riveli a fine partita')}`,
  `FIFO FAFO · plancia giocatore ${PNAME[p]} · stampa su A4 orizzontale`);
}
const CSS_LAND = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; } html, body { margin: 0; background: #888; font-family: "Trebuchet MS", Verdana, "DejaVu Sans", sans-serif; color: #222; }
.sp, .sp svg { display: block; width: 100%; height: 100%; }
.land { position: relative; width: 297mm; height: 210mm; background: #fff; overflow: hidden; page-break-after: always; break-after: page; margin: 0 auto 6mm; }
.spot { position: absolute; width: ${SW}mm; height: ${SH}mm; border: .5mm dashed #888; border-radius: 3.5mm; padding: 3mm; text-align: center; background: #fafafa; }
.spot > b { display: block; font-size: 10.5pt; letter-spacing: .3pt; margin-top: 2mm; } .spot > span { display: block; font-size: 8pt; color: #555; margin-top: 1.5mm; line-height: 1.35; } .spot > span b { color: #222; }
.foot { position: absolute; left: 0; right: 0; bottom: 2.5mm; text-align: center; font-size: 7pt; color: #666; }
.th { font-weight: 900; font-size: 10.5pt; letter-spacing: .4pt; } .th small { font-weight: 500; font-size: 7.6pt; letter-spacing: 0; color: #555; margin-left: 2mm; }
.tn { font-size: 8pt; color: #444; margin-top: 2mm; line-height: 1.3; }
.tk { position: absolute; left: 10mm; right: 10mm; top: 8mm; } .tg { display: inline-block; vertical-align: top; width: 88mm; margin: 3mm 1mm 0 0; border: .5mm solid #555; border-radius: 3mm; padding: 2mm 3mm; } .tg b { font-size: 11pt; } .tg small { display: block; font-size: 7.4pt; color: #444; min-height: 11mm; line-height: 1.25; }
.tg.g0 { background: #fff3c9; } .tg.g1 { background: #dff3d3; } .tg.g2 { background: #d6dbf5; }
.tb { text-decoration: none; display: inline-flex; width: 14mm; height: 14mm; margin: 1mm 1.3mm 0 0; border: .5mm solid #555; border-radius: 50%; align-items: center; justify-content: center; font-weight: 800; font-size: 13pt; background: #fff; }
.bx { position: absolute; border: .5mm solid #555; border-radius: 3mm; padding: 3mm 4mm; background: #fafafa; }
.cnt { display: flex; gap: 4mm; margin-top: 3mm; } .cnt u { text-decoration: none; width: 17mm; height: 17mm; border: .6mm solid #555; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18pt; background: #fff; }
.dir { display: flex; gap: 5mm; margin-top: 3mm; } .dir > div { flex: 1; border: .6mm solid #555; border-radius: 3mm; text-align: center; font-size: 26pt; font-weight: 900; line-height: 1; padding: 2mm 0; background: #fff; } .dir small { font-size: 7pt; font-weight: 700; }
.rg { position: relative; width: 100%; height: 100%; } .rg .rk { position: absolute; width: 11mm; height: 11mm; margin: -5.5mm 0 0 -5.5mm; border: .6mm solid #555; border-radius: 3mm; background: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13pt; }
.rg .rc { position: absolute; left: 50%; top: 50%; width: 82mm; transform: translate(-50%, -50%); font-size: 8pt; line-height: 1.4; text-align: left; }
.ring .rg { top: -6mm; height: 98mm; }
.who { position: absolute; left: 10mm; top: 103mm; color: #fff; font-weight: 900; font-size: 13pt; padding: 1.2mm 5mm; border-radius: 2mm; letter-spacing: 1pt; }
.ll { position: absolute; left: 10mm; top: 114mm; width: 133mm; }
.hd { display: inline-block; vertical-align: top; width: 62mm; margin-right: 3mm; white-space: nowrap; } .hs { display: flex; gap: 3mm; margin-top: 2mm; } .hs i { display: flex; width: 22mm; height: 22mm; border: .6mm dashed #777; border-radius: 50%; align-items: center; justify-content: center; font-style: normal; font-size: 16pt; color: #bbb; background: #fafafa; } .hs.j i { border-style: solid; color: #c79a12; }
.memo { margin: 4mm 0 0; padding-left: 5mm; font-size: 8.4pt; line-height: 1.32; } .memo li { margin-bottom: 1.4mm; }
@media print { html, body { background: none; } .land { margin: 0; } .noprint { display: none; } }
.noprint { position: fixed; top: 6px; right: 6px; z-index: 9; font: 700 14px sans-serif; } .noprint button { padding: 8px 14px; font: inherit; border: 2px solid #333; border-radius: 8px; background: #ffd54a; cursor: pointer; }`;
const landPages = [tabellone(), tracciati(), plancia(0), plancia(1)];
fs.writeFileSync(path.join(out, 'tabellone-e-plance.html'), wrapHtml('FIFO FAFO — tabellone e plance', CSS_LAND, landPages.join('')));

// ───────────────────────── foglio punti (A4 verticale, con esempio) ─────────────────────────
const turnRows = (ex) => Array.from({ length: 15 }, (_, i) => {
  const t = i + 1, per = t <= 5 ? 'Mattino' : t <= 10 ? 'Pomeriggio' : 'Sera';
  const v = ex ? ex[i] : ['', '', '', ''];
  return `<tr class="${t === 6 || t === 11 ? 'pb' : ''}"><td class="t">${t}</td><td class="p">${per}</td>${v.map((x) => `<td class="w ex">${x}</td>`).join('')}</tr>`;
}).join('');
const EX = [[0, 0, 0, 0], [2, 0, 1, 0], [2, 0, 3, 0], [3, 0, 3, 0], [4, 0, 4, 0], [4, 0, 6, 0], [6, 0, 6, 0], [6, 0, 7, 0], [8, 0, 7, 0], [8, 0, 8, 0], [9, 0, 9, 1], [10, 0, 11, 1], [10, 1, 12, 1], [12, 1, 14, 1], [12, 1, 15, 1]];
const exTot = (n, pf, ra, objs) => { const fails = objs.filter((o) => !o.ok).length, rt = ra + fails, pt = objs.filter((o) => o.ok).reduce((a, o) => a + o.pts, 0); return { n, pf, ra, rt, pt, fin: pf - rt + pt, objs }; };
const E0 = exTot('Giulia', 12, 1, [{ n: 'Il tuo angolo: Bagno', ok: true, pts: 3 }, { n: 'Coppia', ok: false, pts: 2 }]);
const E1 = exTot('Marco', 15, 1, [{ n: 'Compagno di cuscino', ok: false, pts: 3 }, { n: 'Risparmiatore', ok: false, pts: 4 }]);
const finalBox = (e) => `<div class="fb"><div class="fh">${e ? esc(e.n) : 'Nome: ________________'}</div>
  <table><tr><td>PF a fine partita</td><td class="v ex">${e ? e.pf : ''}</td></tr><tr><td>Rancori accumulati nei turni</td><td class="v ex">${e ? e.ra : ''}</td></tr>
  <tr><td colspan="2" class="sub">Obiettivi segreti (✔ riuscito: + punti · ✘ non riuscito: +1 Rancore)</td></tr>
  ${[0, 1].map((k) => `<tr><td>${e ? esc(e.objs[k].n) : 'Obiettivo ' + (k + 1) + ': ________________'} &nbsp; ${e ? (e.objs[k].ok ? '<b class="ex">✔</b>' : '<b class="ex">✘</b>') : '✔ &nbsp; ✘'}</td><td class="v ex">${e ? (e.objs[k].ok ? '+' + e.objs[k].pts : '+1 Rancore') : ''}</td></tr>`).join('')}
  <tr><td>Rancori totali (turni + obiettivi falliti)</td><td class="v ex">${e ? e.rt : ''}</td></tr><tr><td>Punti obiettivi riusciti</td><td class="v ex">${e ? e.pt : ''}</td></tr>
  <tr class="tot"><td>PUNTEGGIO FINALE = PF − Rancori totali + punti obiettivi</td><td class="v ex">${e ? `${e.pf} − ${e.rt} + ${e.pt} = <b>${e.fin}</b>` : ''}</td></tr></table></div>`;
const scoreHead = (ex, a, b) => `<tr><th rowspan="2">Turno</th><th rowspan="2">Periodo</th><th colspan="2" style="background:${PCOL[0]}33">${a || 'GIOCATORE ARANCIONE'}</th><th colspan="2" style="background:${PCOL[1]}33">${b || 'GIOCATORE BLU'}</th></tr><tr><th>PF</th><th>Rancori</th><th>PF</th><th>Rancori</th></tr>`;
const CSS_SCORE = `@page { size: A4 portrait; margin: 0; } * { box-sizing: border-box; } html, body { margin: 0; background: #888; font-family: "Trebuchet MS", Verdana, "DejaVu Sans", sans-serif; color: #222; font-size: 10pt; }
.pg { width: 210mm; height: 297mm; background: #fff; padding: 10mm 12mm; margin: 0 auto 6mm; overflow: hidden; page-break-after: always; break-after: page; position: relative; }
h1 { margin: 0; font-size: 18pt; } h1 small { font-size: 10pt; font-weight: 500; } .nt { border: .4mm solid #444; background: #f3f3f3; border-radius: 2mm; padding: 2mm 3mm; margin: 3mm 0; font-size: 8.8pt; line-height: 1.35; }
table { border-collapse: collapse; width: 100%; } th, td { border: .35mm solid #333; padding: 1mm 2mm; text-align: center; } th { background: #eee; font-size: 9pt; }
td.t { width: 14mm; font-weight: 800; } td.p { width: 30mm; font-size: 8.6pt; text-align: left; } td.w { height: 12.4mm; } tr.pb td { border-top: .8mm solid #333; }
.ex { color: #0b3a8c; font-weight: 800; } .tag { display: inline-block; background: #ffd54a; border: .4mm solid #333; border-radius: 2mm; padding: .3mm 3mm; font-weight: 900; font-size: 9pt; margin-left: 3mm; }
.fb { border: .5mm solid #222; border-radius: 3mm; padding: 2.5mm; margin-top: 4mm; } .fh { font-weight: 900; font-size: 12pt; margin-bottom: 1.5mm; } .fb td { text-align: left; height: 9mm; } .fb td.v { width: 62mm; text-align: center; font-size: 11pt; } .fb td.sub { background: #eee; font-size: 8.4pt; height: 6mm; } .fb tr.tot td { background: #ffe9a8; font-weight: 900; height: 12mm; }
.foot { position: absolute; left: 0; right: 0; bottom: 4mm; text-align: center; font-size: 7pt; color: #666; }
.noprint { position: fixed; top: 6px; right: 6px; z-index: 9; font: 700 14px sans-serif; } .noprint button { padding: 8px 14px; font: inherit; border: 2px solid #333; border-radius: 8px; background: #ffd54a; cursor: pointer; }
@media print { html, body { background: none; } .pg { margin: 0; } .noprint { display: none; } }`;
const scoreBody = `
<section class="pg"><h1>FIFO FAFO · Foglio punti <small>(1/3) segnapunti dei turni</small></h1>
<div class="nt"><b>Come si usa.</b> Alla fine di ogni turno scrivi i <b>PF</b> di ognuno. Se i PF scendono <b>sotto zero</b>, ogni punto sotto zero diventa <b>1 Rancore</b> (segnalo nella colonna Rancori) e i PF ripartono da <b>0</b>. Il <b>punteggio netto</b> è PF − Rancori. <b>All'inizio della Sera (turno 11)</b> confronta i due punteggi netti: parte per primo, in tutti e 5 i turni della Sera, chi ha meno (parità: dado). Gli obiettivi segreti <u>non</u> contano per questo confronto.</div>
<table>${scoreHead(false)}${turnRows(false)}</table><div class="foot">FIFO FAFO · foglio punti · A4 verticale, stampa al 100%</div></section>
<section class="pg"><h1>FIFO FAFO · Foglio punti <small>(2/3) conteggio finale</small></h1>
<div class="nt">Dopo il turno 15 si <b>rivelano gli obiettivi segreti</b> e si controlla il tavolo (pedine, mano, carte J2 non usate). Ogni obiettivo <b>riuscito</b> dà i suoi punti; ogni obiettivo <b>non riuscito</b> dà <b>+1 Rancore</b> (cioè −1). Vince chi ha il punteggio finale più alto; a parità è pareggio.</div>
<div class="nt"><b>Obiettivi:</b> Il tuo angolo (sei in quella stanza) +3 · Compagno di cuscino (sei nella stanza di Heafy) +3 · Tasche piene (2 risorse in mano) +1 · Coppia (2 risorse uguali) +2 · Il set (proprio quelle 2 risorse) +3 o +4 · Risparmiatore (mai usato J2) +4 · Primo di sera (sei stato il primo della Sera) +2.</div>
${finalBox(null)}${finalBox(null)}<div class="foot">FIFO FAFO · foglio punti · A4 verticale, stampa al 100%</div></section>
<section class="pg"><h1>FIFO FAFO · Foglio punti <small>(3/3) esempio già compilato</small><span class="tag">ESEMPIO</span></h1>
<div class="nt">Giulia (arancione) e Marco (blu): i numeri blu sono scritti a mano, turno per turno. Alla fine della partita (turno 15) si leggono PF e Rancori e si passa al conteggio finale nella pagina dopo. Esempio inventato: i valori non sono quelli di una partita vera.</div>
<table>${scoreHead(true, 'Giulia (arancione)', 'Marco (blu)')}${turnRows(EX)}</table><div class="foot">FIFO FAFO · foglio punti · esempio (continua nella pagina dopo)</div></section>
<section class="pg"><h1>FIFO FAFO · Foglio punti <small>esempio: conteggio finale</small><span class="tag">ESEMPIO</span></h1>
<div class="nt"><b>Giulia</b> ha il Bagno come angolo (riuscito, +3) e Coppia (non riuscito: +1 Rancore): 12 − 2 + 3 = <b>13</b>. <b>Marco</b> ha Compagno di cuscino e Risparmiatore, entrambi non riusciti: 2 Rancori in più: 15 − 3 + 0 = <b>12</b>. Vince Giulia (13 a 12).</div>
${finalBox(E0)}${finalBox(E1)}<div class="foot">FIFO FAFO · foglio punti · esempio</div></section>`;
fs.writeFileSync(path.join(out, 'foglio-punti.html'), `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FIFO FAFO — Foglio punti</title><style>${CSS_SCORE}</style></head><body><div class="noprint"><button onclick="window.print()">🖨 Stampa</button></div>${scoreBody}</body></html>`);

console.log(`${cards.filter(Boolean).length} carte in ${ns} fogli (${ns * 2} facciate fronte/retro); ${landPages.length} pagine di tabellone/tracciati/plance; foglio punti 4 pagine`);

// ───────────────────────── PDF ─────────────────────────
if (process.argv.includes('--no-pdf')) process.exit(0);
(async () => {
  let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
  const { chromium } = pw;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const pdf = async (html, file, opts) => {
    const p = await b.newPage();
    await p.goto('file://' + path.join(out, html)); await p.waitForTimeout(300);
    await p.pdf(Object.assign({ path: path.join(out, file), printBackground: true, preferCSSPageSize: true }, opts || {}));
    await p.close();
  };
  await pdf('carte-fronte-retro.html', 'carte-fronte-retro.pdf');
  await pdf('carte-solo-fronti.html', 'carte-solo-fronti.pdf');
  await pdf('tabellone-e-plance.html', 'tabellone-e-plance.pdf');
  await pdf('foglio-punti.html', 'foglio-punti.pdf');
  { // regolamento: testo reso dall'app stessa
    const p = await b.newPage(); await p.goto('file://' + path.join(root, 'index.html')); await p.waitForTimeout(500);
    const html = await p.evaluate(() => FF.UI.mdToHtml(FF.RULEBOOK_MD));
    await p.setContent(`<!doctype html><meta charset="utf-8"><style>@page{size:A4;margin:14mm}body{font:10pt/1.45 "Trebuchet MS",Verdana,"DejaVu Sans",sans-serif;color:#222}h2{font-size:19pt}h3{font-size:13.5pt;border-bottom:1.5px solid #999;margin-top:16px}h4{font-size:11pt}table{border-collapse:collapse;width:100%;margin:6px 0}td,th{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top;font-size:9pt}th{background:#eee}tr{break-inside:avoid}li{margin-bottom:3px}.tscroll{overflow:visible;max-height:none}</style>${html}`);
    await p.pdf({ path: path.join(out, 'regolamento.pdf'), printBackground: true, preferCSSPageSize: true }); await p.close();
  }
  await b.close();
  console.log('PDF scritti in stampa/');
})().catch((e) => { console.error(e); process.exit(1); });
