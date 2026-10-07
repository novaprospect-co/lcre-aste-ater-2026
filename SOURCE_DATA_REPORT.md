# Verifica dei dati di origine

Fonte: `ASTE ATER OTTOBRE 2026.xlsx`, Sheet1, righe 3–32.

30 righe importate una volta ciascuna; identificatore di lotto mantenuto.
I 30 URL ufficiali e i 29 URL video sono confrontati esattamente con le celle e gli hyperlink Excel.
Nessuna pagina esterna è stata consultata; la disponibilità dei siti esterni non è verificata.

## Normalizzazione dichiarata

Numeri mantenuti come numeri. Celle vuote e trattini isolati sono null nella vista normalizzata; tutti i valori originali restano in `source`.
Le date conservano giorno, mese e ora del foglio. Il 2026 della chiave di ordinamento viene dal titolo del workbook, non dalla data del computer.
Categorie, indirizzi, condizioni, pertinenze, ascensore ed €/mq conservati senza correzioni o reinterpretazioni.
Su richiesta, la pagina espande Mono/Bilo/Trilo/Quadri/Penta in Monolocale/Bilocale/Trilocale/Quadrilocale/Pentilocale. Ottime diventa “Pronto all’uso”, Buone “Quasi pronto all’uso”, Da lavori “Da fare lavori”. Le date sono rese come “16 OTTOBRE alle ore 15:30”. I valori del dataset restano invariati.
Indirizzi uguali non sono duplicati da eliminare: sono associati a lotti diversi.

## Segnalazioni

- Riga 5, lotto 57/570: il foglio non riporta un numero civico nell’indirizzo; indirizzo conservato senza integrazioni.
- Riga 14, lotto 57/503: il foglio non riporta un numero civico nell’indirizzo; indirizzo conservato senza integrazioni.
- Riga 15, lotto 57/526: il foglio non riporta un numero civico nell’indirizzo; indirizzo conservato senza integrazioni.
- Riga 16, lotto 57/527: il foglio non riporta un numero civico nell’indirizzo; indirizzo conservato senza integrazioni.
- Riga 17, lotto 57/558: Voto originale “Sufficente”; etichetta visualizzata “Sufficiente”. Il valore originale resta nel dataset.
- Riga 18, lotto 57/559: Voto originale “Sufficente”; etichetta visualizzata “Sufficiente”. Il valore originale resta nel dataset.
- Riga 19, lotto 57/560: Voto originale “Sufficente”; etichetta visualizzata “Sufficiente”. Il valore originale resta nel dataset.
- Riga 20, lotto 57/563: Voto originale “Sufficente”; etichetta visualizzata “Sufficiente”. Il valore originale resta nel dataset.
- Riga 21, lotto 57/567: Voto originale “Sufficente”; etichetta visualizzata “Sufficiente”. Il valore originale resta nel dataset.
- Riga 22, lotto 57/542: Voto originale “Sufficente”; etichetta visualizzata “Sufficiente”. Il valore originale resta nel dataset.
- Riga 26, lotto 57/576: Vani “4,5*”, asterisco senza spiegazione nel foglio. Conservato senza interpretazione.
- Riga 30, lotto 57/511: Video indicato con “—”; nessun pulsante video.
- Riga 32, lotto 57/514: Condizioni non compilate; il campo è omesso nella scheda.
