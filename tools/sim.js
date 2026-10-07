#!/usr/bin/env node
/* Simulazione da riga di comando.
   Uso:  node tools/sim.js [--games 500] [--a hard] [--b medium] [--seed x] [--noswap]
                           [--rule handLimit=3 --rule j2Charges=3] [--out report.md] [--csv partite.csv]
                           [--log 3]   (stampa il log completo delle prime N partite) */
'use strict';
const fs = require('fs');
const FF = require('../tests/_load.js');

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const rules = {};
args.forEach((a, i) => {
  if (a === '--rule') {
    const [k, v] = args[i + 1].split('=');
    rules[k] = v === 'true' ? true : v === 'false' ? false : Number(v);
  }
});
const opts = {
  games: Number(get('games', 200)), seed: get('seed', 'playtest'), a: get('a', 'hard'), b: get('b', 'medium'),
  swap: !args.includes('--noswap'), rules, keepLogs: Number(get('log', 0)),
};
(async () => {
  const agg = await FF.Sim.run(opts, (i, n) => process.stderr.write(`\r${i}/${n} `));
  process.stderr.write('\n');
  const md = FF.Sim.report(agg);
  if (get('out')) fs.writeFileSync(get('out'), md + '\n'); else console.log(md);
  if (get('csv')) fs.writeFileSync(get('csv'), FF.Sim.csv(agg));
  for (const l of agg.logs) {
    console.log(`\n=== Partita ${l.i} (seed ${l.seed}) — punteggi ${l.scores.join(' / ')} ===`);
    console.log(l.lines.map((e) => e.text).join('\n'));
  }
})();
