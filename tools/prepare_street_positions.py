"""Use cached official street extents for the four user-approved area markers."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT.parent / 'qa'
raw = json.loads((QA / 'rome-street-civics.json').read_text(encoding='utf-8'))
assert raw['data']['totalFeatures'] == len(raw['data']['features']), 'Risposta comunale incompleta'
target = ROOT / 'data/geocoding.json'
positions = json.loads(target.read_text(encoding='utf-8'))
roads = {'Viale C. T. Odescalchi': 'VIALE CARLO TOMMASO ODESCALCHI',
         'Via F. Orazio da Pennabilli': 'VIA FRANCESCO ORAZIO DA PENNABILLI'}
for address, road in roads.items():
    features = [f for f in raw['data']['features'] if f['properties']['TOPONIMO'] == road
                and f['properties']['STATO'] == 'UFFICIALE'
                and f['properties']['PROVENIENZA'] == 'TOPONOMASTICA']
    assert len(features) >= 2 and all(f['properties']['MUNICIPIO'] == 8 for f in features)
    points = [f['geometry']['coordinates'] for f in features]
    bounds = [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)]
    lon, lat = round((bounds[0] + bounds[2]) / 2, 8), round((bounds[1] + bounds[3]) / 2, 8)
    positions[address] = {'status': 'street', 'latitude': lat, 'longitude': lon,
                          'query': f'{road}, Roma, Italy', 'matchedAddress': f'{road}, Roma, Italy',
                          'provider': 'Roma Capitale / GeoRoma', 'sourceUrl': raw['url'],
                          'municipality': 8, 'checkedOn': '2026-10-07',
                          'precision': 'street', 'method': 'Centro del rettangolo contenente i civici ufficiali della via.',
                          'streetBounds': bounds, 'referenceCivicCount': len(features),
                          'reason': 'Posizione indicativa della via, autorizzata per indicare la zona. Numero civico non disponibile; non identifica il singolo edificio.'}
    print(address, lat, lon, f'{len(features)} civici di riferimento')
target.write_text(json.dumps(positions, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
