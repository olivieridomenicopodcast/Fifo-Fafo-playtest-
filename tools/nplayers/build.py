# Genera copie SPERIMENTALI (a N giocatori 2-4, con varianti di regole) di data/engine/ai in tools/nplayers/.gen.
# I file del gioco in js/ NON vengono modificati: si leggono e si ricopiano con le modifiche. Va rilanciato se cambia js/engine.js o js/ai.js
# (le sostituzioni sono testuali: se non trovano più il testo da sostituire, si ferma con 'non trovato').
import re, sys
import os
HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(HERE, '..', '..', 'js') + os.sep
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '.gen')
os.makedirs(out, exist_ok=True)
def rd(f): return open(R + f).read()
def sub(t, old, new, count=1):
    assert old in t, 'non trovato: ' + old[:70]
    return t.replace(old, new, count)

# ---------- data ----------
d = rd('data.js')
d = sub(d, "FF.PLAYER_ICONS = ['🟠', '🔵'];", "FF.PLAYER_ICONS = ['🟠', '🔵', '🟢', '🟣'];")
open(out + '/data.js', 'w').write(d)

# ---------- engine ----------
e = rd('engine.js')
e = sub(e, "function newStats() { return { p: [{}, {}], g: {}, moodPF: {} }; }", "function newStats() { return { p: [{}, {}, {}, {}], g: {}, moodPF: {} }; }")
e = sub(e, "this.stats.moodPF[m] || [0, 0]", "this.stats.moodPF[m] || [0, 0, 0, 0]")
e = sub(e, "s.res = idx.map((ri) => [ROOMS[ri].res]);", "s.res = idx.map((ri) => Array(this.rules.resPerRoom || 1).fill(ROOMS[ri].res));")
e = sub(e, "s.players = [0, 1].map((i) => ({", "const nP = this.rules.nPlayers || 2;\n      s.players = Array.from({ length: nP }, (_, i) => i).map((i) => ({")
e = sub(e, "pos: this.posOf(i === 0 ? 'cucina' : 'mansarda'),", "pos: this.posOf(['cucina', 'mansarda', 'scale', 'ingresso'][i]), noCarry: 0,")
e = sub(e, "const pl = cfg.players || [{ name: 'G1', kind: 'ai' }, { name: 'G2', kind: 'ai' }];", "const pl = cfg.players || Array.from({ length: this.rules.nPlayers || 2 }, (_, i) => ({ name: 'G' + (i + 1), kind: 'ai' }));")
e = sub(e, "s.objectives = [[], []];", "s.objectives = Array.from({ length: nP }, () => []);")
e = sub(e, "s.eveningFirst = null; ", "s.eveningFirst = null; s.eveningOrder = null; s.order = [0, 1]; s.rightCount = 0; ")
# fine partita
e = sub(e, "const objs = [[], []], objPts = [0, 0];\n      for (let pid = 0; pid < 2; pid++) {", "const nP = s.players.length;\n      const objs = Array.from({ length: nP }, () => []), objPts = Array(nP).fill(0);\n      for (let pid = 0; pid < nP; pid++) {")
a = e.index("const sc = [0, 1].map"); b = e.index("\n", e.index("this.result = {", a))
e = e[:a] + """const sc = s.players.map((p, i) => this.score(i) + objPts[i]);
      const top = Math.max(...sc), winners = sc.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0);
      this.result = { scores: sc, pf: s.players.map((p) => p.pf), rancor: s.players.map((p) => p.rancor), objPts, objs, winner: winners.length === 1 ? winners[0] : null, winners };""" + e[b:]
