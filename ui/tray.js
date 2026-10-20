document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>window.cut.trayAction(button.dataset.action)));
document.addEventListener('keydown',event=>{if(event.key==='Escape')window.cut.trayAction('dismiss');});
