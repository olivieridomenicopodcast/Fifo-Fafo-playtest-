'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const FF = require('./_load.js');

// ── helper ──
function mk(seed = 1, rules) {
  const g = new FF.Game({ seed, rules, log: true });
  g.s.turn = 1; g.s.phase = 'resolve';
  return g;
}
const run = (g, gen, answers) => {
  const q = Array.isArray(answers) ? answers.slice() : null;
  return FF.drive(g, gen, (game, d) => (q ? q.shift() : answers(game, d)));
};
const roomPos = (g, id) => g.posOf(id);
function setMood(g, id) { g.s.wheel[g.s.wheelIdx] = id; g.s.override = null; }
function clearRooms(g) { g.s.res.forEach((r) => (r.length = 0)); }

test('setup: 9 stanze uniche, risorse tematiche, ruota di 10 mood', () => {
  const g = new FF.Game({ seed: 7 });
  assert.equal(new Set(g.s.ring).size, 9);
  g.s.ring.forEach((ri, pos) => assert.deepEqual(g.s.res[pos], [FF.ROOMS[ri].res]));
  assert.equal(new Set(g.s.wheel).size, 10);
  assert.equal(g.room(g.s.heafy.pos).id, 'camera');
  assert.equal(g.room(g.s.players[0].pos).id, 'cucina');
  assert.equal(g.room(g.s.players[1].pos).id, 'mansarda');
  assert.equal(g.s.players[0].j2, 2);
});

test('stesso seed → stessa partita; replay delle risposte riproduce il risultato', () => {
  const play = (cfg) => {
    const g = new FF.Game(cfg);
    const a = [FF.AI.create('medium', 11), FF.AI.create('easy', 12)];
    const r = FF.drive(g, g.run(), (game, d) => a[d.player].decide(game, d));
    return { g, r };
  };
  const x = play({ seed: 'abc', log: true }), y = play({ seed: 'abc', log: true });
  assert.deepEqual(x.r, y.r);
  assert.deepEqual(x.g.events.map((e) => e.text), y.g.events.map((e) => e.text));
  const z = new FF.Game({ seed: 'abc', log: true, replay: x.g.history });
  const rz = FF.drive(z, z.run(), () => { throw new Error('non deve chiedere nulla'); });
  assert.deepEqual(rz, x.r);
});

test('interazione: risorsa giusta +2, sbagliata +1 con counter, nulla −1 e Offesissimo', () => {
  let g = mk(); setMood(g, 'affamato'); g.s.players[0].hand = ['snack'];
  run(g, g.interact(0, false), [['snack']]);
  assert.equal(g.s.players[0].pf, 2); assert.deepEqual(g.s.players[0].hand, []);

  g = mk(); setMood(g, 'affamato'); g.s.players[0].hand = ['cuscino'];
  run(g, g.interact(0, false), [['cuscino']]);
  assert.equal(g.s.players[0].pf, 1); assert.equal(g.s.arrab, 1); assert.equal(g.s.special, null);

  g = mk(); setMood(g, 'affamato');
  run(g, g.interact(0, false), [[]]);
  assert.equal(g.s.players[0].pf, -1); assert.equal(g.s.special, 'offesissimo'); assert.equal(g.s.offStage, 'hit');
});

test('3 risorse sbagliate → Arrabbiatissimo (counter si azzera solo allora); 2 risorse lo calmano', () => {
  const g = mk(); setMood(g, 'affamato');
  for (let i = 0; i < 3; i++) { g.s.players[0].hand = ['cuscino']; run(g, g.interact(0, false), [['cuscino']]); }
  assert.equal(g.s.special, 'arrabbiatissimo'); assert.equal(g.s.arrab, 0);
  g.s.players[1].hand = ['snack', 'coccola'];
  const idx = g.s.wheelIdx;
  run(g, g.interact(1, false), [['snack', 'coccola']]);
  assert.equal(g.s.players[1].pf, 2); assert.equal(g.s.special, null);
  assert.equal(g.s.wheelIdx, (idx + 1) % 10, 'la ruota avanza quando si calma'); assert.equal(g.s.noAdvance, true);
  // al giro dopo la ruota NON avanza di nuovo: il mood "nuovo" fa il suo turno completo
  g.s.turn = 2; run(g, g.heafyPhase(), () => []);
  assert.equal(g.s.wheelIdx, (idx + 1) % 10); assert.equal(g.s.noAdvance, false);
});

