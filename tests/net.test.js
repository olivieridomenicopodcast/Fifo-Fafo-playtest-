'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const FF = require('./_load.js');
require('../js/netgame.js');
const Net = FF.Net;

// giocatore "virtuale": costruisce la propria copia del gioco dai messaggi (come fa l'interfaccia) e risponde con l'AI
function makeClient(runner, seat, log, level) {
  const pair = Net.localPair((m) => { log.fromClient.push(m); runner.answer(seat, m.id, m.i); });
  const ai = FF.AI.create(level || 'medium', 'cl' + seat);
  let mirror = null;
  const apply = (m) => { if (!mirror) mirror = new FF.Game({ seed: 'mirror', rules: runner.rules, players: runner.cfg.players }); mirror.s = m.s; };
  (async () => {
    for (;;) {
      const m = await pair.client.next();
      if (m.t === 'start') { apply(m); continue; }
      apply(m); log.toClient[seat].push(m);
      if (m.t === 'decide') pair.client.send({ t: 'ans', id: m.id, i: ai.decide(mirror, m.d) });
      if (m.t === 'end') return;
    }
  })();
  return pair;
}
function setup(seed, players) {
  const runner = new Net.Runner({ seed, players: players || [{ name: 'Ada', kind: 'human' }, { name: 'Bea', kind: 'human' }] });
  const log = { toClient: [[], []], fromClient: [] };
  const pairs = [0, 1].map((seat) => makeClient(runner, seat, log));
  [0, 1].forEach((seat) => { runner.attach(seat, pairs[seat].toClient); });
  return { runner, log, pairs };
}

test('rete: partita completa a due, tutti i messaggi sono JSON puro e il risultato è riproducibile', async () => {
  const { runner, log, pairs } = setup('rete-1');
  [0, 1].forEach((seat) => pairs[seat].toClient.send(runner.snapshot(seat)));
  const res = await runner.run();
  assert.ok(res && res.scores.length === 2);
  for (const l of log.toClient) for (const m of l) { assert.ok(Net.isPure(m), 'messaggio non JSON puro: ' + m.t); assert.ok(JSON.stringify(m).length < 12000, 'messaggio troppo grande per PeerJS: ' + m.t); }
  for (const m of log.fromClient) assert.ok(Net.isPure(m));
  // le decisioni arrivano solo al giocatore interessato
  for (const seat of [0, 1]) for (const m of log.toClient[seat]) if (m.t === 'decide') assert.equal(m.d.player, seat);
  // stessa partita rigiocata dalla cronologia = stesso risultato
  const g2 = new FF.Game({ seed: 'rete-1', players: runner.cfg.players, replay: runner.game.history, beats: false });
  const it = g2.run(); let r = it.next(); while (!r.done) r = it.next();
  assert.deepEqual(g2.result.scores, res.scores);
});

test('rete: la vista filtrata non rivela seed né obiettivi dell\'avversario prima della fine', async () => {
  const seed = 'segretissimo-777';
  const { runner, log, pairs } = setup(seed);
  [0, 1].forEach((seat) => pairs[seat].toClient.send(runner.snapshot(seat)));
  await runner.run(); await new Promise((r) => setTimeout(r, 30));
  const objs = runner.game.s.objectives;   // quelli veri, a fine partita
  for (const seat of [0, 1]) {
    const other = objs[1 - seat].filter((id) => !objs[seat].includes(id));
    const before = log.toClient[seat].filter((m) => m.t !== 'end' && !(m.s && m.s.over));
    assert.ok(before.length > 20);
    const txt = JSON.stringify(before);
    assert.ok(!txt.includes(seed), 'il seed è uscito');
    for (const id of other) assert.ok(!txt.includes('"' + id + '"'), `obiettivo avversario ${id} rivelato troppo presto`);
    for (const m of before) assert.ok(m.s.objectives[1 - seat].every((x) => x === '?'));
    assert.deepEqual(before[before.length - 1].s.objectives[seat].length, objs[seat].length);
    // a fine partita invece si rivelano
    const end = log.toClient[seat].find((m) => m.t === 'end');
    assert.ok(end && end.result.objs);
  }
});

test('rete: se un giocatore cade, l\'AI può giocare al suo posto e la partita finisce', async () => {
  const { runner, log, pairs } = setup('rete-drop');
  let alive = true;
  pairs[1].toClient.online = () => alive;
  [0, 1].forEach((seat) => pairs[seat].toClient.send(runner.snapshot(seat)));
  let offline = 0;
  runner.onOffline = (seat) => { offline++; assert.equal(seat, 1); runner.takeOver(1); };
  setTimeout(() => { alive = false; }, 0);
  const res = await Promise.race([runner.run(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]);
  assert.ok(res);
  assert.ok(offline >= 1);
});

test('rete: chi rientra riceve la scelta ancora pendente', async () => {
  const runner = new Net.Runner({ seed: 'rete-back', players: [{ name: 'Ada', kind: 'human' }, { name: 'Bea', kind: 'human' }] });
  const got = [];
  const link = (store, on) => ({ send: (m) => store.push(JSON.parse(JSON.stringify(m))), online: () => on.v });
  const on0 = { v: true }, on1 = { v: false };
  const l0 = link([], on0), l1 = link(got, on1);
  runner.attach(0, l0); runner.attach(1, l1);
  runner.onOffline = () => {};
  const ai = FF.AI.create('easy', 'x');
  const p = runner.run();
  // risponde l'AI per il giocatore 0 finché non arriva una decisione per il giocatore 1
  let spins = 0;
  while (!runner.pending[1] && spins++ < 200000) {
    const pd = runner.pending[0]; if (pd) runner.answer(0, pd.id, ai.decide(runner.game, pd.d));
    await new Promise((r) => setImmediate(r));
  }
  assert.ok(runner.pending[1], 'dovrebbe attendere il giocatore 1');
  assert.equal(got.length, 0);                 // era offline: non ha ricevuto nulla
  const id = runner.pending[1].id;
  on1.v = true; runner.join(1, l1);            // rientra
  assert.equal(got[0].t, 'start');
  const dec = got.find((m) => m.t === 'decide');
  assert.ok(dec && dec.id === id && dec.d.player === 1);
  runner.stop(); await p;
});

test('rete: il rientro a partita avanzata manda il log a pezzi piccoli (PeerJS non regge messaggi grandi)', async () => {
  const runner = new Net.Runner({ seed: 'rete-big', players: [{ name: 'Ada', kind: 'human' }, { name: 'Bea', kind: 'human' }] });
  const ai0 = FF.AI.create('easy', 'a'), got = [];
  runner.attach(0, { send() {}, online: () => true });
  runner.attach(1, { send() {}, online: () => false });
  runner.onOffline = () => {};
  const p = runner.run();
  for (let i = 0; i < 100000 && !(runner.pending[1] && runner.game.events.length > 60); i++) {
    for (const sd of [0, 1]) { const pd = runner.pending[sd]; if (pd && !(sd === 1 && runner.game.events.length > 60)) runner.answer(sd, pd.id, ai0.decide(runner.game, pd.d)); }
    await new Promise((r) => setImmediate(r));
  }
  assert.ok(runner.game.events.length > 60);
  runner.join(1, { send: (m) => got.push(JSON.parse(JSON.stringify(m))), online: () => true });
  assert.ok(got.every((m) => JSON.stringify(m).length < 12000));
  assert.equal(got.filter((m) => m.t === 'log').reduce((n, m) => n + m.evs.length, 0), runner.game.events.length);
  runner.stop(); await p;
});