e = sub(e, "this.say('end', `🏁 Fine partita! ${this.pn(0)} ${sc[0]} — ${this.pn(1)} ${sc[1]} → ` + (this.result.winner == null ? 'PAREGGIO' : `vince ${this.pn(this.result.winner)}`));", "this.say('end', 'fine');")
# turnGen: primo e ordine
a = e.index("      // primo giocatore\n"); b = e.index("      let b;\n      const tp = this.rules.turns / 3;")
e = e[:a] + """      // primo giocatore e ordine di risoluzione (N giocatori)
      const per = this.period(s.turn), nP = s.players.length;
      s.rightCount = 0;
      s.players.forEach((p) => { p.noCarry = Math.max(0, (p.noCarry || 0) - 1); });
      const cyc = (f) => Array.from({ length: nP }, (_, k) => (f + k) % nP);
      if (per < 2) {
        const f = this.rules.rotate ? (s.turn - 1) % nP : per;
        s.order = cyc(f % nP);
      } else {
        // Sera: l'ordine si decide una volta, a inizio sera: dal punteggio netto più basso al più alto (a parità, a sorte)
        if (s.eveningOrder == null) {
          const ids = s.players.map((p) => p.id);
          this._shuffle(ids);
          ids.sort((x, y) => this.score(x) - this.score(y));
          s.eveningOrder = ids; s.eveningFirst = ids[0];
        }
        s.order = s.eveningOrder.slice();
      }
      s.first = s.order[0];
""" + e[b:]
e = sub(e, "const flows = [null, null];\n      for (let pid = 0; pid < 2; pid++) {", "const flows = Array(nP).fill(null);\n      for (let pid = 0; pid < nP; pid++) {")
e = sub(e, "s.lastFlows = flows;\n      for (let pid = 0; pid < 2; pid++) {", "s.lastFlows = flows;\n      for (let pid = 0; pid < nP; pid++) {")
e = sub(e, "const order = [s.first, 1 - s.first];\n      for (const pid of order)", "for (const pid of s.order)")
e = sub(e, "for (let pid = 0; pid < 2; pid++) {\n        const offer", "for (let pid = 0; pid < s.players.length; pid++) {\n        const offer")
# interazioni passive
a = e.index("        let order = here;"); b = e.index("        for (const pid of order) {\n          if (s.special === 'offesissimo') break;")
e = e[:a] + """        let order = here.slice();
        if (here.length >= 2) {
          if (this.rules.passiveByOrder) order.sort((x, y) => s.order.indexOf(x) - s.order.indexOf(y));
          else this._shuffle(order);   // a sorte (dado)
        }
""" + e[b:]
# bisognoso
a = e.index("        const d0 = dist(s.players[0].pos, h.pos)"); b = e.index("        if (pulled != null && s.players[pulled].pos !== h.pos) {")
e = e[:a] + """        const ds = s.players.map((p) => dist(p.pos, h.pos)), dm = Math.min(...ds);
        const tied = s.players.filter((p, i) => ds[i] === dm).map((p) => p.id);
        if (dm > 0) pulled = tied.length === 1 ? tied[0] : tied[this.randInt(tied.length)];
""" + e[b:]
# interazione: primo bonus, soglia arrabbiatissimo
e = sub(e, "take(picks); this.addPF(pid, 2, 'giusta');", "take(picks); const bonus = (this.rules.firstBonus && s.rightCount >= 1) ? 1 : 2; s.rightCount++; this.addPF(pid, bonus, 'giusta');")
e = sub(e, "if (s.arrab >= 3) {", "if (s.arrab >= (this.rules.arrabThreshold || 3)) {")
# ricarica
e = sub(e, "if (nextT <= this.rules.turns && this.period(nextT) !== this.period(s.turn)) {\n        for (let pos = 0; pos < N; pos++) s.res[pos].push(s.base[pos]);",
        "const rk = this.rules.rechargeEvery;\n      if (nextT <= this.rules.turns && (rk ? (nextT - 1) % rk === 0 : this.period(nextT) !== this.period(s.turn))) {\n        for (let pos = 0; pos < N; pos++) for (let k = 0; k < (this.rules.resPerRoom || 1); k++) s.res[pos].push(s.base[pos]);")
# Jolly: pausa dopo il trasporto
e = sub(e, "h.carriedBy = null;\n        this.dropCarry();\n      }\n      let skipInteract", "if (this.rules.carryCooldown) s.players[h.carriedBy].noCarry = 2;\n        h.carriedBy = null;\n        this.dropCarry();\n      }\n      let skipInteract")
e = sub(e, "if (!done.pickup && h.pos === p.pos && h.carriedBy == null) {", "if (!done.pickup && h.pos === p.pos && h.carriedBy == null && !(this.rules.carryCooldown && p.noCarry > 0)) {")
open(out + '/engine.js', 'w').write(e)

# ---------- ai ----------
a = rd('ai.js')
a = sub(a, "const s = game.s, opp = 1 - pid;\n    const left", "const s = game.s;\n    const others = s.players.filter((p) => p.id !== pid), avg = (f) => others.reduce((t, p) => t + f(p), 0) / others.length;\n    const left")
a = sub(a, "return (game.score(pid) - game.score(opp)) - (s.players[pid].waste - s.players[opp].waste)\n      + handValue(game, s.players[pid].hand) - 0.4 * handValue(game, s.players[opp].hand)\n      + CUR.j2w * left * (s.players[pid].j2 - s.players[opp].j2)",
        "return (game.score(pid) - avg((p) => game.score(p.id))) - (s.players[pid].waste - avg((p) => p.waste))\n      + handValue(game, s.players[pid].hand) - 0.4 * avg((p) => handValue(game, p.hand))\n      + CUR.j2w * left * (s.players[pid].j2 - avg((p) => p.j2))")
a = sub(a, "for (const q of [g.s.first, 1 - g.s.first]) {", "for (const q of g.s.order) {")
a = sub(a, "const flows = [null, null]; flows[pid] = f;\n        let v = simulate", "const flows = Array(game.s.players.length).fill(null); flows[pid] = f;\n        let v = simulate")
open(out + '/ai.js', 'w').write(a)
print('ok')
