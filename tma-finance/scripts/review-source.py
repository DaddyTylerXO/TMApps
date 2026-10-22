"""Redacted source-only publishing check; never inspect user profiles or caches."""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
files = subprocess.check_output([
    'rg', '--files', '--hidden', '-g', '!.git', '-g', '!node_modules',
    '-g', '!.cache', '-g', '!release', '-g', '!.desktop-test-data*'
], cwd=root, text=True).splitlines()
patterns = {
    'private key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'GitHub token': r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})',
    'cloud credential': r'\bAKIA[A-Z0-9]{16}\b',
    'provider secret': r'\bsk-[A-Za-z0-9_-]{32,}',
}
findings = []
for name in files:
    path = root / name
    if path.suffix.lower() in {'.png', '.ico'}:
        continue
    content = path.read_text(encoding='utf-8')
    for label, pattern in patterns.items():
        if re.search(pattern, content):
            findings.append((name, label))
for name, label in findings:
    print(f'REVIEW REQUIRED: {name}: {label} (value redacted)')
print(f'Reviewed {len(files)} source files; {len(findings)} findings. Caches, profiles and release outputs excluded.')
sys.exit(bool(findings))
