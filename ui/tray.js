'use strict';
document.querySelectorAll('button').forEach(button => button.onclick = () => window.trayMenu.action(button.dataset.action));
document.addEventListener('keydown', event => { if (event.key === 'Escape') window.trayMenu.action('dismiss'); });
