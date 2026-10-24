'use strict';
(() => {
  const $ = id => document.getElementById(id), fields = ['appearance','scheduledAppearance','scheduleEnabled','scheduleStart','scheduleEnd','transitionMinutes','textScale','highContrast','reducedMotion','includeKB','browserFilling'];
  const fallback = { appearance:'purple', scheduledAppearance:'black', scheduleEnabled:false, scheduleStart:'20:00', scheduleEnd:'07:00', transitionMinutes:2, textScale:100, highContrast:false, reducedMotion:false, includeKB:true, browserFilling:true };
  const genDefaults = { length:24, lower:true, upper:true, numbers:true, symbols:true, excludeSimilar:false };
  let api, articles = [], releases = [], timer, active;
  const element = (tag,text) => { const node = document.createElement(tag); node.textContent = text; return node; };
  function apply(value) {
    active = { ...fallback, ...value }; clearTimeout(timer);
    const result = window.SafeAppearance.appearance(active, new Date(), active.reducedMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    ['--safe-bg','--safe-panel','--safe-side','--safe-input'].forEach((name,i) => document.documentElement.style.setProperty(name,result.colors[i]));
    document.documentElement.style.setProperty('--safe-scale', String(active.textScale / 100));
    document.documentElement.dataset.contrast = active.highContrast ? 'high' : 'normal'; document.documentElement.dataset.motion = active.reducedMotion ? 'reduce' : 'normal';
    if (result.nextMs !== null) timer = setTimeout(() => apply(active), Math.max(100, Math.min(60000, result.nextMs)));
  }
  function populate(value) {
    const settings = { ...fallback, ...value };
    for (const key of fields) { const input = $('setting-' + key); if (input.type === 'checkbox') input.checked = settings[key]; else input.value = settings[key]; }
    for (const [key, item] of Object.entries({ ...genDefaults, ...value.generator })) { const input = $('default-' + key); if (input.type === 'checkbox') input.checked = item; else input.value = item; }
    $('settings-search').value = ''; search();
  }
  function collect() {
    return { ...Object.fromEntries(fields.map(key => { const input = $('setting-' + key); return [key,input.type === 'checkbox' ? input.checked : ['transitionMinutes','textScale'].includes(key) ? Number(input.value) : input.value]; })), generator: Object.fromEntries(Object.keys(genDefaults).map(key => [key,key === 'length' ? Number($('default-length').value) : $('default-' + key).checked])) };
  }
  function show(title, content) { $('help-title').textContent = title; $('help-content').replaceChildren(...content); if (!$('help-dialog').open) $('help-dialog').showModal(); $('help-close').focus(); }
  function help(article) {
    if (article) { const back = element('button','Back to KB index'); back.type = 'button'; back.onclick = () => help(); show(article.id + ' · ' + article.title,[back,...article.paragraphs.map(text => element('p',text))]); }
    else show('KB Library', [element('p','These guides are available offline. No online breach checks are performed.'), ...articles.map(item => { const button = element('button',item.id + ' · ' + item.title); button.type = 'button'; button.className = 'kb-link'; button.onclick = () => help(item); return button; })]);
  }
  function search() {
    const term = $('settings-search').value.trim().toLowerCase(); let count = 0;
    document.querySelectorAll('[data-settings-section]').forEach(section => { const match = !term || (section.dataset.settingsSection + section.textContent).toLowerCase().includes(term); section.hidden = !match; if (match) count++; });
    const matches = term && $('setting-includeKB').checked ? articles.filter(a => JSON.stringify(a).toLowerCase().includes(term)) : [];
    $('settings-kb-results').replaceChildren(...matches.map(item => { const button = element('button',item.id + ' · ' + item.title); button.type = 'button'; button.onclick = () => help(item); return button; }));
    if (matches.length) $('settings-kb-results').closest('section').hidden = false;
    $('settings-search-count').textContent = term ? `${count} settings sections and ${matches.length} guides found.` : '';
    // Keep an accessible result count visible even for an empty search result.
    if (term && !count && !matches.length) $('settings-search-count').closest('section').hidden = false;
  }
  function bind(fn) {
    api = fn; api('releases').then(value => { releases = value || []; }).catch(() => {}); api('kb').then(value => { articles = value || []; }).catch(() => {});
    $('settings-search').oninput = search; $('setting-includeKB').onchange = search; $('settings-help').onclick = () => help(); $('help-close').onclick = () => $('help-dialog').close();
    document.querySelectorAll('[data-support]').forEach(button => button.onclick = async () => { button.disabled = true; try { await api('support',{ kind:button.dataset.support, open:true }); } catch(e) { $('settings-error').textContent = e.message; } finally { button.disabled = false; } });
    $('settings-new').onclick = () => show('New features',releases.length ? releases.flatMap(item => [element('h3',item.version),element('p',item.notes)]) : [element('p','Release notes are unavailable in this build.')]);
  }
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',() => { if (active) apply(active); });
  window.addEventListener('focus',() => { if (active) apply(active); }); window.addEventListener('beforeunload',() => clearTimeout(timer));
  window.safePreferences = { populate, collect, apply, bind };
})();