test('Arrabbiatissimo: con una sola risorsa −1 PF e nessuna risorsa consumata', () => {
  const g = mk(); g.s.special = 'arrabbiatissimo'; g.s.players[0].hand = ['snack'];
  run(g, g.interact(0, false), [['snack']]);
  assert.equal(g.s.players[0].pf, -1); assert.deepEqual(g.s.players[0].hand, ['snack']);
});

test('counter Arrabbiatissimo NON si azzera al cambio mood', () => {
  const g = mk(); setMood(g, 'affamato'); g.s.players[0].hand = ['cuscino'];
  run(g, g.interact(0, false), [['cuscino']]);
  g.s.turn = 2; run(g, g.heafyPhase(), () => []);
  assert.equal(g.s.arrab, 1);
});

test('Bisognoso: solo la Paletta (+3); altrimenti −1 e Heafy diventa Irrequieto (senza Offesissimo)', () => {
  let g = mk(); setMood(g, 'bisognoso'); g.s.players[0].hand = ['paletta'];
  run(g, g.interact(0, false), [['paletta']]);
  assert.equal(g.s.players[0].pf, 3);
  g = mk(); setMood(g, 'bisognoso'); g.s.players[0].hand = ['snack'];
  run(g, g.interact(0, false), [['snack']]);
  assert.equal(g.s.players[0].pf, -1); assert.equal(g.s.special, null); assert.equal(g.curMood().id, 'irrequieto');
  assert.deepEqual(g.s.players[0].hand, ['snack']);
});

test('Irrequieto: qualsiasi risorsa +2 → Neutro; non accetta altro; se non soddisfatto inverte direzione', () => {
  let g = mk(); setMood(g, 'irrequieto'); g.s.players[0].hand = ['snack']; g.s.players[1].hand = ['snack'];
  run(g, g.interact(0, false), [['snack']]);
  assert.equal(g.s.players[0].pf, 2); assert.equal(g.curMood().id, 'neutro');
  run(g, g.interact(1, false), [['snack']]); // Irrequieto ha già avuto la sua risorsa
  assert.equal(g.s.players[1].pf, 0); assert.deepEqual(g.s.players[1].hand, ['snack']);

  g = mk(); setMood(g, 'irrequieto'); g.s.heafy.pos = 0; g.s.players[0].pos = 0; g.s.players[1].pos = 5;
  run(g, g.endTurn(), []);
  assert.equal(g.s.heafy.dir, -1);
  assert.equal(g.s.players[0].pf, 0); // −1 PF → diventa Rancore a fine turno
  assert.equal(g.s.players[0].rancor, 1);
});

test('mood senza pretesa: +1 PF con una risorsa, −1 PF senza (nessun Offesissimo)', () => {
  let g = mk(); setMood(g, 'neutro'); g.s.players[0].hand = ['snack'];
  run(g, g.interact(0, false), [['snack']]);
  assert.equal(g.s.players[0].pf, 1);
  g = mk(); setMood(g, 'neutro');
  run(g, g.interact(0, false), [[]]);
  assert.equal(g.s.players[0].pf, -1); assert.equal(g.s.special, null);
});

test('B1 raccoglie solo nella stanza di fermata, rispetta il limite mano', () => {
  const g = mk(); clearRooms(g);
  const p = g.s.players[0]; p.pos = 2; g.s.heafy.pos = 6;
  g.s.res[2] = ['snack']; g.s.res[3] = ['paletta'];
  run(g, g.resolveFlow(0, ['B1', 'A1', 'C2', 'J1']), () => null);
  // B1 prima di A1: raccoglie in pos 2, poi si sposta in 3 senza raccogliere
  assert.deepEqual(p.hand, ['snack']); assert.equal(p.pos, 3); assert.deepEqual(g.s.res[3], ['paletta']);

  const q = g.s.players[1]; q.pos = 3; q.hand = ['snack', 'coccola'];
  run(g, g.collect(1), () => null);
  assert.equal(q.hand.length, 2); assert.deepEqual(g.s.res[3], ['paletta']);
});

