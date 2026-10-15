const fs = require('fs');
const rows = fs.readFileSync(process.argv[2] || (__dirname + '/risultati/results.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const f = (x, d = 1) => x.toFixed(d), pc = (x) => (100 * x).toFixed(0) + '%';
for (const n of [3, 4]) {
  console.log(`\n=== ${n} giocatori (AI media, ${rows[0].games} partite per riga; equo = ${pc(1 / n)} a posto) ===`);
  console.log('config'.padEnd(18) + 'vitt. per posto (G1..)'.padEnd(26) + 'punt.medio'.padEnd(11) + 'PF'.padEnd(6) + 'Ranc.t'.padEnd(8) + 'obiett.ok'.padEnd(10) + 'Offes/p'.padEnd(8) + 'Arrab/p'.padEnd(8) + 'a vuoto/g'.padEnd(10) + 'scarto 1°-ult'.padEnd(14) + 'negativi');
  for (const a of rows.filter((r) => r.n === n)) {
    const g = a.games, pt = a.playersTotal;
    console.log(a.name.padEnd(18) + a.win.map((x) => pc(x / g)).join(' ').padEnd(26) + f(a.score.reduce((s, x) => s + x, 0) / pt).padEnd(11) + f(a.pf.reduce((s, x) => s + x, 0) / pt).padEnd(6)
      + f(a.rancorTurn.reduce((s, x) => s + x, 0) / pt, 2).padEnd(8) + pc(a.objOk / a.objAll).padEnd(10) + f(a.offesissimo / g, 2).padEnd(8) + f(a.arrab / g, 2).padEnd(8) + f(a.gaveNothing / pt).padEnd(10) + f(a.spread / g).padEnd(14) + pc(a.negFinal / pt));
  }
}
const b = rows.filter((r) => r.name === 'base');
console.log('\nObiettivi (successo per tipo, baseline):');
for (const a of b) console.log(' n=' + a.n, Object.entries(a.objKind).map(([k, [o, t]]) => `${k} ${pc(o / t)}`).join(' · '));
console.log('\nrisorse sul tavolo a fine partita (media), interazioni/giocatore, risorse date/giocatore:');
for (const a of rows.filter((r) => ['base', 'res2', 'c_pack'].includes(r.name))) console.log(' ', a.name.padEnd(10), 'n=' + a.n, 'sul tavolo', f(a.boardLeft / a.games), 'interaz.', f(a.interact / a.playersTotal), 'date', f(a.given / a.playersTotal), 'C1 sprecate', f(a.c1waste / a.playersTotal), 'Jolly usati', f(a.jolly / a.playersTotal, 2), 'trasporti', f(a.carry / a.playersTotal, 2));
