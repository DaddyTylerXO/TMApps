class Scheduler{
  constructor({run,onChange=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,now=Date.now}){Object.assign(this,{run,onChange,setTimer,clearTimer,now});this.config={analyticsMode:'manual',intervalMinutes:15};this.status={checking:false,nextCheckAt:null,lastCheckAt:null};this.generation=0;}
  interval(){return this.config.analyticsMode==='live'?30000:this.config.analyticsMode==='interval'?this.config.intervalMinutes*60000:0;}
  configure(config){this.config=config;this.generation++;this.clearTimer(this.timer);this.status.nextCheckAt=null;if(this.interval())this.schedule(0);else this.onChange(this.status);}
  schedule(delay=this.interval()){if(!this.interval())return;const generation=this.generation;this.status.nextCheckAt=new Date(this.now()+delay).toISOString();this.timer=this.setTimer(()=>this.tick(generation),delay);this.onChange(this.status);}
  async tick(generation=this.generation){if(generation!==this.generation)return;if(this.status.checking){this.schedule();return;}this.status.checking=true;this.status.nextCheckAt=null;this.onChange(this.status);try{await this.run();delete this.status.error;this.status.lastCheckAt=new Date(this.now()).toISOString();}catch{this.status.error='Scheduled refresh could not complete.';}finally{this.status.checking=false;if(generation===this.generation)this.schedule();this.onChange(this.status);}}
  stop(){this.generation++;this.clearTimer(this.timer);this.status.nextCheckAt=null;}
}
module.exports={Scheduler};