test('B1 nella stanza di Heafy: −1 PF e Offesissimo; J2 raccolta sicura no', () => {
  let g = mk(); clearRooms(g);
  g.s.players[0].pos = 4; g.s.heafy.pos = 4; g.s.res[4] = ['snack'];
  run(g, g.collect(0), ['snack']);
  assert.equal(g.s.players[0].pf, -1); assert.equal(g.s.special, 'offesissimo');

  g = mk(); clearRooms(g);
  g.s.players[0].pos = 4; g.s.heafy.pos = 4; g.s.res[4] = ['snack'];
  run(g, g.jolly(0, []), [{ k: 'collect', res: 'snack' }, { k: 'done' }]);
  assert.equal(g.s.players[0].pf, 0); assert.equal(g.s.special, null); assert.deepEqual(g.s.players[0].hand, ['snack']);
  assert.equal(g.s.players[0].j2, 1);
});

test('C1 senza Heafy: si abbandona una risorsa nella stanza; C1 con Heafy interagisce una sola volta per turno', () => {
  let g = mk(); clearRooms(g);
  const p = g.s.players[0]; p.pos = 1; p.hand = ['snack']; g.s.heafy.pos = 5;
  run(g, g.resolveFlow(0, ['B2', 'C1', 'J1', 'A1']), ['snack']);
  assert.deepEqual(p.hand, []);
  assert.ok(g.s.res[2].includes('snack') || g.s.res[1].includes('snack') || g.s.res.flat().includes('snack'));

  g = mk(); setMood(g, 'neutro'); const q = g.s.players[0]; q.pos = 3; g.s.heafy.pos = 3; q.hand = ['snack', 'coccola'];
  q.interacted = true;
  run(g, g.resolveFlow(0, ['B2', 'C1', 'J1', 'A1']), () => ['snack']);
  assert.equal(q.pf, 0); assert.equal(q.hand.length, 2);
});

test('Offesissimo scattato durante le carte: colpisce al giro dopo (−2), si calma quello ancora dopo', () => {
  const g = mk(); setMood(g, 'affamato'); g.s.wheelIdx = 0;
  g.s.heafy.pos = 0; g.s.players[0].pos = 5; g.s.players[1].pos = 6;
  run(g, g.interact(0, false), [[]]);                       // nulla → Offesissimo (hit)
  assert.equal(g.s.special, 'offesissimo'); assert.equal(g.s.offStage, 'hit');
  g.s.players[1].pos = 1; g.s.turn = 2;                      // Heafy dir=+1 → pos 1
  run(g, g.heafyPhase(), () => []);
  assert.equal(g.s.heafy.pos, 1); assert.equal(g.s.players[1].pf, -2); assert.equal(g.s.special, 'offesissimo'); assert.equal(g.s.offStage, 'calm');
  const idx = g.s.wheelIdx;
  g.s.turn = 3; run(g, g.heafyPhase(), () => []);
  assert.equal(g.s.special, null); assert.equal(g.s.wheelIdx, (idx + 1) % 10);
});

test('Arrabbiatissimo: −1 PF a chi è nella stanza o adiacente, non cambia mood', () => {
  const g = mk(); g.s.special = 'arrabbiatissimo'; g.s.heafy.pos = 4; g.s.players[0].pos = 3; g.s.players[1].pos = 7;
  const idx = g.s.wheelIdx; g.s.turn = 2;
  run(g, g.heafyPhase(), () => []);
  assert.equal(g.s.players[0].pf, -1); assert.equal(g.s.players[1].pf, 0); assert.equal(g.s.wheelIdx, idx); assert.equal(g.s.heafy.pos, 4);
});

