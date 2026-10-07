"""Development-only, cached, sequential geocoding. Never imported by the site."""
import argparse
import json
import re
import time
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT.parent / 'qa'
AGENT = 'LCRE-Ater57-Development-Geocoding/1.0 (one-time public-address mapping)'

def normalize(value):
    return re.sub(r'[^a-z0-9]+', ' ', unicodedata.normalize('NFKD', value.lower()).encode('ascii', 'ignore').decode()).strip()

def request(url):
    with urlopen(Request(url, headers={'User-Agent': AGENT}), timeout=25) as response:
        return response.read()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--download-leaflet', action='store_true')
    parser.add_argument('--rome-catalog', action='store_true')
    parser.add_argument('--rome-schema', action='store_true')
    parser.add_argument('--rome-civici', action='store_true')
    parser.add_argument('--visual-catalog', action='store_true')
    parser.add_argument('--visual-check', action='store_true')
    parser.add_argument('--street-candidates', action='store_true')
    args = parser.parse_args()
    QA.mkdir(exist_ok=True)
    if args.street_candidates:
        cache_file = QA / 'rome-street-civics.json'
        if not cache_file.exists():
            url = 'https://geoportale.comune.roma.it/geoserver/ows?' + urlencode({'service': 'WFS', 'version': '1.0.0', 'request': 'GetFeature', 'typeName': 'DIPCUL:GeoromaCiviciLocator', 'maxFeatures': 1000, 'outputFormat': 'application/json', 'srsName': 'EPSG:4326', 'cql_filter': "TOPONIMO ILIKE '%ODESCALCHI%' OR TOPONIMO ILIKE '%PENNABILLI%'"})
            cache_file.write_text(json.dumps({'url': url, 'data': json.loads(request(url))}, ensure_ascii=False, indent=2), encoding='utf-8')
        result = json.loads(cache_file.read_text(encoding='utf-8'))['data']
        print('Total:', result.get('totalFeatures'), 'Returned:', len(result['features']))
        for road in sorted(set(f['properties']['TOPONIMO'] for f in result['features'])):
            features = [f for f in result['features'] if f['properties']['TOPONIMO'] == road]
            points = [f['geometry']['coordinates'] for f in features]
            print(road, 'records:', len(features), 'municipality:', sorted(set(f['properties']['MUNICIPIO'] for f in features)), 'bounds:', [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)])
        return
    if args.visual_check:
        from PIL import Image, ImageDraw, ImageFont
        import io
        records = json.loads((ROOT / 'data/geocoding.json').read_text(encoding='utf-8'))
        checked = []
        seen = set()
        for address, record in records.items():
            if record['status'] != 'verified':
                continue
            lat, lon = record['latitude'], record['longitude']
            if (lat, lon) in seen:
                continue
            seen.add((lat, lon))
            checked.append((address, lat, lon))
        panel = 400
        output = Image.new('RGB', (panel * 4, 445 * 5), 'white')
        font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 16)
        for index, (address, lat, lon) in enumerate(checked):
            cache_file = QA / f'civic-visual-{index + 1:02}.png'
            if not cache_file.exists():
                url = 'https://geoportale.comune.roma.it/geoserver/ows?' + urlencode({'service': 'WMS', 'version': '1.1.1', 'request': 'GetMap', 'layers': 'REGLAZ:2020_AGEA_25833_COG', 'styles': '', 'srs': 'EPSG:4326', 'bbox': f'{lon - .0018},{lat - .00134},{lon + .0018},{lat + .00134}', 'width': panel, 'height': panel, 'format': 'image/png'})
                cache_file.write_bytes(request(url))
            picture = Image.open(io.BytesIO(cache_file.read_bytes())).convert('RGB')
            draw = ImageDraw.Draw(picture)
            draw.ellipse((193, 193, 207, 207), fill='#dc1035', outline='white', width=2)
            x, y = (index % 4) * panel, (index // 4) * 445
            output.paste(picture, (x, y))
            draw = ImageDraw.Draw(output)
            draw.text((x + 5, y + 405), f'{index + 1}. {address}', font=font, fill='black')
            draw.text((x + 5, y + 425), f'{lat:.7f}, {lon:.7f} | Roma Capitale / AGEA 2020', font=font, fill='#555555')
            print(f'Visual {index + 1}/{len(checked)}: {address}', flush=True)
        output.save(QA / 'civic-visual-contact-sheet.png')
        return
    if args.visual_catalog:
        cache_file = QA / 'rome-wms-capabilities.xml'
        if not cache_file.exists():
            cache_file.write_bytes(request('https://geoportale.comune.roma.it/geoserver/ows?service=WMS&request=GetCapabilities'))
        doc = ET.fromstring(cache_file.read_bytes())
        for layer in doc.iter():
            if layer.tag.endswith('Layer'):
                values = [child.text for child in layer if child.text and child.tag.endswith(('Name', 'Title'))]
                if re.search('cart|strad|topo|base|ortofoto', ' '.join(values), re.I):
                    print(values)
        return
    if args.rome_schema:
        base = 'https://geoportale.comune.roma.it/geoserver/ows?'
        for kind, parameters in [('schema', {'service': 'WFS', 'version': '1.0.0', 'request': 'DescribeFeatureType', 'typeName': 'DIPCUL:GeoromaCiviciLocator'}), ('sample', {'service': 'WFS', 'version': '1.0.0', 'request': 'GetFeature', 'typeName': 'DIPCUL:GeoromaCiviciLocator', 'maxFeatures': 1, 'outputFormat': 'application/json', 'srsName': 'EPSG:4326'})]:
            raw = request(base + urlencode(parameters))
            (QA / f'rome-civici-{kind}.txt').write_bytes(raw)
            print(kind, raw.decode('utf-8')[:6500], flush=True)
        return
    if args.rome_catalog:
        url = 'https://geoportale.comune.roma.it/geoserver/ows?service=WFS&request=GetCapabilities&version=1.0.0'
        raw = request(url)
        (QA / 'rome-wfs-capabilities.xml').write_bytes(raw)
        doc = ET.fromstring(raw)
        for item in doc.iter():
            if item.tag.endswith('FeatureType'):
                values = [child.text for child in item if child.tag.endswith(('Name', 'Title'))]
                if re.search('civic|toponom|strad|access|indirizz', ' '.join(values), re.I):
                    print(values)
        return
    text = (ROOT / 'data/properties.js').read_text(encoding='utf-8')
    data = json.loads(text.split('window.LCRE_DATA = ', 1)[1].rstrip(';\n'))
    baseline = QA / 'pre-map-data.json'
    if not baseline.exists():
        baseline.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    cache_path = QA / 'geocoding_raw.json'
    cache = json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else {}
    if args.rome_civici:
        cache_file = QA / 'rome-civici-matches.json'
        if cache_file.exists():
            matches = json.loads(cache_file.read_text(encoding='utf-8'))
        else:
            clauses = []
            for original in dict.fromkeys(p['address'] for p in data['properties']):
                building = re.sub(r'\s*[–—-]\s*lotto\s*\d+\s*$', '', original, flags=re.I).replace('Via G. M. Percoto', 'Via Giovanni Maria Percoto')
                match = re.fullmatch(r'(.+?)\s+(\d+)', building)
                if not match:
                    continue
                road, house = match.groups()
                tokens = [t for t in normalize(road).upper().split() if t not in {'VIA', 'VIALE', 'PIAZZA', 'LUNGOTEVERE', 'DI', 'DE', 'DA', 'DEL', 'DEI', 'DELLA'}]
                pattern = '%' + '%'.join(tokens) + '%'
                clause = f"(NUMERO_CIVICO={int(house)} AND TOPONIMO ILIKE '{pattern}')"
                if clause not in clauses:
                    clauses.append(clause)
            url = 'https://geoportale.comune.roma.it/geoserver/ows?' + urlencode({'service': 'WFS', 'version': '1.0.0', 'request': 'GetFeature', 'typeName': 'DIPCUL:GeoromaCiviciLocator', 'maxFeatures': 150, 'outputFormat': 'application/json', 'srsName': 'EPSG:4326', 'cql_filter': ' OR '.join(clauses)})
            raw = request(url)
            matches = json.loads(raw)
            cache_file.write_text(json.dumps({'url': url, 'data': matches}, ensure_ascii=False, indent=2), encoding='utf-8')
            matches = {'url': url, 'data': matches}
        for feature in matches['data']['features']:
            print(json.dumps({'address': feature['properties'], 'coordinates': feature['geometry']['coordinates']}, ensure_ascii=True), flush=True)
        return
    candidates = {}
    for address in dict.fromkeys(p['address'] for p in data['properties']):
        building = re.sub(r'\s*[–—-]\s*lotto\s*\d+\s*$', '', address, flags=re.I)
        building = building.replace('Via G. M. Percoto', 'Via Giovanni Maria Percoto')
        match = re.fullmatch(r'(.+?)\s+(\d+[A-Za-z]?)', building)
        if not match:
            candidates[address] = {'status': 'review', 'reason': 'Numero civico assente nel foglio; nessuna posizione approssimata assegnata.', 'latitude': None, 'longitude': None}
            continue
        road, house = match.groups()
        query = building + ', Roma, Italy'
        if query not in cache:
            time.sleep(1.1)
            url = 'https://nominatim.openstreetmap.org/search?' + urlencode({'q': query, 'format': 'jsonv2', 'addressdetails': 1, 'limit': 5, 'countrycodes': 'it'})
            cache[query] = {'url': url, 'results': json.loads(request(url)), 'date': '2026-10-07'}
            cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding='utf-8')
        entry = cache[query]
        exact = []
        for result in entry['results']:
            detail = result.get('address', {})
            lat, lon = float(result['lat']), float(result['lon'])
            city = detail.get('city') or detail.get('town') or ''
            if detail.get('house_number', '').casefold() == house.casefold() and normalize(detail.get('road', '')) == normalize(road) and city == 'Roma' and detail.get('country_code') == 'it' and 41.70 < lat < 42.05 and 12.30 < lon < 12.75:
                exact.append(result)
        if len(exact) == 1:
            result = exact[0]
            candidates[address] = {'status': 'candidate', 'latitude': float(result['lat']), 'longitude': float(result['lon']), 'query': query, 'matchedAddress': result['display_name'], 'addressDetails': result['address'], 'provider': 'OpenStreetMap / Nominatim', 'sourceUrl': entry['url'], 'osmObjectUrl': f'https://www.openstreetmap.org/{result["osm_type"]}/{result["osm_id"]}', 'checkedOn': '2026-10-07', 'reason': 'Civico, strada e comune coincidono; controllo visivo da completare.'}
        else:
            candidates[address] = {'status': 'review', 'latitude': None, 'longitude': None, 'query': query, 'sourceUrl': entry['url'], 'reason': 'Nessuna corrispondenza univoca a strada e civico; non usato il centro della strada.', 'results': [{'displayName': r['display_name'], 'latitude': r['lat'], 'longitude': r['lon'], 'address': r.get('address', {})} for r in entry['results']]}
        print(address.encode('ascii', 'backslashreplace').decode(), candidates[address]['status'], flush=True)
    (QA / 'geocoding_candidates.json').write_text(json.dumps(candidates, ensure_ascii=False, indent=2), encoding='utf-8')
    if args.download_leaflet:
        vendor = ROOT / 'assets/leaflet'
        (vendor / 'images').mkdir(parents=True, exist_ok=True)
        for name in ['leaflet.js', 'leaflet.css', 'images/layers.png', 'images/layers-2x.png', 'images/marker-icon.png', 'images/marker-icon-2x.png', 'images/marker-shadow.png']:
            target = vendor / name
            if not target.exists():
                target.write_bytes(request('https://unpkg.com/leaflet@1.9.4/dist/' + name))
        if not (vendor / 'LICENSE').exists():
            (vendor / 'LICENSE').write_bytes(request('https://unpkg.com/leaflet@1.9.4/LICENSE'))
        print('Leaflet 1.9.4 saved locally.', flush=True)

if __name__ == '__main__':
    main()
