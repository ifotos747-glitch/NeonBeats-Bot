'use strict';
const {PassThrough}=require('node:stream');

// FFmpeg produces Ogg/Opus at 128 kbit/s (about 16 KB/s).
// Buffer the container byte stream; @discordjs/voice demuxes Opus natively.
// No direct prism-media dependency and no JavaScript Opus re-encoding.
const OPUS_ESTIMATED_BYTES_PER_SECOND=16000;
function bufferOpusRadio(source,onReady,{milliseconds=2000,maxMs=6000}={}){
 const startMs=Math.max(0,Math.min(3000,Number(milliseconds)||0));
 const capMs=Math.max(startMs+500,Math.min(10000,Number(maxMs)||6000));
 const threshold=Math.round(OPUS_ESTIMATED_BYTES_PER_SECOND*startMs/1000);
 const capBytes=Math.round(OPUS_ESTIMATED_BYTES_PER_SECOND*capMs/1000);
 const out=new PassThrough({highWaterMark:capBytes});
 const stats={receivedBytes:0,peakBufferedMs:0};
 Object.defineProperty(stats,'bufferedMs',{enumerable:true,get(){
  return Math.round((stashBytes+out.readableLength)*1000/OPUS_ESTIMATED_BYTES_PER_SECOND);
 }});
 let started=false,paused=false,closed=false,stashBytes=0;
 let stash=[];
 function start(){
  if(started||closed)return;
  started=true;
  // The voice resource can already be wired to the Ogg demuxer. Keep compressed
  // data aside until startup is satisfied, instead of allowing the demuxer to
  // consume the entire prebuffer before the player starts.
  onReady();
  const pending=stash;stash=[];stashBytes=0;
  for(const chunk of pending)writeOutput(chunk);
 }
 function writeOutput(chunk){
  if(!out.write(chunk)&&!paused){paused=true;source.pause();}
 }
 function onData(chunk){
  if(closed||!chunk?.length)return;
  stats.receivedBytes+=chunk.length;
  if(!started){
   stash.push(chunk);stashBytes+=chunk.length;
   stats.peakBufferedMs=Math.max(stats.peakBufferedMs,stats.bufferedMs);
   if(stashBytes>=threshold)start();
  }else{
   writeOutput(chunk);
   stats.peakBufferedMs=Math.max(stats.peakBufferedMs,stats.bufferedMs);
  }
 }
 function onDrain(){if(paused&&!closed){paused=false;source.resume();}}
 function onEnd(){if(closed)return;out.end();start();}
 function onError(err){if(closed)return;start();out.destroy(err);}
 function cleanup(){
  if(closed)return;
  closed=true;source.off('data',onData);source.off('end',onEnd);source.off('error',onError);
  out.off('drain',onDrain);
  stash=[];stashBytes=0;
  if(paused)source.resume();
 }
 source.on('data',onData);source.once('end',onEnd);source.once('error',onError);
 out.on('drain',onDrain);out.once('close',cleanup);
 if(startMs===0)process.nextTick(start);
 return{stream:out,stats,stop:()=>{cleanup();out.destroy();}};
}
module.exports={bufferOpusRadio,OPUS_ESTIMATED_BYTES_PER_SECOND};
