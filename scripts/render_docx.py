"""Render the checked-in Word KB in an isolated CI tool environment."""
from pathlib import Path
import subprocess
import tempfile
import sys

source = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='socials-kb-lo-') as profile:
    subprocess.run(['/usr/bin/libreoffice', '-env:UserInstallation=' + Path(profile).as_uri(), '--headless', '--convert-to', 'pdf', '--outdir', str(output), str(source)], check=True, timeout=120)
pdf = output / (source.stem + '.pdf')
if not pdf.exists():
    raise RuntimeError('Document rendering did not produce a PDF')
subprocess.run(['/usr/bin/pdftoppm', '-png', '-r', '120', str(pdf), str(output / 'page')], check=True, timeout=120)
pages = list(output.glob('page-*.png'))
if not pages:
    raise RuntimeError('No rendered pages')
print(f'Rendered {len(pages)} KB pages')
