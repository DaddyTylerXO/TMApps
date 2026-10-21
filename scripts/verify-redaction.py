"""Independent pypdf checks of the synthetic MuPDF redaction outputs."""
from pathlib import Path
from pypdf import PdfReader

base = Path(__file__).resolve().parents[1] / '.qa' / 'formats'
source = PdfReader(base / 'redaction-source.pdf')
redacted = PdfReader(base / 'redacted.pdf')
assert 'New PDF document' in source.pages[0].extract_text()
assert 'New PDF document' not in redacted.pages[0].extract_text()
image_source = PdfReader(base / 'image-redaction-source.pdf')
image_redacted = PdfReader(base / 'image-redacted.pdf')
assert len(image_source.pages[0].images) > 0
assert len(image_redacted.pages[0].images) == 0
assert 'Synthetic sensitive text' not in image_redacted.pages[0].extract_text()
print('Independent pypdf checks passed: redacted text and touched image removed.')
