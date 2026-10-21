const crypto = require('node:crypto');
const METRICS = ['followers','posts','views','liveViewers','likes','karma','recentLikes','recentReplies','recentReposts','periodViews','periodLikes','watchMinutes','subscribersGained','subscribersLost'];
const TYPES = ['stat','line','bar','pie'];
const RANGES = ['hour','day','week','month'];
const id = () => crypto.randomUUID();
function name(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 60) throw Error('Enter a name between 1 and 60 characters.');
  return value.trim();
}
function recordSample(state, account) {
  if (!account.snapshot || !Number.isFinite(Date.parse(account.snapshot.updatedAt))) return;
  state.metricHistory ||= {};
  const now = Date.parse(account.snapshot.updatedAt);
  const metrics = Object.fromEntries(Object.entries(account.snapshot.metrics).filter(([key,value]) => METRICS.includes(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0));
  const samples = state.metricHistory[account.id] || [];
  if (samples.at(-1)?.at === account.snapshot.updatedAt) return;
  const point = {at: account.snapshot.updatedAt, metrics};
  // Keep the latest observation each minute for 48 hours and each hour for 90 days.
  const buckets = new Map();
  for (const sample of [...samples,point]) {
    const time = Date.parse(sample.at);
    if (time < now - 90 * 86400000 || time > now) continue;
    const period = time < now - 48 * 3600000 ? 3600000 : 60000;
    buckets.set(`${period}:${Math.floor(time / period)}`,sample);
  }
  state.metricHistory[account.id] = [...buckets.values()].sort((a,b) => Date.parse(a.at)-Date.parse(b.at)).slice(-5200);
}
function mutate(state, input) {
  if (!input || typeof input.action !== 'string') throw Error('Invalid dashboard action.');
  state.dashboards ||= [];
  if(input.action==='savePreset'){state.widgetPresets||=[];if(state.widgetPresets.length>=50)throw Error('Keep up to 50 named presets.');const widget=state.dashboards.flatMap(d=>d.tabs.flatMap(t=>t.widgets)).find(w=>w.id===input.widgetId);if(!widget)throw Error('Widget no longer exists.');state.widgetPresets.push({...structuredClone(widget),id:id(),title:name(input.name||widget.title),accountIds:[]});return {};}
  if(input.action==='deletePreset'){state.widgetPresets=(state.widgetPresets||[]).filter(w=>w.id!==input.presetId);return {};}
  if (input.action === 'createDashboard') {
    if (state.dashboards.length >= 30) throw Error('You can create up to 30 dashboards.');
    const dashboard = {id:id(),name:name(input.name),tabs:[{id:id(),name:'Overview',widgets:[]}]};
    state.dashboards.push(dashboard); return {dashboardId:dashboard.id,tabId:dashboard.tabs[0].id};
  }
  const dashboard = state.dashboards.find(d => d.id === input.dashboardId);
  if (!dashboard) throw Error('Dashboard no longer exists.');
  if (input.action === 'renameDashboard') {dashboard.name=name(input.name);return {};}
  if (input.action === 'deleteDashboard') {state.dashboards=state.dashboards.filter(d=>d.id!==dashboard.id);return {};}
  if (input.action === 'addTab') {
    if(dashboard.tabs.length>=20) throw Error('A dashboard can have up to 20 tabs.');
    const tab={id:id(),name:name(input.name),widgets:[]};dashboard.tabs.push(tab);return {tabId:tab.id};
  }
  const tab=dashboard.tabs.find(t=>t.id===input.tabId);
  if(!tab) throw Error('Tab no longer exists.');
  if(input.action==='renameTab'){tab.name=name(input.name);return {};}
  if(input.action==='deleteTab'){if(dashboard.tabs.length===1)throw Error('Keep at least one tab in each dashboard.');dashboard.tabs=dashboard.tabs.filter(t=>t.id!==tab.id);return {};}
  if(input.action==='saveWidget'){
    const w=input.widget;
    if(!w || !TYPES.includes(w.type)||!METRICS.includes(w.metric)||!RANGES.includes(w.range))throw Error('Choose a valid widget type, metric and time range.');
    if(!Array.isArray(w.accountIds)||w.accountIds.some(accountId=>!state.accounts.some(a=>a.id===accountId)))throw Error('One of the selected accounts was disconnected.');
    const old=w.id?tab.widgets.find(v=>v.id===w.id):null;
    if(w.id&&!old)throw Error('Widget no longer exists.');
    if(!old&&tab.widgets.length>=24)throw Error('A tab can hold up to 24 widgets.');
    const widget={id:old?.id||id(),title:name(w.title),type:w.type,metric:w.metric,range:w.range,accountIds:[...new Set(w.accountIds)],width:w.width==='wide'?'wide':'small',syncMode:['inherit','manual','interval'].includes(w.syncMode)?w.syncMode:'inherit',syncMinutes:Math.max(1,Math.min(1440,Math.round(Number(w.syncMinutes)||15)))};
    if(old)tab.widgets[tab.widgets.indexOf(old)]=widget;else tab.widgets.push(widget);
    return {widgetId:widget.id};
  }
  const index=tab.widgets.findIndex(w=>w.id===input.widgetId);
  if(index<0)throw Error('Widget no longer exists.');
  if(input.action==='deleteWidget'){tab.widgets.splice(index,1);return {};}
  if(input.action==='dropWidget'){const target=tab.widgets.findIndex(w=>w.id===input.beforeId);if(target<0)throw Error('Invalid widget position.');const [moving]=tab.widgets.splice(index,1);tab.widgets.splice(target,0,moving);return {};}
  if(input.action==='moveWidget'){
    if(![-1,1].includes(input.direction))throw Error('Invalid widget position.');
    const next=index+input.direction;if(next>=0&&next<tab.widgets.length)[tab.widgets[index],tab.widgets[next]]=[tab.widgets[next],tab.widgets[index]];return {};
  }
  throw Error('Unknown dashboard action.');
}
module.exports={METRICS,TYPES,RANGES,recordSample,mutate};
