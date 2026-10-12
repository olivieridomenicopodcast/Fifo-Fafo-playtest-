#!/usr/bin/env node
/* Prova in browser della partita in rete: due contesti Chromium separati (host e ospite) giocano una partita intera con un server PeerJS locale.
   Uso: NODE_PATH=<cartella con peer>/node_modules node tools/e2e-net.js [--drop]
   Servono: playwright (Chromium preinstallato) e il pacchetto npm "peer". --drop prova anche caduta e rientro dell'ospite. */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const root = path.join(__dirname, '..');
const DROP = process.argv.includes('--drop');
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8137, PPORT = 9137;
const url = (q) => `http://localhost:${PORT}/index.html?peerhost=localhost&peerport=${PPORT}${q || ''}`;

// un "giocatore" automatico che clicca la propria interfaccia
async function botStep(p) {
  const has = (sel) => p.$(sel);
  if (await has('.scoreline')) return 'end';
  if (await has('#a-next')) { await p.click('#a-next', { timeout: 500 }).catch(() => {}); return 'next'; }
  if (await has('#o-ok')) {
    const pick = p.locator('#g-action .opick'); await pick.nth(0).click({ timeout: 500 }).catch(() => {}); await pick.nth(2).click({ timeout: 500 }).catch(() => {});
    await p.click('#o-ok', { timeout: 500 }).catch(() => {}); return 'obj';
  }
  if (await has('#f-ok')) {
    for (const t of ['A', 'B', 'C', 'J']) { const b = p.locator(`#g-action .cgroup.${t} [data-c]:not([disabled])`).first(); await b.click({ timeout: 500 }).catch(() => {}); }
    await p.click('#f-ok', { timeout: 500 }).catch(() => {});
    if (await has('[data-yes]')) await p.click('[data-yes]', { timeout: 500 }).catch(() => {});
    return 'flow';
  }
  if (await has('#g-give')) {
    const o = p.locator('#g-action [data-i]').first();
    if (await o.count()) { await o.click({ timeout: 500 }).catch(() => {}); await p.click('#g-give', { timeout: 500 }).catch(() => {}); } else await p.click('#g-none', { timeout: 500 }).catch(() => {});
    return 'give';
  }
  if (await has('#g-none')) { await p.click('#g-none', { timeout: 500 }).catch(() => {}); return 'give'; }
  if (await has('#g-action [data-r]')) { await p.locator('#g-action [data-r]').first().click({ timeout: 500 }).catch(() => {}); if (await has('#b-skip')) {} return 'pick'; }
  if (await has('#j-done:not([disabled])')) { await p.click('#j-done', { timeout: 500 }).catch(() => {}); return 'j2'; }
  return null;
}

