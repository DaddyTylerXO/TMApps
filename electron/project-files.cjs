const fs=require('node:fs');const path=require('node:path');
const {resolveWithin,workspaceTool}=require('./workspace.cjs');
function jobRoot(jobs,id){const job=jobs.find(j=>j.id===id&&j.native);if(!job?.workFolder)throw new Error('This job has no saved project folder.');if(job.workspaceRoot)resolveWithin(job.workspaceRoot,job.workFolder);const root=resolveWithin(job.workFolder,'').root;if(!fs.statSync(root).isDirectory())throw new Error('The saved project folder is no longer a directory.');return root;}
async function projectFiles(jobs,id){
  const root=jobRoot(jobs,id);const entries=[];let truncated=false;
  async function walk(relative,depth){
    resolveWithin(root,relative);
    let children;try{children=await fs.promises.readdir(path.join(root,relative),{withFileTypes:true});}catch(error){if(!relative)throw error;entries.push({path:relative,kind:'unavailable',error:'Folder cannot be read.'});return;}
    children.sort((a,b)=>Number(b.isDirectory())-Number(a.isDirectory())||a.name.localeCompare(b.name));
    for(const child of children){if(entries.length>=1000){truncated=true;return;}const name=path.join(relative,child.name);let info;try{info=await fs.promises.lstat(path.join(root,name));}catch{continue;}
      const kind=info.isSymbolicLink()?'link':info.isDirectory()?'folder':'file';entries.push({path:name,name:child.name,parent:relative,kind,size:info.size,modified:info.mtimeMs});
      if(kind==='folder'){if(depth<8)await walk(name,depth+1);else truncated=true;}
    }
  }
  await walk('',0);return {root,entries,truncated,checkedAt:Date.now()};
}
function readProjectFile(jobs,id,name){if(typeof name!=='string')throw new Error('Choose a file.');return workspaceTool(jobRoot(jobs,id),'workspace_read',{path:name});}
async function openProjectFolder(jobs,id,shell){const root=jobRoot(jobs,id);const error=await shell.openPath(root);if(error)throw new Error(error);return true;}
module.exports={projectFiles,readProjectFile,openProjectFolder};
