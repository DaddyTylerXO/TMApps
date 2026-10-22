"""Collect installed dependency license files without including any runtime caches."""
from pathlib import Path
import importlib.metadata,json,sys
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
packages=[]
for dist in importlib.metadata.distributions():
    name=dist.metadata.get('Name','package');version=dist.version
    packages.append({'name':name,'version':version})
    for entry in dist.files or []:
        if Path(str(entry)).name.lower().startswith(('license','copying','notice')):
            source=Path(dist.locate_file(entry))
            if source.is_file():
                folder=out/(name+'-'+version);folder.mkdir(exist_ok=True)
                (folder/Path(str(entry)).name).write_bytes(source.read_bytes())
(out/'dependencies.json').write_text(json.dumps(packages,indent=2),encoding='utf-8')

python_license=Path(sys.base_prefix)/"LICENSE.txt"
if python_license.is_file():(out/"Python-LICENSE.txt").write_bytes(python_license.read_bytes())