test('movimenti dei mood: Affamato→Cucina, Iperattivo ×2, Assonnato/Coccolone fermi, Curioso cerca risorse', () => {
  const place = (id) => { const g = mk(); g.s.turn = 2; g.s.wheel[(g.s.wheelIdx + 1) % 10] = id; g.s.heafy.pos = 0; g.s.heafy.dir = 1; g.s.players.forEach((p) => (p.pos = 8)); return g; };
  let g = place('affamato'); run(g, g.heafyPhase(), () => []); assert.equal(g.room(g.s.heafy.pos).id, 'cucina');
  g = place('iperattivo'); run(g, g.heafyPhase(), () => []); assert.equal(g.s.heafy.pos, 2);
  g = place('assonnato'); run(g, g.heafyPhase(), () => []); assert.equal(g.s.heafy.pos, 0);
  g = place('curioso'); clearRooms(g); g.s.res[3] = ['snack']; run(g, g.heafyPhase(), () => []); assert.equal(g.s.heafy.pos, 3);
});

test('Giocherellone sequestra e rilascia al movimento successivo; Dispettoso butta una risorsa', () => {
  let g = mk(); g.s.turn = 2; g.s.wheel[(g.s.wheelIdx + 1) % 10] = 'giocherellone'; g.s.heafy.pos = 0; g.s.players.forEach((p) => (p.pos = 8));
  const before = g.s.res[1].length;
  run(g, g.heafyPhase(), () => []);
  assert.equal(g.s.heafy.carry != null, true); assert.equal(g.s.res[1].length, before - 1);
  const c = g.s.heafy.carry;
  g.s.wheel[(g.s.wheelIdx + 1) % 10] = 'neutro'; g.s.turn = 3;
  run(g, g.heafyPhase(), () => []);
  assert.equal(g.s.heafy.carry, null); assert.ok(g.s.res[g.s.heafy.pos].includes(c));

  g = mk(); g.s.turn = 2; g.s.wheel[(g.s.wheelIdx + 1) % 10] = 'dispettoso'; g.s.heafy.pos = 0; g.s.players.forEach((p) => (p.pos = 8));
  g.s.res[1] = ['snack', 'paletta'];
  run(g, g.heafyPhase(), () => []);
  assert.equal(g.s.res[1].length, 1);
});

test('Bisognoso attira il giocatore più vicino in Bagno', () => {
  const g = mk(); g.s.turn = 2; g.s.wheel[(g.s.wheelIdx + 1) % 10] = 'bisognoso';
  const bag = g.posOf('bagno');
  g.s.players[0].pos = FF.mod(bag + 1); g.s.players[1].pos = FF.mod(bag + 4);
  run(g, g.heafyPhase(), (game, d) => (d.type === 'give' ? [] : null));
  assert.equal(g.s.heafy.pos, bag); assert.equal(g.s.players[0].pos, bag); assert.notEqual(g.s.players[1].pos, bag);
});

test('Coccolone: nessun bonus per fermarsi (solo come variante coccolonePF)', () => {
  let g = mk(); setMood(g, 'coccolone'); g.s.players[0].pos = 2; g.s.heafy.pos = 2;
  run(g, g.resolveFlow(0, ['B2', 'C2', 'J1']), () => null);
  assert.equal(g.s.players[0].pf, 0);
  g = mk(1, { coccolonePF: 1 }); setMood(g, 'coccolone'); g.s.players[0].pos = 2; g.s.heafy.pos = 2;
  run(g, g.resolveFlow(0, ['B2', 'C2', 'J1']), () => null); // resta nella stanza di Heafy
  assert.equal(g.s.players[0].pf, 1);
});

test('J2: spostamento, trasporto di Heafy con risorsa, non può finire con "prendi"', () => {
  const g = mk(); clearRooms(g);
  const p = g.s.players[0]; p.pos = 2; g.s.heafy.pos = 2; g.s.res[2] = ['snack'];
  // un "done" subito dopo "prendi Heafy" è illegale: il motore impone un'altra azione
  run(g, g.jolly(0, []), [{ k: 'pickup', carry: 'snack' }, { k: 'done' }, { k: 'done' }]);
  assert.equal(g.s.heafy.carriedBy, 0); assert.equal(g.s.heafy.pos, 3); assert.equal(p.pos, 3); assert.equal(g.s.heafy.carry, 'snack');
  // all'inizio del turno dopo Heafy torna libero e rilascia la risorsa nella stanza
  g.s.turn = 2; run(g, g.heafyPhase(), () => []);
  assert.equal(g.s.heafy.carriedBy, null);
});

