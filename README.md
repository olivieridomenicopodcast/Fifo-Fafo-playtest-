# FIFO FAFO — Playtest

Versione digitale del gioco da tavolo **FIFO FAFO** (il gatto Heafy e il letto) pensata per il playtest.
Nessuna build: apri `index.html` (o `npm run serve` → http://localhost:8080). È una PWA installabile e funziona offline.

## Modalità
- 🤖 **Contro l'AI** — facile / media / difficile; suggerimento AI, anteprima del Flow, salvataggio automatico.
- 👥 **Due giocatori** — stesso dispositivo, schermata di passaggio per tenere segreto il Flow.
- 🍿 **AI contro AI** — guarda la partita: passo-passo, lento, normale, veloce, istantaneo.
- 📡 **Partita in rete (2 dispositivi)** — «Crea una stanza» (codice di 4 caratteri + link) e «Unisciti a una stanza»; ognuno ha il proprio schermo, senza account né server tuoi. Vedi sotto.
- 📊 **Simulazione veloce** — centinaia di partite in pochi secondi: vittorie con intervallo di confidenza, vantaggio di posto (G1/G2),
  andamento dei punti, resa di ogni mood, eventi medi, elenco partite con log completo e "Rivedi"; esporta report `.md`, `.csv`, `.json`.
  **Esperimento sulle regole**: confronta più valori di un parametro (es. limite mano 2/3/4).

Ogni partita ha un **seed**: stesso seed = stessa partita. Dal log si possono aggiungere note di playtest (📝).

## Obiettivi segreti e catch-up
A inizio partita ognuno pesca 4 obiettivi e ne tiene 2; si rivelano e si controllano a fine partita guardando il tavolo (niente conteggi). Chi non li completa prende +1 Rancore. La carta "Primo di sera" premia chi è partito per primo la sera (cioè era in svantaggio). Tutto è regolabile in *Varianti di regole* e il simulatore mostra quanto riesce ogni obiettivo.

## Interfaccia di gioco
- **Messaggi grandi** sopra la plancia per ogni mossa (anche dell'AI e di Heafy), da far avanzare a mano con *Avanti*, clic sul messaggio, Spazio o Invio; **⏩ Fino alla mia mossa** salta ai tuoi turni. Il cambio di momento della giornata (Mattino/Pomeriggio/Sera) chiede sempre il clic.
- **Ruota dei mood** vera, che gira; **ORA / DOPO** con le pretese sempre visibili; Offesissimo e Arrabbiatissimo descritti anche quando non sono attivi.
- **Legenda** delle icone nel pannello laterale; avvisi evidenti prima di confermare un Flow rischioso (es. C1 lontano da Heafy).

## Grafica e sprite
Plancia 2D illustrata (le 9 stanze sono disegnate e si dispongono ad anello a caso), Heafy con un'espressione diversa per ogni mood, pedine, gettoni risorsa e carte da gioco: tutti sprite SVG disegnati nel codice (`js/ui/sprites.js`).
`node tools/export-sprites.js` li esporta come file in `assets/sprites/*.svg` (riutilizzabili, ad es. in Godot) e genera la galleria `sprites.html`.

## Partita in rete (due dispositivi)
- Collegamento diretto **WebRTC con PeerJS** (`js/vendor/peerjs.min.js`, salvato nel repo: nessun CDN). Il servizio pubblico di PeerJS serve solo a far trovare i due dispositivi (serve internet all'inizio); poi i dati passano direttamente. Per i test: `?peerhost=localhost&peerport=9000` usa un server locale.
- **Il dispositivo che crea la stanza è il tavolo** (`FF.Net.Runner`, `js/netgame.js`): tiene lo stato vero e fa girare le regole. Ognuno dei due giocatori — anche quello sul tavolo — ha la propria schermata (`js/ui/netplay.js`) e va avanti con i propri tempi: nessuno blocca l'altro.
- **Vista filtrata**: all'altro giocatore non arrivano mai il seed (da cui si ricostruirebbero le scelte casuali), gli obiettivi segreti dell'avversario (fino a fine partita) né il suo Flow prima della rivelazione. Le scelte private (Flow, obiettivi) viaggiano solo da chi le fa al tavolo.
- **Caduta e rientro**: battito ogni 4 s, dispositivo perso dopo ~12 s. Il tavolo mostra «Aspetto che torni» / «Gioca l'AI al posto suo»; chi rientra con lo stesso nome riprende da dove era, con la scelta ancora pendente. L'app chiede di tenere lo schermo acceso (Screen Wake Lock) dove supportato.
- Messaggi in **JSON puro** e piccoli (PeerJS non regge messaggi sopra ~16 KB: il log si manda a pezzi): lo controllano i test in `tests/net.test.js`.
- **Salvataggio e ripresa**: il tavolo salva la partita sul proprio dispositivo (`localStorage`: seed + risposte date) dopo ogni scelta. Se chiude l'app, nella home compare «Partita in rete in sospeso» → «Riapri la stanza»: la partita si ricostruisce identica (il motore è deterministico), la stanza riapre con lo stesso codice (se è ancora occupato sul servizio PeerJS riprova qualche volta, poi ne propone uno nuovo) e l'altro giocatore rientra con lo stesso nome («Riconnetti»). Il salvataggio vale solo sullo stesso dispositivo e browser e si cancella a fine partita o con «Abbandona».
- **Limiti**: se nessuno riapre l'app sul tavolo la partita resta ferma; non provato su iPad/telefoni veri né col servizio pubblico di PeerJS (solo con server locale); su wifi che isolano i dispositivi il collegamento diretto può non partire.
- Prova nel browser (due contesti Chromium + server PeerJS locale): `NODE_PATH=<cartella con npm i peer>/node_modules node tools/e2e-net.js [--drop] [--resume]`.

## Da riga di comando
```
npm test                                   # test sulle regole e sulla rete
node tools/sim.js --games 500 --a hard --b medium --out report.md
node tools/sim.js --games 300 --rule handLimit=3 --log 2
```
Simulazioni sperimentali a 3-4 giocatori (copie del motore, senza toccare il gioco): vedi `tools/nplayers/README.md`.

## Architettura
| File | Ruolo |
|---|---|
| `js/data.js` | stanze, risorse, mood, carte, parametri di regola |
| `js/engine.js` | motore: partita come generatore di decisioni, RNG con seed, stato JSON clonabile |
| `js/ai.js` | AI: euristiche + simulazione in avanti sul motore stesso (clone dello stato) |
| `js/sim.js` | simulazioni in blocco, statistiche, report |
| `js/netgame.js` | partita in rete: tavolo (`Runner`), vista filtrata, messaggi |
| `js/ui/*` | interfaccia (plancia, partita, simulazione, regole; `net.js` collegamento PeerJS, `netplay.js` schermata in rete, `lobby.js` stanza) |

Il regolamento completo (fonte unica, mostrato anche nell'app alla voce 📖 Regole) è in `docs/REGOLAMENTO.md`: dopo ogni modifica lancia `node tools/build-rules.js`.
Regolamento originale: repo *Fifo Fafo*; versione precedente: *Fifo Fafo Digital Version*.
