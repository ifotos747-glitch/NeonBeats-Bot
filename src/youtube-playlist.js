'use strict';
const {spawn}=require('node:child_process');
const {validatePublicUrl}=require('./media');
const {ytDlpPath,ytDlpEnvironment,isPyInstallerError,cleanYtdlpError}=require('./youtube');

const MAX_PLAYLIST_ITEMS=100;
const MAX_OUTPUT=4_000_000;
const VIDEO_ID=/^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID=/^[A-Za-z0-9_-]{8,128}$/;
const YOUTUBE_HOSTS=new Set(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtu.be']);

function isYouTubePlaylistUrl(source){
 let u;try{u=validatePublicUrl(source);}catch{return false;}
 if(!YOUTUBE_HOSTS.has(u.hostname.toLowerCase()))return false;
 return u.searchParams.has('list') &&
  (u.pathname==='/playlist'||u.pathname==='/watch'||['youtu.be','www.youtu.be'].includes(u.hostname.toLowerCase()));
}
function normalizePlaylistUrl(source){
 if(!isYouTubePlaylistUrl(source))throw Error('Podaj link playlisty YouTube, np. youtube.com/playlist?list=...');
 const u=validatePublicUrl(source),id=u.searchParams.get('list')||'';
 if(!PLAYLIST_ID.test(id))throw Error('Niepoprawny identyfikator playlisty YouTube.');
 return 'https://www.youtube.com/playlist?list='+id;
}
function validateRange({start=1,limit=MAX_PLAYLIST_ITEMS}={}){
 if(!Number.isInteger(start)||start<1||start>10000)throw Error('Pozycja początkowa playlisty musi być od 1 do 10000.');
 if(!Number.isInteger(limit)||limit<1||limit>MAX_PLAYLIST_ITEMS)throw Error('Liczba utworów musi być od 1 do 100.');
 if(start+limit-1>10000)throw Error('Zakres playlisty nie może przekroczyć pozycji 10000.');
 return {start,limit};
}
function videoIdFromItem(item){
 for(const candidate of [item?.id,item?.url,item?.webpage_url,item?.original_url]){
  if(typeof candidate!=='string')continue;
  if(VIDEO_ID.test(candidate))return candidate;
  let url;
  try{
   url=validatePublicUrl(candidate.startsWith('/watch?')?'https://www.youtube.com'+candidate:candidate);
  }catch{continue;}
  if(!YOUTUBE_HOSTS.has(url.hostname.toLowerCase()))continue;
  let id;
  if(['youtu.be','www.youtu.be'].includes(url.hostname.toLowerCase()))id=url.pathname.slice(1);
  else if(url.pathname==='/watch')id=url.searchParams.get('v');
  else if(/^\/(?:shorts|live|embed)\/[^/]+\/?$/.test(url.pathname))id=url.pathname.split('/')[2];
  if(VIDEO_ID.test(id||''))return id;
 }
 return null;
}
function parsePlaylistEntries(output,{limit=MAX_PLAYLIST_ITEMS}={}){
 validateRange({limit});
 const tracks=[],reasons={unavailable:0,unrecognized:0,invalidMetadata:0};
 let examined=0;
 for(const line of String(output||'').split(/\r?\n/)){
  if(!line.trim())continue;
  examined++;
  let item;
  try{item=JSON.parse(line);}catch{reasons.invalidMetadata++;continue;}
  const availability=String(item?.availability||'').toLowerCase();
  const title=String(item?.title||'').replace(/[\r\n\t<>@]/g,' ').slice(0,140).trim();
  if(['private','premium_only','subscriber_only','needs_auth'].includes(availability)||
    /^(private video|deleted video|unavailable video)$/i.test(title)){
   reasons.unavailable++;continue;
  }
  const id=videoIdFromItem(item);
  if(!id){reasons.unrecognized++;continue;}
  // Incomplete metadata is normal with --flat-playlist. Resolve actual audio only when playing.
  tracks.push({kind:'youtube-link',source:'https://www.youtube.com/watch?v='+id,title:title||'YouTube • '+id});
  if(tracks.length>=limit)break;
 }
 return{tracks,skipped:reasons.unavailable+reasons.unrecognized+reasons.invalidMetadata,reasons,examined};
}
function playlistArgs(source,range={}){
 const {start,limit}=validateRange(range);
 return[
  '--ignore-config','--yes-playlist','--flat-playlist','--skip-download','--dump-json',
  '--playlist-items',start+':'+(start+limit-1),
  '--ignore-errors','--no-warnings','--no-progress','--no-color',
  '--js-runtimes','node:'+process.execPath,'--socket-timeout','25',
  '--extractor-retries','3',
  '--',normalizePlaylistUrl(source)
 ];
}
async function loadYoutubePlaylist(source,{start=1,limit=MAX_PLAYLIST_ITEMS,spawnProcess=spawn,timeoutMs=120_000}={}){
 const bin=ytDlpPath();
 if(!bin)throw Error('Brak yt-dlp. Administrator: /youtube install.');
 const args=playlistArgs(source,{start,limit});
 return new Promise((resolve,reject)=>{
  let stdout='',stderr='',finished=false,timedOut=false,oversize=false;
  let timer,child;
  const finish=(code,signal,error)=>{
   if(finished)return;finished=true;clearTimeout(timer);
   if(error)return reject(Error('yt-dlp: '+String(error.code||error.message).slice(0,140)));
   if(oversize)return reject(Error('Playlista jest zbyt duża do przetworzenia.'));
   if(timedOut)return reject(Error('Odczyt playlisty przekroczył limit czasu ('+Math.round(timeoutMs/1000)+' s).'));
   if(isPyInstallerError(stderr))return reject(Error('Błąd uruchomienia yt-dlp podczas odczytu playlisty: '+cleanYtdlpError(stderr)));
   const parsed=parsePlaylistEntries(stdout,{limit});
   if(!parsed.tracks.length)return reject(Error('Nie odczytano żadnego publicznie dostępnego filmu w tym zakresie. '+cleanYtdlpError(stderr)));
   resolve({...parsed,partial:code!==0||/(?:ERROR:|WARNING:)/.test(stderr),start,limit});
  };
  try{child=spawnProcess(bin,args,{stdio:['ignore','pipe','pipe'],windowsHide:true,env:ytDlpEnvironment()});}
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
module.exports={MAX_PLAYLIST_ITEMS,isYouTubePlaylistUrl,normalizePlaylistUrl,validateRange,videoIdFromItem,parsePlaylistEntries,playlistArgs,loadYoutubePlaylist};
