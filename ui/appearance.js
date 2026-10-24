'use strict';
(function (root) {
  const palettes = { purple: ['#17191f','#22252c','#30203f','#1b1e25'], grey: ['#202124','#2c2d30','#303136','#252629'], black: ['#08090b','#141518','#16111c','#0e0f12'] };
  function appearance(settings, now = new Date(), reduce = false) {
    const base = palettes[settings.appearance] || palettes.purple;
    if (!settings.scheduleEnabled) return { colors: base, nextMs: null };
    const events = [];
    for (let offset = -1; offset <= 1; offset++) for (const [time, target] of [[settings.scheduleStart, settings.scheduledAppearance], [settings.scheduleEnd, settings.appearance]]) {
      const [hour, minute] = time.split(':').map(Number);
      events.push({ time: new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute).getTime(), target });
    }
    events.sort((a,b) => a.time - b.time);
    const current = events.filter(e => e.time <= +now).at(-1), next = events.find(e => e.time > +now);
    const to = palettes[current.target], from = current.target === settings.appearance ? palettes[settings.scheduledAppearance] : base;
    const duration = reduce ? 0 : settings.transitionMinutes * 60000, fraction = duration ? Math.min(1, (+now - current.time) / duration) : 1;
    const blend = (a,b) => '#' + [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16) * (1-fraction) + parseInt(b.slice(i,i+2),16) * fraction).toString(16).padStart(2,'0')).join('');
    return { colors: to.map((color,i) => blend(from[i], color)), nextMs: fraction < 1 ? Math.min(30000, current.time + duration - +now, next.time - +now) : next.time - +now };
  }
  if (typeof module === 'object') module.exports = { appearance, palettes }; else root.SafeAppearance = { appearance, palettes };
})(typeof window === 'undefined' ? globalThis : window);
