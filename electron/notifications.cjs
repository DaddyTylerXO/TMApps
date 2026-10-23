'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const appId='com.tmapps.padlock',clsid='{B0FFBF08-931C-4ECB-A829-4C74C15B5360}',description='Managed by Padlock desktop notifications.';
async function configure(enabled,{app,shell,platform=process.platform,env=process.env}={}){
  if(platform!=='win32'||!app.isPackaged)return;
  if(!env.APPDATA)throw Error('Windows notification registration is unavailable.');
  const file=path.join(env.APPDATA,'Microsoft','Windows','Start Menu','Programs','TMApps','TMA-Padlock Notifications.lnk');
  let exists=false;try{await fs.lstat(file);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  if(exists){const old=shell.readShortcutLink(file);if(old.appUserModelId!==appId||old.description!==description)throw Error('An existing notification shortcut must be managed in Windows.');}
  if(enabled){await fs.mkdir(path.dirname(file),{recursive:true});if(!shell.writeShortcutLink(file,'create',{target:process.execPath,description,appUserModelId:appId,toastActivatorClsid:clsid,icon:process.execPath,iconIndex:0}))throw Error('Could not register Windows notifications.');}
  else if(exists)await fs.unlink(file);
}
module.exports={configure,appId,clsid};
