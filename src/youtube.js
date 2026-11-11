'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {spawn,execFile}=require('node:child_process');
const {Readable,Transform}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {ROOT}=require('./config');
const {validatePublicUrl}=require('./media');

const RELEASE='2026.10.26';
const DOWNLOAD='https://github.com/yt-dlp/yt-dlp/releases/download/'+RELEASE+'/yt-dlp_linux';
const EXPECTED_SHA256='767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795';
const LOCAL=path.join(ROOT,'bin','yt-dlp_linux');
const YT_HOSTS=new Set(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtu.be']);
const VIDEO_ID=/^[A-Za-z0-9_-]{11}$/;
let installPromise=null;

function normalizeYouTubeUrl(raw){
 const u=validatePublicUrl(raw);
 if(!YT_HOSTS.has(u.hostname.toLowerCase()))throw Error('Wymagany link YouTube.');
 let id;
 if(['youtu.be','www.youtu.be'].includes(u.hostname.toLowerCase()))id=u.pathname.slice(1);
 else if(u.pathname==='/watch')id=u.searchParams.get('v');
 else if(/^\/(?:shorts|live)\/[^/]+\/?$/.test(u.pathname))id=u.pathname.split('/')[2];
 if(!VIDEO_ID.test(id||''))throw Error('Podaj link pojedynczego filmu YouTube, nie playlistę lub kanał.');
 return 'https://www.youtube.com/watch?v='+id;
}
function ytDlpPath(){
 if(process.env.YTDLP_PATH)return process.env.YTDLP_PATH;
 return fs.existsSync(LOCAL)?LOCAL:null;
}
function youtubeArgs(url,download){
 return [
  '--ignore-config','--no-playlist','--no-progress','--no-color',
  '--js-runtimes','node:'+process.execPath,
  '--socket-timeout','20','-f','bestaudio/best',
  ...(download?['-o','-']:['--skip-download','--print','%(title)s']),
  '--',normalizeYouTubeUrl(url)
 ];
}
function cleanYtdlpError(raw){
 const lines=String(raw||'').replace(/https?:\/\/\S+/gi,'[URL]')
  .replace(/[<>\x60]/g,' ').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const result=lines.slice(-4).join(' ').slice(-450);
 if(/sign in|confirm you.re not a bot|cookies|login|log in|authentication|account/i.test(result))
  return 'YouTube wymaga weryfikacji lub logowania z tego hostingu. Nie podawaj cookies. '+result.slice(-150);
 return result||'Brak szczegółów. Sprawdź /youtube diagnoza.';
}
async function installYtDlp({fetchImpl=fetch}={}){
 if(process.env.YTDLP_PATH)throw Error('Ustawiono YTDLP_PATH. Plik silnika jest zarządzany ręcznie.');
 if(installPromise)return installPromise;
 installPromise=(async()=>{
  await fsp.mkdir(path.dirname(LOCAL),{recursive:true});
  if(fs.existsSync(LOCAL)){
   await fsp.chmod(LOCAL,0o755);
   return LOCAL;
  }
  const tmp=LOCAL+'.'+process.pid+'.part';
  let count=0;
  const digest=crypto.createHash('sha256');
  try{
   const response=await fetchImpl(DOWNLOAD,{signal:AbortSignal.timeout(120000)});
   if(!response.ok||!response.body)throw Error('Pobieranie yt-dlp: HTTP '+response.status);
   const inspect=new Transform({transform(chunk,_enc,cb){
    count+=chunk.length;
    if(count>65000000)return cb(Error('yt-dlp przekracza limit rozmiaru 65 MB'));
    digest.update(chunk);cb(null,chunk);
   }});
   await pipeline(Readable.fromWeb(response.body),inspect,fs.createWriteStream(tmp,{mode:0o700}));
   if(digest.digest('hex')!==EXPECTED_SHA256)throw Error('Nieprawidłowa suma SHA-256. Instalacja przerwana.');
   await fsp.chmod(tmp,0o755);
   await fsp.rename(tmp,LOCAL);
   return LOCAL;
  }finally{await fsp.rm(tmp,{force:true}).catch(()=>{});}
 })();
 try{return await installPromise;}finally{installPromise=null;}
}
function ytDlpVersion(){
 return new Promise(resolve=>{
  const bin=ytDlpPath();
  if(!bin)return resolve({ok:false,description:'Brak yt-dlp. Użyj /youtube install.'});
  execFile(bin,['--version'],{timeout:7000,encoding:'utf8',maxBuffer:65536},(err,stdout)=>{
   if(err)return resolve({ok:false,description:'Nie można uruchomić yt-dlp: '+String(err.code||err.message).slice(0,110)});
   resolve({ok:true,description:String(stdout).trim().slice(0,75)});
  });
 });
}
function spawnYouTube(url){
 const bin=ytDlpPath();
 if(!bin)throw Error('Brak yt-dlp na ALTARE. Administrator: /youtube install.');
 return spawn(bin,youtubeArgs(url,true),{stdio:['ignore','pipe','pipe'],windowsHide:true});
}
function diagnoseYouTube(url,{timeoutMs=45000}={}){
 const bin=ytDlpPath();
 if(!bin)throw Error('Brak yt-dlp. Administrator: /youtube install.');
 const args=youtubeArgs(url,false);
 return new Promise(resolve=>{
  let output='',errText='',finished=false,timer;
  const finish=(code,signal,error)=>{
   if(finished)return;finished=true;clearTimeout(timer);
   resolve({
    ok:code===0,title:code===0?output.trim().split(/\r?\n/)[0].slice(0,130):'',
    message:error?String(error.code||error.message).slice(0,120):cleanYtdlpError(errText),
    code:code??null,signal:signal||null
   });
  };
  let child;
  try{child=spawn(bin,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});}
  catch(error){finish(null,null,error);return;}
  child.stdout.on('data',d=>{output=(output+d.toString()).slice(-3000);});
  child.stderr.on('data',d=>{errText=(errText+d.toString()).slice(-4000);});
  child.once('error',e=>finish(null,null,e));
  child.once('close',(code,signal)=>finish(code,signal,null));
  timer=setTimeout(()=>{try{child.kill('SIGKILL');}catch{}},timeoutMs);
  timer.unref?.();
 });
}
module.exports={RELEASE,LOCAL,normalizeYouTubeUrl,ytDlpPath,youtubeArgs,cleanYtdlpError,installYtDlp,ytDlpVersion,spawnYouTube,diagnoseYouTube};
