# LCRE · Asta ATER Roma, ottobre 2026

Sito statico in italiano per consultare e confrontare i 30 lotti presenti nel foglio fornito. HTML, CSS e JavaScript vanilla con Leaflet 1.9.4 locale e fondomappa OpenStreetMap, senza build, backend o database. Le foto e le planimetrie restano esclusivamente sulle fonti esterne. Nessuna pagina di dettaglio.

## Struttura

```text
index.html                 pagina unica
style.css                  stile e layout responsive
app.js                     schede, filtri e ordinamenti
map.js                     mappa e collegamenti alle schede
data/properties.js         dati locali e celle originali
data/geocoding.json        coordinate verificate e provenienza
assets/lcre-logo.png        logo fornito
assets/favicon.svg         icona locale
assets/leaflet/             Leaflet 1.9.4, immagini e licenza
SOURCE_DATA_REPORT.md      segnalazioni della fonte
GEOCODING_REPORT.md        verifiche geografiche e indirizzi incompleti
tools/import_properties.py importazione e verifica Excel
tools/geocode_once.py      ricerca geografica solo in sviluppo
tools/prepare_geocoding.py riconciliazione dei civici verificati
tools/prepare_street_positions.py posizioni indicative delle due vie autorizzate
tools/test_site.mjs        test dati, logica e browser
```

## Aggiornare i dati

Aggiornare prima il foglio Excel, mantenendo Sheet1, titolo in riga 1 e le 16 colonne originali in riga 2. Il sito conserva anche Lotto e Vani: Lotto distingue indirizzi identici; Vani rimane nel dataset perché non richiesto nelle schede.

Da questa cartella, con Python e `openpyxl` disponibili:

```powershell
python tools/import_properties.py "../ASTE ATER OTTOBRE 2026.xlsx"
python tools/import_properties.py "../ASTE ATER OTTOBRE 2026.xlsx" --check
node tools/test_site.mjs
```

L'importatore legge il workbook senza modificarlo e rigenera dataset e rapporto. Non inventa informazioni, non ricalcola €/mq e non unisce immobili con lo stesso indirizzo. I trattini isolati diventano null nella vista; tutte le celle originali sono conservate in `source`. La normalizzazione “Sufficente” → “Sufficiente” è dichiarata nel rapporto. Le date hanno una chiave di ordinamento del 2026, anno esplicito nel titolo del foglio. Per altre aste o altri anni occorre aggiornare anche titolo, testi e importatore.

La pagina espande le tipologie in Monolocale, Bilocale, Trilocale, Quadrilocale e Pentilocale. Le condizioni “Ottime” e “Buone” sono visualizzate come “Pronto all'uso” e “Quasi pronto all'uso”; “Da lavori” diventa “Da fare lavori”. Le date sono mostrate, ad esempio, come “16 OTTOBRE alle ore 15:30”. Queste etichette non modificano i dati originali. Il disclaimer e la nota sulle valutazioni sono riuniti in un unico blocco nel footer, con il testo sintetico richiesto.

Per la verifica browser facoltativa occorrono Playwright e Chrome già installati, più il server locale sotto descritto:

```powershell
$env:LCRE_PLAYWRIGHT_PATH = "C:/percorso/node_modules/playwright/index.mjs"
node tools/test_site.mjs --browser
```

Gli URL vengono confrontati con il foglio e con i link effettivamente resi nella pagina. Questi test non visitano le pagine d'asta o YouTube e non verificano la disponibilità dei siti esterni.

I test browser verificano marker, filtri, reset, lotti con coordinate condivise, navigazione mappa/scheda e gesti touch. Sostituiscono le immagini delle tile con una fixture locale per evitare richieste automatiche a OpenStreetMap. `--file` permette di eseguire i test senza server. Il confronto prima/dopo dei dati originali usa lo snapshot locale `../qa/pre-map-data.json` quando presente.

## Mappa e coordinate

La mappa si trova tra filtri e risultati e usa gli stessi lotti filtrati delle schede: tutti i 30 lotti sono in mappa. 26 hanno coordinate verificate su 20 civici distinti; per i quattro senza civico, su richiesta, è usata una posizione indicativa della via. Questi marker hanno bordo tratteggiato e una nota esplicita nel popup. Non identificano il singolo edificio. Dettagli e fonti in `GEOCODING_REPORT.md`.

Le coordinate sono già salvate nel dataset. Il sito non interroga servizi di geocodifica. Per nuovi indirizzi, verificare strada, civico e comune, aggiornare `data/geocoding.json` e rigenerare il dataset con l'importatore. Gli script di ricerca sono strumenti di sviluppo e non vanno richiamati dalla pagina. Le richieste Nominatim devono rispettare la [policy ufficiale](https://operations.osmfoundation.org/policies/nominatim/): singole, con cache, identificazione dell'applicazione e almeno un secondo tra richieste. Non utilizzare risultati approssimati o ambigui.

I marker nello stesso edificio sono separati soltanto sullo schermo: le coordinate esatte restano identiche. Ogni marker conserva il proprio lotto, popup e pulsante “VEDI IMMOBILE”. Le schede hanno il collegamento “Sulla mappa”. La rotella del mouse non ingrandisce la mappa; su dispositivi touch lo trascinamento si attiva con “Interagisci con la mappa” e può essere disattivato per tornare allo scorrimento della pagina.

Le tile provengono da `https://tile.openstreetmap.org`, con attribuzione visibile, e richiedono Internet. La mappa viene creata una sola volta; le immagini sono richieste soltanto mentre è visibile. Non introdurre download massivi, prefetch, cache offline o una policy Referrer che blocchi il Referer dell'hosting. Rispettare la [policy delle tile OSM](https://operations.osmfoundation.org/policies/tiles/).

## Anteprima locale

Aprire `index.html` direttamente nel browser: filtri, schede e marker funzionano anche senza server. Per vedere anche il fondomappa, usare un'anteprima HTTP locale con connessione Internet. Dalla cartella del sito:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Aprire `http://127.0.0.1:8765/`. Interrompere il server con Ctrl+C. Nel computer dove è stato preparato il sito Python è disponibile anche in `C:/Users/patga/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`.

## Pubblicazione

Caricare `index.html`, `style.css`, `app.js`, `map.js`, `data/` e `assets/` (inclusa tutta la sottocartella `leaflet/`) nella directory pubblica di un hosting statico con HTTPS. Mantenere i percorsi e servire `index.html` come pagina iniziale. Non caricare i documenti originali, il foglio Excel o la cartella `tools/`; non servono al funzionamento. Non sono richiesti comandi di build, variabili d'ambiente, database o configurazioni di routing.

L'archivio `lcre-asta-ater-57.zip` nella cartella superiore contiene i file del sito, il README e i rapporti sui dati e sulle coordinate, pronto da estrarre. Gli script di aggiornamento e test restano nella cartella locale `site/tools/`. Nessuna pubblicazione o modifica DNS è stata eseguita.

## Verifica e limiti

Il rapporto `SOURCE_DATA_REPORT.md` documenta le anomalie del foglio e le trasformazioni. Dopo ogni aggiornamento verificare il conteggio, l'unicità delle righe, i collegamenti, i filtri e il layout. Informazioni, condizioni e partecipazione all'asta devono sempre essere verificate sulle fonti ufficiali. La Valutazione LCRE è presentata come indicazione interna orientativa.
