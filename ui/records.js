'use strict';
(() => {
  const $ = id => document.getElementById(id); let api, currentState, saved, record, kind, revision = 0, dirty = false;
  function clear() { revision++; $('record-form').reset(); record = null; for (const id of ['record-secret','record-number','record-cvv']) { $(id).value = ''; $(id).type = 'password'; } }
  async function edit(type, entry) {
    clear(); const epoch = revision; record = entry || null; kind = type; dirty = !entry;
    $('record-expiryDays').value = entry?.expiryDays || 0;
    $('record-heading').textContent = `${entry ? 'Edit' : 'Add'} ${kind === 'api' ? 'API credential' : 'card'}`; $('record-user-label').textContent = kind === 'api' ? 'Email' : 'Cardholder name';
    $('api-fields').hidden = kind !== 'api'; $('card-fields').hidden = kind !== 'card'; $('record-title').value = entry?.title || ''; $('record-user').value = entry?.username || ''; $('record-clientId').value = entry?.clientId || ''; $('record-notes').value = entry?.notes || '';
    $('record-breached').checked = entry?.breached === true; $('record-breachSource').value = entry?.breachSource || ''; $('record-delete').hidden = !entry;
    $('record-error').textContent = ''; $('record-folder').replaceChildren();
    for (const folder of [{id:'',name:'No folder'},...(currentState()?.folders || [])]) { const option = document.createElement('option'); option.value = folder.id; option.textContent = folder.name; $('record-folder').append(option); } $('record-folder').value = entry?.folderId || '';
    $('record-dialog').showModal(); $('record-title').focus();
    if (entry && kind === 'card') try { const value = JSON.parse(await api('reveal',entry.id)); if (epoch !== revision || !$('record-dialog').open) return; $('record-number').value = value.number; $('record-expiry').value = value.expiry; $('record-cvv').value = value.cvv; } catch(e) { if (epoch === revision) $('record-error').textContent = e.message; }
  }
  function bind(fn, getState, onSaved) {
    api = fn; currentState = getState; saved = onSaved;
    $('add-api').onclick = () => edit('api'); $('add-card').onclick = () => edit('card'); $('record-cancel').onclick = () => $('record-dialog').close();
    $('record-dialog').addEventListener('close',clear); window.addEventListener('safe-locked',clear); window.addEventListener('blur',() => { revision++; });
    $('record-delete').onclick = async () => { try { if (!record) return; const result = await api('remove',record.id); $('record-dialog').close(); saved(result); } catch(e) { $('record-error').textContent = e.message; } };
    $('record-secret').oninput = () => { dirty = true; };
    document.querySelector('[data-eye="record-secret"]').addEventListener('click',async event => {
      if (!record || dirty || $('record-secret').value) return;
      event.stopImmediatePropagation(); const epoch = revision, toggle = event.currentTarget;
      try { const value = await api('reveal',record.id); if (epoch !== revision || !$('record-dialog').open) return; $('record-secret').value = value; toggle.click(); }
      catch(e) { if (epoch === revision) $('record-error').textContent = e.message; }
    },true);
    $('record-form').onsubmit = async event => {
      event.preventDefault(); const submit = event.submitter; if (submit) submit.disabled = true;
      try {
        const password = kind === 'card' ? JSON.stringify({number:$('record-number').value,expiry:$('record-expiry').value,cvv:$('record-cvv').value}) : record && !dirty ? null : $('record-secret').value;
        const result = await api('put',{id:record?.id,kind,title:$('record-title').value,username:$('record-user').value,clientId:$('record-clientId').value,password,url:'',notes:$('record-notes').value,breached:$('record-breached').checked,breachSource:$('record-breachSource').value,folderId:$('record-folder').value,expiryDays:kind === 'api' ? Number($('record-expiryDays').value) : 0});
        $('record-dialog').close(); saved(result);
      } catch(e) { $('record-error').textContent = e.message; } finally { if (submit) submit.disabled = false; }
    };
  }
  window.safeRecords = { bind, edit };
})();
