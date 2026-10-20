'use strict';
for(const button of document.querySelectorAll('[data-action]'))button.addEventListener('click',()=>window.padlockTray.action(button.dataset.action).catch(()=>{}));