test('C1 dell\'avversario fallisce se Heafy è in braccio al rivale', () => {
  const g = mk(); clearRooms(g);
  g.s.players[0].pos = 3; g.s.players[1].pos = 3; g.s.heafy.pos = 3; g.s.heafy.carriedBy = 0; g.s.players[1].hand = ['snack'];
  run(g, g.resolveFlow(1, ['C1', 'B2', 'J1', 'A1']), ['snack']);
  assert.equal(g.s.players[1].pf, 0); assert.deepEqual(g.s.players[1].hand, []); // risorsa abbandonata
});

test('Rancore: i PF sotto zero diventano Rancori; punteggio finale = PF − Rancori', () => {
  const g = mk(); g.s.players[0].pf = -3;
  run(g, g.endTurn(), []);
  assert.equal(g.s.players[0].pf, 0); assert.equal(g.s.players[0].rancor, 3); assert.equal(g.score(0), -3);
});

test('Ricarica: a fine Mattino e Pomeriggio ogni stanza riceve la risorsa originale', () => {
  const g = mk(); g.s.turn = 5; g.s.res.forEach((r) => (r.length = 0));
  run(g, g.endTurn(), []);
  g.s.res.forEach((r, pos) => assert.deepEqual(r, [g.s.base[pos]]));
  g.s.turn = 6; const tot = g.s.res.flat().length; run(g, g.endTurn(), []); assert.equal(g.s.res.flat().length, tot); // 6→7 nessuna ricarica
  g.s.turn = 10; run(g, g.endTurn(), []); assert.equal(g.s.res.flat().length, tot + 9);
});

test('ordine di partenza: G1 mattino, G2 pomeriggio, sera chi ha meno', () => {
  const firsts = [];
  const g = new FF.Game({ seed: 3 });
  const a = [FF.AI.create('easy', 1), FF.AI.create('easy', 2)];
  g.s.players[0].pf = 5; // verrà alterato sotto
  const r = FF.drive(g, g.run(), (game, d) => { if (d.type === 'flow') firsts[game.s.turn] = game.s.first; return a[d.player].decide(game, d); });
  for (let t = 1; t <= 5; t++) assert.equal(firsts[t], 0);
  for (let t = 6; t <= 10; t++) assert.equal(firsts[t], 1);
  assert.ok(r.scores.length === 2);
});

test('flow non valido viene rimpiazzato; J2 non giocabile a cariche esaurite', () => {
  const g = new FF.Game({ seed: 1 });
  assert.equal(g.validFlow(0, ['A1', 'A2', 'C1', 'J1']), false);
  assert.equal(g.validFlow(0, ['A1', 'B1', 'C1', 'J2']), true);
  g.s.players[0].j2 = 0;
  assert.equal(g.validFlow(0, ['A1', 'B1', 'C1', 'J2']), false);
});

test('fuzz: invarianti su 400 partite con AI miste', () => {
  const levels = ['easy', 'medium'];
  for (let i = 0; i < 400; i++) {
    const g = new FF.Game({ seed: 'fz' + i, log: false });
    const a = [FF.AI.create(levels[i % 2], i), FF.AI.create(levels[(i + 1) % 2], i + 999)];
    FF.drive(g, g.run(), (game, d) => {
      for (const p of game.s.players) assert.ok(p.hand.length <= 2, 'limite mano');
      assert.ok(game.s.arrab >= 0 && game.s.arrab <= 2);
      return a[d.player].decide(game, d);
    });
    g.s.players.forEach((p) => { assert.ok(p.pf >= 0); assert.ok(p.hand.length <= 2); });
    // conservazione delle risorse: 9 iniziali + 2 ricariche da 9 − buttate da Heafy dispettoso
    const total = g.s.res.flat().length + g.s.players.reduce((n, p) => n + p.hand.length, 0) + (g.s.heafy.carry ? 1 : 0);
    const dati = (g.stats.p[0].risorse_date || 0) + (g.stats.p[1].risorse_date || 0);
    assert.equal(total + dati, 27 - (g.stats.g.dispettoso_buttate || 0));
  }
});

