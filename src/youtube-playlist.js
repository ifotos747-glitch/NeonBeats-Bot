'use strict';
const {spawn}=require('node:child_process');
const {validatePublicUrl}=require('./media');
const {ytDlpPath,cleanYtdlpError}=require('./youtube');

const MAX_PLAYLIST_ITEMS=50;
const MAX_OUTPUT=2_000_000;
const VIDEO_ID=/^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID=/^[A-Za-z0-9_-]{8,128}$/;
const YOUTUBE_HOSTS=new Set(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtu.be']);

function isYouTubePlaylistUrl(source){
 let url;try{url=validatePublicUrl(source);}catch{return false;}
 if(!YOUTUBE_HOSTS.has(url.hostname.toLowerCase()))return false;
 return url.searchParams.has('list')&&
  (url.pathname==='/playlist'||url.pathname==='/watch'||url.hostname.toLowerCase().endsWith('youtu.be'));
}
function normalizePlaylistUrl(source){
 if(!isYouTubePlaylistUrl(source))throw Error('Podaj link playlisty YouTube, np. youtube.com/playlist?list=...');
 const u=validatePublicUrl(source);
 const id=u.searchParams.get('list')||'';
 if(!PLAYLIST_ID.test(id))throw Error('Niepoprawny identyfikator playlisty YouTube.');
 return 'https://www.youtube.com/playlist?list='+id;
}
function parsePlaylistEntries(output,{limit=MAX_PLAYLIST_ITEMS}={}){
 if(!Number.isInteger(limit)||limit<1||limit>MAX_PLAYLIST_ITEMS)throw Error('Nieprawidłowy limit playlisty.');
 const tracks=[];let skipped=0;
 for(const line of String(output||'').split(/\r?\n/)){
  if(!line.trim())continue;
  let item;try{item=JSON.parse(line);}catch{skipped++;continue;}
  const id=String(item?.id||'');
  const status=String(item?.availability||'').toLowerCase();
  const title=String(item?.title||'').replace(/[\r\n\t<>@]/g,' ').slice(0,140).trim();
  if(!VIDEO_ID.test(id)||['private','premium_only','subscriber_only','needs_auth'].includes(status)||
     /^(private video|deleted video|unavailable video)$/i.test(title)){skipped++;continue;}
  tracks.push({kind:'youtube-link',source:'https://www.youtube.com/watch?v='+id,title:title||'YouTube • '+id});
  if(tracks.length===limit)break;
 }
 return{tracks,skipped};
}
function playlistArgs(url,{limit=MAX_PLAYLIST_ITEMS}={}){
 if(!Number.isInteger(limit)||limit<1||limit>MAX_PLAYLIST_ITEMS)throw Error('Niepoprawny limit playlisty.');
 return [
  '--ignore-config','--yes-playlist','--flat-playlist','--skip-download','--dump-json',
  '--playlist-end',String(limit),'--ignore-errors','--no-warnings','--no-progress','--no-color',
  '--js-runtimes','node:'+process.execPath,'--socket-timeout','20',
  '--',normalizePlaylistUrl(url)
 ];
}
async function loadYoutubePlaylist(source,{limit=MAX_PLAYLIST_ITEMS,spawnProcess=spawn,timeoutMs=75_000}={}){
 const bin=ytDlpPath();
 if(!bin)throw Error('Brak yt-dlp. Administrator: /youtube install.');
 const args=playlistArgs(source,{limit});
 return new Promise((resolve,reject)=>{
  let stdout='',stderr='',finished=false,timedOut=false,oversize=false;
  let timer,child;
  const finish=(code,signal,error)=>{
   if(finished)return;finished=true;clearTimeout(timer);
   if(error)return reject(Error('yt-dlp: '+String(error.code||error.message).slice(0,140)));
   if(oversize)return reject(Error('Playlista jest zbyt duża do przetworzenia.'));
   if(timedOut)return reject(Error('Odczyt playlisty przekroczył limit czasu ('+Math.round(timeoutMs/1000)+' s).'));
   const result=parsePlaylistEntries(stdout,{limit});
   if(!result.tracks.length)
    return reject(Error('Nie udało się odczytać dostępnych filmów. '+cleanYtdlpError(stderr)));
   resolve({tracks:result.tracks,skipped:result.skipped,partial:code!==0,limit});
  };
  try{child=spawnProcess(bin,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});}
  catch(e){finish(null,null,e);return;}
  child.stdout?.on('data',data=>{
   stdout+=data.toString();
   if(stdout.length>MAX_OUTPUT){oversize=true;child.kill('SIGKILL');}
  });
  child.stderr?.on('data',data=>{stderr=(stderr+data.toString()).slice(-6000);});
  child.once('error',e=>finish(null,null,e));
  child.once('close',(code,signal)=>finish(code,signal,null));
  timer=setTimeout(()=>{timedOut=true;try{child.kill('SIGKILL');}catch(err){finish(null,null,err);}},timeoutMs);
  timer.unref?.();
 });
}
module.exports={MAX_PLAYLIST_ITEMS,isYouTubePlaylistUrl,normalizePlaylistUrl,parsePlaylistEntries,playlistArgs,loadYoutubePlaylist};
