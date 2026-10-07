# Verifica geografica dei lotti

30 lotti in mappa: 26 localizzati su 20 civici distinti e quattro con posizione indicativa della via, su richiesta esplicita. Per questi quattro manca il civico: il marker indica la zona, senza identificare il singolo edificio.

## Fonti e metodo

- Ricerca iniziale Nominatim: indirizzi completi + Roma, Italy, richieste singole distanziate, risposte salvate localmente. Centri di strade e risultati di altri comuni scartati.
- Coordinate dei 26 lotti con civico dal layer pubblico `DIPCUL:GeoromaCiviciLocator` di Roma Capitale. Sono stati scelti esclusivamente record con STATO UFFICIALE, PROVENIENZA TOPONOMASTICA, strada e numero coincidenti e senza lettera/esponente.
- CRS richiesto EPSG:4326; GeoJSON [longitudine, latitudine] convertito correttamente in latitude/longitude. Ogni punto ricade nell’area urbana di Roma.
- Nessun dato del foglio è stato riscritto. I 26 punti precisi sono quelli del civico/ingresso, non una georeferenziazione catastale della singola unità. I quattro punti indicativi sono documentati qui sotto con precisione `street`.
- Le verifiche salvate sono riutilizzate dall’importatore. Nessuna geocodifica al caricamento della pagina.

Fonte: [Geoportale Roma Capitale, servizi pubblici](https://geoportale.comune.roma.it/servizi/). Evidenza completa dei record in `qa/rome-civici-matches.json`, fuori dai file da pubblicare.

## Posizioni indicative della via

- Viale C. T. Odescalchi: lotti 57/570, 57/526, 57/527. Corrisponde alla VIALE CARLO TOMMASO ODESCALCHI del Municipio VIII. Posizione indicativa: **41.85614269, 12.50015854**, ricavata dal centro del rettangolo contenente 78 civici ufficiali della via.
- Via F. Orazio da Pennabilli: lotto 57/503. Corrisponde alla VIA FRANCESCO ORAZIO DA PENNABILLI del Municipio VIII. Posizione indicativa: **41.86500469, 12.49213511**, ricavata dal centro del rettangolo contenente 11 civici ufficiali della via.
- Scartate VIA MARCANTONIO ODESCALCHI (Municipio XII) e VIA PENNABILLI (Municipio IV), che sono strade diverse. Risposta comunale completa: 131 record, salvati in `qa/rome-street-civics.json`.
- Le quattro posizioni sono volutamente riferite alla via: nessun civico inventato. Il popup indica “Posizione indicativa della via · civico non disponibile”; i tre lotti sul viale hanno marker separati sullo schermo e collegamenti distinti alle schede.

## Risoluzioni documentate

- Via G. M. Percoto 5: confronto con il civico ufficiale VIA GIOVANNI MARIA PERCOTO 5, Municipio VIII. Il nome originale resta nelle schede.
- Via Palladio 22: il civico comunale univoco è VIA ANDREA PALLADIO 22, Municipio I. I risultati Nominatim di Pomezia e Rignano Flaminio sono stati scartati; non sono stati utilizzati. Il nome originale resta nelle schede.
- Via di Donna Olimpia 30: Nominatim restituisce più punti, anche una scuola e civici con lettere. Usato soltanto il civico comunale UFFICIALE numero 30 senza lettera. Entrambi i lotti conservano questa stessa coordinata.
- Per i civici con lettere (es. Annio Felice 26/A, dei Marsi 68/A, de Nobili 9/A, Nemorense 18/E), scartate le varianti: il foglio non le indica.
- Le denominazioni di quartiere di OSM possono differire dalle etichette del foglio (es. Chiaradia in Pinciano, Colombo/Caterina Sforza in Garbatella). Il campo Quartiere è mantenuto integralmente; il punto deriva dal civico ufficiale della strada.

## Controllo visivo

Controllo visivo eseguito sulle ortofoto pubbliche Roma Capitale / AGEA 2020, in riquadri centrati sui 20 civici distinti: posizioni coerenti con strade e ingressi individuati nei record comunali. Evidenza locale: `qa/civic-visual-contact-sheet.png`. Questo controllo verifica il posizionamento geografico del civico, senza attribuire una specifica unità o particella catastale.

## Verifiche dell'interfaccia

- 30 schede e 59 collegamenti conservati, confronto dei campi originali prima/dopo e verifica del foglio Excel superati.
- 2.520 combinazioni dei filtri, sei ordinamenti e ogni valore dei filtri nel browser verificati. I marker coincidono con i lotti filtrati provvisti di coordinate; gli altri sono segnalati separatamente.
- Reset, risultati vuoti, bounds, cinque lotti con lo stesso civico, popup e navigazione alla scheda corretta verificati.
- Layout a 320, 375, 390, 430, 768, 1024 e 1440 px; nessuna eccedenza orizzontale. Mappa 350 px su mobile e 480 px su desktop. Attivazione/disattivazione gesti touch verificata.
- Screenshot della mappa e del popup controllati su desktop e mobile. I test automatici sostituiscono le tile OSM con una fixture; il controllo geografico usa le ortofoto comunali. La disponibilità del servizio live OpenStreetMap non è certificata da questi test.
- Nessuna richiesta a Nominatim o GeoRoma durante l'uso della pagina. Disclaimer, valutazioni, etichette di quartiere e logica di filtraggio mantenuti.

## Coordinate accettate (tabella)

| Indirizzo nel foglio | Latitudine | Longitudine | Civico comunale |
| --- | --- | --- | --- |
| Via Roberto De Nobili 9 | 41.86341091 | 12.49013968 | 315380 |
| Via Giovanni Branca 79 | 41.87863959 | 12.4727158 | 177125 |
| Lungotevere Testaccio 20 | 41.88088964 | 12.47318494 | 351409 |
| Via Ignazio Persico 77 | 41.86577824 | 12.4862274 | 201063 |
| Via Imera 3 | 41.87915815 | 12.51128967 | 201865 |
| Via Principe Eugenio 106 | 41.89344963 | 12.50935232 | 302901 |
| Via Annio Felice 26 | 41.85565966 | 12.49969817 | 24711 |
| Via Giovanni Livraghi 2 | 41.88458704 | 12.46039647 | 179534 |
| Via Palladio 22 | 41.87687779 | 12.48607172 | 20612 |
| Via G. M. Percoto 5 | 41.8656604 | 12.49188814 | 179774 |
| Piazza Lorenzo Lotto 3 | 41.8521143 | 12.49881022 | 216178 |
| Via Portogallo 13 | 41.93368238 | 12.47092716 | 297293 |
| Via Cristoforo Colombo 310 | 41.85605534 | 12.49207195 | 112474 |
| Via dei Marsi 68 | 41.89588428 | 12.51497547 | 236042 |
| Via di Donna Olimpia 30 – lotto 1 | 41.87836409 | 12.45175964 | 119507 |
| Via di Donna Olimpia 30 – lotto 2 | 41.87836409 | 12.45175964 | 119507 |
| Via Salvatore di Giacomo 25 | 41.8453219 | 12.48652048 | 324961 |
| Via Nemorense 18 | 41.92414281 | 12.50797196 | 258172 |
| Piazza Caterina Sforza 6 | 41.85915592 | 12.49130129 | 89511 |
| Via Masolino da Panicale 17 | 41.92482507 | 12.46458049 | 236955 |
| Via Enrico Chiaradia 2 | 41.92096253 | 12.47247347 | 125995 |
