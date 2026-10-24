"""Redacted high-confidence credential scan; supplements manual artifact review.

Scan tracked working files and optional outgoing history. DOCX XML is inspected,
not binary image pixels; screenshots require visual review with fictional data.
"""
import re, subprocess, sys, io, zipfile
from pathlib import Path
rules={
 'GitHub credential':rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b',
 'AWS access key':rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
 'Private key material':rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----',
 'Provider credential':rb'\b(?:sk-proj-[A-Za-z0-9_-]{30,}|xox[baprs]-[A-Za-z0-9-]{30,})\b',
}
findings=[];count=0
def scan(label,data):
 global count
 count+=1
 if label.lower().endswith('.docx'):
  try:
   with zipfile.ZipFile(io.BytesIO(data)) as z:
    for name in z.namelist():
     if name.endswith(('.xml','.rels')):scan(label+'!'+name,z.read(name))
  except zipfile.BadZipFile:findings.append((label,'Invalid DOCX archive'))
  return
 if not label.endswith('.asar') and b'\0' in data[:8192]:return
 for name,pattern in rules.items():
  if re.search(pattern,data):findings.append((label,name))
paths=subprocess.check_output(['git','ls-files','-z']).decode().split('\0')
for name in filter(None,paths):
 p=Path(name)
 if p.is_file():scan(name,p.read_bytes())
if '--packages' in sys.argv:
 packages=list(Path('dist').glob('**/app.asar'))
 if not packages:raise SystemExit('No packaged app.asar found')
 for p in packages:scan(str(p),p.read_bytes())
if len(sys.argv)>1 and sys.argv[1]!='--packages':
 for sha in subprocess.check_output(['git','rev-list',sys.argv[1]+'..HEAD']).decode().split():
  names=subprocess.check_output(['git','diff-tree','--root','--no-commit-id','--name-only','-r',sha]).decode().splitlines()
  for name in names:
   r=subprocess.run(['git','show',sha+':'+name],capture_output=True)
   if r.returncode==0:scan(sha[:8]+':'+name,r.stdout)
for label,rule in findings:print('REVIEW REQUIRED:',label,'[',rule,'] [value redacted]')
print('Scanned',count,'tracked document/text parts; findings:',len(findings))
if findings:sys.exit(1)
