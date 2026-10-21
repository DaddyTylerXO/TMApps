"""Build the versioned Word KB using the bundled Python runtime (python-docx)."""
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
qa = root / 'artifacts' / 'kb'
qa.mkdir(parents=True, exist_ok=True)
logo = Image.new('RGB', (96, 96), '#97572B')
draw = ImageDraw.Draw(logo)
draw.rectangle((18, 27, 45, 42), fill='white')
draw.rectangle((18, 36, 78, 75), fill='white')
logo.save(qa / 'logo.png')

d = Document()
s = d.sections[0]
s.page_width, s.page_height = Inches(8.27), Inches(11.69)
s.top_margin, s.bottom_margin = Inches(.8), Inches(.7)
s.left_margin = s.right_margin = Inches(.8)
s.header_distance = s.footer_distance = Inches(.35)
for style in ['Normal', 'Title', 'Subtitle', 'Heading 1', 'Heading 2']:
    d.styles[style].font.name = 'Calibri'
    d.styles[style].font.color.rgb = RGBColor(0, 0, 0)
d.styles['Normal'].font.size = Pt(11)
d.styles['Normal'].paragraph_format.space_after = Pt(7)
d.styles['Title'].font.size = Pt(25)
d.styles['Heading 1'].font.size = Pt(19)
d.styles['Heading 2'].font.size = Pt(13)
header = s.header.paragraphs[0]
header.add_run().add_picture(str(qa / 'logo.png'), width=Inches(.28))
header.add_run('  TMA-Libraries').bold = True
footer = s.footer.paragraphs[0]
footer.add_run('TMA-Libraries  |  0.1.0  |  Libraries-KB1 to Libraries-KB4  |  Page ')
field = OxmlElement('w:fldSimple'); field.set(qn('w:instr'), 'PAGE'); footer._p.append(field)

def p(text): d.add_paragraph(text)
def h(text): d.add_heading(text, 2)
def article(code, title):
    d.add_heading(code + '  ' + title, 1)

d.add_paragraph('TMA-Libraries KB Library', 'Title')
p('Windows desktop edition 0.1.0 • 21 October 2026')
p('This library explains the first desktop build: offline notes, checklists, organisation, saving, recovery and settings. Advanced document editors are still in development.')
p('Master KB reference: the TMApps master KB document location has not yet been confirmed. Use the main repository for project information: https://github.com/DaddyTylerXO/TMApps. The master KB document link and publication remain pending.')
article('Libraries-KB1', 'Start and organise your work')
p('Run TMA-Libraries.exe from the build folder on Windows with .NET Framework 4.8. First-time setup offers larger text, high contrast and a feature tour. The optional text and contrast settings start off. No account or paid subscription is required.')
d.add_picture(str(root / 'build' / 'desktop-smoke.png'), width=Inches(6.6))
p('Choose New document, then Create note or Create checklist. Use New folder to create a folder, then choose it in the document editor. Select Favourite for quick access. Enter comma-separated tags to add coloured labels. Search finds titles, note text, checklist text and tags.')
p('Recent documents lists the last 30 opened documents. Side notes stores extra comments separately from the main text. A checklist has individual completion boxes and an optional progress indicator. Use Tab and Shift+Tab to move between controls and Space to toggle a focused checkbox.')

d.add_page_break()
article('Libraries-KB2', 'Save export and work offline')
h('Local storage and autosave')
p('Notes, checklists, folders, favourites, tags, recent documents, side notes, appearance settings, saving, importing, exporting and the feature tour work offline. The Word KB opens offline when a DOCX viewer is installed. Visiting GitHub requires an internet connection.')
p('The live workspace is stored under %LOCALAPPDATA%\\TMApps\\TMA-Libraries\\workspace.json in your Windows user profile. This build has no account login, cloud sync, telemetry or background network checks. Workspace files and exports are unencrypted. Use Windows account protection and keep copies private.')
p('Press Ctrl+S to save immediately. Autosave is on by default and saves changed work every 5 seconds. In Settings, change the interval from 2 to 300 seconds or turn autosave off. Closing the window attempts to save changes; if saving fails, closing is cancelled so you can retry or export.')
h('Recovery and longer retention')
p('A completed save replaces the primary file atomically. workspace.json.bak retains the previous saved workspace. A partial temporary write does not replace the committed file. When the primary cannot be read, Libraries tries the backup and displays a recovery notice. Changes after the previous save may be lost. If both copies fail, startup stops; it does not start with an empty replacement.')
p('The previous-save backup is not long-term version history. Repeated saves replace it. Use Export copy regularly and keep separate dated copies on a private disk. This build does not offer encryption, timed backup retention or document version history.')
h('Import and export')
p('Export copy writes all documents, folders and basic settings to a .tmalibrary file. It includes unsaved changes currently in memory. Open from location imports documents and folders from a .tmalibrary copy. Imported documents receive new IDs; existing documents are preserved. Existing app settings are retained. Importing the same copy twice creates duplicate documents.')
p('The complete import is validated before being added. Conflicting folder names differing only by case are rejected. Exporting and importing .tmalibrary files has a representative exact round-trip check. This is the only supported interchange format in 0.1.0; DOCX, XLSX, PDF, PPTX and plain-text file import/export are not supported.')
h('Limits')
p('Workspace files are limited to 16 MiB, 10,000 documents and 1,000 folders. Notes allow up to 2,000,000 characters, side notes 200,000 characters and checklists 10,000 items. These validation limits are safeguards, not a claim that the desktop UI has been tested at every limit. The measured workload used 1,000 synthetic 4 KiB notes.')

