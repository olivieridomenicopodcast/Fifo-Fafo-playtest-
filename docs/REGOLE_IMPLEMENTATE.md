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
| 2 | Offesissimo | Scattato durante le carte: al turno dopo si muove di 1 e dà −2 PF nella stanza d'arrivo; quello ancora dopo si calma. Scattato in fase Heafy: si calma al turno dopo |
| 3 | Raccolta vicino a Heafy | −1 PF + Offesissimo; se già Offesissimo/Arrabbiatissimo solo −1 PF; stanza vuota: nessun effetto |
| 4 | Mood senza pretesa | +1 PF con risorsa (parametro `noDemandGive`), −1 PF senza, nessun Offesissimo |
| 5 | Irrequieto | Qualsiasi risorsa: +2 PF → Neutro, non ne accetta altre; non soddisfatto: inversione direzione a fine turno e −1 PF a chi è con lui |
| 6 | Bisognoso | Solo Paletta +3 PF (la lista punti dice +1: uso la tabella mood); altrimenti −1 PF e Irrequieto per il resto del turno, senza saltare la ruota |
| 7 | Giocherellone | Sequestra a caso dalla stanza d'arrivo; rilascia al movimento successivo; non raccoglibile |
| 8 | Dispettoso | Butta via per sempre una risorsa a caso dalla stanza d'arrivo |
| 9 | Arrabbiatissimo | Inizio turno: −1 PF a chi è nella stanza o adiacente. 2 risorse = +2 PF; con meno di 2: −1 PF senza perdere risorse |
| 10 | Coccolone | +1 PF a chi finisce il proprio Flow nella sua stanza |
| 11 | Interazione | Una per turno a giocatore; C1 senza Heafy (o con Heafy in braccio all'avversario) = abbandoni una risorsa |
| 12 | Trasporto (J2) | Heafy torna libero all'inizio della fase Heafy successiva; la risorsa portata si rilascia al deposito/rilascio. Rimosso l'obbligo di depositare "se A prima di J" (non sorge mai con questo modello) |
| 13 | J2 | Ogni azione al massimo una volta; spostamento 1-2 in entrambi i sensi; "Prendi Heafy" non può essere ultima |
| 14 | Sera | Parte chi ha punteggio netto minore, parità: dado. Pareggio finale possibile |
| 15 | Informazione | Risorse in mano e Flow (dopo la scelta) sono pubblici |
| 16 | Non implementato | Obiettivi Segreti, catch-up, "Soffio" (TBD nel regolamento) |

## Parametri variabili (Varianti di regole)
`turns`, `handLimit`, `j2Charges`, `noDemandGive`, `coccolonePF`, `eveningLowestFirst`.
