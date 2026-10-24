'use strict';
(() => {
  const labels = { total:'Stored records', short:'Short login passwords (<12)', reused:'Logins sharing a password', due:'Update reminders due', flagged:'Manually reported breaches' };
  const node = (tag,text,className) => { const value=document.createElement(tag); if(text!=null)value.textContent=text;if(className)value.className=className;return value; };
  function mount(parent,api) {
    let disposed=false;const panel=node('section',null,'panel'),status=node('p','Calculating on this device…');panel.append(node('h3','Your security widgets'),status);parent.append(panel);
    (async()=>{
      const [audit,settings]=await Promise.all([api('audit'),api('settings')]);if(disposed||!audit||!settings)return;
      const widgets=node('div',null,'summary'), choices=node('div',null,'generator-options'),inputs={};
      for(const [key,label] of Object.entries(labels)){const item=node('label',null,'check'),input=node('input');input.type='checkbox';input.checked=(settings.dashboardWidgets||Object.keys(labels)).includes(key);inputs[key]=input;item.append(input,document.createTextNode(label));choices.append(item);}
      const draw=()=>{widgets.replaceChildren();for(const [key,input] of Object.entries(inputs))if(input.checked){const card=node('div',null,'stat');card.append(node('small',labels[key]),node('strong',audit[key]));widgets.append(card);}};
      for(const input of Object.values(inputs))input.onchange=draw;
      const save=node('button','Save widget choices');save.type='button';save.onclick=async()=>{save.disabled=true;try{const latest=await api('settings');await api('settings',{...latest,dashboardWidgets:Object.keys(inputs).filter(key=>inputs[key].checked)});if(!disposed)status.textContent='Widget choices saved on this device.';}catch(e){if(!disposed)status.textContent=e.message;}finally{save.disabled=false;}};
      status.textContent='Local checks only. Short/reused passwords are health signals, not proof of a breach. Red breach flags are reports you enter; no dark-web or online monitoring is running.';
      panel.append(widgets,choices,save);draw();
      if(audit.history?.length){const history=node('section',null,'panel');history.append(node('h3','Daily local snapshots'),node('p','Last recorded state for each UTC day you changed this vault. Days without changes have no new measurement.'));
        const table=node('table'),head=node('tr');for(const label of ['Date','Records','Short','Reused','Reported'])head.append(node('th',label));table.append(head);
        for(const item of audit.history.slice(-14)){const row=node('tr');for(const value of [item.date,item.total,item.short,item.reused,item.flagged])row.append(node('td',value));table.append(row);}history.append(table);parent.append(history);}
    })().catch(error=>{if(!disposed)status.textContent=error.message;});
    return()=>{disposed=true;};
  }
  window.safeDashboard={mount};
})();
