"""Read the overview workbook's colored cells and compare with the project CSV.

Read-only: emits JSON evidence; never modifies the workbook or project data.
"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[1]
workbook = openpyxl.load_workbook(sys.argv[1], data_only=True)
sheet = workbook['Details']
colors = {'FFFFFF00': 'yellow', 'FFFFC000': 'orange', 'FFFF0000': 'red'}

def color(cell):
    fill = cell.fill
    value = fill.fgColor if fill.patternType == 'solid' else fill.bgColor
    return value.rgb if value.type == 'rgb' else None

with (root / 'operator-selection/data/operators.csv').open(encoding='utf-8-sig', newline='') as f:
    current = list(csv.DictReader(f))
for op in current:
    for field in ('close', 'medium', 'long'):
        op[field] = json.loads(op[field])

source = []
diffs = []
unmatched = []
matched = set()
for row in sheet.iter_rows():
    label = str(row[0].value or '')
    match = re.fullmatch(r'([AD])\d+ (.+?)(?:\s*-\s*alt)?', label)
    if not match:
        continue
    side = 'attack' if match[1] == 'A' else 'defense'
    version = 'alt' if re.search(r'-\s*alt$', label) else 'off'
    name = ''.join(c for c in unicodedata.normalize('NFKD', match[2].upper().replace('Ø', 'O')) if not unicodedata.combining(c))
    name = {'JAEGER': 'JAGER'}.get(name, name)
    data = {}
    ranges = {}
    hp = [str(i + 4) for i in range(3) if color(row[i + 1]) == 'FF00B050']
    if len(hp) != 1:
        raise ValueError(f'{label}: ambiguous health {hp}')
    data['hp'] = 'health_' + hp[0]
    ranges['hp'] = f'B{row[0].row}:D{row[0].row}'
    # User-confirmed convention: unmarked means yellow, orange mark means orange.
    destruction = colors.get(color(row[5]))
    if destruction not in (None, 'orange'):
        raise ValueError(f'{row[5].coordinate}: unexpected destruction color {destruction}')
    data['destruction'] = (destruction or 'yellow') + '_destruction'
    ranges['destruction'] = row[5].coordinate
    for field, start in [('close', 8), ('medium', 13), ('long', 18)]:
        dice = []
        for cell in row[start:start + 4]:
            shade = colors.get(color(cell))
            if shade:
                if cell.value not in (None, '/'):
                    raise ValueError(f'{cell.coordinate}: unexpected dice mark {cell.value}')
                dice.append(('broken_' if cell.value == '/' else '') + shade + '_dice')
            elif cell.value not in (None, '.'):
                raise ValueError(f'{cell.coordinate}: unknown dice {cell.value}, {color(cell)}')
        data[field] = dice
        ranges[field] = f'{row[start].coordinate}:{row[start+3].coordinate}'
    matches = [op for op in current if op['name'] == name and op['side'] == side and op['version'] == version]
    entry = {'label': label, 'row': row[0].row, 'data': data, 'ranges': ranges}
    if len(matches) != 1:
        unmatched.append(entry)
    else:
        op = matches[0]
        entry['id'] = op['id']
        matched.add(op['id'])
        for field, value in data.items():
            if value is not None and op[field] != value:
                diffs.append({'id': op['id'], 'field': field, 'old': op[field], 'new': value, 'range': ranges[field]})
    source.append(entry)
print(json.dumps({'source': source, 'differences': diffs, 'unmatchedSource': unmatched,
                  'notInWorkbook': [op['id'] for op in current if op['id'] not in matched]}, ensure_ascii=False))
