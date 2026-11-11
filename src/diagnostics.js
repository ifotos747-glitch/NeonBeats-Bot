'use strict';
const {spawn}=require('node:child_process');
const {ffmpegPath}=require('./config');
const {validatePublicUrl}=require('./media');

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
function diagnoseStream(rawUrl,options={}) {
 const url=validatePublicUrl(rawUrl).href;
 return probeFFmpeg([
  '-nostdin','-hide_banner','-loglevel','info',
  '-rw_timeout','12000000','-i',url,
  '-t','5','-vn','-sn','-dn',
  '-ac','2','-ar','48000','-f','s16le','pipe:1'
 ],options);
}
function diagnoseLocalFFmpeg(options={}) {
 return probeFFmpeg([
  '-nostdin','-hide_banner','-loglevel','error',
  '-f','lavfi','-i','sine=frequency=440:sample_rate=48000',
  '-t','1','-ac','2','-ar','48000','-f','s16le','pipe:1'
 ],{timeoutMs:7000,...options});
}

async function diagnoseHttp(rawUrl,{fetchImpl=fetch,timeoutMs=8000}={}) {
 const url=validatePublicUrl(rawUrl).href;
 const startedAt=Date.now();
 const result={ok:false,status:null,type:'',bytes:0,redirectHost:'',error:'',durationMs:0};
 try{
  const response=await fetchImpl(url,{
   method:'GET',redirect:'manual',signal:AbortSignal.timeout(timeoutMs),
   headers:{'User-Agent':'NeonBeatsBot/1.0','Accept':'*/*','Icy-MetaData':'0'}
  });
  result.status=response.status;
  result.type=String(response.headers.get('content-type')||'').slice(0,70);
  if(response.status>=300&&response.status<400){
   const location=response.headers.get('location');
   if(location)try{
    const next=validatePublicUrl(new URL(location,url).href);
    result.redirectHost=next.hostname.slice(0,100);
   }catch{result.error='Przekierowanie na niedozwolony adres';}
  }
  if(response.ok&&response.body){
   const reader=response.body.getReader();
   try{
    const {value}=await reader.read();
    result.bytes=value?.byteLength||0;
   }finally{void reader.cancel().catch(()=>{});}
  }
  result.ok=response.ok&&result.bytes>0;
 }catch(err){
  result.error=String(err?.cause?.code||err?.code||err?.name||'UNKNOWN').slice(0,80);
  if(err?.name==='TimeoutError'||err?.name==='AbortError')result.error='TIMEOUT';
 }
 result.durationMs=Date.now()-startedAt;
 return result;
}
function httpText(r){
 return (r.ok?'✅ dane odebrane':'❌ brak danych')+
  ' | HTTP: '+(r.status===null?'brak':r.status)+
  ' | typ: '+(r.type||'brak')+
  ' | '+r.bytes+' B | '+r.durationMs+' ms'+
  (r.redirectHost?' | przekierowanie: '+r.redirectHost:'')+
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
  '\n📻 Strumień FFmpeg: '+probeText(stream)+
  (local?'\n🧪 Test lokalny FFmpeg: '+probeText(local):'')+
  (stream.error?'\nBłąd procesu strumienia: '+stream.error:'')+
  (stream.details?'\n\nFFmpeg — strumień:\n'+stream.details:'\n\nFFmpeg — strumień: brak dodatkowego opisu.')+
  (local?.error?'\n\nBłąd lokalnego FFmpeg: '+local.error:'')+
  (!local?.ok&&local?.details?'\n\nFFmpeg — test lokalny:\n'+local.details:'');
 return body.slice(0,1900);
}
module.exports={probeFFmpeg,diagnoseStream,diagnoseLocalFFmpeg,diagnoseHttp,formatDiagnostic,redactFFmpeg};
