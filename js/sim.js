/* FIFO FAFO — simulazione di partite AI vs AI in blocco e statistiche per il playtest. */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const Sim = (FF.Sim = {});

  const tick = () => new Promise((r) => setTimeout(r, 0));

  function wilson(k, n) { // intervallo di confidenza 95% di una proporzione
    if (!n) return [0, 0];
    const z = 1.96, p = k / n, d = 1 + z * z / n;
    const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
    return [Math.max(0, c - h), Math.min(1, c + h)];
  }
  Sim.wilson = wilson;

  function addInto(dst, src) { for (const k in src) dst[k] = (dst[k] || 0) + src[k]; }

  /* opts: { games, seed, rules, a:'hard', b:'medium', swap:true, keepLogs:10, names:[..] }
     Il profilo A siede in G1 nelle partite pari e in G2 nelle dispari (se swap). */
  Sim.playOne = function (i, opts) {
    const swap = opts.swap !== false;
    const aSeat = swap ? i % 2 : 0;
    const seed = opts.seed + '#' + i;
    const keepLog = i < (opts.keepLogs || 0);
    const levels = [null, null]; levels[aSeat] = opts.a; levels[1 - aSeat] = opts.b;
    const names = [null, null]; names[aSeat] = 'A·' + opts.a; names[1 - aSeat] = 'B·' + opts.b;
    const g = new FF.Game({ seed, rules: opts.rules, log: keepLog, stats: true, players: [{ name: names[0], kind: 'ai', level: levels[0] }, { name: names[1], kind: 'ai', level: levels[1] }] });
    const ai = [FF.AI.create(levels[0], seed + 'a0'), FF.AI.create(levels[1], seed + 'a1')];
    const traj = [];
    const res = FF.drive(g, g.run(), (game, d) => {
      if (d.type === 'flow' && d.player === 0) traj[game.s.turn] = [game.score(0), game.score(1)];
      return ai[d.player].decide(game, d);
    });
    return { g, res, aSeat, seed, traj };
  };

  /* Analisi di TUTTI gli obiettivi: per ognuno, il profilo A lo "ha in mano" (solo quello) e lo insegue contro il profilo B.
     Serve a tarare i punti anche per le carte che le AI non scelgono mai da sole. */
  Sim.analyzeObjectives = async function (opts, perObj, onProgress, cancel) {
    const rows = []; const total = FF.OBJECTIVE_IDS.length * perObj; let done = 0, last = Date.now();
    const rules = Object.assign({}, opts.rules || {}, { objectives: true });
    for (const id of FF.OBJECTIVE_IDS) {
      let ok = 0, diff = 0, n = 0;
      for (let i = 0; i < perObj; i++) {
        if (cancel && cancel.cancelled) break;
        const seed = (opts.seed || 'obj') + ':' + id + ':' + i, seat = i % 2;
        const g = new FF.Game({ seed, rules, log: false, stats: false });
        g.dealObjectives = function* () {}; // niente pesca: assegniamo noi
        g.s.objectives[seat] = [id]; g.s.objectives[1 - seat] = [];
        const ai = [null, null]; ai[seat] = FF.AI.create(opts.a, seed + 'a'); ai[1 - seat] = FF.AI.create(opts.b, seed + 'b');
        const r = FF.drive(g, g.run(), (game, d) => ai[d.player].decide(game, d));
        if (r.objs[seat][0].ok) ok++;
        diff += r.scores[seat] - r.scores[1 - seat]; n++; done++;
        if (onProgress && Date.now() - last > 60) { last = Date.now(); onProgress(done, total); await tick(); }
      }
      const o = FF.OBJECTIVES[id], rate = n ? ok / n : 0, fail = rules.objectiveFailRancor == null ? FF.DEFAULT_RULES.objectiveFailRancor : rules.objectiveFailRancor;
      rows.push({ id, name: o.name, pts: o.pts, rate, ev: rate * o.pts - (1 - rate) * fail, diff: n ? diff / n : 0, n });
      if (cancel && cancel.cancelled) break;
    }
    if (onProgress) onProgress(total, total);
    return rows;
  };

  Sim.run = async function (opts, onProgress, cancel) {
    const n = opts.games;
    const agg = {
      opts: { games: n, seed: opts.seed, rules: Object.assign({}, FF.DEFAULT_RULES, opts.rules || {}), a: opts.a, b: opts.b, swap: opts.swap !== false },
      n: 0,
      wins: { A: 0, B: 0, draw: 0 },
      seatWins: { G1: 0, G2: 0, draw: 0 },
      score: { A: 0, B: 0, G1: 0, G2: 0 },
      pf: { A: 0, B: 0, G1: 0, G2: 0 }, rancor: { A: 0, B: 0, G1: 0, G2: 0 },
      margins: {},                 // |differenza| → conteggio
      stats: { A: {}, B: {}, G1: {}, G2: {}, game: {} },
      moodPF: {},                  // mood → somma PF (entrambi) e turni
      moodTurns: {},
      traj: { sumG1: [], sumG2: [], cnt: [] },
      objs: {},                    // obiettivo → { kept, done }
      games: [],                   // riassunto compatto di ogni partita
      logs: [],                    // log completi delle prime partite
      ms: 0,
    };
    const t0 = Date.now();
    let last = Date.now();
    for (let i = 0; i < n; i++) {
      if (cancel && cancel.cancelled) break;
      const { g, res, aSeat, seed, traj } = Sim.playOne(i, opts);
      const bSeat = 1 - aSeat;
      agg.n++;
      const win = res.winner;
      if (win == null) { agg.wins.draw++; agg.seatWins.draw++; }
      else { agg.wins[win === aSeat ? 'A' : 'B']++; agg.seatWins[win === 0 ? 'G1' : 'G2']++; }
      const map = { A: aSeat, B: bSeat, G1: 0, G2: 1 };
      for (const k of ['A', 'B', 'G1', 'G2']) {
        agg.score[k] += res.scores[map[k]]; agg.pf[k] += res.pf[map[k]]; agg.rancor[k] += res.rancor[map[k]];
        addInto(agg.stats[k], g.stats.p[map[k]]);
      }
      addInto(agg.stats.game, g.stats.g);
      const diff = Math.abs(res.scores[0] - res.scores[1]);
      agg.margins[diff] = (agg.margins[diff] || 0) + 1;
      for (const m in g.stats.moodPF) agg.moodPF[m] = (agg.moodPF[m] || 0) + g.stats.moodPF[m][0] + g.stats.moodPF[m][1];
      for (const k in g.stats.g) if (k.startsWith('mood_')) agg.moodTurns[k.slice(5)] = (agg.moodTurns[k.slice(5)] || 0) + g.stats.g[k];
      traj.forEach((v, t) => { if (!v) return; agg.traj.sumG1[t] = (agg.traj.sumG1[t] || 0) + v[0]; agg.traj.sumG2[t] = (agg.traj.sumG2[t] || 0) + v[1]; agg.traj.cnt[t] = (agg.traj.cnt[t] || 0) + 1; });
      for (const list of res.objs || []) for (const ob of list) { const e = (agg.objs[ob.id] = agg.objs[ob.id] || { kept: 0, done: 0, pts: ob.pts }); e.kept++; if (ob.ok) e.done++; }
      agg.games.push({ i, seed, aSeat, scores: res.scores, winner: win, pf: res.pf, rancor: res.rancor, objPts: res.objPts });
      if (g.logOn) agg.logs.push({ i, seed, aSeat, scores: res.scores, winner: win, lines: g.events.map((e) => ({ t: e.t, k: e.k, p: e.p, text: e.text })) });
      if (onProgress && Date.now() - last > 60) { last = Date.now(); onProgress(i + 1, n); await tick(); }
    }
    agg.ms = Date.now() - t0;
    if (onProgress) onProgress(agg.n, n);
    return agg;
  };

  // ───────────────────────── report testuale (markdown) ─────────────────────────
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  const pct = (k, n) => (n ? (100 * k / n).toFixed(1) + '%' : '–');

  Sim.report = function (a) {
    const n = a.n || 1, L = FF.LEVELS;
    const o = a.opts;
    const lines = [];
    const ci = (k) => { const [lo, hi] = wilson(k, a.n); return `${pct(k, a.n)} (IC95 ${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}%)`; };
    lines.push(`# FIFO FAFO — report simulazione`);
    lines.push(`- Partite: **${a.n}** · seed base \`${o.seed}\` · ${a.ms} ms · ${o.swap ? 'posti alternati (A in G1/G2 a turno)' : 'A sempre G1'}`);
    lines.push(`- Profilo **A**: ${L[o.a] || o.a} · Profilo **B**: ${L[o.b] || o.b}`);
    const diffRules = Object.keys(o.rules).filter((k) => o.rules[k] !== FF.DEFAULT_RULES[k]);
    lines.push(`- Regole: ${diffRules.length ? diffRules.map((k) => `${k}=${o.rules[k]}`).join(', ') : 'standard'}`);
    lines.push('');
    lines.push('## Esito');
    lines.push(`| | Vittorie | Punteggio medio | PF medi | Rancori medi |`);
    lines.push(`|---|---|---|---|---|`);
    for (const [k, label] of [['A', `A (${L[o.a] || o.a})`], ['B', `B (${L[o.b] || o.b})`]]) lines.push(`| ${label} | ${ci(a.wins[k])} | ${f1(a.score[k] / n)} | ${f1(a.pf[k] / n)} | ${f1(a.rancor[k] / n)} |`);
    lines.push(`| Pareggi | ${pct(a.wins.draw, a.n)} | | | |`);
    lines.push('');
    lines.push('## Vantaggio di posizione');
    lines.push(`| | Vittorie | Punteggio medio |`);
    lines.push(`|---|---|---|`);
    lines.push(`| G1 (Cucina, primo al mattino) | ${ci(a.seatWins.G1)} | ${f1(a.score.G1 / n)} |`);
    lines.push(`| G2 (Mansarda, primo al pomeriggio) | ${ci(a.seatWins.G2)} | ${f1(a.score.G2 / n)} |`);
    lines.push(`| Pareggi | ${pct(a.seatWins.draw, a.n)} | |`);
    lines.push('');
    // distribuzione scarto
    const mk = Object.keys(a.margins).map(Number).sort((x, y) => x - y);
    const mean = mk.reduce((s, k) => s + k * a.margins[k], 0) / n;
    lines.push(`## Scarto finale · media ${f1(mean)} PF · partite decise di ≤2 PF: ${pct(mk.filter((k) => k <= 2).reduce((s, k) => s + a.margins[k], 0), a.n)}`);
    lines.push('');
    lines.push('## Andamento medio del punteggio (netto = PF − Rancori)');
    lines.push('| Turno | G1 | G2 |');
    lines.push('|---|---|---|');
    for (let t = 1; t < a.traj.cnt.length; t += 2) if (a.traj.cnt[t]) lines.push(`| ${t} | ${f1(a.traj.sumG1[t] / a.traj.cnt[t])} | ${f1(a.traj.sumG2[t] / a.traj.cnt[t])} |`);
    lines.push('');
    lines.push('## Mood: PF totali generati (media per partita, entrambi i giocatori) e rendimento per turno');
    lines.push('| Mood | Turni/partita | PF/partita | PF per turno |');
    lines.push('|---|---|---|---|');
    for (const id of FF.MOOD_IDS) {
      const t = a.moodTurns[id] || 0, pf = a.moodPF[id] || 0;
      lines.push(`| ${FF.MOODS[id].e} ${FF.MOODS[id].name} | ${f1(t / n)} | ${f1(pf / n)} | ${t ? (pf / t).toFixed(2) : '–'} |`);
    }
    for (const id of ['offesissimo', 'arrabbiatissimo']) {
      const pf = a.moodPF[id] || 0;
      lines.push(`| ${FF.SPECIAL[id].e} ${FF.SPECIAL[id].name} | – | ${f1(pf / n)} | – |`);
    }
    lines.push('');
    if (Object.keys(a.objs).length) {
      lines.push('## Obiettivi segreti');
      lines.push('| Obiettivo | Punti | Tenuto | Riuscito |');
      lines.push('|---|---|---|---|');
      for (const id of Object.keys(a.objs).sort((x, y) => a.objs[y].kept - a.objs[x].kept)) { const e = a.objs[id]; lines.push(`| ${FF.OBJECTIVES[id].name} | +${e.pts} | ${e.kept} | ${pct(e.done, e.kept)} |`); }
      lines.push('');
    }
    lines.push('## Eventi di gioco (medie per partita, per giocatore)');
    const keys = new Set([...Object.keys(a.stats.A), ...Object.keys(a.stats.B)]);
    lines.push('| Evento | A | B | G1 | G2 |');
    lines.push('|---|---|---|---|---|');
    for (const k of [...keys].sort()) lines.push(`| ${STAT_LABELS[k] || k} | ${f1((a.stats.A[k] || 0) / n)} | ${f1((a.stats.B[k] || 0) / n)} | ${f1((a.stats.G1[k] || 0) / n)} | ${f1((a.stats.G2[k] || 0) / n)} |`);
    lines.push('');
    lines.push('## Eventi globali (media per partita)');
    for (const k of Object.keys(a.stats.game).sort()) if (!k.startsWith('mood_')) lines.push(`- ${STAT_LABELS[k] || k}: ${f1(a.stats.game[k] / n)}`);
    return lines.join('\n');
  };

  const STAT_LABELS = {
    'pf+giusta': '+PF risorsa giusta', 'pf+sbagliata': '+PF risorsa sbagliata', 'pf+senza_pretesa': '+PF mood senza pretesa',
    'pf+bisognoso_ok': '+PF Bisognoso (paletta)', 'pf+irrequieto_ok': '+PF Irrequieto soddisfatto', 'pf+arrab_calmato': '+PF Arrabbiatissimo calmato',
    'pf+coccolone_stop': '+PF fermarsi da Coccolone',
    'pf-nulla': '−PF non dare nulla', 'pf-raccolta_vicino_heafy': '−PF raccolta vicino a Heafy', 'pf-offesissimo_stanza': '−PF Offesissimo nella stanza',
    'pf-arrab_vicino': '−PF vicino ad Arrabbiatissimo', 'pf-arrab_non_soddisfatto': '−PF Arrabbiatissimo non soddisfatto',
    'pf-bisognoso_ko': '−PF Bisognoso senza paletta', 'pf-irrequieto_cambio': '−PF Irrequieto cambia direzione',
    interact: 'interazioni totali', interact_passive: 'interazioni passive (Heafy arriva)', c1_senza_heafy: 'C1 senza Heafy (abbandona risorsa)',
    c1_sprecata: 'C1 sprecata (già interagito)', b1_raccolte: 'B1 raccolte', b1_mano_piena: 'B1 con mano piena', b1_vuota: 'B1 in stanza vuota',
    risorse_date: 'risorse date a Heafy', mosse: 'stanze percorse con A', j2_usate: 'J2 usati', j2_mosse: 'J2 spostamenti', j2_raccolte: 'J2 raccolte sicure',
    j2_trasporti: 'J2 trasporti di Heafy', rancori: 'Rancori ottenuti', obj_fallito: 'obiettivi falliti',
    offesissimo_scattato: 'Offesissimo scattato', offesissimo_causato: 'Offesissimo causato dal giocatore', arrab_scattato: 'Arrabbiatissimo scattato',
    irrequieto_inversioni: 'Irrequieto: inversioni di direzione', bisognoso_to_irrequieto: 'Bisognoso → Irrequieto', dispettoso_buttate: 'risorse buttate da Dispettoso',
  };
  Sim.STAT_LABELS = STAT_LABELS;

  Sim.csv = function (a) {
    const rows = ['partita;seed;posto_A;punteggio_G1;punteggio_G2;vincitore;PF_G1;PF_G2;rancori_G1;rancori_G2'];
    for (const g of a.games) rows.push([g.i, g.seed, g.aSeat === 0 ? 'G1' : 'G2', g.scores[0], g.scores[1], g.winner == null ? 'pareggio' : (g.winner === g.aSeat ? 'A' : 'B') + '(' + (g.winner === 0 ? 'G1' : 'G2') + ')', g.pf[0], g.pf[1], g.rancor[0], g.rancor[1]].join(';'));
    return rows.join('\n');
  };
})(typeof window !== 'undefined' ? window : globalThis);
