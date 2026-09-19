"""Exporta somente totais agregados do XLSX para o painel, sem dados pessoais."""
import argparse
import collections
import datetime
import json
from pathlib import Path
import posixpath
import unicodedata
import xml.etree.ElementTree as ET
import zipfile


def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.lower()) if not unicodedata.combining(c)).strip()


def aggregate(path):
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(path) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in item.iterfind('.//m:t', ns)) for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        relationships = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        churches = []
        cargos, departments, politics, evangelical = (collections.Counter() for _ in range(4))
        for sheet in workbook.find('m:sheets', ns):
            target = relationships[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            target = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
            rows = []
            for row in ET.fromstring(archive.read(target)).findall('.//m:sheetData/m:row', ns):
                cells = {}
                for cell in row:
                    column = ''.join(c for c in cell.attrib.get('r', '') if c.isalpha())
                    value = cell.find('m:v', ns)
                    text = value.text or '' if value is not None else ''
                    if cell.attrib.get('t') == 's':
                        text = strings[int(text)]
                    elif cell.attrib.get('t') == 'inlineStr':
                        text = ''.join(t.text or '' for t in cell.findall('.//m:t', ns))
                    cells[column] = text.strip()
                if any(cells.values()):
                    rows.append(cells)
            if not rows:
                continue
            headers = {col: norm(value) for col, value in rows[0].items()}
            timestamp = next((col for col, value in headers.items() if 'carimbo' in value), None)
            if timestamp is None:
                continue
            records = [r for r in rows[1:] if r.get(timestamp)]
            churches.append({'name': sheet.attrib['name'].strip(), 'responses': len(records)})
            for row in records:
                def get(keyword):
                    return next((norm(row.get(col, '')) for col, value in headers.items() if keyword in value), '')
                cargo = get('cargo')
                if cargo:
                    cargos[next((label for key, label in [('pastor', 'Pastor'), ('obreiro', 'Obreiro'), ('membro', 'Membro')] if key in cargo), 'Outro')] += 1
                department = get('departamento')
                for name in ['ufadeb', 'umadeb', 'unaadeb', 'udvadeb']:
                    if name in department:
                        departments[name.upper()] += 1
                if department and ('nenhum' in department or department == 'nao'):
                    departments['Nenhum'] += 1
                for keyword, counter in [('politica', politics), ('evangelico', evangelical)]:
                    value = get(keyword)
                    # Respostas contraditórias não entram no percentual de sim/não.
                    if ('sim' in value) != ('nao' in value):
                        counter['Sim' if 'sim' in value else 'Não'] += 1
        if not churches:
            raise ValueError('Nenhuma aba de respostas reconhecida; arquivo anterior preservado.')
        return {'updatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'source': 'Formulário das Igrejas - ADEB.xlsx', 'countingBasis': 'Uma unidade por aba de respostas da planilha. As abas representam cidades/setores e podem reunir várias congregações.', 'churches': churches, 'cargo': dict(cargos), 'departments': dict(departments), 'politics': dict(politics), 'evangelical': dict(evangelical)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('arquivo')
    parser.add_argument('--saida', default='public/dados-painel.json')
    args = parser.parse_args()
    data = aggregate(args.arquivo)
    output = Path(args.saida)
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(output)
    print(json.dumps({'unidades': len(data['churches']), 'com_dados': sum(c['responses'] > 0 for c in data['churches']), 'cadastros': sum(c['responses'] for c in data['churches'])}, ensure_ascii=False))
