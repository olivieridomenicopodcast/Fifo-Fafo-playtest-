/* FIFO FAFO — intelligenza artificiale.
   Tre livelli:
   - easy   : flow quasi casuali, errori frequenti
   - medium : sceglie il flow migliore simulando il proprio turno sul motore (un po' di rumore)
   - hard   : come medium + modella l'avversario e guarda il turno dopo (posizionamento, mood futuri)
   Tutte le simulazioni usano `game.clone()`: il motore stesso è il modello in avanti. */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const { CARDS, MOODS } = FF;
  const AI = (FF.AI = {});
  const DEFAULTS = { opp: 'search', rngFix: true, j2w: 2.0 };
  let CUR = DEFAULTS; // parametri dell'AI che sta decidendo in questo momento (decide() è sincrono)

  // ───────────────────────── valutazione ─────────────────────────
  const W = [1, 0.75, 0.5, 0.35];

  // Quanto vale tenere in mano la risorsa r, guardando i mood che arriveranno
  function resValue(game, r) {
    let best = 0;
    for (let k = 1; k <= 4; k++) {
      const m = game.wheelMood(k);
      let v;
      if (m.id === 'bisognoso') v = r === 'paletta' ? 3 : 0;
      else if (m.demand === r) v = 2;
      else if (m.demand === 'any') v = 2;
      else if (m.demand) v = 1;
      else v = game.rules.noDemandGive;
      best = Math.max(best, W[k - 1] * v);
    }
    return best;
  }
  function handValue(game, hand) {
    const vs = hand.map((r) => resValue(game, r)).sort((a, b) => b - a);
    return 0.6 * vs.reduce((a, b) => a + b, 0);
  }
  AI.resValue = resValue;

  function evalState(game, pid) {
    const s = game.s, opp = 1 - pid;
    const left = Math.max(0, game.rules.turns - s.turn) / game.rules.turns;
    return (game.score(pid) - game.score(opp)) - (s.players[pid].waste - s.players[opp].waste)
      + handValue(game, s.players[pid].hand) - 0.4 * handValue(game, s.players[opp].hand)
      + CUR.j2w * left * (s.players[pid].j2 - s.players[opp].j2);
  }

  // ───────────────────────── policy "greedy" ─────────────────────────
  function leastValuable(game, hand) {
    let best = null, bv = Infinity;
    for (const r of hand) { const v = resValue(game, r); if (v < bv) { bv = v; best = r; } }
    return best;
  }

  AI.greedy = function (game, d) {
    const s = game.s;
    switch (d.type) {
      case 'give': {
        const hand = d.hand;
        if (!hand.length) return [];
        if (d.special === 'arrabbiatissimo') {
          if (hand.length < 2) return [];
          const a = hand.slice().sort((x, y) => resValue(game, x) - resValue(game, y));
          return a.slice(0, 2);
        }
        if (d.mood === 'bisognoso') return hand.includes('paletta') ? ['paletta'] : [];
        if (s.irreqDone) return [];
        const m = MOODS[d.mood];
        if (m.demand && m.demand !== 'any' && hand.includes(m.demand)) return [m.demand];
        return [leastValuable(game, hand)];
      }
      case 'abandon': return leastValuable(game, d.hand);
      case 'b1': {
        const sorted = d.options.slice().sort((a, b) => resValue(game, b) - resValue(game, a));
        if (d.near) return resValue(game, sorted[0]) >= 1.7 ? sorted[0] : null;
        return sorted[0];
      }
      case 'j2step': return greedyJ2(game, d);
      case 'flow': return ['A1', 'B2', 'C2', 'J1'];
    }
    return null;
  };

  function greedyJ2(game, d) {
    const s = game.s, p = s.players[d.player], h = s.heafy;
    const done = { k: 'done' };
    const wantC = d.rest.includes('C1') && !p.interacted;
    const wantB = d.rest.includes('B1');
    const moves = d.options.filter((o) => o.k === 'move');
    if (!d.done.move && wantC && p.pos !== h.pos) {
      const m = moves.find((o) => FF.mod(p.pos + o.dir * o.steps) === h.pos);
      if (m && (p.hand.length || s.special)) return m;
    }
    const col = d.options.filter((o) => o.k === 'collect').sort((a, b) => resValue(game, b.res) - resValue(game, a.res))[0];
    if (col && resValue(game, col.res) >= 0.4) return col;
    if (!d.done.move && wantB && !s.res[p.pos].length) {
      // vai nella stanza vicina con più risorse (non quella di Heafy)
      let best = null, bv = 0;
      for (const o of moves) {
        const pos = FF.mod(p.pos + o.dir * o.steps);
        if (pos === h.pos) continue;
        const v = s.res[pos].reduce((a, r) => Math.max(a, resValue(game, r)), 0);
        if (v > bv) { bv = v; best = o; }
      }
      if (best && bv >= 0.5) return best;
    }
    return d.canFinish ? done : d.options[0];
  }

  // ───────────────────────── simulazione di un turno ─────────────────────────
  function noop(c) { return c === 'B2' || c === 'C2' || c === 'J1'; }

  // Gioca (in un clone) il turno con i flow dati e ritorna la valutazione per `pid`.
  function simulate(game, pid, flows, look, rs) {
    const g = game.clone();
    if (rs != null) g.s.rng = rs; // numeri casuali "finti": l'AI non deve conoscere i dadi futuri veri
    g.s.phase = 'resolve';
    for (const q of [g.s.first, 1 - g.s.first]) {
      if (flows[q]) FF.drive(g, g.resolveFlow(q, flows[q]), AI.greedy);
    }
    FF.drive(g, g.endTurn(), AI.greedy);
    if (look && g.s.turn < g.rules.turns) {
      g.s.turn++;
      g.s.players.forEach((p) => { p.interacted = false; });
      g.s.irreqDone = false;
      FF.drive(g, g.heafyPhase(), AI.greedy);
    }
    return evalState(g, pid);
  }

  function candidateFlows(game, pid) {
    const p = game.s.players[pid];
    const As = ['A1', 'A2', 'A3', 'A4'], Bs = ['B1', 'B2'], Cs = ['C1', 'C2'];
    const Js = p.j2 > 0 ? ['J1', 'J2'] : ['J1'];
    const seen = new Set(), out = [];
    const perms = [];
    (function permute(a, k) {
      if (k === a.length) { perms.push(a.slice()); return; }
      for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; permute(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; }
    })([0, 1, 2, 3], 0);
    for (const A of As) for (const B of Bs) for (const C of Cs) for (const J of Js) {
      const cards = [A, B, C, J];
      for (const pm of perms) {
        const f = pm.map((i) => cards[i]);
        const key = f.map((c) => (noop(c) ? '_' : c)).join('');
        if (seen.has(key)) continue;
        seen.add(key); out.push(f);
      }
    }
    return out;
  }

  // Flow "plausibili" dell'avversario (uno per ogni carta A) — modello euristico
  function opponentFlows(game, opp) {
    const s = game.s, p = s.players[opp], h = s.heafy, out = [];
    for (const A of ['A1', 'A2', 'A3', 'A4']) {
      const c = CARDS[A];
      const pos = FF.mod(p.pos + c.dir * c.steps);
      const hasRes = s.res[pos].length > 0 && p.hand.length < game.rules.handLimit;
      const B = hasRes && pos !== h.pos ? 'B1' : 'B2';
      const C = pos === h.pos && (p.hand.length || s.special) ? 'C1' : 'C2';
      const J = 'J1';
      out.push(C === 'C1' ? [A, B, J, C] : [A, B, C, J]);
    }
    return out;
  }

  // Modello "razionale" dell'avversario: i suoi 3 flow migliori (cerca come farebbe l'AI media, Jolly compreso)
  function opponentSearch(game, opp, rs) {
    const scored = candidateFlows(game, opp).map((f) => {
      const flows = [null, null]; flows[opp] = f;
      return { f, v: simulate(game, opp, flows, true, rs) };
    }).sort((a, b) => b.v - a.v);
    return scored.slice(0, 3).map((x) => x.f);
  }

  // ───────────────────────── ricerca del piano J2 (hard) ─────────────────────────
  function bestJ2Plan(game, d, rng) {
    const pid = d.player;
    const flows = game.s.lastFlows; // a questo punto i flow sono stati rivelati
    const opp = 1 - pid;
    let bestScore = -Infinity, bestSeq = [];
    function finish(g, seq) {
      const g2 = g.clone();
      // resto del mio flow, poi (se tocca a loro dopo di me) il flow rivelato dell'avversario
      FF.drive(g2, g2.resolveFlow(pid, d.rest), AI.greedy);
      if (g2.s.first === pid && flows) FF.drive(g2, g2.resolveFlow(opp, flows[opp]), AI.greedy);
      FF.drive(g2, g2.endTurn(), AI.greedy);
      if (g2.s.turn < g2.rules.turns) {
        g2.s.turn++; g2.s.players.forEach((p) => { p.interacted = false; }); g2.s.irreqDone = false;
        FF.drive(g2, g2.heafyPhase(), AI.greedy);
      }
      const v = evalState(g2, pid) - 0.06 * seq.length + rng() * 0.001; // a parità, meno azioni (niente "prendi e deposita Heafy" a vuoto)
      if (v > bestScore) { bestScore = v; bestSeq = seq; }
    }
    (function dfs(g, done, last, seq, depth) {
      const { options, canFinish } = g.j2Options(pid, done, last === 'pickup');
      if (canFinish) finish(g, seq);
      if (depth >= 4) return;
      for (const a of options) {
        const g2 = g.clone();
        g2.j2Apply(pid, a);
        dfs(g2, { ...done, [a.k]: true }, a.k, seq.concat([a]), depth + 1);
      }
    })(game.clone(), { move: false, collect: false, pickup: false, deposit: false }, null, [], 0);
    return bestSeq;
  }

  // ───────────────────────── fabbrica ─────────────────────────
  AI.create = function (level, seed, opts) {
    const P = Object.assign({}, DEFAULTS, opts || {});
    const rng = FF.makeRng(seed == null ? Date.now() : seed);
    let plan = null;

    function chooseFlow(game, d) {
      const pid = d.player, p = game.s.players[pid];
      const cands = candidateFlows(game, pid);
      if (level === 'easy') {
        const A = ['A1', 'A2', 'A3', 'A4'][Math.floor(rng() * 4)];
        const B = rng() < 0.5 ? 'B1' : 'B2', C = rng() < 0.5 ? 'C1' : 'C2';
        const J = p.j2 > 0 && rng() < 0.2 ? 'J2' : 'J1';
        const f = [A, B, C, J];
        for (let i = 3; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [f[i], f[j]] = [f[j], f[i]]; }
        return f;
      }
      const hard = level === 'hard';
      const rs = P.rngFix ? Math.floor(rng() * 2147483647) : null;
      const rs2 = P.rngFix ? Math.floor(rng() * 2147483647) : null;
      const scored = cands.map((f) => {
        const flows = [null, null]; flows[pid] = f;
        let v = simulate(game, pid, flows, hard, rs);
        if (!hard) v += (rng() - 0.5) * 1.6;
        return { f, v };
      }).sort((a, b) => b.v - a.v);
      if (!hard) return scored[0].f;
      // hard: rifinisce i migliori contro i flow plausibili dell'avversario
      const oppFlows = P.opp === 'search' ? opponentSearch(game, 1 - pid, rs) : opponentFlows(game, 1 - pid);
      let best = null, bv = -Infinity;
      for (const { f } of scored.slice(0, 14)) {
        let tot = 0, cnt = 0;
        for (const of of oppFlows) for (const r of (P.rngFix ? [rs, rs2] : [null])) {
          const flows = [null, null]; flows[pid] = f; flows[1 - pid] = of;
          tot += simulate(game, pid, flows, true, r); cnt++;
        }
        tot = tot / cnt + rng() * 0.02;
        if (tot > bv) { bv = tot; best = f; }
      }
      return best;
    }

    return {
      level,
      decide(game, d) {
        CUR = P;
        switch (d.type) {
          case 'flow': plan = null; return chooseFlow(game, d);
          case 'j2step':
            if (level === 'easy') return d.canFinish && rng() < 0.5 ? { k: 'done' } : d.options[Math.floor(rng() * d.options.length)];
            if (level === 'hard') {
              if (!plan) plan = bestJ2Plan(game, d, rng);
              const a = plan.shift();
              if (!a) return { k: 'done' };
              return a;
            }
            return AI.greedy(game, d);
          case 'give':
            if (level === 'easy' && rng() < 0.3) return d.hand.length && rng() < 0.6 ? [d.hand[Math.floor(rng() * d.hand.length)]] : [];
            return AI.greedy(game, d);
          case 'b1':
            if (level === 'easy') return rng() < 0.8 ? d.options[Math.floor(rng() * d.options.length)] : null;
            return AI.greedy(game, d);
          default: return AI.greedy(game, d);
        }
      },
    };
  };

  AI.simulate = simulate; AI.evalState = evalState; AI.candidateFlows = candidateFlows;
})(typeof window !== 'undefined' ? window : globalThis);
