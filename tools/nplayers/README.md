# Simulazioni a 3 e 4 giocatori (sperimentale)

Il gioco è fatto per **2 giocatori**: il motore in `js/engine.js` ha i due posti scritti nel codice. Per capire se Fifo Fafo potrebbe funzionare anche a 3-4 senza toccarlo, questi script **generano copie sperimentali** del motore e dell'AI (`.gen/`, ignorata da git) generalizzate a N giocatori e con varianti di regole, e le fanno giocare AI contro AI. I file in `js/` **non vengono mai modificati**.

## Come si usa
```
python3 tools/nplayers/build.py                      # genera tools/nplayers/.gen/{data,engine,ai}.js dai file del gioco
node tools/nplayers/run.js base 4 300 '{}' medium    # una configurazione: nome, n giocatori (2-4), partite, regole in JSON, livello AI
node tools/nplayers/driver.js 300 results.jsonl      # tutte le configurazioni (n=3 e 4), 4 processi in parallelo (~8 minuti)
T12=1 node tools/nplayers/driver.js 300 results_t12.jsonl   # le varianti a 12 turni
node tools/nplayers/report.js [file.jsonl]           # tabella di confronto (di default risultati/results.jsonl)
```
Va rilanciato `build.py` se cambia `js/engine.js` o `js/ai.js`: le modifiche sono sostituzioni di testo e, se non trovano più il pezzo da sostituire, si fermano con «non trovato».

## Regole sperimentali (parametri in `run.js`/`driver.js`)
| Parametro | Cosa fa |
|---|---|
| `nPlayers` | 2-4 giocatori (partenze: Cucina, Mansarda, Scale, Ingresso). Ordine di turno di base: G1 il mattino, G2 il pomeriggio, la Sera dal punteggio netto più basso al più alto; gli altri seguono in ordine di posto |
| `resPerRoom` | gettoni per stanza (all'inizio e a ogni ricarica) |
| `rechargeEvery` | ricarica ogni k turni invece che a cambio periodo |
| `handLimit` | limite mano (parametro già del gioco) |
| `rotate` | il primo di turno ruota a ogni turno (mattino e pomeriggio); la Sera resta «dal più basso» |
| `firstBonus` | la prima risorsa giusta del turno dà +2, le successive +1 |
| `passiveByOrder` | interazioni passive in ordine di turno invece che a sorte |
| `carryCooldown` | dopo aver portato Heafy in braccio non puoi riprenderlo per il turno dopo |
| `arrabThreshold` | soglia del counter Arrabbiatissimo (3 nel gioco) |
| `turns` | numero di turni (già del gioco) |

## Cosa è venuto fuori (AI «media» per tutti i posti, 300 partite per riga, errore circa ±3 punti)
- **Controllo**: a 2 giocatori la copia dà punteggio medio 11,1 / 11,4 (motore vero: 11,1 / 11,1) e vittorie G1/G2 47/53% (vero: 45/49%).
- **Così com'è** (punti a testa 11,1 → 9,2 → 7,3 con 2/3/4 giocatori): il vantaggio di posto esplode (3 giocatori: 33/44/23%, 4 giocatori: 27/34/22/17%), coerente con l'ordine di turno medio di ogni posto. Offesissimo e Arrabbiatissimo scattano quasi il doppio. Gli obiettivi riescono come prima (46%), niente spirale di Rancori.
- **Cosa aiuta**: primo di turno a rotazione (con 12 turni è più equo a 3 e 4), 2 gettoni per stanza (riporta i punti vicino a quelli del 2 giocatori), soglia Arrabbiatissimo `n+1`. «Prima risorsa giusta +2» da sola peggiora il vantaggio di posto.
- **Pacchetto migliore**: `turns:12, rotate, resPerRoom:2, firstBonus, passiveByOrder, carryCooldown, arrabThreshold:n+1` → 3 giocatori 30/35/35%, 4 giocatori 22/28/29/21%.

## Limiti
- Misura equilibrio, non divertimento, attese o «re-maker» (chi aiuta chi).
- L'AI «media» non è pensata per più giocatori e ignora cosa faranno gli altri; l'AI «difficile» non è stata generalizzata. Per questo `carryCooldown` non si può valutare (l'AI media non porta mai Heafy in braccio).
- Restano scarti di ±5 punti per posto dopo la rotazione, non del tutto spiegati.
- Le varianti vanno provate anche con persone vere.
- Nessun test automatico per questi script (richiedono Python e qualche minuto): se cambiano motore o AI, rilancia `build.py` e un `run.js` di prova.
