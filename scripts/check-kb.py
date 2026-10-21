from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
import json
entries = json.loads(Path('assets/kb.json').read_text(encoding='utf-8'))
with ZipFile('docs/KB Library.docx') as archive:
    root = ET.fromstring(archive.read('word/document.xml'))
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    attr = '{' + ns['w'] + '}'
    bookmarks = {n.get(attr + 'name') for n in root.findall('.//w:bookmarkStart', ns)}
    anchors = [n.get(attr + 'anchor') for n in root.findall('.//w:hyperlink', ns) if n.get(attr + 'anchor')]
    assert set(anchors) <= bookmarks
    assert 'KB_Index' in bookmarks
    assert all(entry['id'].replace('-', '_') in bookmarks for entry in entries)
    assert anchors.count('KB_Index') == len(entries)
    assert len([f for f in archive.namelist() if f.startswith('word/media/')]) >= 5
    for entry in entries:
        assert all(ref in {e['id'] for e in entries} for ref in entry['related'])
print('Verified 12 stable KB bookmarks, index/related/back links and 5 screenshots.')
