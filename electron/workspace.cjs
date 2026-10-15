const fs=require('node:fs');
const path=require('node:path');
function inside(root,target) {const relative=path.relative(root,target);return relative==='' || (!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
function resolveWithin(root,name) {
  if(typeof name!=='string'||name.length>2000||name.includes('\0'))throw new Error('Use a valid workspace path.');
  const canonicalRoot=fs.realpathSync(root); const target=path.resolve(canonicalRoot,name || '.');
  if(!inside(canonicalRoot,target))throw new Error('Path is outside the selected work folder.');
  let existing=target;
  for(;;){try{fs.lstatSync(existing);break;}catch(error){if(error.code!=='ENOENT')throw error;const parent=path.dirname(existing);if(parent===existing)throw new Error('Cannot resolve workspace path.');existing=parent;}}
  if(!inside(canonicalRoot,fs.realpathSync(existing)))throw new Error('This link leads outside the selected work folder.');
  return {root:canonicalRoot,target,relative:path.relative(canonicalRoot,target)};
}
function workspaceTool(root,name,args) {
  const resolved=resolveWithin(root,args.path ?? '');
  if(name==='workspace_list') {
    const entries=fs.readdirSync(resolved.target,{withFileTypes:true});
    return {path:resolved.relative || '.',entries:entries.slice(0,200).map(e=>({name:e.name,kind:e.isSymbolicLink()?'link':e.isDirectory()?'folder':'file'})),total:entries.length,truncated:entries.length>200};
  }
  if(name==='workspace_read') {
    const info=fs.statSync(resolved.target);if(!info.isFile()||info.size>200000)throw new Error('Read a text file of at most 200 KB.');
    const bytes=fs.readFileSync(resolved.target);if(bytes.includes(0))throw new Error('This is a binary file. Use its assigned ArtCraft app to inspect it.');
    return {path:resolved.relative,content:bytes.toString('utf8')};
  }
  if(name==='workspace_write') {
    if(typeof args.content!=='string'||Buffer.byteLength(args.content)>200000)throw new Error('Write at most 200 KB of text per file.');
    if(!resolved.relative)throw new Error('Choose a file inside the work folder.');
    fs.mkdirSync(path.dirname(resolved.target),{recursive:true});
    resolveWithin(root,resolved.target);fs.writeFileSync(resolved.target,args.content,'utf8');
    return {path:resolved.relative,bytes:Buffer.byteLength(args.content),written:true};
  }
  throw new Error('Unknown workspace tool.');
}
module.exports={inside,resolveWithin,workspaceTool};