(async () => {
  const procs = [];
  const run = (cmd, args, env) => { const c = spawn(cmd, args, { cwd: root, env: Object.assign({}, process.env, env || {}), stdio: 'ignore' }); procs.push(c); return c; };
  run('node', ['tools/serve.js', String(PORT)]);
  run('node', ['tools/peer-server.js', String(PPORT)]);
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const errs = [], fails = [];
  const check = (ok, msg) => { console.log((ok ? '  ✔ ' : '  ✘ ') + msg); if (!ok) fails.push(msg); };
  try {
    const ctxH = await browser.newContext({ viewport: { width: 1400, height: 1000 } }), ctxG = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    const host = await ctxH.newPage(), guest = await ctxG.newPage();
    for (const [n, p] of [['host', host], ['ospite', guest]]) { p.on('pageerror', (e) => errs.push(n + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|WebSocket|favicon/.test(m.text())) errs.push(n + ' console: ' + m.text()); }); }
    await host.goto(url()); await host.click('.mode[data-mode=net-host]');
    await host.fill('#nl-name', 'Ada'); await host.click('#nl-seat button[data-v="0"]'); await host.click('#nl-speed button[data-v="fast"]');
    await host.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.querySelector('#nl-code').textContent.trim()), null, { timeout: 15000 });
    const code = (await host.textContent('#nl-code')).trim();
    check(true, 'stanza creata, codice ' + code);
    await guest.goto(url()); await guest.click('.mode[data-mode=net-join]');
    await guest.fill('#nj-code', code); await guest.fill('#nj-name', 'Bea'); await guest.click('#nl-speed button[data-v="fast"]'); await guest.click('#nj-go');
    await host.waitForFunction(() => !document.querySelector('#nl-go').disabled, null, { timeout: 20000 });
    check(true, 'l\'ospite è collegato al tavolo');
    await host.click('#nl-go');
    await guest.waitForSelector('#g-board', { timeout: 15000 }); await host.waitForSelector('#g-board', { timeout: 15000 });
    check(true, 'la partita è iniziata su entrambi gli schermi');

    let drops = 0, steps = 0, endH = false, endG = false, leakChecked = false;
    const t0 = Date.now();
    let guestPage = guest;
    while (Date.now() - t0 < 420000 && !(endH && endG)) {
      const a = await botStep(host).catch(() => null);
      const b = await botStep(guestPage).catch(() => null);
      if (a === 'end') endH = true; if (b === 'end') endG = true;
      if (a || b) steps++;
      if (!leakChecked && steps > 10) {
        // l'ospite non deve poter leggere gli obiettivi dell'host dal proprio stato
        const leak = await guestPage.evaluate(() => { const s = FF.UI.session.game.s; return s.objectives.map((l, i) => (i === FF.UI.session.mySeat ? 'mine' : l.join(','))); });
        check(leak.filter((x) => x !== 'mine').every((x) => x.split(',').every((y) => y === '?')), 'l\'ospite non vede gli obiettivi dell\'avversario (' + leak.join(' | ') + ')');
        const seedLeak = await guestPage.evaluate(() => JSON.stringify(FF.UI.session.game.events).includes('seed ') && /seed (?!\(in rete\))\S+\./.test(JSON.stringify(FF.UI.session.game.events)));
        check(!seedLeak, 'il seed non compare nel log dell\'ospite');
        leakChecked = true;
      }
      if (DROP && drops < 2 && steps > 20 + drops * 14) {
        drops++;
        console.log('  … simulo la caduta dell\'ospite (' + drops + ')');
        const oldCtx = guestPage.context();
        await guestPage.close(); await oldCtx.close();
        await host.waitForSelector('.overlay [data-w]', { timeout: 20000 });
        check(true, 'il tavolo mostra l\'avviso di disconnessione (caduta ' + drops + ')');
        await host.click('.overlay [data-w]');
        const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
        guestPage = await ctx2.newPage(); guestPage.on('pageerror', (e) => errs.push('ospite' + (drops + 1) + ': ' + e.message));
        await guestPage.goto(url(`&join=${code}`)); await guestPage.fill('#nj-name', 'Bea'); await guestPage.click('#nl-speed button[data-v="fast"]'); await guestPage.click('#nj-go');
        await guestPage.waitForSelector('#g-board', { timeout: 20000 });
        check(true, 'l\'ospite è rientrato con lo stesso nome e ha ritrovato la partita (rientro ' + drops + ')');
      }
      await host.waitForTimeout(60);
    }
    check(endH && endG, 'la partita finisce su entrambi gli schermi (' + steps + ' azioni)');
    const sh = await host.textContent('.scoreline'), sg = await guestPage.textContent('.scoreline');
    check(sh === sg && sh.length > 0, 'stesso punteggio finale su entrambi: ' + sh.replace(/\s+/g, ' ').trim());
    if (DROP) check(drops === 2, 'due cadute e due rientri provati');
    check(errs.length === 0, 'nessun errore nel browser' + (errs.length ? ': ' + errs.slice(0, 3).join(' / ') : ''));
  } catch (e) { fails.push('eccezione: ' + e.message); console.log('  ✘ ' + e.stack); }
  await browser.close(); procs.forEach((c) => c.kill());
  console.log(fails.length ? `FALLITO (${fails.length})` : 'OK');
  process.exit(fails.length ? 1 : 0);
})();
