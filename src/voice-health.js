'use strict';
const {performance}=require('node:perf_hooks');

// Observes PUBLIC AudioResource.read() and VoiceConnection.dispatchAudio().
// No new timers and no change to the returned packets or dispatch results.
// Dispatch=true means the local voice library dispatched it, NOT that Discord
// or any listener acknowledged receiving it.
class VoiceHealth {
 constructor({now=()=>performance.now(),getStatus=()=>null}={}){
  this.now=now;
  this.getStatus=getStatus;
  this.active=false;
  this.lastRead=null;this.lastDispatch=null;
  this.connectionRestore=null;this.resourceRestore=null;
  this.reset();
 }
 reset(active=this.active){
  this.active=active;
  this.lastRead=null;this.lastDispatch=null;
  this.consecutiveEmpty=0;
  this.stats={
   resourceReads:0,missingReads:0,missingEpisodes:0,longestMissingSeries:0,
   readGaps50:0,readGaps100:0,largestReadGapMs:0,
   dispatchAttempts:0,dispatchSuccess:0,dispatchFailed:0,dispatchUnavailable:0,
   dispatchGaps50:0,dispatchGaps100:0,largestDispatchGapMs:0
  };
 }
 clearTiming(){this.lastRead=null;this.lastDispatch=null;this.consecutiveEmpty=0;}
 running(){return this.active&&this.getStatus()==='playing';}
 onGap(kind,now){
  const lastKey=kind==='read'?'lastRead':'lastDispatch';
  const pfx=kind==='read'?'read':'dispatch';
  if(this[lastKey]!==null){
   const delta=Math.max(0,now-this[lastKey]);
   this.stats[pfx==='read'?'largestReadGapMs':'largestDispatchGapMs']=
    Math.max(this.stats[pfx==='read'?'largestReadGapMs':'largestDispatchGapMs'],Math.round(delta));
   if(delta>50)this.stats[pfx+'Gaps50']++;
   if(delta>100)this.stats[pfx+'Gaps100']++;
  }
  this[lastKey]=now;
 }
 observeRead(packet){
  if(!this.running()){this.lastRead=null;return;}
  this.onGap('read',this.now());
  this.stats.resourceReads++;
  if(!packet){
   this.stats.missingReads++;
   this.consecutiveEmpty++;
   if(this.consecutiveEmpty===1)this.stats.missingEpisodes++;
   this.stats.longestMissingSeries=Math.max(this.stats.longestMissingSeries,this.consecutiveEmpty);
  }else this.consecutiveEmpty=0;
 }
 observeDispatch(result){
  if(!this.running()){this.lastDispatch=null;return;}
  this.onGap('dispatch',this.now());
  this.stats.dispatchAttempts++;
  if(result===true)this.stats.dispatchSuccess++;
  else if(result===false)this.stats.dispatchFailed++;
  else this.stats.dispatchUnavailable++;
 }
 attachResource(resource){
  this.detachResource();
  if(!resource||typeof resource.read!=='function')return;
  const original=resource.read,health=this;
  resource.read=function(...args){
   const packet=original.apply(this,args);
   health.observeRead(packet);
   return packet;
  };
  this.resourceRestore=()=>{resource.read=original;};
 }
 detachResource(){this.resourceRestore?.();this.resourceRestore=null;}
 attachConnection(connection){
  if(!connection||typeof connection.dispatchAudio!=='function')return;
  this.detachConnection();
  const original=connection.dispatchAudio,health=this;
  connection.dispatchAudio=function(...args){
   const result=original.apply(this,args);
   health.observeDispatch(result);
   return result;
  };
  this.connectionRestore=()=>{connection.dispatchAudio=original;};
 }
 detachConnection(){this.connectionRestore?.();this.connectionRestore=null;}
 snapshot(){return {...this.stats};}
 close(){this.active=false;this.detachResource();this.detachConnection();}
}
module.exports={VoiceHealth};
