/* FIFO FAFO — schermata Simulazione */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const UI = FF.UI;
  const { $, $$, esc } = UI;
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  const pct = (k, n) => (n ? (100 * k / n).toFixed(1) + '%' : '–');

  let current = null; // ultimo risultato
  let cancelFlag = null;

  UI.openSim = function () {
    UI.screen('sim');
    const last = UI.store.get('setup_sim', {});
    const lv = (id, def) => `<div class="seg" id="${id}">${Object.entries(FF.LEVELS).map(([k, v]) => `<button data-v="${k}" class="${k === def ? 'sel' : ''}">${v}</button>`).join('')}</div>`;
    const counts = [100, 300, 1000, 3000];
    $('#s-sim').innerHTML = `<div class="wrap">
      <div class="card"><h2>📊 Simulazione veloce AI vs AI</h2>
        <p class="small muted" style="margin-bottom:12px">Ogni partita è giocata fino in fondo con le stesse regole del gioco reale. Con “posti alternati” il profilo A siede a turno in G1 e G2, così si separa la forza dell'AI dal vantaggio di posizione.</p>
        <div class="row2"><div class="field"><label>Profilo A</label>${lv('sm-a', last.a || 'hard')}</div><div class="field"><label>Profilo B</label>${lv('sm-b', last.b || 'medium')}</div></div>
        <div class="row2"><div class="field"><label>Numero di partite</label><div class="seg" id="sm-n">${counts.map((c) => `<button data-v="${c}" class="${(last.n || 300) === c ? 'sel' : ''}">${c}</button>`).join('')}</div></div>
        <div class="field"><label>Seed base</label><input type="text" id="sm-seed" placeholder="vuoto = casuale" value="${esc(last.seed || '')}"></div></div>
        <label class="check" style="margin-bottom:12px"><input type="checkbox" id="sm-swap" ${last.swap === false ? '' : 'checked'}> Alterna i posti (A in G1 / G2 a turno)</label>
        <details class="adv"><summary>⚙ Varianti di regole</summary>${UI.rulesFields('sm-r-', last.rules)}</details>
        <div class="btn-row"><button class="btn" id="sm-back">← Indietro</button><button class="btn primary" id="sm-go" style="flex:1">▶ Avvia simulazione</button></div>
        <div id="sm-prog" class="hidden"><div class="progress"><i id="sm-bar"></i></div><div class="small muted" id="sm-ptxt"></div><button class="btn sm danger" id="sm-stop">Interrompi</button></div>
      </div>
      <div class="card"><h2>🧪 Esperimento sulle regole</h2>
        <p class="small muted" style="margin-bottom:10px">Prova più valori di una stessa regola (con i profili e il seed scelti sopra) e confronta come cambia l'equilibrio della partita.</p>
        <div class="row2"><div class="field"><label>Regola</label><select id="ex-rule">${Object.keys(FF.DEFAULT_RULES).filter((k) => typeof FF.DEFAULT_RULES[k] !== 'boolean').map((k) => `<option value="${k}">${esc(FF.RULE_LABELS[k])}</option>`).join('')}</select></div>
        <div class="field"><label>Valori da provare (separati da virgola)</label><input type="text" id="ex-vals" value="1,2,3"></div></div>
        <div class="field"><label>Partite per valore</label><input type="number" id="ex-n" value="200" min="20" max="2000"></div>
        <button class="btn primary" id="ex-go">🧪 Esegui esperimento</button><div id="ex-out" style="margin-top:12px"></div></div>
      <div id="sm-res"></div></div>`;
    ['sm-a', 'sm-b', 'sm-n'].forEach((id) => UI.seg($('#' + id)));
    $('#sm-back').onclick = () => UI.go('home');
    $('#sm-go').onclick = runMain;
    $('#sm-stop').onclick = () => { if (cancelFlag) cancelFlag.cancelled = true; };
    $('#ex-go').onclick = runExperiment;
  };

  function readOpts() {
    const el = $('#s-sim');
    const o = {
      games: Number(UI.segVal($('#sm-n'))), a: UI.segVal($('#sm-a')), b: UI.segVal($('#sm-b')),
      seed: $('#sm-seed').value.trim() || UI.randomSeed(), swap: $('#sm-swap').checked, rules: UI.readRules(el), keepLogs: 8,
    };
    UI.store.set('setup_sim', { n: o.games, a: o.a, b: o.b, seed: $('#sm-seed').value.trim(), swap: o.swap, rules: o.rules });
    return o;
  }
  function setProg(show, i, n, txt) {
    $('#sm-prog').classList.toggle('hidden', !show);
    if (show) { $('#sm-bar').style.width = (100 * i / n) + '%'; $('#sm-ptxt').textContent = txt || `${i} / ${n} partite`; }
  }

  async function runMain() {
    const o = readOpts();
    $('#sm-go').disabled = true; $('#ex-go').disabled = true;
    cancelFlag = { cancelled: false };
    setProg(true, 0, o.games);
    const agg = await FF.Sim.run(o, (i, n) => setProg(true, i, n), cancelFlag);
    setProg(false);
    $('#sm-go').disabled = false; $('#ex-go').disabled = false;
    if (!agg.n) return;
    current = agg;
    showResults(agg);
  }

  // ───────────────────────── risultati ─────────────────────────
  function stackBar(parts) { // [{v,c,l}]
    const tot = parts.reduce((a, p) => a + p.v, 0) || 1;
    return `<div class="bar">${parts.map((p) => `<i style="width:${100 * p.v / tot}%;background:${p.c}" title="${p.l}: ${p.v}"></i>`).join('')}</div>`;
  }

  function lineChart(agg) {
    const T = agg.traj.cnt.length - 1;
    const pts0 = [], pts1 = [];
    for (let t = 1; t <= T; t++) if (agg.traj.cnt[t]) { pts0.push([t, agg.traj.sumG1[t] / agg.traj.cnt[t]]); pts1.push([t, agg.traj.sumG2[t] / agg.traj.cnt[t]]); }
    if (!pts0.length) return '';
    const W = 560, H = 200, L = 34, R = 10, Tp = 10, B = 24;
    const ys = pts0.concat(pts1).map((p) => p[1]);
    const ymax = Math.max(...ys, 1), ymin = Math.min(0, ...ys);
    const x = (t) => L + (W - L - R) * (t - 1) / Math.max(1, T - 1);
    const y = (v) => Tp + (H - Tp - B) * (1 - (v - ymin) / (ymax - ymin || 1));
    const path = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(' ');
    let grid = '';
    for (let i = 0; i <= 4; i++) { const v = ymin + (ymax - ymin) * i / 4; grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#5c3e1e55"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${v.toFixed(0)}</text>`; }
    for (let t = 1; t <= T; t += T > 10 ? 2 : 1) grid += `<text x="${x(t)}" y="${H - 8}" text-anchor="middle">${t}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento medio dei punteggi per turno">${grid}
      <path d="${path(pts0)}" fill="none" stroke="var(--p0)" stroke-width="2.5"/><path d="${path(pts1)}" fill="none" stroke="var(--p1)" stroke-width="2.5"/>
      <text x="${W - R}" y="${y(pts0[pts0.length - 1][1]) - 6}" text-anchor="end" style="fill:var(--p0)">G1</text><text x="${W - R}" y="${y(pts1[pts1.length - 1][1]) + 12}" text-anchor="end" style="fill:var(--p1)">G2</text></svg>`;
  }

  function marginChart(agg) {
    const ks = Object.keys(agg.margins).map(Number).sort((a, b) => a - b);
    const max = Math.max(...Object.values(agg.margins));
    const kmax = Math.min(ks[ks.length - 1], 24);
    const W = 560, H = 150, L = 8, B = 22, bw = (W - L * 2) / (kmax + 1);
    let bars = '';
    for (let k = 0; k <= kmax; k++) {
      const v = agg.margins[k] || 0, hgt = (H - B - 10) * v / max;
      bars += `<rect x="${L + k * bw + 1}" y="${H - B - hgt}" width="${bw - 2}" height="${hgt}" rx="2" fill="var(--accent)"><title>scarto ${k}: ${v} partite</title></rect>`;
      if (k % 2 === 0) bars += `<text x="${L + k * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${k}</text>`;
    }
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribuzione dello scarto finale">${bars}</svg>`;
  }

  function showResults(agg) {
    const n = agg.n, o = agg.opts, L = FF.LEVELS;
    const [alo, ahi] = FF.Sim.wilson(agg.wins.A, n), [glo, ghi] = FF.Sim.wilson(agg.seatWins.G1, n);
    const mk = Object.keys(agg.margins).map(Number);
    const mean = mk.reduce((s, k) => s + k * agg.margins[k], 0) / n;
    const close = mk.filter((k) => k <= 2).reduce((s, k) => s + agg.margins[k], 0);
    const moodRows = FF.MOOD_IDS.map((id) => ({ id, t: agg.moodTurns[id] || 0, pf: agg.moodPF[id] || 0 }));
    const maxRate = Math.max(...moodRows.map((r) => (r.t ? r.pf / r.t : 0)), 0.1);
    const keys = [...new Set([...Object.keys(agg.stats.A), ...Object.keys(agg.stats.B)])].sort();
    const rules = Object.keys(o.rules).filter((k) => o.rules[k] !== FF.DEFAULT_RULES[k]);
    $('#sm-res').innerHTML = `
      <div class="card"><h2>Risultati · ${n} partite · ${(agg.ms / 1000).toFixed(1)} s</h2>
        <div class="small muted" style="margin-bottom:10px">A = ${L[o.a]} · B = ${L[o.b]} · seed <code>${esc(o.seed)}</code> · ${rules.length ? 'regole: ' + rules.map((k) => `${k}=${o.rules[k]}`).join(', ') : 'regole standard'}</div>
        <div class="kpis">
          <div class="kpi"><div class="l">Vittorie A (${L[o.a]})</div><div class="v">${pct(agg.wins.A, n)}</div><div class="s">IC95 ${(alo * 100).toFixed(0)}–${(ahi * 100).toFixed(0)}% · punteggio medio ${f1(agg.score.A / n)}</div></div>
          <div class="kpi"><div class="l">Vittorie B (${L[o.b]})</div><div class="v">${pct(agg.wins.B, n)}</div><div class="s">punteggio medio ${f1(agg.score.B / n)}</div></div>
          <div class="kpi"><div class="l">Pareggi</div><div class="v">${pct(agg.wins.draw, n)}</div><div class="s">scarto medio ${f1(mean)} PF · ≤2 PF: ${pct(close, n)}</div></div>
          <div class="kpi"><div class="l">Vantaggio G1</div><div class="v">${pct(agg.seatWins.G1, n)} <span class="small muted">vs ${pct(agg.seatWins.G2, n)}</span></div><div class="s">G1 IC95 ${(glo * 100).toFixed(0)}–${(ghi * 100).toFixed(0)}%</div></div>
        </div>
        <div class="lbl">Vittorie per profilo</div>${stackBar([{ v: agg.wins.A, c: 'var(--good)', l: 'A' }, { v: agg.wins.draw, c: 'var(--muted)', l: 'pareggi' }, { v: agg.wins.B, c: 'var(--bad)', l: 'B' }])}
        <div class="small muted" style="margin:3px 0 10px">verde = A · grigio = pareggi · rosso = B</div>
        <div class="lbl">Vittorie per posto</div>${stackBar([{ v: agg.seatWins.G1, c: 'var(--p0)', l: 'G1' }, { v: agg.seatWins.draw, c: 'var(--muted)', l: 'pareggi' }, { v: agg.seatWins.G2, c: 'var(--p1)', l: 'G2' }])}
        <div class="small muted" style="margin:3px 0">arancio = G1 (Cucina, primo al mattino) · blu = G2 (Mansarda, primo al pomeriggio)</div>
      </div>
      <div class="card"><h2>Andamento del punteggio nei turni</h2>${lineChart(agg)}<div class="small muted">Punteggio netto medio (PF − Rancori) di G1 e G2 all'inizio di ogni turno.</div></div>
      <div class="card"><h2>Distribuzione dello scarto finale</h2>${marginChart(agg)}<div class="small muted">Scarto assoluto di punti tra i due giocatori (0 = pareggio).</div></div>
      <div class="card"><h2>Quanto rende ogni mood</h2><div class="tscroll"><table class="t"><tr><th>Mood</th><th>Turni/partita</th><th>PF/partita</th><th style="width:40%">PF per turno</th></tr>
        ${moodRows.map((r) => { const rate = r.t ? r.pf / r.t : 0; return `<tr><td>${FF.MOODS[r.id].e} ${FF.MOODS[r.id].name}</td><td>${f1(r.t / n)}</td><td>${f1(r.pf / n)}</td><td><div class="bar"><i style="width:${Math.max(2, 100 * Math.max(0, rate) / maxRate)}%;background:var(--accent2)"></i></div> ${rate.toFixed(2)}</td></tr>`; }).join('')}
        ${['offesissimo', 'arrabbiatissimo'].map((id) => `<tr><td>${FF.SPECIAL[id].e} ${FF.SPECIAL[id].name}</td><td>–</td><td>${f1((agg.moodPF[id] || 0) / n)}</td><td></td></tr>`).join('')}
      </table></div><div class="small muted">PF generati (somma di entrambi i giocatori) mentre quel mood era attivo. Un mood che rende molto meno degli altri è poco interessante; uno che rende molto di più può essere troppo forte.</div></div>
      <div class="card"><h2>Eventi di gioco · medie per partita</h2><div class="tscroll"><table class="t"><tr><th>Evento</th><th>A</th><th>B</th><th>G1</th><th>G2</th></tr>
        ${keys.map((k) => `<tr><td>${esc(FF.Sim.STAT_LABELS[k] || k)}</td><td>${f1((agg.stats.A[k] || 0) / n)}</td><td>${f1((agg.stats.B[k] || 0) / n)}</td><td>${f1((agg.stats.G1[k] || 0) / n)}</td><td>${f1((agg.stats.G2[k] || 0) / n)}</td></tr>`).join('')}
        ${Object.keys(agg.stats.game).filter((k) => !k.startsWith('mood_')).sort().map((k) => `<tr><td>${esc(FF.Sim.STAT_LABELS[k] || k)} <span class="muted">(globale)</span></td><td colspan="4" style="text-align:right">${f1(agg.stats.game[k] / n)}</td></tr>`).join('')}
      </table></div></div>
      <div class="card"><h2>Le singole partite</h2>
        <div class="btn-row" style="margin-bottom:10px"><select id="gl-filter" style="width:auto"><option value="all">Tutte</option><option value="close">Tirate (≤2 PF)</option><option value="blow">Larghe (≥8 PF)</option><option value="draw">Pareggi</option><option value="g1">Vince G1</option><option value="g2">Vince G2</option></select></div>
        <div class="tscroll"><table class="t" id="gl-table"></table></div><div class="btn-row" id="gl-pager" style="margin-top:8px"></div></div>
      <div class="card"><h2>Esporta</h2><div class="btn-row">
        <button class="btn" id="ex-md">⬇ Report (.md)</button><button class="btn" id="ex-copy">📋 Copia report</button><button class="btn" id="ex-csv">⬇ Partite (.csv)</button><button class="btn" id="ex-json">⬇ Dati completi (.json)</button></div></div>`;
    $('#ex-md').onclick = () => UI.download(`fifo-fafo-sim-${o.seed}.md`, FF.Sim.report(agg));
    $('#ex-copy').onclick = () => UI.copy(FF.Sim.report(agg));
    $('#ex-csv').onclick = () => UI.download(`fifo-fafo-sim-${o.seed}.csv`, FF.Sim.csv(agg), 'text/csv;charset=utf-8');
    $('#ex-json').onclick = () => UI.download(`fifo-fafo-sim-${o.seed}.json`, JSON.stringify(agg), 'application/json');
    let page = 0;
    const renderList = () => {
      const f = $('#gl-filter').value;
      const rows = agg.games.filter((g) => {
        const d = Math.abs(g.scores[0] - g.scores[1]);
        return f === 'all' || (f === 'close' && d <= 2) || (f === 'blow' && d >= 8) || (f === 'draw' && g.winner == null) || (f === 'g1' && g.winner === 0) || (f === 'g2' && g.winner === 1);
      });
      const per = 20, pages = Math.max(1, Math.ceil(rows.length / per));
      page = Math.min(page, pages - 1);
      $('#gl-table').innerHTML = `<tr><th>#</th><th>A siede</th><th>G1</th><th>G2</th><th>Esito</th><th></th></tr>` + rows.slice(page * per, page * per + per).map((g) =>
        `<tr><td>${g.i + 1}</td><td>${g.aSeat === 0 ? 'G1' : 'G2'}</td><td>${g.scores[0]}</td><td>${g.scores[1]}</td><td>${g.winner == null ? 'pareggio' : (g.winner === g.aSeat ? 'A' : 'B') + ' (G' + (g.winner + 1) + ')'}</td>
        <td style="white-space:nowrap"><button class="btn sm" data-log="${g.i}">📜 Log</button> <button class="btn sm" data-watch="${g.i}">▶ Rivedi</button></td></tr>`).join('');
      $('#gl-pager').innerHTML = `<span class="small muted">${rows.length} partite · pagina ${page + 1}/${pages}</span><button class="btn sm" data-p="-1" ${page === 0 ? 'disabled' : ''}>◀</button><button class="btn sm" data-p="1" ${page >= pages - 1 ? 'disabled' : ''}>▶</button>`;
    };
    $('#gl-filter').onchange = () => { page = 0; renderList(); };
    $('#gl-pager').onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { page += Number(b.dataset.p); renderList(); } };
    $('#gl-table').onclick = (e) => {
      const lb = e.target.closest('[data-log]'), wb = e.target.closest('[data-watch]');
      if (lb) showLog(agg, Number(lb.dataset.log));
      if (wb) watchGame(agg, Number(wb.dataset.watch));
    };
    renderList();
    $('#sm-res').scrollIntoView({ behavior: 'smooth' });
  }

  function gameLog(agg, i) {
    const kept = agg.logs.find((l) => l.i === i);
    if (kept) return kept.lines.map((e) => e.text).join('\n');
    const { g } = FF.Sim.playOne(i, Object.assign({}, agg.opts, { keepLogs: i + 1 })); // deterministico: rigioca la stessa partita col log acceso
    return g.events.map((e) => e.text).join('\n');
  }
  function showLog(agg, i) {
    const text = gameLog(agg, i);
    const gm = agg.games[i];
    const dlg = UI.modal(`<h2>Partita ${i + 1}</h2><div class="small muted" style="margin-bottom:8px">seed <code>${esc(gm.seed)}</code> · G1 ${gm.scores[0]} — G2 ${gm.scores[1]}</div><pre class="log">${esc(text)}</pre>
      <div class="btn-row end" style="margin-top:10px"><button class="btn" data-c>📋 Copia</button><button class="btn" data-d>⬇ .txt</button><button class="btn primary" data-x>Chiudi</button></div>`, { left: true });
    dlg.el.querySelector('[data-c]').onclick = () => UI.copy(text);
    dlg.el.querySelector('[data-d]').onclick = () => UI.download(`fifo-fafo-partita-${i + 1}.txt`, text);
    dlg.el.querySelector('[data-x]').onclick = dlg.close;
  }
  function watchGame(agg, i) {
    const gm = agg.games[i], o = agg.opts;
    const levels = [null, null]; levels[gm.aSeat] = o.a; levels[1 - gm.aSeat] = o.b;
    const names = [null, null]; names[gm.aSeat] = 'A·' + o.a; names[1 - gm.aSeat] = 'B·' + o.b;
    UI.startSession({ mode: 'watch', seed: gm.seed, rules: o.rules, speed: 'normal', players: levels.map((l, k) => ({ name: names[k], kind: 'ai', level: l })) });
  }

  // ───────────────────────── esperimento ─────────────────────────
  async function runExperiment() {
    const o = readOpts();
    const key = $('#ex-rule').value;
    const vals = $('#ex-vals').value.split(',').map((x) => Number(x.trim())).filter((x) => !isNaN(x));
    const per = Math.max(20, Math.min(2000, Number($('#ex-n').value) || 200));
    if (!vals.length) { UI.toast('Inserisci almeno un valore'); return; }
    $('#ex-go').disabled = true; $('#sm-go').disabled = true;
    cancelFlag = { cancelled: false };
    const rows = [];
    for (let vi = 0; vi < vals.length; vi++) {
      const rules = Object.assign({}, o.rules, { [key]: vals[vi] });
      const agg = await FF.Sim.run(Object.assign({}, o, { games: per, rules, keepLogs: 0 }), (i) => setProg(true, vi * per + i, vals.length * per, `valore ${vals[vi]} · ${i}/${per}`), cancelFlag);
      rows.push({ v: vals[vi], agg });
      if (cancelFlag.cancelled) break;
    }
    setProg(false);
    $('#ex-go').disabled = false; $('#sm-go').disabled = false;
    $('#ex-out').innerHTML = `<div class="tscroll"><table class="t"><tr><th>${esc(FF.RULE_LABELS[key])}</th><th>Vince A</th><th>Vince B</th><th>Pareggi</th><th>Vince G1</th><th>Vince G2</th><th>Punteggio medio</th><th>Scarto medio</th></tr>
      ${rows.map(({ v, agg }) => { const n = agg.n; const mk = Object.keys(agg.margins).map(Number); const mean = mk.reduce((s, k) => s + k * agg.margins[k], 0) / n;
        return `<tr><td>${v}${v === FF.DEFAULT_RULES[key] ? ' <span class="muted">(std)</span>' : ''}</td><td>${pct(agg.wins.A, n)}</td><td>${pct(agg.wins.B, n)}</td><td>${pct(agg.wins.draw, n)}</td><td>${pct(agg.seatWins.G1, n)}</td><td>${pct(agg.seatWins.G2, n)}</td><td>${f1((agg.score.G1 + agg.score.G2) / (2 * n))}</td><td>${f1(mean)}</td></tr>`; }).join('')}
      </table></div><div class="btn-row" style="margin-top:8px"><button class="btn sm" id="ex-copyt">📋 Copia tabella</button></div>`;
    $('#ex-copyt').onclick = () => UI.copy(rows.map(({ v, agg }) => `${key}=${v}: A ${pct(agg.wins.A, agg.n)} B ${pct(agg.wins.B, agg.n)} pareggi ${pct(agg.wins.draw, agg.n)} · G1 ${pct(agg.seatWins.G1, agg.n)} G2 ${pct(agg.seatWins.G2, agg.n)}`).join('\n'));
  }
})(typeof window !== 'undefined' ? window : globalThis);
