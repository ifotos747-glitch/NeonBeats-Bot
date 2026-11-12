'use strict';
const {spawn}=require('node:child_process');
const {ffmpegPath}=require('./config');
const {validatePublicUrl}=require('./media');
const {openAudioResponse,pipeHttpAudio}=require('./network');

function redactFFmpeg(raw) {
 return String(raw||'')
  .replace(/\x1b\[[0-9;]*m/g,'')
  .replace(/https?:\/\/[^\s"'<>]+/gi,'[UKRYTY_URL]')
  .replace(/\b(authorization|cookie|set-cookie|x-api-key)\s*:\s*[^\r\n]*/gi,'$1: [UKRYTO]')
  .replace(/\bBearer\s+[a-z0-9._~+/-]+/gi,'Bearer [UKRYTO]')
  .replace(/[@<>\x60]/g,' ')
  .replace(/\r/g,'\n')
  .split('\n').map(s=>s.trim().slice(0,230)).filter(Boolean)
  .slice(-8).join('\n').slice(-1200);
}

function probeFFmpeg(args,{spawnProcess=spawn,timeoutMs=20000}={}) {
 return new Promise(resolve=>{
  let bytes=0,stderr='',done=false,timedOut=false,timer=null;
  const startedAt=Date.now();
  const finish=(exitCode,signal,err)=>{
   if(done)return;
   done=true;clearTimeout(timer);
   resolve({
    ok:bytes>0,bytes,exitCode:exitCode??null,signal:signal??null,timedOut,
    durationMs:Date.now()-startedAt,
    error:err?String(err.code||err.message||err).slice(0,120):'',
    details:redactFFmpeg(stderr)
   });
  };
  let child;
  try{
   child=spawnProcess(ffmpegPath(),args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
  }catch(err){finish(null,null,err);return;}
  child.stdout?.on('data',chunk=>{bytes+=chunk.length;});
  child.stderr?.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-16000);});
  child.once('error',err=>finish(null,null,err));
  child.once('close',(code,signal)=>finish(code,signal,null));
  timer=setTimeout(()=>{
   timedOut=true;
   try{if(!child.kill('SIGKILL'))finish(null,'TIMEOUT',new Error('Nie udało się zatrzymać procesu'));}catch(err){finish(null,'TIMEOUT',err);}
  },timeoutMs);
  timer.unref?.();
 });
}
// Test the SAME MP3/AAC radio path as MusicSession: Node fetch -> FFmpeg stdin.
// Opening HTTP directly inside FFmpeg crashes with SIGSEGV on some hosts.
function diagnoseStream(rawUrl,{spawnProcess=spawn,pipeAudio=pipeHttpAudio,timeoutMs=18000}={}) {
 const url=validatePublicUrl(rawUrl).href;
 return new Promise(resolve=>{
  const startedAt=Date.now(),controller=new AbortController();
  let child,timer,bytes=0,stderr='',done=false,timedOut=false;
  const finish=(exitCode,signal,err)=>{
   if(done)return;
   done=true;clearTimeout(timer);controller.abort();
   try{child?.stdin?.destroy();}catch{}
   resolve({
    ok:bytes>0,bytes,exitCode:exitCode??null,signal:signal??null,timedOut,
    durationMs:Date.now()-startedAt,method:'node-pipe',
    error:err?redactFFmpeg(String(err.code||err.message||err)).slice(-120):'',
    details:redactFFmpeg(stderr)
   });
  };
  const args=[
   '-nostdin','-hide_banner','-loglevel','info','-threads','2','-filter_threads','1',
   '-i','pipe:0','-t','3','-vn','-sn','-dn',
   '-ac','2','-ar','48000','-f','s16le','pipe:1'
  ];
  try{child=spawnProcess(ffmpegPath(),args,{stdio:['pipe','pipe','pipe'],windowsHide:true});}
  catch(err){finish(null,null,err);return;}
  child.stdin?.on('error',()=>{}); // FFmpeg may close stdin after 3s of decoded audio.
  child.stdout?.on('data',chunk=>{bytes+=chunk.length;});
  child.stderr?.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-16000);});
  child.once('error',err=>finish(null,null,err));
  child.once('close',(code,signal)=>finish(code,signal,null));
  timer=setTimeout(()=>{
   timedOut=true;
   try{child.kill('SIGKILL');}catch{}
   // The process can be unkillable on a broken host: still return a diagnosis.
   finish(null,'TIMEOUT',Error('Brak odpowiedzi FFmpeg.'));
  },timeoutMs);
  timer.unref?.();
  Promise.resolve().then(()=>pipeAudio(url,child.stdin,{signal:controller.signal})).catch(err=>{
   if(done||controller.signal.aborted)return;
   try{child.kill('SIGKILL');}catch{}
   finish(null,null,err);
  });
 });
}
function diagnoseLocalFFmpeg(options={}) {
 return probeFFmpeg([
  '-nostdin','-hide_banner','-loglevel','error',
  '-f','lavfi','-i','sine=frequency=440:sample_rate=48000',
  '-t','1','-ac','2','-ar','48000','-f','s16le','pipe:1'
 ],{timeoutMs:7000,...options});
}

