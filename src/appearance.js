(function () {
  try {
    const appearance = JSON.parse(localStorage.getItem('agent-office-v1'))?.appearance;
    const dark = appearance?.theme === 'dark' || (appearance?.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.classList.toggle('reduce-motion', !!appearance?.reducedMotion);
    const textSize = Number(appearance?.textSize) || 100;
    document.documentElement.style.setProperty('--text-scale', Math.min(200,Math.max(100,textSize)) / 100);
    document.documentElement.classList.toggle('text-large',textSize >= 140);
  } catch {}
})();
