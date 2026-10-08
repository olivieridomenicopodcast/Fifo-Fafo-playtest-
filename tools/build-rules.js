#!/usr/bin/env node
/* Genera js/rulebook.js dal regolamento docs/REGOLAMENTO.md (fonte unica, mostrata anche nell'app).
   Uso: node tools/build-rules.js   (da rilanciare dopo ogni modifica al regolamento) */
'use strict';
const fs = require('fs'), path = require('path');
const md = fs.readFileSync(path.join(__dirname, '..', 'docs', 'REGOLAMENTO.md'), 'utf8');
fs.writeFileSync(path.join(__dirname, '..', 'js', 'rulebook.js'),
  '/* GENERATO da tools/build-rules.js a partire da docs/REGOLAMENTO.md: non modificare a mano */\n(function (root) { (root.FF = root.FF || {}).RULEBOOK_MD = ' + JSON.stringify(md) + '; })(typeof window !== \'undefined\' ? window : globalThis);\n');
console.log('js/rulebook.js aggiornato (' + md.length + ' caratteri)');
