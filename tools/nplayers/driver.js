const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const games = +process.argv[2] || 300, out = path.join(__dirname, 'risultati', process.argv[3] || 'results.jsonl');   // T12=1: prova le varianti a 12 turni
fs.writeFileSync(out, '');
const jobs = [];
for (const n of [3, 4]) {
  const V = process.env.T12 ? {
    t12_base: { turns: 12 }, t12_rot: { turns: 12, rotate: true },
    t12_pack: { turns: 12, resPerRoom: 2, rotate: true, firstBonus: true, passiveByOrder: true, carryCooldown: true, arrabThreshold: n + 1 },
  } : {
    base: {}, res2: { resPerRoom: 2 }, hand3: { handLimit: 3 }, rech3: { rechargeEvery: 3 }, fbo: { firstBonus: true, passiveByOrder: true },
    rot: { rotate: true }, cool: { carryCooldown: true }, arr: { arrabThreshold: n + 1 },
    c_res2_rot_fbo: { resPerRoom: 2, rotate: true, firstBonus: true, passiveByOrder: true },
    c_pack: { resPerRoom: 2, rotate: true, firstBonus: true, passiveByOrder: true, carryCooldown: true, arrabThreshold: n + 1 },
    c_pack_rech3: { rechargeEvery: 3, rotate: true, firstBonus: true, passiveByOrder: true, carryCooldown: true, arrabThreshold: n + 1 },
  };
  for (const k of Object.keys(V)) jobs.push([k, n, V[k]]);
}
let running = 0, i = 0, done = 0;
function next() {
  while (running < 4 && i < jobs.length) {
    const [k, n, r] = jobs[i++]; running++;
    const c = spawn('node', [path.join(__dirname, 'run.js'), k, String(n), String(games), JSON.stringify(r), 'medium']);
    let buf = ''; c.stdout.on('data', (d) => (buf += d)); c.stderr.on('data', (d) => process.stderr.write(d));
    c.on('close', () => { running--; done++; fs.appendFileSync(out, buf.trim() + '\n'); console.log(`${done}/${jobs.length} ${k} n=${n}`); next(); });
  }
}
next();
