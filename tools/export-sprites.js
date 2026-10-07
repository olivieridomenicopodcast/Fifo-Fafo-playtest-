#!/usr/bin/env node
/* Esporta tutti gli sprite come file .svg in assets/sprites/ e crea una galleria sprites.html */
'use strict';
const fs = require('fs'), path = require('path');
require('../js/data.js'); require('../js/ui/sprites.js');
const FF = globalThis.FF, out = path.join(__dirname, '..', 'assets', 'sprites');
fs.mkdirSync(out, { recursive: true });
for (const s of FF.Sprites.symbols) fs.writeFileSync(path.join(out, s.id + '.svg'), FF.Sprites.standalone(s.id));
const groups = {};
FF.Sprites.symbols.forEach((s) => { const g = s.id.split('-')[0]; (groups[g] = groups[g] || []).push(s); });
const html = `<!DOCTYPE html><meta charset="utf-8"><title>Sprite FIFO FAFO</title><body style="background:#5a3a22;font-family:sans-serif;color:#fff;padding:20px">
<h1>Sprite FIFO FAFO</h1>${FF.Sprites.sheet()}
${Object.entries(groups).map(([g, a]) => `<h2>${g}</h2><div style="display:flex;flex-wrap:wrap;gap:14px">${a.map((s) => `<figure style="margin:0;text-align:center;background:#f7ecd4;color:#3b2410;border-radius:12px;padding:8px"><svg viewBox="${s.vb}" width="${g === 'room' ? 180 : 120}" height="120"><use href="#s-${s.id}"/></svg><figcaption style="font-size:12px">${s.id}</figcaption></figure>`).join('')}</div>`).join('')}`;
fs.writeFileSync(path.join(__dirname, '..', 'sprites.html'), html);
console.log(FF.Sprites.symbols.length + ' sprite esportati in assets/sprites/ e galleria sprites.html');
