# Prompt per un nuovo prototipo di playtest digitale

*Da incollare nella prima chat della nuova sessione. Sostituisci i segnaposto tra [parentesi quadre] e allega il file MD del gioco.*

---

Ciao! Voglio costruire un **prototipo digitale per il playtest** del mio gioco di carte **[NOME DEL GIOCO]**, in questo repo nuovo e vuoto. In allegato trovi **[NOME-FILE.md]** con tutto quello che so finora: regole, carte, dubbi aperti. Parla e scrivi **sempre in italiano**.

## Riferimento: parti da un lavoro già fatto
Ho già fatto la stessa cosa per un altro mio gioco da tavolo. Il repo, pubblico, è **olivieridomenicopodcast/Fifo-Fafo-playtest-** (branch **`ccr-ef847750-u6ouub`**). Aggiungilo in sola lettura, clonalo e studialo **prima di scrivere codice**: voglio la stessa filosofia e la stessa qualità, adattate a un gioco di carte. Guarda in particolare `README.md`, `js/engine.js`, `js/ai.js`, `js/sim.js`, `js/ui/*`, `tests/`, `tools/` e `docs/REGOLAMENTO.md`. Riusa architettura e idee, non copiare le regole di quel gioco.

## Come lavoriamo (importante)
1. **Prima di tutto leggi l'MD e dimmi cosa trovi**: lacune, contraddizioni e punti ambigui delle regole. Fammi poche domande mirate e **aspetta le mie risposte**: non inventare regole. Ogni interpretazione va scritta nel regolamento.
2. **Lavora a piccoli passi** e a ogni passo **verifica davvero**: test automatici sulle regole e prova nel browser (Chromium e Playwright sono già installati: gioca partite complete con un bot, fai screenshot su desktop e su mobile). Dimmi con onestà cosa hai verificato e cosa no.
3. Sviluppa e fai push solo sul branch che ti viene indicato. **Niente PR** se non te le chiedo.
4. Quando ti incollo un log o ti segnalo che qualcosa "non ha senso": **prima analizza e dimmi cosa vedi di strano, poi proponi, poi aspetta la mia decisione** prima di cambiare le regole. Se cambi una regola, aggiorna regolamento, test e simulatore.

## Architettura
- **Nessuna build**: HTML/CSS/JS vanilla con script classici, che funzionano aprendo `index.html` e anche in Node. **PWA installabile e offline.**
- **Motore di gioco separato dall'interfaccia**: la partita è un generatore che chiede "decisioni"; stato JSON clonabile; **RNG con seed**; ogni partita è riproducibile e rigiocabile dal seed o dalla cronologia delle risposte (serve per salvataggio/ripresa e per "Rivedi").
- **Informazione nascosta** (mani, mazzo, carte coperte): l'AI non deve mai "sbirciare". Per le decisioni difficili usa il motore come modello in avanti con simulazioni su mani possibili, senza leggere i dadi o le carte future vere.
- **Parametri delle regole in un unico oggetto**, modificabili dall'interfaccia (per fare esperimenti).
- **Test con `node:test`**: un test per ogni regola importante, test di determinismo e replay, test "fuzz" con invarianti (ad esempio nessuna carta si perde o duplica).
- **Regolamento unico** in `docs/REGOLAMENTO.md` (con le parti nuove o chiarite segnate e una tabella delle differenze rispetto all'originale), mostrato anche nell'app alla voce Regole. Test che controlla che il testo mostrato sia sincronizzato e che i valori citati coincidano col codice.

## Modalità di gioco
1. **Contro l'AI** (facile, media, difficile) con suggerimento dell'AI facoltativo e anteprima delle conseguenze.
2. **Due giocatori sullo stesso dispositivo** ("passa il telefono"): schermata di passaggio prima di ogni scelta privata, così l'altro non vede la mano.
3. **AI contro AI**, da guardare: velocità regolabile.
4. **Simulazione veloce** dentro l'app (vedi sotto).
Salvataggio automatico con ripresa; log (cronaca) completo, esportabile; possibilità di aggiungere **note di playtest** al log.

## Interfaccia: i miei requisiti
- **Look da gioco da tavolo**: tavolo, carte vere (ben disegnate, con il testo leggibile), zone di gioco chiare (mano, mazzo, scarti, tavolo). **Sprite e grafica generati da te in SVG**, senza risorse esterne; esportali anche come file.
- **Tutto leggibile**: testo grande (base ≥17px), icone grandi, buon contrasto, responsive per telefono. Le carte si possono ingrandire con un tocco.
- **Legenda** sempre disponibile con tutte le icone e i simboli (a sinistra della plancia su schermi larghi).
- **Messaggi grandi sopra al tavolo per ogni evento** (anche le mosse dell'AI e gli effetti delle carte), che **faccio avanzare io** con un bottone, un clic sul messaggio o Spazio/Invio. La modalità predefinita è manuale, con un tasto "salta fino alla mia mossa". I cambi di fase, round o turno chiedono **sempre** il clic. Ogni effetto deve spiegare **cosa fa e perché**.
- **A colpo d'occhio, senza cliccare**: cosa sta per succedere (carta o effetto attivo e prossimo), le risorse e i contatori di tutti, di chi è il turno. Gli stati speciali vanno descritti sempre, anche quando non sono attivi.
- **Le azioni non disponibili non spariscono**: restano visibili e grigie con il motivo. Prima di una mossa costosa o rischiosa, **avviso evidente e conferma**.
- Cronaca di tutti gli eventi sempre consultabile.

## Il simulatore (dentro l'app e da riga di comando)
- N partite AI vs AI con due profili A e B, **posti alternati**, vittorie con **intervallo di confidenza**, vantaggio di chi gioca per primo, andamento dei punteggi nel tempo, distribuzione degli scarti.
- **Quanto rende ogni carta o effetto**, medie degli eventi per partita, elenco partite con log e "Rivedi" dal seed.
- **Esperimento sulle regole**: cambia un parametro e confronta i risultati.
- **Analisi di ogni carta/obiettivo "forzata"** per tarare i valori, anche per quelle che l'AI non sceglie mai da sola.
- Esporta in Markdown, CSV e JSON. Prima di adottare un cambiamento all'AI, misuralo con un torneo e un intervallo di confidenza.

## Qualità dell'AI
Tre livelli ben distinti (facile < media < difficile, misurati col simulatore). Dopo averli fatti, **leggi tu stesso i log di partite difficile contro difficile** e correggi le scelte senza senso (azioni sprecate, risorse buttate, mosse che si annullano). Se vedo io qualcosa di strano te lo segnalo.

## Primi passi
1. Clona il repo di riferimento e leggi il mio MD.
2. Dimmi le ambiguità e le domande sulle regole, e proponi una **struttura del progetto e un piano a tappe** adatti al mio gioco (adattando quello di riferimento).
3. Aspetta il mio ok, poi parti dal motore e dai test, e solo dopo interfaccia, AI e simulatore.
