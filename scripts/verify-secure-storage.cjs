const {app,safeStorage}=require('electron');
app.whenReady().then(()=>{
  try{
    if(!safeStorage.isEncryptionAvailable())throw new Error('Windows encrypted storage is unavailable.');
    const marker='Agent Office encryption self-test';const encrypted=safeStorage.encryptString(marker);
    if(safeStorage.decryptString(encrypted)!==marker)throw new Error('Encrypted storage round trip failed.');
    console.log('Windows encrypted storage round trip verified. No API key was read or written.');app.exit(0);
  }catch(error){console.error(error.message);app.exit(1);}
});
