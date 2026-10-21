let activeDashboardId=null,activeDashboardTabId=null;
const dashboardPalette=['#e5b92f','#8bc7ff','#eaa1d8','#88d99b','#b69aff','#ffac81','#86e5e5','#ff8585','#d1d8e8'];
const rangeNames={hour:'Last hour',day:'Last 24 hours',week:'Last 7 days',month:'Last 30 days'};
function dashboardModal(title,build,onSubmit,submitText='Save'){
  const dialog=el('dialog','dashboard-dialog');const form=el('form');const heading=el('div','dialog-heading');const h=el('h2','',title);h.id='dashboard-dialog-title';dialog.setAttribute('aria-labelledby',h.id);
  heading.append(h,button('×',()=>dialog.close()));heading.lastChild.setAttribute('aria-label','Close');const body=el('div','dashboard-form');const controls=build(body);const error=el('p','warning');error.setAttribute('role','alert');
  const actions=el('div','dialog-actions');const submit=el('button','primary',submitText);submit.type='submit';actions.append(button('Cancel',()=>dialog.close()),submit);form.append(heading,body,error,actions);dialog.append(form);document.body.append(dialog);
  let saving=false;
  form.onsubmit=async event=>{event.preventDefault();if(busy||saving)return;saving=true;submit.disabled=true;try{await onSubmit(controls);dialog.close();}catch(e){error.textContent=e.message;}finally{saving=false;submit.disabled=false;}};
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();const focus=body.querySelector('input,select');focus?.focus();if(focus?.tagName==='INPUT'&&focus.type==='text')focus.select();return dialog;
}
async function dashboardChange(input){const result=await call('dashboardAction',input);state=result.state;if(result.dashboardId)activeDashboardId=result.dashboardId;if(result.tabId)activeDashboardTabId=result.tabId;render();return result;}
function dashboardNameDialog(title,value,input){return dashboardModal(title,body=>{const wrapper=field('Name','dashboard-name');const control=wrapper.querySelector('input');control.value=value;control.maxLength=60;control.required=true;body.append(wrapper);return control;},control=>dashboardChange({...input,name:control.value}));}
function dashboardConfirm(title,text,input){return dashboardModal(title,body=>{body.append(el('p','',text));},()=>dashboardChange(input),'Delete');}
function dashboardMenu(items){const details=el('details','dashboard-menu');const summary=el('summary','','•••');summary.setAttribute('aria-label','More options');details.append(summary);const menu=el('div','dashboard-menu-items');for(const [label,action] of items)menu.append(button(label,()=>{details.open=false;action();}));details.append(menu);return details;}
function dashboards(){
  const content=$('#content');const list=state.dashboards||[];const create=()=>dashboardNameDialog('Create dashboard','',{action:'createDashboard'});
  if(!list.length){content.append(empty('A dashboard that feels like yours.','Create separate spaces for each project, community or campaign. Add tabs, follower counts, engagement widgets and charts.',create,'＋ Create dashboard'));return;}
  let dashboard=list.find(d=>d.id===activeDashboardId)||list[0];activeDashboardId=dashboard.id;
  const tab=dashboard.tabs.find(t=>t.id===activeDashboardTabId)||dashboard.tabs[0];activeDashboardTabId=tab.id;
  const toolbar=el('div','toolbar dashboard-toolbar');const select=el('select');select.id='dashboard-select';select.setAttribute('aria-label','Choose dashboard');for(const d of list)select.append(new Option(d.name,d.id));select.value=dashboard.id;select.onchange=()=>{activeDashboardId=select.value;activeDashboardTabId=null;render();};
  const tools=el('div','toolbar-right');tools.append(button('＋ New dashboard',create),button('↻ Refresh data',()=>task(async()=>{state=await call('refresh');render();})),dashboardMenu([
    ['Rename dashboard',()=>dashboardNameDialog('Rename dashboard',dashboard.name,{action:'renameDashboard',dashboardId:dashboard.id})],
    ['Delete dashboard',()=>dashboardConfirm('Delete dashboard?',`Delete “${dashboard.name}” and its tabs and widgets? Account data and metric history will be kept.`,{action:'deleteDashboard',dashboardId:dashboard.id})]
  ]));toolbar.append(select,tools);content.append(toolbar);
  const tabsRow=el('div','dashboard-tabs-row');const tabs=el('div','dashboard-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',dashboard.name+' tabs');
  for(const t of dashboard.tabs){const b=button(t.name,()=>{activeDashboardTabId=t.id;render();});b.setAttribute('role','tab');b.setAttribute('aria-selected',String(t.id===tab.id));b.tabIndex=t.id===tab.id?0:-1;b.id='tab-'+t.id;b.setAttribute('aria-controls','dashboard-widgets');b.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const index=dashboard.tabs.indexOf(t);const next=dashboard.tabs[(index+(event.key==='ArrowRight'?1:dashboard.tabs.length-1))%dashboard.tabs.length];activeDashboardTabId=next.id;render();document.getElementById('tab-'+next.id)?.focus();});tabs.append(b);}
  tabsRow.append(tabs,button('＋ Add tab',()=>dashboardNameDialog('Add tab','',{action:'addTab',dashboardId:dashboard.id})),dashboardMenu([
    ['Rename tab',()=>dashboardNameDialog('Rename tab',tab.name,{action:'renameTab',dashboardId:dashboard.id,tabId:tab.id})],
    ['Delete tab',()=>dashboardConfirm('Delete tab?',`Delete “${tab.name}” and its widgets? A dashboard must keep at least one tab.`,{action:'deleteTab',dashboardId:dashboard.id,tabId:tab.id})]
  ]));content.append(tabsRow);
  const heading=el('div','toolbar dashboard-tab-heading');const title=el('div');title.append(el('h2','',tab.name),el('p','',`${tab.widgets.length} widgets · ${dashboard.name}`));heading.append(title,button('＋ Add widget',()=>dashboardWidgetEditor(dashboard,tab),'primary'));content.append(heading);
  const grid=el('div','dashboard-grid');grid.id='dashboard-widgets';grid.setAttribute('role','tabpanel');grid.setAttribute('aria-labelledby','tab-'+tab.id);
  if(!tab.widgets.length)grid.append(empty('Make space for what matters.','Start with a follower count, track engagement over time, or compare your communities in a pie chart.',()=>dashboardWidgetEditor(dashboard,tab),'＋ Add your first widget'));
  else for(const widget of tab.widgets)grid.append(dashboardWidget(dashboard,tab,widget));content.append(grid);
  content.append(el('p','data-note','Trends use observations saved on this device. Recording starts when an account is connected or upgraded; earlier history cannot be reconstructed. Minute samples are retained for 48 hours, then hourly samples for up to 90 days. Charts retain each metric’s meaning; audience totals are not unique people.'));
}
function dashboardWidgetEditor(dashboard,tab,widget){
  const existing=widget||{title:'Follower count',type:'stat',metric:'followers',range:'day',accountIds:[],width:'small'};
  dashboardModal(widget?'Edit widget':'Add widget',body=>{
    const titleField=field('Widget title','widget-title');const title=titleField.querySelector('input');title.value=existing.title;title.maxLength=60;title.required=true;body.append(titleField);
    const selectField=(label,id,values,value)=>{const wrapper=el('div','field');const l=el('label','',label);l.htmlFor=id;const s=el('select');s.id=id;for(const [v,text] of values)s.append(new Option(text,v));s.value=value;wrapper.append(l,s);body.append(wrapper);return s;};
    const type=selectField('Display','widget-type',[['stat','Statistic with trend arrow'],['line','Line graph over time'],['bar','Bar chart by account'],['pie','Pie chart by account']],existing.type);
    const metric=selectField('Statistic','widget-metric',Object.entries(names).map(([key,label])=>[key,label]),existing.metric);
    const range=selectField('Trend / graph period','widget-range',Object.entries(rangeNames),existing.range);
    const width=selectField('Widget size','widget-width',[['small','Standard'],['wide','Wide']],existing.width);
    type.onchange=()=>width.value=['line','bar'].includes(type.value)?'wide':'small';
    const scope=selectField('Accounts','widget-scope',[['all','All connected accounts (including future connections)'],['selected','Choose specific accounts']],existing.accountIds.length?'selected':'all');
    const choices=el('div','widget-account-choices');const checkboxes=[];
    if(!state.accounts.length)choices.append(el('p','','Connect accounts to choose specific sources. You can still create widgets for all future connections.'));
    for(const a of state.accounts){const row=el('label','target');const input=el('input');input.type='checkbox';input.value=a.id;input.checked=existing.accountIds.includes(a.id);row.append(input,el('span','',`${platform(a.platform).name} · ${a.label}`));choices.append(row);checkboxes.push(input);}
    scope.onchange=()=>choices.hidden=scope.value!=='selected';scope.onchange();body.append(choices,el('p','data-note','Only accounts exposing this statistic contribute. Lifetime likes and likes on recent Bluesky posts are separate metrics. Pie and bar charts compare the latest values; the period controls statistic trends and line graphs.'));
    return {title,type,metric,range,width,scope,checkboxes};
  },controls=>{
    const accountIds=controls.scope.value==='selected'?controls.checkboxes.filter(c=>c.checked).map(c=>c.value):[];
    if(controls.scope.value==='selected'&&!accountIds.length)throw Error('Choose at least one account.');
    return dashboardChange({action:'saveWidget',dashboardId:dashboard.id,tabId:tab.id,widget:{id:widget?.id,title:controls.title.value,type:controls.type.value,metric:controls.metric.value,range:controls.range.value,width:controls.width.value,accountIds}});
  });
}
function dashboardWidget(dashboard,tab,widget){
  const card=el('article','panel dashboard-widget '+(widget.width==='wide'?'widget-wide':''));card.dataset.widgetId=widget.id;
  const header=el('div','panel-heading');const text=el('div');const metricLabel=el('small','',names[widget.metric]);if(widget.type!=='stat')metricLabel.append(freshness(dashboardData.accounts(state,widget),widget.metric));text.append(el('h3','',widget.title),metricLabel);const base={dashboardId:dashboard.id,tabId:tab.id,widgetId:widget.id};header.append(text,dashboardMenu([
    ['Edit widget',()=>dashboardWidgetEditor(dashboard,tab,widget)],['Move earlier',()=>task(()=>dashboardChange({...base,action:'moveWidget',direction:-1}))],['Move later',()=>task(()=>dashboardChange({...base,action:'moveWidget',direction:1}))],['Remove widget',()=>dashboardConfirm('Remove widget?',`Remove “${widget.title}” from this tab? Saved analytics will be kept.`,{...base,action:'deleteWidget'})]
  ]));card.append(header);
  const body=el('div','dashboard-widget-body');const data=dashboardData.summary(state,widget);const rows=dashboardData.accounts(state,widget);
  if(widget.type==='stat'){
    const value=el('div','widget-value',fmt(data.value));value.append(freshness(rows,widget.metric));body.append(value);
    let label=data.rawYouTube?'YouTube · provider-reported value':'Collecting a comparison…',direction='neutral';
    if(data.delta!==null){direction=data.delta>0?'up':data.delta<0?'down':'neutral';const change=(data.delta>0?'+':'')+fmt(data.delta);label=`${data.delta>0?'↑':data.delta<0?'↓':'→'} ${change}${data.percent===null?'':` (${Math.abs(data.percent).toFixed(1)}%)`}`;}
    body.append(el('div','widget-trend '+direction,label),el('small','',data.baselineAt?`Compared with ${date(data.baselineAt)}`:data.rawYouTube?'Use YouTube-reported subscribers gained/lost for changes.':'Two observations at least a minute apart are needed.'));
  }else if(widget.type==='line')body.append(dashboardLineChart(state,widget));
  else body.append(dashboardComparisonChart(state,widget));
  if(data.hasError)body.append(el('p','warning widget-note','A source could not refresh. Showing its last successful observation.'));
  if(data.youtubeSeparated)body.append(el('p','widget-note','YouTube data is kept separate from summed statistics and pie-share calculations. Choose a single YouTube account for a raw statistic, line graph or bar chart.'));
  body.append(el('p','widget-note',`${data.available} of ${data.total} selected accounts provide this metric${widget.type==='line'||widget.type==='stat'?' · '+rangeNames[widget.range]:''}.`));card.append(body);return card;
}
function dashboardSvg(tag,attributes={}){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));return node;}
function dashboardChartFrame(label){const svg=dashboardSvg('svg',{viewBox:'0 0 560 250',role:'img','aria-label':label,class:'dashboard-chart'});const title=dashboardSvg('title');title.textContent=label;svg.append(title);return svg;}
function dashboardLegend(items){const legend=el('div','chart-legend');items.forEach((item,index)=>{const row=el('span','');const swatch=dashboardSvg('svg',{width:10,height:10,viewBox:'0 0 10 10','aria-hidden':'true'});swatch.append(dashboardSvg('circle',{cx:5,cy:5,r:4,fill:dashboardPalette[index%dashboardPalette.length]}));row.append(swatch,el('span','',`${platform(item.platform).name} · ${item.label}`+(item.value===undefined?'':` · ${fmt(item.value)}`)));legend.append(row);});return legend;}
function dashboardLineChart(state,widget){
  const series=dashboardData.series(state,widget);const wrapper=el('div');if(!series.length){wrapper.append(el('p','chart-empty','No observations in this period yet. Connect a source and refresh to begin recording.'));return wrapper;}
  const all=series.flatMap(s=>s.points);const earliest=Math.min(...all.map(p=>p.time)),latest=Math.max(...all.map(p=>p.time));const min=Math.min(...all.map(p=>p.value)),max=Math.max(...all.map(p=>p.value));const margin=Math.max((max-min)*.1,1);const low=Math.max(0,min-margin),high=max+margin;
  const x=time=>58+(time-earliest)/(latest-earliest||1)*476,y=value=>210-(value-low)/(high-low)*175;const svg=dashboardChartFrame(`${names[widget.metric]} over time. ${rangeNames[widget.range]}. Actual recorded observations.`);
  for(let i=0;i<4;i++){const value=low+(high-low)*i/3;const yy=y(value);svg.append(dashboardSvg('line',{x1:58,y1:yy,x2:534,y2:yy,stroke:'#393f4b'}));const label=dashboardSvg('text',{x:49,y:yy+4,'text-anchor':'end',class:'chart-axis'});label.textContent=new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1}).format(value);svg.append(label);}
  series.forEach((s,index)=>{const color=dashboardPalette[index%dashboardPalette.length];svg.append(dashboardSvg('polyline',{points:s.points.map(p=>`${x(p.time)},${y(p.value)}`).join(' '),fill:'none',stroke:color,'stroke-width':2.5,'stroke-linejoin':'round'}));for(const p of s.points){const circle=dashboardSvg('circle',{cx:x(p.time),cy:y(p.value),r:s.points.length>150?1.5:3,fill:color});const title=dashboardSvg('title');title.textContent=`${s.label}: ${fmt(p.value)} · ${date(p.time)}`;circle.append(title);svg.append(circle);}});
  for(const [time,xx,anchor] of [[earliest,58,'start'],[latest,534,'end']]){const label=dashboardSvg('text',{x:xx,y:240,'text-anchor':anchor,class:'chart-axis'});label.textContent=new Date(time).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});svg.append(label);}
  wrapper.append(svg,dashboardLegend(series));if(all.length===1)wrapper.append(el('small','','First observation recorded. The line will appear after another check.'));else wrapper.append(el('small','','Recorded observations; dense history is sampled while preserving peaks and troughs.'));return wrapper;
}
function dashboardComparisonChart(state,widget){
  const rows=dashboardData.breakdown(state,widget);const wrapper=el('div');if(!rows.length){wrapper.append(el('p','chart-empty','No available values for this metric. Connect a supported account and refresh.'));return wrapper;}
  const total=rows.reduce((sum,r)=>sum+r.value,0);if(widget.type==='pie'&&total===0){wrapper.append(el('p','chart-empty','All available values are zero. There are no positive slices to draw.'),dashboardLegend(rows));return wrapper;}
  const svg=dashboardChartFrame(`${names[widget.metric]} by account. `+rows.map(r=>`${r.label}: ${fmt(r.value)}`).join('; '));
  if(widget.type==='pie'){
    let angle=-Math.PI/2;for(let i=0;i<rows.length;i++){const row=rows[i];if(row.value===0)continue;const sweep=row.value/total*Math.PI*2;const color=dashboardPalette[i%dashboardPalette.length];let node;
      if(row.value===total)node=dashboardSvg('circle',{cx:280,cy:125,r:99,fill:color});
      else{const end=angle+sweep;node=dashboardSvg('path',{d:`M280 125 L${280+99*Math.cos(angle)} ${125+99*Math.sin(angle)} A99 99 0 ${sweep>Math.PI?1:0} 1 ${280+99*Math.cos(end)} ${125+99*Math.sin(end)} Z`,fill:color,stroke:'#22252c','stroke-width':2});}
      const title=dashboardSvg('title');title.textContent=`${row.label}: ${fmt(row.value)} (${(row.value/total*100).toFixed(1)}%)`;node.append(title);svg.append(node);angle+=sweep;
    }
  }else{
    const max=Math.max(...rows.map(r=>r.value),1);const step=480/rows.length;rows.forEach((r,i)=>{const height=r.value/max*170;const rect=dashboardSvg('rect',{x:55+i*step,y:205-height,width:Math.max(3,step-12),height,rx:5,fill:dashboardPalette[i%dashboardPalette.length]});const title=dashboardSvg('title');title.textContent=`${r.label}: ${fmt(r.value)}`;rect.append(title);svg.append(rect);const label=dashboardSvg('text',{x:55+i*step+(step-12)/2,y:195-height,'text-anchor':'middle',class:'chart-axis'});label.textContent=new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1}).format(r.value);svg.append(label);});svg.append(dashboardSvg('line',{x1:48,y1:205,x2:540,y2:205,stroke:'#555e6e'}));
  }
  wrapper.append(svg,dashboardLegend(rows));return wrapper;
}
