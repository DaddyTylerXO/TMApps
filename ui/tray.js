'use strict';
document.querySelectorAll('button').forEach(button => button.onclick = () => window.trayMenu.action(button.dataset.action));
document.addEventListener('keydown', event => { if (event.key === 'Escape') window.trayMenu.action('dismiss'); });

window.addEventListener('tray-appearance',event => { const value={appearance:'purple',scheduleEnabled:false,...event.detail}; const colors=window.SafeAppearance.appearance(value,new Date(),value.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches).colors; document.documentElement.style.setProperty('--tray-panel',colors[2]); });
