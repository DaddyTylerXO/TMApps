"""Build the Word KB Library using the bundled document runtime."""
import json
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

root = Path(__file__).resolve().parents[1]
articles = json.loads((root / 'docs/kb.json').read_text(encoding='utf-8'))
doc = Document()
section = doc.sections[0]
section.page_width, section.page_height = Inches(8.5), Inches(11)
section.top_margin = section.bottom_margin = Inches(.75)
section.left_margin = section.right_margin = Inches(.8)
normal = doc.styles['Normal']
normal.font.name = 'Calibri'
normal.font.size = Pt(11)
normal.font.color.rgb = RGBColor(0, 0, 0)
normal.paragraph_format.line_spacing = 1.12
normal.paragraph_format.space_after = Pt(8)
for name, size in [('Title', 28), ('Subtitle', 12), ('Heading 1', 16), ('Heading 2', 12)]:
    style = doc.styles[name]
    style.font.name = 'Calibri'
    style.font.size = Pt(size)
    style.font.color.rgb = RGBColor(0, 0, 0)
    style.paragraph_format.space_before = Pt(15 if name == 'Heading 1' else 6)
    style.paragraph_format.space_after = Pt(8)
    if name.startswith('Heading'):
        style.paragraph_format.keep_with_next = True

doc.core_properties.title = 'TMA Cut KB Library'
doc.core_properties.subject = 'User guides and setup information for TMA-Cut 0.2.0'
doc.core_properties.author = 'TMApps'
for border in doc.styles.element.xpath('.//w:pBdr'):
    border.getparent().remove(border)
doc.add_paragraph('TMA Cut KB Library', 'Title')
doc.add_paragraph('User guides and setup information', 'Subtitle')
doc.add_paragraph('Version 0.2.0  |  21 October 2026')
doc.add_paragraph('Use this library to create, edit, recover and export projects in TMA-Cut. The articles explain how local editing works, which services need setup, and where preview or analysis has limits. Find an article by its Cut-KB number in the app’s Settings search. Review generated captions, tracking and service upload drafts before publishing.')
doc.add_paragraph('Article index', 'Heading 1')
for article in articles:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(article['id'] + '  ')
    r.bold = True
    p.add_run(article['title'])
doc.add_page_break()

for article in articles:
    doc.add_paragraph(article['id'] + ' ' + article['title'], 'Heading 1')
    sentences = article['body'].split('. ')
    groups = []
    current = []
    for sentence in sentences:
        current.append(sentence)
        if len(' '.join(current)) > 380:
            groups.append('. '.join(current))
            current = []
    if current:
        groups.append('. '.join(current))
    for index, group in enumerate(groups):
        if index < len(groups)-1 and not group.endswith('.'):
            group += '.'
        doc.add_paragraph(group)
    p = doc.add_paragraph('Related articles  ' + ', '.join(article['related']))
    p.paragraph_format.space_after = Pt(14)
    for run in p.runs:
        run.font.size = Pt(10)

footer = section.footer.paragraphs[0]
footer.alignment = 2
footer.add_run('TMA-Cut KB Library  |  ')
field = OxmlElement('w:fldSimple')
field.set(qn('w:instr'), 'PAGE')
footer._p.append(field)
for run in footer.runs:
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0, 0, 0)
doc.save(root / 'docs/KB Library.docx')
