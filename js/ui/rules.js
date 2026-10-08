/* FIFO FAFO — pagina "Regole": mostra il regolamento completo (docs/REGOLAMENTO.md, incorporato in js/rulebook.js) */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const UI = FF.UI;
  const { esc } = UI;

  // mini renderer markdown: titoli, liste, tabelle, **grassetto**, *corsivo*, `codice`
  function inline(t) {
    return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>');
  }
  UI.mdToHtml = function (md) {
    const lines = md.split('\n'); const out = []; let i = 0;
    const isTable = (l) => /^\s*\|.*\|\s*$/.test(l);
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      let m;
      if ((m = /^(#{1,3}) (.*)$/.exec(l))) { const n = m[1].length; out.push(n === 1 ? `<h2>${inline(m[2])}</h2>` : n === 2 ? `<h3 class="rh">${inline(m[2])}</h3>` : `<h4>${inline(m[2])}</h4>`); i++; continue; }
      if (isTable(l)) {
        const rows = []; while (i < lines.length && isTable(lines[i])) { rows.push(lines[i]); i++; }
        const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const head = cells(rows[0]), body = rows.slice(2).map(cells);
        out.push(`<div class="tscroll"><table class="t rt"><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table></div>`);
        continue;
      }
      if (/^\s*(-|\d+\.) /.test(l)) {
        const ordered = /^\s*\d+\./.test(l); const items = [];
        while (i < lines.length && /^\s*(-|\d+\.) /.test(lines[i])) {
          const indent = /^(\s*)/.exec(lines[i])[1].length;
          items.push({ indent, text: lines[i].replace(/^\s*(-|\d+\.) /, '') }); i++;
        }
        let html = '', depth = 0;
        const tag = (o) => (o ? 'ol' : 'ul');
        items.forEach((it, k) => {
          const d = it.indent >= 2 ? 1 : 0;
          while (depth < d) { html += `<${tag(true)}>`; depth++; }
          while (depth > d) { html += `</${tag(true)}>`; depth--; }
          html += `<li>${inline(it.text)}</li>`;
        });
        while (depth > 0) { html += '</ol>'; depth--; }
        out.push(`<${tag(ordered)}>${html}</${tag(ordered)}>`); continue;
      }
      const para = []; while (i < lines.length && lines[i].trim() && !/^(#|\s*\||\s*(-|\d+\.) )/.test(lines[i])) { para.push(lines[i]); i++; }
      out.push(`<p>${inline(para.join(' '))}</p>`);
    }
    return out.join('\n');
  };

  UI.openRules = function () {
    UI.screen('rules');
    document.getElementById('s-rules').innerHTML = `<div class="wrap rules"><div class="card rulebook">${UI.mdToHtml(FF.RULEBOOK_MD || '# Regolamento non disponibile')}</div>
      <div class="btn-row"><button class="btn" id="ru-copy">📋 Copia il regolamento (Markdown)</button><button class="btn" id="ru-dl">⬇ Scarica .md</button><button class="btn" id="ru-back">← Indietro</button></div></div>`;
    document.getElementById('ru-back').onclick = () => UI.go('home');
    document.getElementById('ru-copy').onclick = () => UI.copy(FF.RULEBOOK_MD);
    document.getElementById('ru-dl').onclick = () => UI.download('FIFO-FAFO-regolamento.md', FF.RULEBOOK_MD);
  };
})(typeof window !== 'undefined' ? window : globalThis);
