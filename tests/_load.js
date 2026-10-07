// Carica i file del gioco in Node (scripts classici che popolano globalThis.FF)
require('../js/data.js');
require('../js/engine.js');
try { require('../js/ai.js'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
try { require('../js/sim.js'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
module.exports = globalThis.FF;
