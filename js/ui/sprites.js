/* FIFO FAFO — sprite vettoriali (SVG) disegnati a mano nel codice.
   Heafy con un'espressione per ogni mood, stanze illustrate, gettoni risorsa, pedine, icone delle carte.
   Funziona in browser (sprite sheet inline + <use>) e in Node (tools/export-sprites.js → assets/sprites/*.svg). */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const S = (FF.Sprites = {});
  const INK = '#3b2410';
  const ol = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const th = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

  // ───────────────────────── Heafy ─────────────────────────
  const eye = (cx, cy, rx, ry, pr, dx, dy) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" ${th}/><circle cx="${cx + dx}" cy="${cy + dy}" r="${pr}" fill="${INK}"/><circle cx="${cx + dx + pr * 0.35}" cy="${cy + dy - pr * 0.4}" r="${pr * 0.32}" fill="#fff"/>`;
  const eyes = {
    normal: () => eye(34, 54, 7, 8.5, 4.4, 0, 1) + eye(66, 54, 7, 8.5, 4.4, 0, 1),
    wide: () => eye(34, 54, 8.5, 10, 3, 0, 0) + eye(66, 54, 8.5, 10, 3, 0, 0),
    small: () => eye(34, 54, 7, 8.5, 2.6, 0, 0) + eye(66, 54, 7, 8.5, 2.6, 0, 0),
    up: () => eye(34, 54, 7.5, 9, 4.4, 2, -2) + eye(66, 54, 7.5, 9, 4.4, 2, -2),
    closed: () => `<path d="M26 55 q8 7 16 0 M58 55 q8 7 16 0" fill="none" ${ol}/>`,
    heart: () => [34, 66].map((x) => `<path d="M${x} 62 c-12 -7 -10 -18 -3 -16 q3 1 3 5 q0 -4 3 -5 c7 -2 9 9 -3 16z" fill="#e5457a" ${th}/>`).join(''),
    narrow: () => `<path d="M26 54 q8 -5 16 2 q-8 5 -16 -2z M58 56 q8 -7 16 -2 q-8 7 -16 2z" fill="#fff" ${th}/><circle cx="36" cy="55" r="3" fill="${INK}"/><circle cx="64" cy="55" r="3" fill="${INK}"/>`,
  };
  const browsAngry = `<path d="M24 42 l20 8 M76 42 l-20 8" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  const browsWorry = `<path d="M24 46 l18 -8 M76 46 l-18 -8" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
  const drop = (x, y, s) => `<path d="M${x} ${y} q${5 * s} ${10 * s} 0 ${14 * s} q${-5 * s} ${-4 * s} 0 ${-14 * s}z" fill="#8fd3ff" ${th}/>`;
  const mouthNeutral = `<path d="M50 70 v4 M50 74 q-6 5 -11 1 M50 74 q6 5 11 1" fill="none" ${th}/>`;
  const heartSm = (x, y, s, c) => `<path d="M${x} ${y} c${-6 * s} ${-4 * s} ${-5 * s} ${-9 * s} ${-1.5 * s} ${-8 * s} q${1.5 * s} .5 ${1.5 * s} ${2.5 * s} q0 ${-2 * s} ${1.5 * s} ${-2.5 * s} c${3.5 * s} ${-1 * s} ${4.5 * s} ${4 * s} ${-1.5 * s} ${8 * s}z" fill="${c || '#e5457a'}" ${th}/>`;
  const flame = (cx, cy, s) => `<path d="M${cx} ${cy - 22 * s} c${8 * s} ${8 * s} ${14 * s} ${12 * s} ${10 * s} ${22 * s} c${-2 * s} ${4 * s} ${-18 * s} ${4 * s} ${-20 * s} 0 c${-3 * s} ${-8 * s} ${5 * s} ${-12 * s} ${10 * s} ${-22 * s}z" fill="#f08a1c" ${th}/><path d="M${cx} ${cy - 8 * s} c${4 * s} ${4 * s} ${7 * s} ${6 * s} ${5 * s} ${10 * s} c${-2 * s} ${2 * s} ${-8 * s} ${2 * s} ${-10 * s} 0 c${-1 * s} ${-4 * s} ${3 * s} ${-6 * s} ${5 * s} ${-10 * s}z" fill="#ffd93b"/>`;
  const bolt = (x, y, f) => `<path d="M${x} ${y} l${8 * f} -12 l${-2 * f} 9 l${8 * f} -3 l${-10 * f} 15z" fill="#ffd93b" ${th}/>`;

  // [occhi, bocca, sopracciglia, extra sotto la testa, extra sopra, tinta]
  const CAT = {
    affamato:  { e: 'wide', mouth: `<path d="M40 72 q10 13 20 0z" fill="#8a2b2b" ${th}/><path d="M46 78 q4 9 8 0z" fill="#e5707a" ${th}/>`, extra: drop(66, 80, 0.9) },
    assonnato: { e: 'closed', mouth: `<ellipse cx="50" cy="77" rx="4" ry="3" fill="#8a2b2b" ${th}/>`, extra: `<text x="76" y="26" font-size="20" font-weight="800" fill="#4a6fa5" font-family="Nunito,Arial">Z</text><text x="88" y="14" font-size="14" font-weight="800" fill="#4a6fa5" font-family="Nunito,Arial">z</text>` },
    curioso:   { e: 'up', mouth: `<path d="M50 70 v4 M50 74 q-6 3 -10 -1 M50 74 q6 3 10 -1" fill="none" ${th}/>`, brows: `<path d="M24 40 q8 -5 16 -1 M60 36 q9 -7 17 0" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`, extra: `<text x="76" y="26" font-size="26" font-weight="800" fill="#3b82c4" stroke="${INK}" stroke-width="1" font-family="Nunito,Arial">?</text>` },
    coccolone: { e: 'heart', mouth: `<path d="M50 70 v4 M50 74 q-6 6 -12 0 M50 74 q6 6 12 0" fill="none" ${th}/>`, cheeks: true, extra: heartSm(84, 22, 1.5) + heartSm(12, 28, 1.1, '#ff8fb1') },
    giocherellone: { e: 'wide', mouth: `<path d="M38 71 q12 14 24 0z" fill="#8a2b2b" ${th}/><path d="M45 79 q5 6 10 0z" fill="#e5707a"/>`, extra: `<circle cx="18" cy="84" r="13" fill="#d95b5b" ${th}/><path d="M7 80 q11 6 22 -2 M8 88 q12 -2 20 -8 M14 74 q8 14 4 22" fill="none" stroke="${INK}" stroke-width="1.8"/>` },
    irrequieto: { e: 'small', mouth: `<path d="M36 77 q4 -5 7 0 t7 0 t7 0 t7 0" fill="none" ${th}/>`, extra: drop(14, 26, 0.9) + drop(88, 40, 0.8) },
    neutro:    { e: 'normal', mouth: `<path d="M50 70 v4 M42 77 h16" fill="none" ${th}/>` },
    bisognoso: { e: 'normal', mouth: `<path d="M50 70 v4 M38 79 q4 -4 6 0 t6 0 t6 0 t6 0" fill="none" ${th}/>`, brows: browsWorry, extra: drop(86, 30, 1) },
    iperattivo: { e: 'wide', mouth: `<path d="M38 71 q12 16 24 0z" fill="#8a2b2b" ${th}/>`, extra: bolt(6, 38, 1) + bolt(82, 30, 1) },
    dispettoso: { e: 'narrow', mouth: `<path d="M50 70 v3 M36 75 q14 10 28 -4" fill="none" ${th}/><path d="M60 75 l3 -3 l1 5z" fill="#fff" ${th}/>`, brows: browsAngry, horns: true },
    offesissimo: { e: 'narrow', mouth: `<path d="M50 70 v3 M38 80 q12 -10 24 0" fill="none" ${th}/>`, brows: browsAngry, tint: '#e03a2a', steam: true },
    arrabbiatissimo: { e: 'narrow', mouth: `<rect x="37" y="73" width="26" height="11" rx="3" fill="#fff" ${th}/><path d="M43 73 v11 M50 73 v11 M57 73 v11" ${th}/>`, brows: browsAngry, tint: '#e0201a', flames: true },
  };

  function catBody(m) {
    const c = CAT[m] || CAT.neutro;
    let s = '';
    if (c.flames) s += flame(50, 28, 1) + flame(30, 30, 0.7) + flame(70, 30, 0.7);
    s += `<path d="M14 46 L16 8 L45 27 Z" fill="#f0a24a" ${ol}/><path d="M20 36 L22 18 L36 27 Z" fill="#f4a6a6"/>`;
    s += `<path d="M86 46 L84 8 L55 27 Z" fill="#f0a24a" ${ol}/><path d="M80 36 L78 18 L64 27 Z" fill="#f4a6a6"/>`;
    if (c.horns) s += `<path d="M20 26 L10 8 L33 20z M80 26 L90 8 L67 20z" fill="#c0392b" ${ol}/>`;
    s += `<ellipse cx="50" cy="58" rx="38" ry="33" fill="#f0a24a" ${ol}/>`;
    if (c.tint) s += `<ellipse cx="50" cy="58" rx="36" ry="31" fill="${c.tint}" opacity=".38"/>`;
    s += `<path d="M50 27 v10 M39 29 l2 8 M61 29 l-2 8" fill="none" stroke="#c9741f" stroke-width="4" stroke-linecap="round"/>`;
    s += `<ellipse cx="50" cy="73" rx="17" ry="12" fill="#fff4e0"/>`;
    if (c.cheeks) s += `<circle cx="22" cy="68" r="6" fill="#ff8fb1" opacity=".7"/><circle cx="78" cy="68" r="6" fill="#ff8fb1" opacity=".7"/>`;
    s += eyes[c.e]();
    if (c.brows) s += c.brows;
    s += `<path d="M44 64 h12 l-6 6z" fill="#e5707a" ${th}/>`;
    s += c.mouth || mouthNeutral;
    s += `<path d="M10 66 l-12 -3 M10 72 l-12 3 M90 66 l12 -3 M90 72 l12 3" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
    if (c.steam) s += `<circle cx="14" cy="16" r="7" fill="#fff" ${th}/><circle cx="25" cy="8" r="5" fill="#fff" ${th}/><circle cx="86" cy="16" r="7" fill="#fff" ${th}/><circle cx="75" cy="8" r="5" fill="#fff" ${th}/>`;
    if (c.extra) s += c.extra;
    return s;
  }

  // ───────────────────────── stanze (120×90) ─────────────────────────
  const R = (x, y, w, h, f, extra) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${extra || ''}/>`;
  const ROOM = {
    cucina() {
      let t = R(0, 0, 120, 90, '#f6e7c4');
      for (let y = 0; y < 90; y += 15) for (let x = ((y / 15) % 2) * 15; x < 120; x += 30) t += R(x, y, 15, 15, '#e3c98c');
      t += R(0, 0, 120, 28, '#b9784a') + R(0, 24, 120, 5, '#8a5632');
      t += R(10, 5, 38, 18, '#4a4a52', th) + `<circle cx="22" cy="14" r="5" fill="#222"/><circle cx="36" cy="14" r="5" fill="#222"/><circle cx="22" cy="14" r="2" fill="#e8553a"/>`;
      t += R(66, 8, 22, 15, '#9aa9b5', th) + `<path d="M64 12 h-6 M90 12 h6" ${th}/><path d="M70 8 q6 -8 12 0" fill="#fff" opacity=".7"/>`;
      t += R(96, 2, 22, 52, '#eef3f6', th) + R(98, 26, 18, 2, '#b8c4cc') + `<rect x="111" y="10" width="2.5" height="10" rx="1" fill="#8a8f99"/>`;
      t += `<ellipse cx="40" cy="66" rx="22" ry="10" fill="#d96b6b" ${th}/><ellipse cx="40" cy="66" rx="12" ry="5" fill="#f2a0a0"/>`;
      return t;
    },
    bagno() {
      let t = R(0, 0, 120, 90, '#d4eef4');
      for (let x = 0; x < 120; x += 20) t += `<path d="M${x} 0 v90" stroke="#a8d4de" stroke-width="1.5"/>`;
      for (let y = 0; y < 90; y += 20) t += `<path d="M0 ${y} h120" stroke="#a8d4de" stroke-width="1.5"/>`;
      t += `<rect x="6" y="8" width="74" height="36" rx="14" fill="#fff" ${th}/><rect x="12" y="14" width="62" height="24" rx="10" fill="#9fd8ff"/>`;
      t += `<path d="M16 22 q6 -5 12 0 t12 0 t12 0" fill="none" stroke="#fff" stroke-width="2"/><circle cx="88" cy="14" r="4" fill="#c9d3da" ${th}/>`;
      t += `<rect x="92" y="38" width="22" height="12" rx="3" fill="#fff" ${th}/><ellipse cx="103" cy="64" rx="13" ry="16" fill="#fff" ${th}/><ellipse cx="103" cy="64" rx="8" ry="11" fill="#cfe8ef"/>`;
      t += `<rect x="14" y="62" width="40" height="18" rx="6" fill="#6fb7a5" ${th}/>`;
      return t;
    },
    camera() {
      let t = R(0, 0, 120, 90, '#c99a68');
      for (let y = 0; y < 90; y += 12) t += `<path d="M0 ${y} h120" stroke="#a97a4a" stroke-width="1.5"/>`;
      t += R(8, 6, 76, 62, '#7aa6d9', th) + R(8, 6, 76, 14, '#5a3a22', th);
      t += `<rect x="14" y="22" width="26" height="16" rx="6" fill="#fff" ${th}/><rect x="46" y="22" width="26" height="16" rx="6" fill="#fff" ${th}/>`;
      t += `<path d="M8 44 h76" stroke="#5b86b9" stroke-width="3"/><path d="M20 52 l6 -4 l6 4 l6 -4 l6 4" fill="none" stroke="#fff" stroke-width="2"/>`;
      t += `<ellipse cx="102" cy="74" rx="16" ry="9" fill="#d96b6b" ${th}/><rect x="96" y="8" width="18" height="22" rx="3" fill="#b9d8ee" ${th}/><path d="M105 8 v22 M96 19 h18" ${th}/>`;
      return t;
    },
    terrazzo() {
      let t = R(0, 0, 120, 90, '#a8d481');
      for (let x = 0; x < 120; x += 15) t += `<path d="M${x} 0 v90" stroke="#86b862" stroke-width="1.8"/>`;
      t += R(0, 0, 120, 8, '#c9a066', th);
      for (let x = 6; x < 120; x += 16) t += R(x, 0, 4, 18, '#d9b47c', `stroke="${INK}" stroke-width="1.5"`);
      const pot = (x, y, s) => `<path d="M${x - 9 * s} ${y} h${18 * s} l${-3 * s} ${14 * s} h${-12 * s}z" fill="#b8643a" ${th}/><circle cx="${x}" cy="${y - 7 * s}" r="${10 * s}" fill="#3f9a4a" ${th}/><circle cx="${x - 4 * s}" cy="${y - 10 * s}" r="${3 * s}" fill="#ff8fa3"/><circle cx="${x + 5 * s}" cy="${y - 5 * s}" r="${3 * s}" fill="#ffd93b"/>`;
      t += pot(22, 62, 1.1) + pot(98, 36, 1) + pot(92, 74, 0.8);
      t += `<circle cx="60" cy="52" r="12" fill="#e8d09a" ${th}/><circle cx="60" cy="52" r="6" fill="#d6b878"/>`;
      return t;
    },
    corridoio() {
      let t = R(0, 0, 120, 90, '#ead7b0');
      t += R(38, 0, 44, 90, '#b5392f', th) + R(43, 0, 34, 90, '#c9503f') + `<path d="M43 0 v90 M77 0 v90" stroke="#e3a82b" stroke-width="2"/>`;
      for (let y = 8; y < 90; y += 16) t += `<path d="M52 ${y} l8 5 l8 -5" fill="none" stroke="#e3a82b" stroke-width="2"/>`;
      t += R(4, 8, 22, 34, '#8a4f2a', th) + `<circle cx="22" cy="26" r="2.5" fill="#e3a82b"/>` + R(94, 8, 22, 34, '#8a4f2a', th) + `<circle cx="98" cy="26" r="2.5" fill="#e3a82b"/>`;
      t += `<rect x="6" y="56" width="18" height="26" rx="2" fill="#fff4e0" ${th}/><path d="M9 62 h12 M9 68 h12" stroke="#d9822b" stroke-width="2"/>`;
      return t;
    },
    mansarda() {
      let t = R(0, 0, 120, 90, '#9a7752');
      for (let y = 0; y < 90; y += 11) t += `<path d="M0 ${y} h120" stroke="#7d5c3a" stroke-width="1.5"/>`;
      t += `<path d="M0 0 L60 -4 L120 0 L120 6 L60 14 L0 6z" fill="#5a3a22"/><path d="M0 86 L60 22 L120 86" fill="none" stroke="#5a3a22" stroke-width="5"/>`;
      t += `<circle cx="60" cy="40" r="13" fill="#bfe3f2" ${ol}/><path d="M60 27 v26 M47 40 h26" ${th}/>`;
      t += R(10, 58, 26, 22, '#c99a68', th) + `<path d="M10 66 h26" ${th}/>` + R(40, 66, 20, 14, '#b8864f', th) + R(86, 52, 26, 28, '#c99a68', th) + `<path d="M86 62 h26" ${th}/>`;
      t += `<path d="M10 8 l12 10 M110 8 l-12 10 M24 14 l6 6 M30 14 l-6 6" stroke="#fff" stroke-width="1" opacity=".6"/>`;
      return t;
    },
    sgabuzzino() {
      let t = R(0, 0, 120, 90, '#b6b6bd');
      for (const y of [20, 46, 72]) t += R(6, y, 108, 4, '#6b4a2e', th);
      const box = (x, y, w, h, c) => R(x, y, w, h, c, th);
      t += box(10, 6, 24, 14, '#d9822b') + box(38, 8, 16, 12, '#5aa0d6') + box(62, 4, 22, 16, '#d96b6b') + box(90, 8, 20, 12, '#62b36f');
      t += box(10, 32, 18, 14, '#e3a82b') + box(32, 28, 26, 18, '#8a4f2a') + box(64, 34, 20, 12, '#5aa0d6') + box(90, 30, 20, 16, '#d9822b');
      t += `<path d="M20 90 L30 54" stroke="#8a4f2a" stroke-width="4" stroke-linecap="round"/><path d="M24 76 l16 14 h-22z" fill="#e3c06a" ${th}/>`;
      t += box(52, 56, 22, 16, '#b8864f') + `<circle cx="96" cy="62" r="9" fill="#fff4e0" ${th}/><path d="M96 56 v12 M90 62 h12" ${th}/>`;
      return t;
    },
    scale() {
      let t = R(0, 0, 120, 90, '#ead9b4');
      const n = 6;
      for (let i = 0; i < n; i++) {
        const x = 6 + i * 17, y = 78 - i * 12;
        t += `<path d="M${x} ${y} h17 v12 h-17z" fill="#c9a066" ${th}/><path d="M${x} ${y} h17 l3 -5 h-17z" fill="#e8c88a" ${th}/>`;
      }
      t += `<path d="M6 66 L108 6" stroke="#5a3a22" stroke-width="3.5" stroke-linecap="round"/>` + `<path d="M20 62 v-14 M48 45 v-14 M76 28 v-14" stroke="#5a3a22" stroke-width="2.5" stroke-linecap="round"/>`;
      return t;
    },
    ingresso() {
      let t = R(0, 0, 120, 90, '#e8dcc2');
      for (let y = 40; y < 90; y += 15) for (let x = ((y / 15) % 2) * 15; x < 120; x += 30) t += R(x, y, 15, 15, '#cdb98f');
      t += R(36, 0, 48, 52, '#8a4f2a', th) + R(42, 6, 36, 20, '#a8683a', th) + R(42, 30, 36, 18, '#a8683a', th) + `<circle cx="76" cy="32" r="3.5" fill="#e3a82b" ${th}/>`;
      t += R(30, 56, 60, 22, '#4a7a5a', th) + R(36, 60, 48, 14, '#5e9970') + `<path d="M42 67 h36" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/>`;
      t += `<path d="M6 70 q4 -10 14 -4 l2 10 h-18z" fill="#d96b6b" ${th}/><path d="M100 72 q4 -10 14 -4 l2 10 h-18z" fill="#5aa0d6" ${th}/>`;
      return t;
    },
  };

  // ───────────────────────── risorse (48×48) ─────────────────────────
  const disc = (c) => `<circle cx="24" cy="24" r="22" fill="${c}" ${ol}/><circle cx="24" cy="24" r="17" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`;
  const RES = {
    snack: disc('#e0793a') + `<ellipse cx="22" cy="24" rx="11" ry="7" fill="#fff4e0" ${th}/><path d="M32 24 l9 -8 v16z" fill="#fff4e0" ${th}/><circle cx="16" cy="22" r="1.8" fill="${INK}"/><path d="M22 18 v12 M27 19 v10" stroke="#e0793a" stroke-width="1.5"/>`,
    cuscino: disc('#4f9ad6') + `<rect x="9" y="15" width="30" height="19" rx="6" fill="#fff" ${th}/><path d="M13 20 q11 -4 22 0 M13 29 q11 4 22 0" fill="none" stroke="#9fc8ea" stroke-width="2"/><circle cx="9" cy="15" r="2.6" fill="#e3a82b" ${th}/><circle cx="39" cy="15" r="2.6" fill="#e3a82b" ${th}/><circle cx="9" cy="34" r="2.6" fill="#e3a82b" ${th}/><circle cx="39" cy="34" r="2.6" fill="#e3a82b" ${th}/>`,
    giochino: disc('#5cb06a') + `<circle cx="24" cy="23" r="11" fill="#f2d54a" ${th}/><path d="M14 20 q10 4 20 -2 M14 27 q10 -2 18 -10 M17 31 q6 -2 12 -10" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M33 31 q8 6 4 10" fill="none" stroke="#f2d54a" stroke-width="2.5" stroke-linecap="round"/>`,
    paletta: disc('#7d8794') + `<path d="M10 33 L24 15 L40 22 L34 38 Z" fill="#fff" ${th}/><path d="M24 15 L36 7" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><path d="M16 31 l14 -10 M22 35 l12 -8" stroke="#c9d3da" stroke-width="2"/>`,
    coccola: disc('#e0607a') + `<path d="M24 36 c-15 -9 -13 -22 -5 -20 q5 1 5 6 q0 -5 5 -6 c8 -2 10 11 -5 20z" fill="#fff" ${th}/>`,
  };

  // ───────────────────────── pedine (40×56) ─────────────────────────
  const pawn = (c, d) => `<ellipse cx="20" cy="52" rx="16" ry="4" fill="#000" opacity=".25"/><path d="M20 20 C9 20 4 29 3 41 C2 49 8 51 13 51 H27 C32 51 38 49 37 41 C36 29 31 20 20 20Z" fill="${c}" ${ol}/><path d="M10 34 q10 6 20 0" fill="none" stroke="${d}" stroke-width="3" stroke-linecap="round" opacity=".6"/><circle cx="20" cy="12" r="9.5" fill="${c}" ${ol}/><path d="M14 9 q3 -4 8 -3" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>`;

  // ───────────────────────── icone carte (64×64) ─────────────────────────
  const arrow = (cw, pips) => {
    const a = `<path d="M12 40 A22 22 0 0 1 50 26" fill="none" stroke="#d23a2a" stroke-width="7" stroke-linecap="round"/><path d="M44 12 L58 28 L38 30z" fill="#d23a2a" ${th}/>`;
    const p = pips === 1 ? `<circle cx="32" cy="54" r="4.5" fill="#d23a2a" ${th}/>` : `<circle cx="24" cy="54" r="4.5" fill="#d23a2a" ${th}/><circle cx="40" cy="54" r="4.5" fill="#d23a2a" ${th}/>`;
    return cw ? a + p : `<g transform="translate(64 0) scale(-1 1)">${a}</g>` + p;
  };
  const xmark = `<path d="M40 8 l16 16 M56 8 l-16 16" stroke="#c0392b" stroke-width="6" stroke-linecap="round"/>`;
  const basket = (x) => `<path d="M10 28 h44 l-6 26 h-32z" fill="#d9a05a" ${th}/><path d="M16 28 l4 26 M26 28 l1 26 M38 28 l-1 26 M48 28 l-4 26" stroke="${INK}" stroke-width="1.5"/><path d="M16 28 q16 -20 32 0" fill="none" stroke="#a8683a" stroke-width="4" stroke-linecap="round"/>${x ? xmark : '<circle cx="32" cy="16" r="6" fill="#e0793a" stroke="' + INK + '" stroke-width="2"/>'}`;
  const paw = (x) => `<ellipse cx="32" cy="42" rx="14" ry="12" fill="#5cb85c" ${th}/><ellipse cx="15" cy="28" rx="5.5" ry="7" fill="#5cb85c" ${th}/><ellipse cx="26" cy="20" rx="5.5" ry="7.5" fill="#5cb85c" ${th}/><ellipse cx="38" cy="20" rx="5.5" ry="7.5" fill="#5cb85c" ${th}/><ellipse cx="49" cy="28" rx="5.5" ry="7" fill="#5cb85c" ${th}/>${x ? xmark : '<path d="M32 48 c-8 -5 -7 -11 -3 -10 q3 1 3 3 q0 -2 3 -3 c4 -1 5 5 -3 10z" fill="#fff"/>'}`;
  const star = (on) => on
    ? `<path d="M32 6 L39 24 L58 25 L43 37 L48 56 L32 45 L16 56 L21 37 L6 25 L25 24Z" fill="#f5c542" ${ol}/><path d="M32 14 L36 26" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/><path d="M54 8 v8 M50 12 h8 M8 44 v7 M4.5 47.5 h7" stroke="#e3a82b" stroke-width="2.5" stroke-linecap="round"/>`
    : `<path d="M32 6 L39 24 L58 25 L43 37 L48 56 L32 45 L16 56 L21 37 L6 25 L25 24Z" fill="#e8dcc2" stroke="#a8917a" stroke-width="3" stroke-linejoin="round" stroke-dasharray="5 4"/>`;
  const ICON = { A1: arrow(true, 1), A2: arrow(true, 2), A3: arrow(false, 1), A4: arrow(false, 2), B1: basket(false), B2: basket(true), C1: paw(false), C2: paw(true), J1: star(false), J2: star(true) };

  // ───────────────────────── extra (UI) ─────────────────────────
  const EXTRA = {
    rug: `<ellipse cx="50" cy="50" rx="48" ry="48" fill="#8f2f2f"/><ellipse cx="50" cy="50" rx="42" ry="42" fill="none" stroke="#e3a82b" stroke-width="2.5" stroke-dasharray="3 5"/><ellipse cx="50" cy="50" rx="34" ry="34" fill="#a63c36"/>`,
    star: star(true), rancor: `<path d="M24 4 C32 14 40 20 38 32 C37 40 30 44 24 44 C17 44 10 40 10 32 C10 24 17 22 18 14 C21 18 22 12 24 4Z" fill="#7a3d8f" ${ol}/><circle cx="18" cy="30" r="3" fill="#fff"/><circle cx="30" cy="30" r="3" fill="#fff"/><path d="M18 38 q6 -4 12 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
    hand: `<rect x="2" y="2" width="44" height="44" rx="10" fill="#e8dcc2" stroke="#a8917a" stroke-width="2.5" stroke-dasharray="5 4"/>`,
  };

  const SYMBOLS = [];
  Object.keys(CAT).forEach((m) => SYMBOLS.push({ id: 'cat-' + m, vb: '-4 -4 108 108', body: catBody(m) }));
  Object.keys(ROOM).forEach((r) => SYMBOLS.push({ id: 'room-' + r, vb: '0 0 120 90', body: ROOM[r]() }));
  Object.keys(RES).forEach((r) => SYMBOLS.push({ id: 'res-' + r, vb: '0 0 48 48', body: RES[r] }));
  SYMBOLS.push({ id: 'pawn-0', vb: '0 0 40 56', body: pawn('#f08a2b', '#8a4a10') }, { id: 'pawn-1', vb: '0 0 40 56', body: pawn('#3f86d0', '#143f73') });
  Object.keys(ICON).forEach((c) => SYMBOLS.push({ id: 'card-' + c, vb: '0 0 64 64', body: ICON[c] }));
  SYMBOLS.push({ id: 'rug', vb: '0 0 100 100', body: EXTRA.rug }, { id: 'star', vb: '0 0 64 64', body: EXTRA.star }, { id: 'rancor', vb: '0 0 48 48', body: EXTRA.rancor }, { id: 'slot', vb: '0 0 48 48', body: EXTRA.hand });
  S.symbols = SYMBOLS;

  // sprite sheet da inserire una volta nel DOM
  S.sheet = () => `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${SYMBOLS.map((s) => `<symbol id="s-${s.id}" viewBox="${s.vb}">${s.body}</symbol>`).join('')}</defs></svg>`;
  // riferimento a uno sprite
  S.use = (id, cls, title) => `<svg class="sp ${cls || ''}" viewBox="${(SYMBOLS.find((s) => s.id === id) || { vb: '0 0 1 1' }).vb}" role="img" aria-label="${title || id}"><use href="#s-${id}"/></svg>`;
  S.standalone = (id) => { const s = SYMBOLS.find((x) => x.id === id); return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${s.vb}" width="256" height="256">${s.body}</svg>`; };
  S.cat = (m, cls) => S.use('cat-' + m, cls, 'Heafy ' + m);
  S.room = (id, cls) => S.use('room-' + id, cls);
  S.res = (id, cls) => S.use('res-' + id, cls, (FF.RES[id] || {}).n);
  S.pawn = (i, cls) => S.use('pawn-' + i, cls);
  S.card = (c, cls) => S.use('card-' + c, cls);
})(typeof window !== 'undefined' ? window : globalThis);
