"""Run with the bundled workspace Python. Render and inspect DOCX before release."""
import json
import re
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

root = Path(__file__).resolve().parent.parent
content = json.loads((root / 'content/experience.json').read_text())
version = json.loads((root / 'desktop/package.json').read_text())['version']
document = Document()
section = document.sections[0]
section.page_width, section.page_height = Inches(8.5), Inches(11)
section.top_margin = section.bottom_margin = Inches(.8)
section.left_margin = section.right_margin = Inches(.85)
for name in ['Normal', 'Body Text']:
    style = document.styles[name]
    style.font.name, style.font.size = 'Calibri', Pt(11)
    style.paragraph_format.space_after = Pt(8)
document.styles['Normal'].paragraph_format.line_spacing = 1.12
title = document.styles['Title']
title.font.name, title.font.size, title.font.bold = 'Calibri', Pt(27), True
title.font.color.rgb = RGBColor(0, 0, 0)
for style in document.styles:
    for border in list(style.element.findall('.//' + qn('w:pBdr'))):
        border.getparent().remove(border)
for name in ['Heading 1', 'Heading 2']:
    style = document.styles[name]
    style.font.name, style.font.size = 'Calibri', Pt(16)
    style.font.color.rgb = RGBColor.from_string('9B4300')
    style.paragraph_format.keep_with_next = True
document.add_paragraph('TMApps Launcher KB Library', 'Title')
document.add_paragraph('User guides setup and troubleshooting', 'Subtitle')
document.add_paragraph(f'Release {version}  |  21 October 2026  |  DaddyTylerXO')
document.add_paragraph('Use this library to install the launcher, manage your applications, find settings, and report problems. Each article has a stable KB number that you can type into launcher Help or settings search. Shared TMApps sign-in is prepared for deployment and requires backend configuration before activation. App support varies by operating system.')
document.add_heading('Article index', 1)
table = document.add_table(rows=1, cols=2)
table.style = 'Table Grid'
table.rows[0].cells[0].text, table.rows[0].cells[1].text = 'KB number', 'Subject'
for article in content['articles']:
    cells = table.add_row().cells
    cells[0].text, cells[1].text = article['id'], article['title']
for i, row in enumerate(table.rows):
    for cell in row.cells:
        shading = OxmlElement('w:shd')
        shading.set(qn('w:fill'), 'EDE8E2' if i == 0 else ('F5F5F5' if i % 2 else 'FFFFFF'))
        cell._tc.get_or_add_tcPr().append(shading)
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.size = Pt(10)
                run.bold = i == 0
document.add_page_break()
for article in content['articles']:
    document.add_heading(article['id'].replace('-', ' ') + ' ' + article['title'], 1)
    reference = document.add_paragraph('Reference ' + article['id'])
    reference.paragraph_format.keep_with_next = True
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', article['body'])
    parts = [' '.join(sentences[i:i + 3]) for i in range(0, len(sentences), 3)]
    for i, part in enumerate(parts):
        paragraph = document.add_paragraph(part)
        paragraph.paragraph_format.keep_with_next = i < len(parts) - 1
document.add_heading('Maintaining this library', 1)
document.add_paragraph('The in-app articles and this Word document are generated from content/experience.json. Keep each KB number stable when updating its instructions. Regenerate and visually inspect the Word document when article text changes. Deployment and app-integration details are in backend/README.md and docs/shared-profile.md on the launcher branch.')
footer = section.footer.paragraphs[0]
footer.text = 'TMApps Launcher KB Library  •  '
field = OxmlElement('w:fldSimple')
field.set(qn('w:instr'), 'PAGE')
footer._p.append(field)
document.core_properties.title = 'TMApps Launcher KB Library'
document.core_properties.author = 'DaddyTylerXO'
document.save(root / 'docs/KB Library.docx')
