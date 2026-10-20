'use strict';
const api=window.padlock,$=id=>document.getElementById(id);let state,entries=[],hidden=false,verified='',busy=false,epoch=0;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const notice=text=>$('notice').textContent=text;
async function run(job){try{return await job();}catch(e){notice(e.message);}}
function value(){return{name:$('name').value,secret:$('secret').value,type:$('type').value,algorithm:$('algorithm').value,digits:Number($('digits').value),period:Number($('period').value),counter:Number($('counter').value)};}
function resetVerify(){verified='';$('save').disabled=true;$('matched').checked=false;$('preview').textContent='Verify to preview your first code.';}
function closeEditor(){$('editor').close();$('add-form').reset();resetVerify();$('editor-error').textContent='';}
function add(){if(!state?.unlocked){notice('Unlock your vault to add an authenticator.');return;}$('add-form').reset();resetVerify();$('editor-error').textContent='';$('editor').showModal();$('name').focus();}
function button(text,fn){const n=el('button',text);n.type='button';n.onclick=()=>run(fn);return n;}
function render(){
  $('count').textContent=entries.length;$('cards').replaceChildren();const term=$('search').value.toLowerCase(),filtered=entries.filter(e=>(e.name+' '+e.issuer).toLowerCase().includes(term));$('empty').hidden=entries.length>0;
  for(const e of filtered){const card=el('article',undefined,'auth-card'),icon=el('div',e.name.slice(0,1).toUpperCase(),'account-icon'),info=el('div',undefined,'account-info'),actions=el('div',undefined,'card-actions');info.append(el('h2',e.name),el('small',e.issuer|| (e.type==='totp'?'Time-based authenticator':'Counter-based authenticator')));const digits=el('div',undefined,'code');for(const ch of (hidden?'•'.repeat(e.digits):e.code))digits.append(el('span',ch));info.append(digits);
    card.dataset.id=e.id;const time=el('div',undefined,'time');time.append(el('strong',e.type==='totp'?e.remaining+'s':'#'+e.counter),el('small',e.type==='totp'?'until refresh':'current counter'));
    const copy=button('Copy code',async()=>{await api.copy(e.id);notice('Code copied. Clipboard clears in 20 seconds.');});copy.className='primary';actions.append(copy);
    if(e.type==='hotp')actions.append(button('Next code →',async()=>{if(confirm('Advance the counter? Only do this after using the current code.')){entries=await api.advance(e.id);render();}}));
    const menu=el('details'),summary=el('summary','•••');summary.setAttribute('aria-label',e.name+' options');const options=el('div',undefined,'menu-items');options.append(button('Rename',async()=>{const name=prompt('Authenticator name',e.name);if(name!==null){entries=await api.rename({id:e.id,name});render();}}),button('Delete authenticator',async()=>{entries=await api.remove(e.id);render();}));menu.append(summary,options);actions.append(menu);card.append(icon,info,time,actions);$('cards').append(card);
  }
  if(entries.length&&!filtered.length)$('cards').append(el('p','No authenticators match your search.'));
}
async function refresh(){const generation=epoch;const s=await api.status();if(generation!==epoch)return;state=s;$('gate').hidden=s.unlocked;$('workspace').hidden=!s.unlocked;$('lock').disabled=!s.unlocked;$('backup').disabled=!s.unlocked;
  $('mode-label').hidden=s.exists;$('confirm-label').hidden=s.exists;$('restore').hidden=s.exists;$('mode').querySelector('[value=device]').disabled=!s.deviceAvailable;
  $('gate-title').textContent=s.exists?'Welcome back.':'Welcome to Padlock';$('gate-copy').textContent=s.exists?'Unlock your private space to see your codes.':'Keep your verification codes encrypted on this device.';$('unlock').textContent=s.exists?'Unlock my vault →':'Create my vault →';
  const mode=s.exists?s.mode:$('mode').value;$('password-label').hidden=mode==='device';$('confirm-label').hidden=s.exists||mode==='device';$('gate-note').textContent=mode==='password'?'Keep your master password safe. There is no password reset.':'Device protection is tied to this OS account. Use a master password for portable backups.';
  $('protection').textContent='● '+(s.exists?(s.mode==='password'?'Master-password protected':'Device-key protected'):'Local & encrypted');
  if(s.unlocked){const list=await api.list();if(generation!==epoch)return;entries=list;render();}else{entries=[];$('cards').replaceChildren();$('count').textContent='0';}
}
window.refreshPadlock=refresh;
api.onLock(()=>{epoch++;state={...state,unlocked:false};entries=[];closeEditor();$('password').value='';$('confirm').value='';$('cards').replaceChildren();$('workspace').hidden=true;$('gate').hidden=false;run(refresh);});
for(const id of ['add','add-side','add-empty'])$(id).onclick=add;
$('mode').onchange=()=>run(refresh);$('all').onclick=()=>{$('search').value='';render();};$('search').oninput=render;
$('hide').onclick=()=>{hidden=!hidden;$('hide').textContent=hidden?'◉ Show codes':'◉ Hide codes';render();};$('lock').onclick=()=>run(()=>api.lock());
$('backup').onclick=()=>run(async()=>{if(await api.backup())notice('Encrypted backup saved. Keep your master password separately.');});
$('restore').onclick=()=>run(async()=>{if(await api.restore()){notice('Backup restored. Enter its master password.');await refresh();}});
$('security').onclick=()=>alert('Your vault stays on this device.\n\nMaster password: scrypt + AES-256-GCM encryption; no password reset.\nDevice key: OS account protection; not a portable backup.\n\nAuto-lock: 5 minutes of inactivity, screen lock, or suspend. Codes clear from the clipboard after 20 seconds.\n\nKeep service recovery codes elsewhere. A compromised device can still read an unlocked vault. Standard TOTP/HOTP only; proprietary Steam and Battle.net enrollment is not included. QR images are not imported; use the manual setup key or otpauth URL.');
$('unlock-form').onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;$('unlock').disabled=true;try{if(state.exists)await api.unlock($('password').value);else await api.create({mode:$('mode').value,password:$('password').value,confirm:$('confirm').value});$('password').value='';$('confirm').value='';notice('Your vault is unlocked.');await refresh();}catch(e){notice(e.message);}finally{busy=false;$('unlock').disabled=false;}};
$('cancel').onclick=closeEditor;$('editor').addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
$('add-form').addEventListener('input',event=>{if(event.target.id==='matched'){$('save').disabled=!$('matched').checked||!verified;}else resetVerify();});
$('verify').onclick=async()=>{try{const v=value(),preview=await api.verify(v);verified=JSON.stringify(v);$('preview').textContent=preview.code+' · '+preview.name;$('editor-error').textContent='Compare this with your service before adding.';}catch(e){$('editor-error').textContent=e.message;}};
$('add-form').onsubmit=async event=>{event.preventDefault();if(busy)return;try{const v=value();if(verified!==JSON.stringify(v)||!$('matched').checked)throw Error('Verify and confirm your code first.');busy=true;$('save').disabled=true;entries=await api.add(v);closeEditor();render();notice('Authenticator added.');}catch(e){$('editor-error').textContent=e.message;}finally{busy=false;}};
let last=0;for(const name of ['pointerdown','keydown'])document.addEventListener(name,()=>{if(Date.now()-last>10000){last=Date.now();run(()=>api.activity());}});
setInterval(()=>{if(state?.unlocked&&!busy&&!$('editor').open){const generation=epoch;api.list().then(list=>{if(generation===epoch){entries=list;for(const card of document.querySelectorAll('.auth-card')){const e=entries.find(e=>e.id===card.dataset.id);if(!e)continue;const text=hidden?'•'.repeat(e.digits):e.code;card.querySelectorAll('.code span').forEach((n,i)=>n.textContent=text[i]);card.querySelector('.time strong').textContent=e.type==='totp'?e.remaining+'s':'#'+e.counter;}}}).catch(()=>run(refresh));}},1000);
run(refresh);
