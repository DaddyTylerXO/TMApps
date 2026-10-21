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
def bookmark(paragraph, name, number):
    start = OxmlElement('w:bookmarkStart')
    start.set(qn('w:id'), str(number))
    start.set(qn('w:name'), name)
    end = OxmlElement('w:bookmarkEnd')
    end.set(qn('w:id'), str(number))
    paragraph._p.insert(0, start)
    paragraph._p.append(end)

def link(paragraph, text, target):
    hyperlink = OxmlElement('w:hyperlink')
    hyperlink.set(qn('w:anchor'), target)
    run = OxmlElement('w:r')
    properties = OxmlElement('w:rPr')
    color = OxmlElement('w:color'); color.set(qn('w:val'), '9C2430')
    underline = OxmlElement('w:u'); underline.set(qn('w:val'), 'single')
    properties.append(color); properties.append(underline)
    run.append(properties)
    content = OxmlElement('w:t'); content.text = text
    run.append(content); hyperlink.append(run)
    paragraph._p.append(hyperlink)

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
bookmark(doc.add_paragraph('Article index', 'Heading 1'), 'KB_Index', 0)
for article in articles:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    link(p, article['id'] + '  ' + article['title'], article['id'].replace('-', '_'))
doc.add_page_break()

for number, article in enumerate(articles, 1):
    bookmark(doc.add_paragraph(article['id'] + ' ' + article['title'], 'Heading 1'), article['id'].replace('-', '_'), number)
    if number == 1:
        doc.add_picture(str(root / 'docs/screenshots/editing-studio.png'), width=Inches(6.8))
        caption = doc.add_paragraph('Figure 1. Editing studio with synthetic demo footage, a video overlay and an editable caption.')
        caption.runs[0].font.size = Pt(9)
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
    p = doc.add_paragraph('Related articles  ')
    for index, related in enumerate(article['related']):
        if index: p.add_run('  |  ')
        link(p, related, related.replace('-', '_'))
    p.paragraph_format.space_after = Pt(14)
    for run in p.runs:
        run.font.size = Pt(10)
    link(doc.add_paragraph(), 'Back to index', 'KB_Index')

footer = section.footer.paragraphs[0]
footer.alignment = 2
footer.add_run('TMA-Cut KB Library  |  ')
field = OxmlElement('w:fldSimple')
field.set(qn('w:instr'), 'PAGE')
footer._p.append(field)
for run in footer.runs:
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0, 0, 0)
targets = {node.get(qn('w:name')) for node in doc.element.xpath('//w:bookmarkStart')}
anchors = [node.get(qn('w:anchor')) for node in doc.element.xpath('//w:hyperlink')]
assert len(targets) == 17 and all(anchor in targets for anchor in anchors)
doc.save(root / 'docs/KB Library.docx')
print(f'Validated {len(anchors)} internal links and {len(targets)} bookmarks.')
