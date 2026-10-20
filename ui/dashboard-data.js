(function(root,factory){const data=factory();if(typeof module==='object'&&module.exports)module.exports=data;else root.dashboardData=data;})(typeof window==='object'?window:globalThis,function(){
  const durations={hour:3600000,day:86400000,week:604800000,month:2592000000};
  function accounts(state,widget){return state.accounts.filter(a=>!widget.accountIds.length||widget.accountIds.includes(a.id));}
  function points(state,account,metric){return (state.metricHistory?.[account.id]||[]).filter(p=>typeof p.metrics[metric]==='number').map(p=>({time:Date.parse(p.at),value:p.metrics[metric]})).sort((a,b)=>a.time-b.time);}
  function summary(state,widget,now=Date.now()){
    const rows=accounts(state,widget);const available=rows.filter(a=>typeof a.snapshot?.metrics[widget.metric]==='number');
    if(!available.length)return {value:null,delta:null,percent:null,available:0,total:rows.length,baselineAt:null};
    const value=available.reduce((sum,a)=>sum+a.snapshot.metrics[widget.metric],0);
    let baseline=0,baselineAt=null,complete=true;
    for(const a of available){const list=points(state,a,widget.metric);const latest=list.at(-1);const cutoff=now-(durations[widget.range]||durations.day);const previous=list.filter(p=>p.time<=cutoff).at(-1)||list[0];
      if(!latest||!previous||previous.time===latest.time){complete=false;continue;}
      baseline+=previous.value;baselineAt=Math.max(baselineAt||0,previous.time);
    }
    const delta=complete?value-baseline:null;
    return {value,delta,percent:delta===null||baseline===0?null:delta/baseline*100,available:available.length,total:rows.length,baselineAt:complete?baselineAt:null,hasError:available.some(a=>a.error)};
  }
  function reducePoints(list,limit=180){
    if(list.length<=limit)return list;
    const result=[list[0]],size=Math.ceil(list.length/((limit-2)/2));
    for(let i=1;i<list.length-1;i+=size){const bucket=list.slice(i,Math.min(i+size,list.length-1));const low=bucket.reduce((a,b)=>a.value<b.value?a:b),high=bucket.reduce((a,b)=>a.value>b.value?a:b);result.push(...[low,high].sort((a,b)=>a.time-b.time));}
    result.push(list.at(-1));return result.filter((p,i)=>i===0||p.time!==result[i-1].time);
  }
  function series(state,widget,now=Date.now()){
    const cutoff=now-(durations[widget.range]||durations.day);
    return accounts(state,widget).map(a=>({id:a.id,label:a.label,platform:a.platform,points:reducePoints(points(state,a,widget.metric).filter(p=>p.time>=cutoff&&p.time<=now))})).filter(s=>s.points.length);
  }
  function breakdown(state,widget){return accounts(state,widget).filter(a=>typeof a.snapshot?.metrics[widget.metric]==='number').map(a=>({id:a.id,label:a.label,platform:a.platform,value:a.snapshot.metrics[widget.metric]}));}
  return {accounts,summary,series,breakdown,durations,reducePoints};
});