test('inizio di ogni periodo: messaggio dedicato', () => {
  const g = new FF.Game({ seed: 4, log: true });
  const a = [FF.AI.create('easy', 1), FF.AI.create('easy', 2)];
  FF.drive(g, g.run(), (game, d) => a[d.player].decide(game, d));
  const per = g.events.filter((e) => e.k === 'period');
  assert.equal(per.length, 3);
  assert.deepEqual(per.map((e) => e.t), [1, 6, 11]);
});

test('C1 sprecata o senza Heafy pesa sulla valutazione dell\'AI (waste)', () => {
  const g = mk(); clearRooms(g);
  const p = g.s.players[0]; p.pos = 1; p.hand = ['snack']; g.s.heafy.pos = 5;
  run(g, g.resolveFlow(0, ['C1', 'B2', 'J1']), ['snack']);
  assert.ok(p.waste >= 1.5);
});

test('Offesissimo scattato in fase Heafy (interazione passiva): il turno dopo si sposta e colpisce comunque', () => {
  const g = mk(); g.s.phase = 'heafy'; setMood(g, 'affamato'); g.s.heafy.pos = 0; g.s.players[0].pos = 0; g.s.players[1].pos = 1;
  run(g, g.interact(0, true), [[]]);
  assert.equal(g.s.special, 'offesissimo'); assert.equal(g.s.offStage, 'hit');
  g.s.turn = 2; run(g, g.heafyPhase(), () => []);
  assert.equal(g.s.heafy.pos, 1); assert.equal(g.s.players[1].pf, -2); assert.equal(g.s.offStage, 'calm');
});

test('obiettivi: pesca (2+2), scelta, controlli sul tavolo, rivelazione e Rancore se falliti', () => {
  const g = new FF.Game({ seed: 'obj1', log: true });
  const offers = [];
  const a = [FF.AI.create('medium', 1), FF.AI.create('medium', 2)];
  const r = FF.drive(g, g.run(), (game, d) => { if (d.type === 'objectives') offers.push(d.offer); return a[d.player].decide(game, d); });
  assert.equal(offers.length, 2);
  offers.forEach((o) => { assert.equal(o.length, 4); assert.equal(o.filter((id) => FF.OBJECTIVES[id].deck === 'A').length, 2); });
  assert.equal(new Set(offers.flat()).size, 8, 'nessuna carta in comune');
  assert.equal(g.s.objectives[0].length, 2);
  let gain = 0, fails = 0;
  [0, 1].forEach((i) => r.objs[i].forEach((o) => { if (o.ok) gain += o.pts; else fails++; }));
  assert.equal(r.objPts[0] + r.objPts[1], gain);
  assert.equal(r.rancor[0] + r.rancor[1], g.s.players[0].rancor + g.s.players[1].rancor);
  assert.ok(g.events.some((e) => e.k === 'obj'));
});

test('controllo di ogni obiettivo', () => {
  const g = mk(); const p = g.s.players[0];
  p.pos = g.posOf('cucina'); assert.equal(g.objectiveDone(0, 'angolo:cucina'), true); assert.equal(g.objectiveDone(0, 'angolo:bagno'), false);
  g.s.heafy.pos = p.pos; assert.equal(g.objectiveDone(0, 'compagno'), true);
  p.hand = ['snack']; assert.equal(g.objectiveDone(0, 'tasche'), false);
  p.hand = ['snack', 'snack']; assert.equal(g.objectiveDone(0, 'tasche'), true); assert.equal(g.objectiveDone(0, 'coppia'), true);
  p.hand = ['snack', 'giochino']; assert.equal(g.objectiveDone(0, 'coppia'), false); assert.equal(g.objectiveDone(0, 'set:snack+giochino'), true); assert.equal(g.objectiveDone(0, 'set:giochino+cuscino'), false);
  assert.equal(g.objectiveDone(0, 'risparmiatore'), true); p.j2 = 1; assert.equal(g.objectiveDone(0, 'risparmiatore'), false);
});

test('sera: l\'ordine si decide a inizio sera e resta uguale per i 5 turni; obiettivo "Primo di sera"', () => {
  const g = new FF.Game({ seed: 'sera', log: true });
  const a = [FF.AI.create('easy', 1), FF.AI.create('easy', 2)];
  const firsts = {};
  FF.drive(g, g.run(), (game, d) => { if (d.type === 'flow') firsts[game.s.turn] = game.s.first; return a[d.player].decide(game, d); });
  for (let t2 = 12; t2 <= 15; t2++) assert.equal(firsts[t2], firsts[11]);
  assert.equal(g.s.eveningFirst, firsts[11]);
  assert.equal(g.objectiveDone(firsts[11], 'primoSera'), true);
  assert.equal(g.objectiveDone(1 - firsts[11], 'primoSera'), false);
});

