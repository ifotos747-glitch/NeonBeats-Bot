'use strict';
// ALTARE sends only outgoing HTTPS requests to Cloudflare. No inbound port is exposed.
const {classifyInput}=require('./media');
const {normalizeYouTubeUrl,youtubeVideoTitle}=require('./youtube');
const radio=require('./global-radio'),store=require('./store');
const {sessions}=require('./player');

const VALID_ACTIONS=new Set(['pause','resume','skip','stop','shuffle','repeat','volume','play','radio','dj','clear']);
function safeSnapshot(client){
 return [...client.guilds.cache.values()].map(guild=>{
  const s=sessions.get(guild.id);
  return{id:guild.id,connected:!!s&&!s.closed,channelId:s?.channelId||null,
   nowPlaying:s?.current?.title||'',queue:s?.queue?.slice(0,15).map(x=>x.title)||[],
   volume:s?.volume??85,repeat:s?.repeatMode||'off',dj:s?.dj||'off',
   playerStatus:s?.player?.state?.status||'idle'};
 });
}
async function perform(client,cmd){
 if(!/^\d{15,24}$/.test(String(cmd.guild_id||''))||!VALID_ACTIONS.has(cmd.action))throw Error('Niepoprawne polecenie.');
 if(!client.guilds.cache.has(cmd.guild_id))throw Error('Bot nie jest członkiem wybranego serwera.');
 const s=sessions.get(cmd.guild_id);
 if(!s||s.closed)throw Error('Bot nie jest połączony z kanałem głosowym. Uruchom muzykę w Discordzie.');
 const value=cmd.value===null?null:JSON.parse(cmd.value);
 switch(cmd.action){
  case 'pause':if(!s.pause())throw Error('Nie można wstrzymać odtwarzania.');return 'Wstrzymano odtwarzanie.';
  case 'resume':if(!s.resume())throw Error('Nie można wznowić odtwarzania.');return 'Wznowiono odtwarzanie.';
  case 'skip':if(!s.skip())throw Error('Nie ma utworu do pominięcia.');return 'Pominięto utwór.';
  case 'stop':store.set247(cmd.guild_id,null);s.stop();return 'Odtwarzanie zatrzymane.';
  case 'shuffle':return s.shuffleQueue()?'Kolejka wymieszana.':'Za mało utworów do losowania.';
  case 'repeat':return s.toggleRepeat()==='one'?'Powtarzanie włączone.':'Powtarzanie wyłączone.';
  case 'clear':s.queue=[];void s.showControlPanel(s.current);return 'Wyczyszczono oczekujące utwory.';
  case 'volume':if(!Number.isInteger(value)||value<0||value>150)throw Error('Głośność 0–150%.');s.setVolume(value);return 'Głośność '+value+'%.';
  case 'dj':
   if(!['off','bass','nightcore','slowed','8d','echo','club'].includes(value))throw Error('Niepoprawny preset DJ.');
   store.setDJ(cmd.guild_id,value);s.setDJ(value);return 'Efekt DJ: '+value+'.';
  case 'play':{
   if(typeof value!=='string'||value.length>500)throw Error('Nieprawidłowy link YouTube.');
   const url=normalizeYouTubeUrl(value);
   const title=await youtubeVideoTitle(url)||'YouTube • '+new URL(url).searchParams.get('v');
   s.enqueue({kind:'youtube-link',source:url,title});
   return 'Dodano do kolejki: '+title;
  }
  case 'radio':{
   if(typeof value!=='string'||value.length>100)throw Error('Niepoprawna nazwa stacji.');
   const station=radio.find(value);
   if(!station)throw Error('Nie znaleziono stacji globalnej.');
   s.replace({kind:'radio',source:station.url,title:station.name,stationId:station.id});
   return 'Włączono radio: '+station.name;
  }
  default:throw Error('Nieobsługiwana operacja.');
 }
}
function startWebControl(client,{fetchImpl=fetch,intervalMs=3000}={}){
 const base=(process.env.NEONBEATS_CONTROL_URL||'').replace(/\/$/,'');
 const secret=process.env.NEONBEATS_CONTROL_SECRET||'';
 if(!base&&!secret){console.log('🌐 Web Control wyłączony (brak konfiguracji).');return null;}
 if(!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(base)||secret.length<32){
  console.warn('⚠️ Web Control wyłączony: wymagane https://... oraz silny sekret (min. 32 znaki).');return null;
 }
 let busy=false,stopped=false;
 const request=async(path,data)=>{
  const response=await fetchImpl(base+path,{method:'POST',
   headers:{authorization:'Bearer '+secret,'content-type':'application/json'},
   body:JSON.stringify(data),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  return response.json();
 };
 async function tick(){
  if(busy||stopped)return;busy=true;
  try{
   const report=await request('/api/bridge/sync',{guilds:safeSnapshot(client)});
   for(const command of report.commands||[]){
    let status='done',result='';
    try{result=await perform(client,command);}catch(e){status='failed';result=String(e.message||e).slice(0,250);}
    try{await request('/api/bridge/result',{id:command.id,status,result});}
    catch(e){console.warn('🌐 Web Control: nie zapisano wyniku '+String(e.message));}
   }
  }catch(e){console.warn('🌐 Web Control: '+String(e.message||e).slice(0,130));}
  finally{busy=false;}
 }
 const timer=setInterval(()=>void tick(),Math.max(1500,intervalMs));
 timer.unref?.();void tick();
 return()=>{stopped=true;clearInterval(timer);};
}
module.exports={safeSnapshot,perform,startWebControl};
