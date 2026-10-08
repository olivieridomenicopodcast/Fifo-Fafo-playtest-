# FIFO FAFO — Playtest

Versione digitale del gioco da tavolo **FIFO FAFO** (il gatto Heafy e il letto) pensata per il playtest.
Nessuna build: apri `index.html` (o `npm run serve` → http://localhost:8080). È una PWA installabile e funziona offline.

## Modalità
- 🤖 **Contro l'AI** — facile / media / difficile; suggerimento AI, anteprima del Flow, salvataggio automatico.
- 👥 **Due giocatori** — stesso dispositivo, schermata di passaggio per tenere segreto il Flow.
- 🍿 **AI contro AI** — guarda la partita: passo-passo, lento, normale, veloce, istantaneo.
- 📊 **Simulazione veloce** — centinaia di partite in pochi secondi: vittorie con intervallo di confidenza, vantaggio di posto (G1/G2),
  andamento dei punti, resa di ogni mood, eventi medi, elenco partite con log completo e "Rivedi"; esporta report `.md`, `.csv`, `.json`.
  **Esperimento sulle regole**: confronta più valori di un parametro (es. limite mano 2/3/4).

Ogni partita ha un **seed**: stesso seed = stessa partita. Dal log si possono aggiungere note di playtest (📝).

## Obiettivi segreti e catch-up
A inizio partita ognuno pesca 4 obiettivi e ne tiene 2; si rivelano e si controllano a fine partita guardando il tavolo (niente conteggi). Chi non li completa prende +1 Rancore. Nell'ultimo turno chi parte per primo (in svantaggio) prende +2 PF. Tutto è regolabile in *Varianti di regole* e il simulatore mostra quanto riesce ogni obiettivo.

## Interfaccia di gioco
- **Messaggi grandi** sopra la plancia per ogni mossa (anche dell'AI e di Heafy), da far avanzare a mano con *Avanti*, clic sul messaggio, Spazio o Invio; **⏩ Fino alla mia mossa** salta ai tuoi turni. Il cambio di momento della giornata (Mattino/Pomeriggio/Sera) chiede sempre il clic.
- **Ruota dei mood** vera, che gira; **ORA / DOPO** con le pretese sempre visibili; Offesissimo e Arrabbiatissimo descritti anche quando non sono attivi.
- **Legenda** delle icone nel pannello laterale; avvisi evidenti prima di confermare un Flow rischioso (es. C1 lontano da Heafy).

## Grafica e sprite
Plancia 2D illustrata (le 9 stanze sono disegnate e si dispongono ad anello a caso), Heafy con un'espressione diversa per ogni mood, pedine, gettoni risorsa e carte da gioco: tutti sprite SVG disegnati nel codice (`js/ui/sprites.js`).
`node tools/export-sprites.js` li esporta come file in `assets/sprites/*.svg` (riutilizzabili, ad es. in Godot) e genera la galleria `sprites.html`.

## Da riga di comando
```
npm test                                   # 25 test sulle regole
node tools/sim.js --games 500 --a hard --b medium --out report.md
node tools/sim.js --games 300 --rule handLimit=3 --log 2
```

## Architettura
| File | Ruolo |
|---|---|
| `js/data.js` | stanze, risorse, mood, carte, parametri di regola |
| `js/engine.js` | motore: partita come generatore di decisioni, RNG con seed, stato JSON clonabile |
| `js/ai.js` | AI: euristiche + simulazione in avanti sul motore stesso (clone dello stato) |
| `js/sim.js` | simulazioni in blocco, statistiche, report |
| `js/ui/*` | interfaccia (plancia, partita, simulazione, regole) |

Regole e interpretazioni delle parti ambigue: `docs/REGOLE_IMPLEMENTATE.md`.
Regolamento originale: repo *Fifo Fafo*; versione precedente: *Fifo Fafo Digital Version*.
