"""Read cell values without loading vendor-specific Excel styles. Original file is untouched."""
import json, pathlib, sys, zipfile, xml.etree.ElementTree as ET

def extract(path):
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(path) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(e.text or '' for e in item.findall('.//m:t', ns))
                       for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        rels = {e.attrib['Id']: e.attrib['Target'] for e in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        sheets = []
        for sheet in ET.fromstring(archive.read('xl/workbook.xml')).find('m:sheets', ns):
            target = rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            rows = []
            for row in ET.fromstring(archive.read(target)).findall('m:sheetData/m:row', ns):
                cells = {}
                for cell in row:
                    value = cell.find('m:v', ns)
                    value = value.text if value is not None else None
                    kind = cell.attrib.get('t')
                    if kind == 's' and value is not None:
                        value = strings[int(value)]
                    elif kind == 'inlineStr':
                        value = ''.join(e.text or '' for e in cell.findall('.//m:t', ns))
                    if value is not None:
                        cells[cell.attrib['r']] = value
                if cells:
                    rows.append({'row': int(row.attrib['r']), 'cells': cells})
            sheets.append({'sheet': sheet.attrib['name'], 'rows': rows})
        return sheets

if __name__ == '__main__':
    data = extract(sys.argv[1])
    pathlib.Path(sys.argv[2]).write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    print(json.dumps([{'sheet': s['sheet'], 'rows': len(s['rows'])} for s in data], ensure_ascii=True))
