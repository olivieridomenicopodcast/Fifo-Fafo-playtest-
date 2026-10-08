# FIFO FAFO — regole come implementate

Fonte: regolamento interattivo del repo **Fifo Fafo** + logica della **Digital Version**. Il motore è in `js/engine.js`;
le stesse interpretazioni sono mostrate nell'app (📖 Regole).

## Struttura
15 turni (Mattino 1-5, Pomeriggio 6-10, Sera 11-15). 9 stanze su un anello casuale, ognuna con la risorsa della tabella
Playtest v0.1. Heafy parte dalla Camera, G1 dalla Cucina, G2 dalla Mansarda. Ruota di 10 mood in ordine casuale.
Cambio periodo: ogni stanza riceve di nuovo la sua risorsa originale.

Turno: **1)** fase Heafy (mood + movimento + interazioni passive) → **2)** scelta segreta di A/B/C/J e Flow →
**3)** risoluzione (prima il giocatore di turno). Fine: PF − Rancori; i PF negativi a fine turno diventano Rancori.

## Interpretazioni adottate
| # | Punto ambiguo | Scelta |
|---|---|---|
| 1 | Movimento di Heafy | Un solo movimento per turno, dopo il cambio mood; il turno 1 rivela il primo mood |
| 2 | Offesissimo | Non pretende niente e non accetta nulla. Comunque scatti (durante le carte o in un'interazione passiva): al turno dopo si muove di 1 e dà −2 PF nella stanza d'arrivo; quello ancora dopo si calma e la ruota riprende |
| 3 | Raccolta vicino a Heafy | −1 PF + Offesissimo; se già Offesissimo/Arrabbiatissimo solo −1 PF; stanza vuota: nessun effetto |
| 4 | Mood senza pretesa | "Pretesa" = vuole una risorsa *specifica*. Senza pretesa basta dargli qualcosa: +1 PF (mai di più, nessun counter; parametro `noDemandGive`), −1 PF se non dai nulla, nessun Offesissimo |
| 5 | Irrequieto | La prima risorsa qualsiasi: +2 PF e si calma (Neutro); per il resto del turno non accetta altro. Non soddisfatto: inversione direzione a fine turno e −1 PF a chi è con lui |
| 6 | Bisognoso | Solo Paletta +3 PF (la lista punti dice +1: uso la tabella mood); altrimenti −1 PF e Irrequieto per il resto del turno, senza saltare la ruota |
| 7 | Giocherellone | Sequestra a caso dalla stanza d'arrivo; rilascia al movimento successivo; non raccoglibile |
| 8 | Dispettoso | Butta via per sempre una risorsa a caso dalla stanza d'arrivo |
| 9 | Arrabbiatissimo | Il counter è unico per la partita e si azzera solo quando scatta (scelta strategica voluta: si può accettare il +1 PF rischiando di farlo scattare). Inizio turno: −1 PF a chi è nella stanza o adiacente. 2 risorse = +2 PF; con meno di 2: −1 PF senza perdere risorse. **Quando si calma la ruota avanza**: il mood successivo vale subito per il resto del turno e fa il suo turno completo al giro dopo |
| 10 | Coccolone | Nessun bonus per fermarsi da lui (tolto). Resta come variante `coccolonePF` |
| 11 | Interazione | Una per turno a giocatore; C1 senza Heafy (o con Heafy in braccio all'avversario) = abbandoni una risorsa |
| 12 | Trasporto (J2) | Heafy torna libero all'inizio della fase Heafy successiva; la risorsa portata si rilascia al deposito/rilascio. Rimosso l'obbligo di depositare "se A prima di J" (non sorge mai con questo modello) |
| 13 | J2 | Ogni azione al massimo una volta; spostamento 1-2 in entrambi i sensi; "Prendi Heafy" non può essere ultima |
| 14 | Sera | Parte chi ha punteggio netto minore, parità: dado. Pareggio finale possibile |
| 15b | Primo turno | Le interazioni passive valgono anche al turno 1 (mani vuote): una penalità iniziale è possibile ed è casualità voluta |
| 15 | Informazione | Risorse in mano e Flow (dopo la scelta) sono pubblici |
| 16 | Obiettivi segreti | Pesca 2 carte "posizione" + 2 "mano e stile", ne tieni 2. Si controllano solo guardando il tavolo a fine partita (nessun conteggio nel tempo). Non riuscito = +1 Rancore. Vedi tabella sotto |
| 17 | Catch-up | Nell'ultimo turno chi parte per primo (è in svantaggio) prende +2 PF, una volta sola (parametro `lastTurnFirstBonus`) |
| 18 | Non implementato | "Soffio" (TBD nel regolamento) |

## Parametri variabili (Varianti di regole)
`turns`, `handLimit`, `j2Charges`, `noDemandGive`, `coccolonePF`, `eveningLowestFirst`.

## Obiettivi segreti (valori provvisori, da tarare con la simulazione)
| Carta | Si controlla | Punti | Riuscito (AI difficile che lo cerca) |
|---|---|---|---|
| Il tuo angolo ×9 (una per stanza) | la tua pedina è in quella stanza | +2 | 33–45% |
| Compagno di cuscino | sei nella stanza di Heafy | +2 | 33% |
| Tasche piene | 2 risorse in mano | +1 | 96% (regalo) |
| Coppia | 2 risorse uguali in mano | +3 | 78% (troppo facile) |
| Il set ×5 | proprio quelle 2 risorse in mano (Snack+Giochino, Giochino+Cuscino, Paletta+Snack +3; Cuscino+Coccola, Coccola+Paletta +4) | +3 / +4 | 31–45% |
| Risparmiatore | non hai mai usato J2 | +5 | 100% (troppo forte: un J2 vale ~2,9 PF) |

Valore atteso = riuscito × punti − non riuscito × 1 Rancore. Punti modificabili in `js/data.js` (`FF.OBJECTIVES`).
