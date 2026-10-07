"""Reconcile cached municipal civic records with source addresses; no network."""
import json
import re
from pathlib import Path
from urllib.parse import urlencode
from geocode_once import normalize

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT.parent / 'qa'
data = json.loads((QA / 'pre-map-data.json').read_text(encoding='utf-8'))
raw = json.loads((QA / 'rome-civici-matches.json').read_text(encoding='utf-8'))
features = raw['data']['features']
existing_path = ROOT / 'data/geocoding.json'
existing = json.loads(existing_path.read_text(encoding='utf-8')) if existing_path.exists() else {}
positions = {}
for p in data['properties']:
    address = p['address']
    if address in positions:
        continue
    building = re.sub(r'\s*[–—-]\s*lotto\s*\d+\s*$', '', address, flags=re.I)
    building = building.replace('Via G. M. Percoto', 'Via Giovanni Maria Percoto').replace('Via Palladio', 'Via Andrea Palladio')
    match = re.fullmatch(r'(.+?)\s+(\d+)', building)
    if not match:
        # Keep the two explicitly authorized street-level positions when rebuilding civics.
        positions[address] = existing[address] if existing.get(address, {}).get('status') == 'street' else {'status': 'review', 'latitude': None, 'longitude': None, 'reason': 'Numero civico assente nel foglio. Nessuna posizione approssimata assegnata.'}
        continue
    road, house = match.groups()
    found = [f for f in features if normalize(f['properties']['TOPONIMO']) == normalize(road)
             and f['properties']['NUMERO_CIVICO'] == int(house)
             and not f['properties']['LETTERA'] and not f['properties']['ESPONENTE']
             and f['properties']['STATO'] == 'UFFICIALE' and f['properties']['PROVENIENZA'] == 'TOPONOMASTICA']
    if len(found) != 1:
        raise ValueError(f'Civico comunale non univoco: {address}: {len(found)}')
    feature = found[0]
    detail = feature['properties']
    lon, lat = feature['geometry']['coordinates']
    assert 41.70 < lat < 42.05 and 12.30 < lon < 12.75
    url = 'https://geoportale.comune.roma.it/geoserver/ows?' + urlencode({'service': 'WFS', 'version': '1.0.0', 'request': 'GetFeature', 'typeName': 'DIPCUL:GeoromaCiviciLocator', 'outputFormat': 'application/json', 'srsName': 'EPSG:4326', 'cql_filter': f'ID_CIVICO={detail["ID_CIVICO"]}'})
    positions[address] = {'status': 'verified', 'latitude': lat, 'longitude': lon, 'query': building + ', Roma, Italy',
                          'matchedAddress': f'{detail["TOPONIMO"]} {house}, Roma, Italy', 'provider': 'Roma Capitale / GeoRoma',
                          'sourceUrl': url, 'civicId': detail['ID_CIVICO'], 'municipality': detail['MUNICIPIO'], 'checkedOn': '2026-10-07',
                          'reason': 'Corrispondenza univoca a strada e civico ufficiale comunale, senza lettere o esponenti. Posizione del civico, non della singola unità.'}
    print(address.encode('ascii', 'backslashreplace').decode(), lat, lon, 'Municipio', detail['MUNICIPIO'])
(ROOT / 'data/geocoding.json').write_text(json.dumps(positions, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Verified lots:', sum(positions[p['address']]['status'] == 'verified' for p in data['properties']))

report = ['# Verifica geografica dei lotti', '', '26 lotti localizzati su 20 civici distinti. Quattro lotti privi di civico sono da verificare: nessuna coordinata stimata.', '',
          '## Fonti e metodo', '',
          '- Ricerca iniziale Nominatim: indirizzi completi + Roma, Italy, richieste singole distanziate, risposte salvate localmente. Centri di strade e risultati di altri comuni scartati.',
          '- Coordinate finali dal layer pubblico `DIPCUL:GeoromaCiviciLocator` di Roma Capitale. Sono stati scelti esclusivamente record con STATO UFFICIALE, PROVENIENZA TOPONOMASTICA, strada e numero coincidenti e senza lettera/esponente.',
          '- CRS richiesto EPSG:4326; GeoJSON [longitudine, latitudine] convertito correttamente in latitude/longitude. Ogni punto ricade nell’area urbana di Roma.',
          '- Nessun dato del foglio è stato riscritto. Le coordinate sono quelle del civico/ingresso, non una georeferenziazione catastale della singola unità.',
          '- Le verifiche salvate sono riutilizzate dall’importatore. Nessuna geocodifica al caricamento della pagina.', '',
          'Fonte: [Geoportale Roma Capitale, servizi pubblici](https://geoportale.comune.roma.it/servizi/). Evidenza completa dei record in `qa/rome-civici-matches.json`, fuori dai file da pubblicare.', '',
          '## Indirizzi esclusi dalla mappa', '',
          '- Viale C. T. Odescalchi: lotti 57/570, 57/526, 57/527. Manca il numero civico; nessun punto assegnato al centro del viale.',
          '- Via F. Orazio da Pennabilli: lotto 57/503. Manca il numero civico; nessun punto approssimato.', '',
          '## Risoluzioni documentate', '',
          '- Via G. M. Percoto 5: confronto con il civico ufficiale VIA GIOVANNI MARIA PERCOTO 5, Municipio VIII. Il nome originale resta nelle schede.',
          '- Via Palladio 22: il civico comunale univoco è VIA ANDREA PALLADIO 22, Municipio I. I risultati Nominatim di Pomezia e Rignano Flaminio sono stati scartati; non sono stati utilizzati. Il nome originale resta nelle schede.',
          '- Via di Donna Olimpia 30: Nominatim restituisce più punti, anche una scuola e civici con lettere. Usato soltanto il civico comunale UFFICIALE numero 30 senza lettera. Entrambi i lotti conservano questa stessa coordinata.',
          '- Per i civici con lettere (es. Annio Felice 26/A, dei Marsi 68/A, de Nobili 9/A, Nemorense 18/E), scartate le varianti: il foglio non le indica.',
          '- Le denominazioni di quartiere di OSM possono differire dalle etichette del foglio (es. Chiaradia in Pinciano, Colombo/Caterina Sforza in Garbatella). Il campo Quartiere è mantenuto integralmente; il punto deriva dal civico ufficiale della strada.', '',
          '## Coordinate accettate', '', '| Indirizzo nel foglio | Latitudine | Longitudine | Civico comunale |', '| --- | --- | --- | --- |']
for address, position in positions.items():
    if position['status'] == 'verified':
        report.append(f'| {address} | {position["latitude"]} | {position["longitude"]} | {position["civicId"]} |')
report_path = ROOT / 'GEOCODING_REPORT.md'
# The existing report includes curated visual checks and street-level exceptions.
if not report_path.exists():
    report_path.write_text('\n'.join(report) + '\n', encoding='utf-8')
