'use strict';
// Una configurazione: partite AI contro AI a N giocatori con regole modificate; stampa una riga JSON di totali.
// uso: node tools/nplayers/run.js <nome> <n-giocatori 2-4> <partite> '<json regole>' [easy|medium]
const path = require('path');
const dir = path.join(__dirname, '.gen');   // generato da build.py
require(path.join(dir, 'data.js')); require(path.join(dir, 'engine.js')); require(path.join(dir, 'ai.js'));
const FF = globalThis.FF;
const [name, nStr, gStr, rulesJson, level] = process.argv.slice(2);
const n = +nStr, games = +gStr, over = JSON.parse(rulesJson || '{}'), lvl = level || 'medium';
const rules = Object.assign({ nPlayers: n }, over);
const agg = { name, n, games, rules: over, level: lvl, win: Array(n).fill(0), ties: 0, score: Array(n).fill(0), pf: Array(n).fill(0), rancorTurn: Array(n).fill(0), rancorObj: Array(n).fill(0),
  objOk: 0, objAll: 0, objKind: {}, spread: 0, gaveNothing: 0, interact: 0, given: 0, rightGive: 0, wrongGive: 0, offesissimo: 0, arrab: 0, boardLeft: 0, c1waste: 0, below0games: 0, minScore: 0, negFinal: 0, playersTotal: 0, jolly: 0, carry: 0 };
const t0 = Date.now();
for (let i = 0; i < games; i++) {
  const seed = 'n' + n + '-' + name + '-' + i;
  const players = Array.from({ length: n }, (_, k) => ({ name: 'G' + (k + 1), kind: 'ai', level: lvl }));
  const g = new FF.Game({ seed, rules, players, log: false, beats: false, stats: true });
  const ais = players.map((p, k) => FF.AI.create(lvl, seed + 'a' + k));
  FF.drive(g, g.run(), (game, d) => ais[d.player].decide(game, d));
  const r = g.result, st = g.stats;
  const w = r.winners || [];
  if (w.length > 1) agg.ties++;
  for (const x of w) agg.win[x] += 1 / w.length;
  const mx = Math.max(...r.scores), mn = Math.min(...r.scores); agg.spread += mx - mn; agg.minScore += mn;
  for (let k = 0; k < n; k++) {
    agg.score[k] += r.scores[k]; agg.pf[k] += r.pf[k];
    const fails = r.objs[k].filter((o) => !o.ok).length;
    agg.rancorTurn[k] += r.rancor[k] - fails * (rules.objectiveFailRancor == null ? 1 : rules.objectiveFailRancor); agg.rancorObj[k] += fails;
    if (r.scores[k] < 0) agg.negFinal++;
    agg.playersTotal++;
    for (const o of r.objs[k]) { agg.objAll++; if (o.ok) agg.objOk++; const kind = FF.OBJECTIVES[o.id].kind; const e = (agg.objKind[kind] = agg.objKind[kind] || [0, 0]); e[1]++; if (o.ok) e[0]++; }
    const p = st.p[k];
    agg.interact += p.interact || 0; agg.given += p.risorse_date || 0; agg.gaveNothing += p['pf-nulla'] || 0; agg.c1waste += (p.c1_sprecata || 0) + (p.c1_senza_heafy || 0);
    agg.rightGive += p['pf+giusta'] ? 1 : 0;
    agg.jolly += p.j2_usate || 0; agg.carry += p.j2_trasporti || 0;
  }
  agg.offesissimo += st.g.offesissimo_scattato || 0; agg.arrab += st.g.arrab_scattato || 0;
  agg.boardLeft += g.s.res.reduce((a, b) => a + b.length, 0);
}
agg.ms = Date.now() - t0;
console.log(JSON.stringify(agg));
