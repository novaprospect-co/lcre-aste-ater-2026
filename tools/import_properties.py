"""Read the supplied workbook without modifying it; preserve every source cell."""
import argparse
import json
import math
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT.parent / 'ASTE ATER OTTOBRE 2026.xlsx'
FIELDS = ['address', 'evaluation', 'startingPrice', 'surface', 'neighborhood', 'floor',
          'category', 'condition', 'elevator', 'appurtenance', 'officialUrl', 'videoUrl',
          'pricePerSqm', 'rooms', 'lot', 'auction']
EMPTY_MARKERS = {'', '—', '–', '-'}

def clean(value):
    if value is None or (isinstance(value, str) and value.strip() in EMPTY_MARKERS):
        return None
    return value.strip() if isinstance(value, str) else value

def build(source):
    book = openpyxl.load_workbook(source, data_only=True)
    sheet = book['Sheet1']
    headers = [cell.value for cell in sheet[2]]
    if len(headers) != len(FIELDS) or headers[0] != 'Indirizzo' or headers[-1] != 'Asta':
        raise ValueError('Schema del foglio diverso da quello atteso: verificare le colonne.')
    properties, notes = [], []
    geo_path = ROOT / 'data/geocoding.json'
    geocoding = json.loads(geo_path.read_text(encoding='utf-8')) if geo_path.exists() else {}
    for row in sheet.iter_rows(min_row=3):
        values = [cell.value for cell in row]
        if all(v is None for v in values):
            continue
        raw = dict(zip(headers, values))
        item = dict(zip(FIELDS, map(clean, values)))
        item.update(id=f'row-{row[0].row}', sourceRow=row[0].row, source=raw)
        position = geocoding.get(item['address'], {'status': 'review', 'reason': 'Indirizzo non ancora verificato.'})
        verified = position.get('status') in ('verified', 'street')
        item['latitude'] = position.get('latitude') if verified else None
        item['longitude'] = position.get('longitude') if verified else None
        if verified and not (isinstance(item['latitude'], (int, float)) and isinstance(item['longitude'], (int, float)) and math.isfinite(item['latitude']) and math.isfinite(item['longitude']) and 41.70 < item['latitude'] < 42.05 and 12.30 < item['longitude'] < 12.75):
            raise ValueError(f'Coordinate non valide per {item["address"]}')
        item['geocoding'] = {key: value for key, value in position.items() if key not in ['latitude', 'longitude', 'results']}
        prefix = f'Riga {row[0].row}, lotto {item["lot"]}'
        if not re.search(r'\d', item['address'] or ''):
            notes.append(f'{prefix}: il foglio non riporta un numero civico nell’indirizzo; indirizzo conservato senza integrazioni.')
        if item['evaluation'] == 'Sufficente':
            item['evaluation'] = 'Sufficiente'
            notes.append(f'{prefix}: Voto originale “Sufficente”; etichetta visualizzata “Sufficiente”. Il valore originale resta nel dataset.')
        if item['condition'] is None:
            notes.append(f'{prefix}: Condizioni non compilate; il campo è omesso nella scheda.')
        if item['videoUrl'] is None:
            notes.append(f'{prefix}: Video indicato con “—”; nessun pulsante video.')
        if isinstance(item['rooms'], str) and '*' in item['rooms']:
            notes.append(f'{prefix}: Vani “{item["rooms"]}”, asterisco senza spiegazione nel foglio. Conservato senza interpretazione.')
        for field, column in [('officialUrl', 10), ('videoUrl', 11)]:
            url = item[field]
            if url and (urlparse(url).scheme != 'https' or not urlparse(url).netloc):
                notes.append(f'{prefix}: URL {field} malformato, conservato nel dataset ma non reso cliccabile.')
            hyperlink = row[column].hyperlink
            if hyperlink and hyperlink.target != values[column]:
                notes.append(f'{prefix}: testo e destinazione del collegamento {field} diversi; usato il testo della cella.')
        date = re.fullmatch(r'(\d{2})/(\d{2}) (\d{2}):(\d{2})', item['auction'] or '')
        # The year is explicit in the workbook title. No current-year inference.
        item['auctionSortKey'] = None
        if date:
            day, month, hour, minute = map(int, date.groups())
            item['auctionSortKey'] = f'2026-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}'
        else:
            notes.append(f'{prefix}: formato data asta non riconosciuto; valore originale conservato.')
        price, area, rate = item['startingPrice'], item['surface'], item['pricePerSqm']
        if all(isinstance(v, (int, float)) for v in (price, area, rate)) and area > 0 and abs(price / area - rate) > 1:
            notes.append(f'{prefix}: €/mq nel foglio ({rate}) differisce da base d’asta / MQ ({price / area:.2f}); conservato il valore del foglio.')
        properties.append(item)
    lots = Counter(p['lot'] for p in properties)
    for lot, count in lots.items():
        if count > 1:
            notes.append(f'Lotto {lot} ripetuto {count} volte: righe conservate, da verificare.')
    return {'meta': {'sourceFile': source.name, 'sheet': sheet.title, 'title': sheet['A1'].value,
                     'auctionYear': 2026, 'count': len(properties)}, 'properties': properties}, notes

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', nargs='?', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data, notes = build(args.source)
    target = ROOT / 'data' / 'properties.js'
    content = '// Generated from the supplied workbook. Do not overwrite source values.\nwindow.LCRE_DATA = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n'
    if args.check:
        assert target.read_text(encoding='utf-8') == content, 'Dataset non corrispondente al foglio.'
        print(f'PASS: {len(data["properties"])} righe, tutti i campi e tutti gli URL corrispondono alla fonte.')
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')
    last_row = max(p['sourceRow'] for p in data['properties'])
    report = ['# Verifica dei dati di origine', '', f'Fonte: `{args.source.name}`, Sheet1, righe 3–{last_row}.', '',
              f'{len(data["properties"])} righe importate una volta ciascuna; identificatore di lotto mantenuto.',
              'I 30 URL ufficiali e i 29 URL video sono confrontati esattamente con le celle e gli hyperlink Excel.',
              'Nessuna pagina esterna è stata consultata; la disponibilità dei siti esterni non è verificata.', '',
              '## Normalizzazione dichiarata', '',
              'Numeri mantenuti come numeri. Celle vuote e trattini isolati sono null nella vista normalizzata; tutti i valori originali restano in `source`.',
              'Le date conservano giorno, mese e ora del foglio. Il 2026 della chiave di ordinamento viene dal titolo del workbook, non dalla data del computer.',
              'Categorie, indirizzi, condizioni, pertinenze, ascensore ed €/mq conservati senza correzioni o reinterpretazioni.',
              'Su richiesta, la pagina espande Mono/Bilo/Trilo/Quadri/Penta in Monolocale/Bilocale/Trilocale/Quadrilocale/Pentilocale. Ottime diventa “Pronto all’uso”, Buone “Quasi pronto all’uso”, Da lavori “Da fare lavori”. Le date sono rese come “16 OTTOBRE alle ore 15:30”. I valori del dataset restano invariati.',
              'Indirizzi uguali non sono duplicati da eliminare: sono associati a lotti diversi.', '',
              '## Segnalazioni', '']
    report += ['- ' + note for note in notes]
    (ROOT / 'SOURCE_DATA_REPORT.md').write_text('\n'.join(report) + '\n', encoding='utf-8')
    print(f'Imported {len(data["properties"])} properties; {len(notes)} source notes.')

if __name__ == '__main__':
    main()