d.add_page_break()
article('Libraries-KB3', 'Resolve errors and recover safely')
h('E001  Startup or workspace recovery failed')
p('Close other Libraries windows. Check free disk space and your Windows user access to the local storage folder in Libraries-KB2. Before attempting repairs, copy workspace.json and workspace.json.bak to a private recovery folder. Do not delete the originals or replace them with a blank workspace. If the app recovers the previous save automatically, review documents for missing recent changes.')
h('E002  Save failed')
p('Keep the application open so changes remain in memory. Check disk space and folder access, then press Ctrl+S again. Another program may have locked the saved file. Export a copy to another private writable location if the main save still fails. Do not close the app until you have a verified save or export.')
h('E003  Import failed')
p('Use a .tmalibrary export from the same app version. Check that it is no larger than 16 MiB and can be read from its current location. A corrupt file, unsupported schema, invalid document or case-conflicting folder can prevent import. No documents are added by a validation failure. Keep the source copy for recovery; do not hand-edit its data.')
h('E004  Export failed')
p('Choose a writable local folder with enough free space. Avoid files locked by another program. Retry Export copy, then verify the saved copy by importing into a separate test Windows profile if needed. Importing into your active workspace will add duplicate copies of the exported documents.')
h('KB viewer unavailable')
p('Install a free DOCX viewer, such as LibreOffice, if Windows has no app associated with Word documents. Keep the docs folder beside the executable; rebuild the application if the Word KB file is missing.')
h('Report a persistent problem')
p('Record the error code, app version 0.1.0, Windows version and steps to reproduce using synthetic text. Do not include passwords, document contents, private paths or workspace files. The app sends no crash report automatically. App-specific GitHub form destinations are awaiting verification; use the confirmed repository branch for project information until those settings buttons are implemented. Review any public issue text and attachments yourself before submitting.')

d.add_page_break()
article('Libraries-KB4', 'Settings performance and release notes')
h('Appearance and accessibility')
p('Settings offers Light, Grey and Black themes, larger text and high contrast. Optional adjustments are offered during setup and can be changed later. Baseline labelled controls and keyboard access remain available. Screen reader behaviour and full magnification support need further verification. Scheduled gradual colour transitions are not implemented.')
h('Performance controls')
p('Short autosave intervals increase disk and CPU use because each save serialises the complete workspace. A longer interval reduces save frequency but increases the amount of recent work at risk before a save. Autosave does nothing when the workspace has no changes. Search runs locally on the UI thread; large bodies can slow typing. Break large collections into separate exported workspaces while scale testing is developed.')
p('Storage checks include Unicode text, metadata, checklists, native-format round trips, failed replacement, corrupt-primary recovery and invalid imports. A synthetic 1,000-note workload is recorded in docs/VERIFICATION-0.1.0.md. Resource measurements are local observations and are not performance guarantees on other computers.')
h('Keyboard shortcuts')
p('Ctrl+N opens New document. Ctrl+S saves. Ctrl+F focuses document search. F1 opens the Word KB. Enter adds a checklist item when the new-item field is focused. These shortcuts are fixed in this build; configurable bindings remain pending.')
h('New features in version 0 1 0')
p('The initial build adds a native Windows desktop shell, offline plain-text notes, checklists with completion progress, folders, favourites, recent documents, coloured tags, search, side notes, local atomic saving, previous-save recovery, native workspace copies, initial setup, a replayable feature tour and appearance controls.')
h('Planned features')
p('Books, DOCX editing, CVs, cover letters, advertisements, newsletters, PDFs, scanning, spreadsheets, slideshows, dashboards, databases, creative boards, templates, branding, encryption, version history and TMApps sync remain pending. Launcher registration, TMA-Mail tray/connection patterns, notifications, support forms, KB search integration and master KB publication also remain pending. No paid service is required by this build.')
p('The full requirements remain in docs/TMAPPS-STANDARDS.md and docs/TMA-LIBRARIES-SPEC.md. Those specifications preserve requirements beyond this release.')

d.core_properties.author = 'TMApps'
d.core_properties.title = 'TMA-Libraries KB Library'
d.core_properties.subject = 'Version 0.1.0 desktop user guides and recovery'
d.save(root / 'docs' / 'TMA-Libraries KB Library.docx')
print('Created Word KB Library')
