let providerSetup={};
const oauthProviderNames={youtube:'YouTube',twitch:'Twitch',kick:'Kick'};
function providerSettings(){
  const card=panel('Provider sign-in','Configure your developer apps on this device. Values are encrypted locally and are never included in app releases or GitHub.');const body=el('div','form-body');
  for(const [id,label] of Object.entries(oauthProviderNames)){
    const row=el('div','account-row');const details=el('div','details');details.append(el('strong','',label),el('small','',providerSetup[id]?.configured?'Local OAuth configuration saved':'Not configured on this device'));row.append(details,button('Configure',()=>configureProvider(id)));
    if(id==='youtube')row.append(button('Import Google JSON',()=>task(async()=>{const result=await call('importGoogleClient');if(!result.cancelled){providerSetup=result;render();notice('Google Desktop client imported into encrypted local storage. The source JSON was not copied into the project.');}})));
    row.append(button('Remove',()=>task(async()=>{providerSetup=await call('removeOAuthClient',id);render();notice('Local client configuration removed. Disconnect accounts separately to remove their authorization and data.');})));body.append(row);
  }
  body.append(el('p','data-note','Use your own developer apps for local testing. Do not embed confidential client secrets in a distributed desktop build. Twitch/Kick confidential clients need a protected server for a shared consumer sign-in service; this beta keeps configuration per device.'));
  card.append(body);$('#content').append(card);
  const legal=panel('Privacy and account data','Review the draft policies and your deletion options. Operator/contact details and public release review are still pending.');const documents=el('div','form-body');documents.append(button('Terms of Service',()=>openLegalDocument('terms')),button('Privacy Policy',()=>openLegalDocument('privacy')),button('Delete my data',()=>openLegalDocument('deletion')));legal.append(documents);$('#content').append(legal);
}
function configureProvider(id){
  dashboardModal('Configure '+oauthProviderNames[id],body=>{
    body.append(el('p','data-note',id==='youtube'?'Create a Google OAuth client of type Desktop app, enable YouTube Data API v3 and YouTube Analytics API, and add your Google account as a test user while the consent screen is in Testing. You can import the downloaded Desktop client JSON instead.':'Register the callback URL below exactly in your developer app. Only channel identity and read-only analytics permissions are requested.'));
    const clientId=field('Client ID — stored locally only','oauth-client-id','password');const secret=field('Client secret — stored locally only','oauth-client-secret','password',id==='youtube'?'Use the Desktop client secret supplied by Google, if present.':'Enter the replacement secret from the provider dashboard.');
    const redirect=field('Registered callback URL','oauth-redirect','url','The app listens only on your own computer, at this loopback address.');redirect.querySelector('input').value=providerSetup[id]?.redirectUri||'http://127.0.0.1:43821/oauth/callback';
    const clientInput=clientId.querySelector('input'),secretInput=secret.querySelector('input'),redirectInput=redirect.querySelector('input');clientInput.required=true;secretInput.required=id!=='youtube';for(const input of [clientInput,secretInput]){input.autocomplete='off';input.spellcheck=false;}body.append(clientId,secret,redirect);return {clientInput,secretInput,redirectInput};
  },async fields=>{providerSetup=await call('saveOAuthClient',{platform:id,clientId:fields.clientInput.value,clientSecret:fields.secretInput.value,redirectUri:fields.redirectInput.value});fields.clientInput.value='';fields.secretInput.value='';render();notice('Provider configuration saved to encrypted local storage. It is never returned to the page or committed to GitHub.');},'Save locally');
}
function openOAuthDialog(p){
  dashboardModal('Sign in to '+p.name,body=>{
    body.append(el('p','',p.id==='youtube'?'Read your YouTube channel totals and 28-day analytics report, including views, likes, watch minutes and subscriber changes. Google may report analytics with a delay. No YouTube publishing permission is requested.':'Read your channel identity and available follower/viewer statistics. No chat, moderation or publishing permission is requested.'));
    body.append(el('p','privacy','Sign-in opens in your system browser. Tokens and local client configuration are encrypted on this device. Cached metrics and dashboards stay local. Disconnecting removes the account’s cached data and attempts to revoke its token.'));
    if(!providerSetup[p.id]?.configured)body.append(el('p','warning','Configure this provider in Settings → Provider sign-in before continuing.'));
    body.append(button('Read Privacy Policy',()=>openLegalDocument('privacy')),button('Read Terms',()=>openLegalDocument('terms')));
    if(p.id==='youtube'){body.append(button('Google Privacy Policy',()=>call('openLegalLink','googlePrivacy')),button('YouTube Terms',()=>call('openLegalLink','youtubeTerms')));}
    const label=el('label','target');const consent=el('input');consent.type='checkbox';consent.required=true;label.append(consent,el('span','','I agree to the Terms of Service (including applicable YouTube Terms), have reviewed the draft Privacy Policy and consent to the local data use described above. Public release policy details are still pending.'));body.append(label);
    body.append(button('Configure provider',()=>{document.querySelector('.dashboard-dialog')?.close();configureProvider(p.id);}),button('Advanced: use an access token',()=>{document.querySelector('.dashboard-dialog')?.close();openTokenConnect(p);}));return consent;
  },async()=>{state=await call('oauthConnect',p.id);render();notice(p.name+' connected through browser sign-in.');},'Continue in browser');
}
function openConnect(p){if(oauthProviderNames[p.id])openOAuthDialog(p);else openTokenConnect(p);}
async function openLegalDocument(key){try{const content=await call('legalDocument',key);const dialog=el('dialog','legal-dialog');const title=el('h2','',key==='terms'?'Terms of Service':key==='privacy'?'Privacy Policy':'Data deletion');const text=el('pre','legal-text',content);const close=button('Close',()=>dialog.close(),'primary');dialog.append(title,text,close);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();close.focus();}catch(error){notice(error.message);}}
