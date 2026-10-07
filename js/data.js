/* FIFO FAFO — dati statici del gioco (stanze, risorse, mood, carte, regole di default).
   Nessuna dipendenza: funziona nel browser (window) e in Node (globalThis). */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});

  // Stanze: `res` è la risorsa "originale" della stanza (tabella Playtest v0.1 del regolamento)
  FF.ROOMS = [
    { id: 'cucina',     name: 'Cucina',    icon: '🍳', res: 'snack' },
    { id: 'bagno',      name: 'Bagno',     icon: '🚿', res: 'paletta' },
    { id: 'camera',     name: 'Camera',    icon: '🛏', res: 'cuscino' },
    { id: 'terrazzo',   name: 'Terrazzo',  icon: '🌿', res: 'giochino' },
    { id: 'corridoio',  name: 'Corridoio', icon: '🚪', res: 'coccola' },
    { id: 'mansarda',   name: 'Mansarda',  icon: '🏚', res: 'snack' },
    { id: 'sgabuzzino', name: 'Sgabuzzino', icon: '📦', res: 'paletta' },
    { id: 'scale',      name: 'Scale',     icon: '🪜', res: 'giochino' },
    { id: 'ingresso',   name: 'Ingresso',  icon: '🚪', res: 'cuscino' },
  ];

  FF.RES = {
    snack:    { id: 'snack',    n: 'Snack',    i: '🍬' },
    cuscino:  { id: 'cuscino',  n: 'Cuscino',  i: '🛏' },
    giochino: { id: 'giochino', n: 'Giochino', i: '🎾' },
    paletta:  { id: 'paletta',  n: 'Paletta',  i: '🪣' },
    coccola:  { id: 'coccola',  n: 'Coccola',  i: '🤗' },
  };

  // demand: id risorsa | 'any' (qualsiasi) | null (nessuna pretesa)
  // move: standard | stay | double | explore | to:<roomId>
  FF.MOODS = {
    affamato:      { id: 'affamato',      name: 'Affamato',      e: '🍽', demand: 'snack',    move: 'to:cucina' },
    assonnato:     { id: 'assonnato',     name: 'Assonnato',     e: '😴', demand: 'cuscino',  move: 'stay' },
    curioso:       { id: 'curioso',       name: 'Curioso',       e: '🔍', demand: null,       move: 'explore' },
    coccolone:     { id: 'coccolone',     name: 'Coccolone',     e: '🤗', demand: 'coccola',  move: 'stay' },
    giocherellone: { id: 'giocherellone', name: 'Giocherellone', e: '🎾', demand: 'giochino', move: 'standard' },
    irrequieto:    { id: 'irrequieto',    name: 'Irrequieto',    e: '😤', demand: 'any',      move: 'standard' },
    neutro:        { id: 'neutro',        name: 'Neutro',        e: '😐', demand: null,       move: 'standard' },
    bisognoso:     { id: 'bisognoso',     name: 'Bisognoso',     e: '🚽', demand: 'paletta',  move: 'to:bagno' },
    iperattivo:    { id: 'iperattivo',    name: 'Iperattivo',    e: '⚡', demand: null,       move: 'double' },
    dispettoso:    { id: 'dispettoso',    name: 'Dispettoso',    e: '😈', demand: null,       move: 'standard' },
  };
  FF.MOOD_IDS = Object.keys(FF.MOODS);

  // Mood "speciali": non stanno nella ruota
  FF.SPECIAL = {
    offesissimo:     { id: 'offesissimo',     name: 'Offesissimo',     e: '😡', demand: null,  move: 'standard' },
    arrabbiatissimo: { id: 'arrabbiatissimo', name: 'Arrabbiatissimo', e: '🔥', demand: 'two', move: 'stay' },
  };

  FF.CARDS = {
    A1: { t: 'A', code: 'A1', dir: 1,  steps: 1, label: 'Orario ×1' },
    A2: { t: 'A', code: 'A2', dir: 1,  steps: 2, label: 'Orario ×2' },
    A3: { t: 'A', code: 'A3', dir: -1, steps: 1, label: 'Antiorario ×1' },
    A4: { t: 'A', code: 'A4', dir: -1, steps: 2, label: 'Antiorario ×2' },
    B1: { t: 'B', code: 'B1', label: 'Raccogli' },
    B2: { t: 'B', code: 'B2', label: 'Non raccogliere' },
    C1: { t: 'C', code: 'C1', label: 'Interagisci' },
    C2: { t: 'C', code: 'C2', label: 'Non interagire' },
    J1: { t: 'J', code: 'J1', label: 'Niente jolly' },
    J2: { t: 'J', code: 'J2', label: 'Jolly!' },
  };

  // Parametri modificabili (per confrontare varianti di regole nelle simulazioni)
  FF.DEFAULT_RULES = {
    turns: 15,            // 3 periodi da turns/3 turni
    handLimit: 2,         // risorse massime in mano
    j2Charges: 2,         // attivazioni di J2 per partita
    noDemandGive: 1,      // PF per una risorsa data a un mood senza pretesa (Neutro, Curioso, ...)
    coccolonePF: 1,       // PF per chi finisce il flow nella stanza di Heafy Coccolone
    eveningLowestFirst: true, // Sera: va primo chi ha meno PF
  };

  FF.RULE_LABELS = {
    turns: 'Turni totali (multiplo di 3)',
    handLimit: 'Limite risorse in mano',
    j2Charges: 'Cariche J2 per partita',
    noDemandGive: 'PF se dai una risorsa a un mood senza pretesa',
    coccolonePF: 'PF per fermarsi da Heafy Coccolone',
    eveningLowestFirst: 'Sera: parte chi ha meno PF',
  };

  FF.PLAYER_ICONS = ['🟠', '🔵'];
  FF.LEVELS = { easy: 'Facile', medium: 'Media', hard: 'Difficile' };
})(typeof window !== 'undefined' ? window : globalThis);
