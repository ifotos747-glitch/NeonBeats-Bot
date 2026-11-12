'use strict';
const {monitorEventLoopDelay,performance}=require('node:perf_hooks');

// Lightweight sampling: the 10s / 60s worst event-loop delays reveal freezes
// invisible in ALTARE's averaged CPU gauge. Values are sampled, not guessed.
const histogram=monitorEventLoopDelay({resolution:10});
histogram.enable();
let previousUtilization=performance.eventLoopUtilization();
const recent=[],MAX_SAMPLES=6;
let latest={p99Ms:0,maxMs:0,utilizationPct:0,sampledAt:null};
function sample(){
 const elu=performance.eventLoopUtilization(previousUtilization);
 previousUtilization=performance.eventLoopUtilization();
 const ms=v=>Number.isFinite(v)?Math.round(v/1e5)/10:0;
 latest={
  p99Ms:ms(histogram.percentile(99)),
  maxMs:ms(histogram.max),
  utilizationPct:Number.isFinite(elu.utilization)?Math.round(elu.utilization*1000)/10:0,
  sampledAt:new Date().toISOString()
 };
 histogram.reset();
 recent.push(latest);
 while(recent.length>MAX_SAMPLES)recent.shift();
}
const timer=setInterval(sample,10000);
timer.unref?.();

function performanceSnapshot(session){
 const ping=session?.connection?.ping||{};
 const playerState=session?.player?.state||{};
 return{
  ...latest,
  max60sMs:Math.max(0,...recent.map(s=>s.maxMs)),
  wsPingMs:Number.isFinite(ping.ws)?Math.round(ping.ws):null,
  udpPingMs:Number.isFinite(ping.udp)?Math.round(ping.udp):null,
  discordMissedFrames:Number.isFinite(playerState.missedFrames)?playerState.missedFrames:null
 };
}
function performanceText(snapshot){
 const fmt=v=>v===null?'brak pomiaru':String(v)+' ms';
 return 'Ping Discord Voice: UDP '+fmt(snapshot.udpPingMs)+' | WS '+fmt(snapshot.wsPingMs)+
  '\nOpóźnienia Node.js: p99 '+snapshot.p99Ms+' ms | szczyt 10s '+snapshot.maxMs+' ms | szczyt 60s '+snapshot.max60sMs+' ms'+
  '\nZajętość pętli zdarzeń: '+snapshot.utilizationPct+'% | brakujące ramki Voice (seria): '+
  (snapshot.discordMissedFrames??'brak danych');
}
module.exports={performanceSnapshot,performanceText};