async function diagnoseHttp(rawUrl,{fetchImpl=fetch,timeoutMs=9000}={}){
 const startedAt=Date.now();
 const result={ok:false,status:null,type:'',bytes:0,redirectHost:'',redirects:0,error:'',durationMs:0};
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 timer.unref?.();
 try{
  const {response,finalHost,redirects}=await openAudioResponse(rawUrl,{fetchImpl,signal:controller.signal});
  result.status=response.status;
  result.type=String(response.headers.get('content-type')||'').slice(0,70);
  result.redirectHost=redirects?finalHost.slice(0,100):'';
  result.redirects=redirects;
  const reader=response.body.getReader();
  try{
   const {value}=await reader.read();
   result.bytes=value?.byteLength||0;
  }finally{void reader.cancel().catch(()=>{});}
  result.ok=result.bytes>0;
 }catch(err){
  const msg=String(err?.message||'');
  const status=msg.match(/^HTTP ([0-9]{3})$/);
  if(status)result.status=Number(status[1]);
  result.error=controller.signal.aborted?'TIMEOUT':(status?'HTTP '+status[1]:String(err?.cause?.code||err?.code||err?.name||'ERROR').slice(0,70));
 }
 clearTimeout(timer);
 result.durationMs=Date.now()-startedAt;
 return result;
}

function httpText(r){
 return (r.ok?'✅ dane odebrane':'❌ brak danych')+
  ' | HTTP: '+(r.status===null?'brak':r.status)+
  ' | typ: '+(r.type||'brak')+
  ' | '+r.bytes+' B | '+r.durationMs+' ms'+
  (r.redirects?' | przekierowań: '+r.redirects+' → '+r.redirectHost:'')+
  (r.error?' | błąd: '+r.error:'');
}

function probeText(r){
 return (r.ok?'✅ audio':'❌ brak audio')+
  ' | '+r.bytes+' B'+
  ' | kod: '+(r.exitCode===null?'brak':r.exitCode)+
  ' | sygnał: '+(r.signal||'brak')+
  ' | '+r.durationMs+' ms'+
  (r.timedOut?' | LIMIT CZASU':'');
}
function formatDiagnostic(name,stream,local=null,http=null){
 const safeName=String(name||'stacja').replace(/[@<>\x60\r\n]/g,' ').slice(0,70);
 let body='🔎 NeonBeats — diagnoza: '+safeName+
  '\n🌐 Test HTTP Node.js: '+(http?httpText(http):'nie uruchomiono')+
  '\n📻 Strumień FFmpeg (Node.js → pipe:0): '+probeText(stream)+
  (local?'\n🧪 Test lokalny FFmpeg: '+probeText(local):'')+
  (stream.error?'\nBłąd procesu strumienia: '+stream.error:'')+
  (stream.details?'\n\nFFmpeg — strumień:\n'+stream.details:'\n\nFFmpeg — strumień: brak dodatkowego opisu.')+
  (local?.error?'\n\nBłąd lokalnego FFmpeg: '+local.error:'')+
  (!local?.ok&&local?.details?'\n\nFFmpeg — test lokalny:\n'+local.details:'');
 return body.slice(0,1900);
}
module.exports={probeFFmpeg,diagnoseStream,diagnoseLocalFFmpeg,diagnoseHttp,formatDiagnostic,redactFFmpeg};