test('valori degli obiettivi dopo la taratura', () => {
  const pts = (id) => FF.OBJECTIVES[id].pts;
  assert.equal(pts('risparmiatore'), 4); assert.equal(pts('angolo:cucina'), 3); assert.equal(pts('compagno'), 3);
  assert.equal(pts('coppia'), 2); assert.equal(pts('tasche'), 1); assert.equal(pts('primoSera'), 2);
  assert.equal(FF.DEFAULT_RULES.lastTurnFirstBonus, undefined);
});

test('regolamento (docs/REGOLAMENTO.md): punti degli obiettivi coerenti con il codice, rulebook.js aggiornato', () => {
  const fs = require('fs'), path = require('path');
  const md = fs.readFileSync(path.join(__dirname, '..', 'docs', 'REGOLAMENTO.md'), 'utf8');
  const gen = fs.readFileSync(path.join(__dirname, '..', 'js', 'rulebook.js'), 'utf8');
  assert.ok(gen.includes(JSON.stringify(md)), 'js/rulebook.js non aggiornato: lancia node tools/build-rules.js');
  const row = (name) => md.split('\n').find((l) => l.startsWith('|') && l.includes(name));
  const check = (name, pts) => { const r = row(name); assert.ok(r, name + ' manca nel regolamento'); assert.ok(r.trimEnd().endsWith('**+' + pts + '**|') || r.includes('**+' + pts + '**'), `${name}: nel regolamento i punti non sono +${pts}`); };
  check('Il tuo angolo', FF.OBJECTIVES['angolo:cucina'].pts); check('Compagno di cuscino', FF.OBJECTIVES.compagno.pts);
  check('Tasche piene', FF.OBJECTIVES.tasche.pts); check('| **Coppia**', FF.OBJECTIVES.coppia.pts);
  check('Risparmiatore', FF.OBJECTIVES.risparmiatore.pts); check('Primo di sera', FF.OBJECTIVES.primoSera.pts);
  for (const o of Object.values(FF.OBJECTIVES).filter((x) => x.kind === 'set')) check(`Il set: ${FF.RES[o.a].n} + ${FF.RES[o.b].n}`, o.pts);
  FF.ROOMS.forEach((r) => assert.ok(md.includes(r.name + ' →') || md.includes(r.name + ' /') || md.includes(r.name), r.name));
});

test('kit stampabile: conteggi, formato e niente undefined/NaN', () => {
  const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
  const root = path.join(__dirname, '..');
  execFileSync('node', [path.join(root, 'tools', 'build-print.js'), '--no-pdf']);
  const rd = (f) => fs.readFileSync(path.join(root, 'stampa', f), 'utf8');
  const fr = rd('carte-fronte-retro.html'), so = rd('carte-solo-fronti.html');
  assert.equal((fr.match(/class="sheet"/g) || []).length, 12);
  assert.equal((so.match(/class="sheet"/g) || []).length, 6);
  assert.equal((so.match(/class="c"/g) || []).length, 54);
  assert.ok(fr.includes('width: 63.5mm') && fr.includes('height: 88.9mm'));
  ['carte-fronte-retro.html', 'carte-solo-fronti.html', 'tabellone-e-plance.html', 'foglio-punti.html'].forEach((f) => {
    const h = rd(f); assert.ok(!h.includes('NaN') && !h.includes('undefined'), f);
  });
  const n = (re) => (so.match(re) || []).length;
  assert.equal(n(/class="cd room"/g), FF.ROOMS.length);
  assert.equal(n(/class="cd flow"/g), 20);
  assert.equal(n(/class="cd mood"/g), 3);   // 3 carte di riepilogo mood
  assert.equal(n(/class="cd obj o[ab]"/g), Object.keys(FF.OBJECTIVES).length);
  assert.equal(n(/class="cd refc"/g), 3);
});
