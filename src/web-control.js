'use strict';
// ALTARE sends only outgoing HTTPS requests to Cloudflare. No inbound port is exposed.
const {classifyInput}=require('./media');
const {spawn}=require('node:child_process');
const {ytDlpPath,ytDlpEnvironment}=require('./youtube');
const {normalizeYouTubeUrl,youtubeVideoTitle}=require('./youtube');
const {loadYoutubePlaylist,isYouTubePlaylistUrl,validateRange}=require('./youtube-playlist');
const radio=require('./global-radio'),store=require('./store'),premium=require('./premium');
const {sessions}=require('./player');

const VALID_ACTIONS=new Set(['pause','resume','skip','stop','shuffle','repeat','volume','play','playlist','radio','dj','clear','search','save-list','load-list','delete-list','queue-move','queue-remove','favorite-add','favorite-remove','radio-search','premium-grant','premium-revoke','premium-status','premium-list','premium-manage']);
const lastCurrent=new Map();
async function searchMusic(query){
 if(typeof query!=='string'||query.trim().length<2||query.length>80)throw Error('Wyszukiwanie: wpisz 2–80 znaków.');
 const bin=ytDlpPath();if(!bin)throw Error('Brak yt-dlp — sprawdź /youtube status.');
 return new Promise((resolve,reject)=>{
  const args=['--ignore-config','--flat-playlist','--skip-download','--dump-json','--no-warnings','--no-progress','--socket-timeout','20','--js-runtimes','node:'+process.execPath,'--','ytsearch5:'+query.trim()];
  let output='',settled=false;const child=spawn(bin,args,{env:ytDlpEnvironment(),stdio:['ignore','pipe','pipe'],windowsHide:true});
  const timeout=setTimeout(()=>{child.kill('SIGKILL');finish(Error('Upłynął czas wyszukiwania YouTube.'));},45000);
  function finish(error){if(settled)return;settled=true;clearTimeout(timeout);if(error)return reject(error);const items=[];
   for(const line of output.split(/\r?\n/)){try{const v=JSON.parse(line),id=v.id;if(/^[a-zA-Z0-9_-]{11}$/.test(id))items.push({title:String(v.title||'Utwór').slice(0,110),url:'https://www.youtube.com/watch?v='+id});}catch{}}
   resolve(JSON.stringify(items.slice(0,5)));}
  child.stdout.on('data',b=>{output+=String(b);if(output.length>100000){child.kill('SIGKILL');finish(Error('Zbyt duża odpowiedź YouTube.'));}});
  child.on('error',finish);child.on('close',()=>finish());
 });
}
function safeSnapshot(client){
 const radioCount=radio.list().length;
 return [...client.guilds.cache.values()].map(guild=>{
  const s=sessions.get(guild.id);
  const current=s?.current;
  if(current&&!s.closed){const key=current.kind+'|'+current.source;
   if(lastCurrent.get(guild.id)!==key){lastCurrent.set(guild.id,key);try{store.recordPlay(guild.id,current);}catch(e){console.warn('Historia Web Control: '+e.message);}}
  }else lastCurrent.delete(guild.id);
  const saved=store.read(guild.id);
  return{id:guild.id,connected:!!s&&!s.closed,channelId:s?.channelId||null,
   nowSource:current?.kind==='youtube-link'?current.source:null,
   queueTracks:s?.queue?.slice(0,100).map(t=>({title:String(t.title||'').slice(0,140),source:t.kind==='youtube-link'?String(t.source||''):null}))||[],
   history:saved.history.slice(0,30),
   savedPlaylists:Object.entries(saved.playlists).slice(0,50).map(([name,tracks])=>({name,count:Array.isArray(tracks)?tracks.length:0})),
   favorites:saved.favorites.slice(0,250),stats:saved.stats,
   queueTotal:s?.queue?.length||0,
   radioCount,
   premium:premium.status(guild.id,Date.now(),saved),
   nowPlaying:s?.current?.title||'',queue:s?.queue?.slice(0,15).map(x=>x.title)||[],
   volume:s?.volume??85,repeat:s?.repeatMode||'off',dj:s?.dj||'off',
   playerStatus:s?.player?.state?.status||'idle'};
 });
}
async function perform(client,cmd){
 if(!/^\d{15,24}$/.test(String(cmd.guild_id||''))||!VALID_ACTIONS.has(cmd.action))throw Error('Niepoprawne polecenie.');
 if(!client.guilds.cache.has(cmd.guild_id))throw Error('Bot nie jest członkiem wybranego serwera.');
 const value=cmd.value===null?null:JSON.parse(cmd.value);
 if(cmd.action==='premium-list'){
  premium.requireOwner(cmd.user_id);
  return JSON.stringify(premium.list([...client.guilds.cache.values()].map(g=>({id:g.id,name:g.name})),value??0));
 }
 if(cmd.action==='premium-manage'){
  premium.requireOwner(cmd.user_id);
  if(!value||typeof value!=='object'||!/^\d{15,24}$/.test(String(value.guildId||''))||!['grant','revoke'].includes(value.operation))throw Error('Niepoprawne polecenie administracyjne Premium.');
  if(!client.guilds.cache.has(value.guildId))throw Error('Bot nie należy do wskazanego serwera.');
  const state=value.operation==='grant'?premium.grant(value.guildId,value.days,cmd.user_id):premium.revoke(value.guildId,cmd.user_id);
  return 'Premium dla '+value.guildId+': '+(state.active?'aktywne do '+new Date(state.expiresAt).toISOString().slice(0,10):'wyłączone')+'.';
 }
 if(cmd.action==='premium-grant'){premium.requireOwner(cmd.user_id);const state=premium.grant(cmd.guild_id,value,cmd.user_id);return 'Premium aktywne do '+new Date(state.expiresAt).toISOString().slice(0,10)+' ('+state.daysLeft+' dni).';}
 if(cmd.action==='premium-revoke'){premium.requireOwner(cmd.user_id);premium.revoke(cmd.guild_id,cmd.user_id);return 'Premium wyłączone na tym serwerze.';}
 if(cmd.action==='premium-status'){const state=premium.status(cmd.guild_id);return state.active?'Premium aktywne do '+new Date(state.expiresAt).toISOString().slice(0,10)+'.':'Premium nieaktywne.';}
 const s=sessions.get(cmd.guild_id);
 if(!s||s.closed)throw Error('Bot nie jest połączony z kanałem głosowym. Uruchom muzykę w Discordzie.');
 switch(cmd.action){
  case 'queue-move':{
   if(!value||!Number.isInteger(value.from)||!Number.isInteger(value.to)||value.from<0||value.to<0||value.from>=s.queue.length||value.to>=s.queue.length)throw Error('Nieprawidłowe pozycje kolejki.');
   if(value.from===value.to)return 'Pozycja bez zmian.';
   const [track]=s.queue.splice(value.from,1);s.queue.splice(value.to,0,track);void s.showControlPanel(s.current);
   return 'Przeniesiono utwór na pozycję '+(value.to+1)+'.';
  }
  case 'queue-remove':{
   if(!Number.isInteger(value)||value<0||value>=s.queue.length)throw Error('Nieprawidłowa pozycja w kolejce.');
   const [track]=s.queue.splice(value,1);void s.showControlPanel(s.current);
   return 'Usunięto z kolejki: '+track.title;
  }
  case 'favorite-add':{
   if(typeof value!=='string')throw Error('Nieprawidłowy link.');
   const track=[s.current,...s.queue,...store.read(cmd.guild_id).history].find(x=>x?.source===value&&x.kind==='youtube-link');
   if(!track)throw Error('Można dodać tylko utwór YouTube z odtwarzania, kolejki lub historii.');
   const saved=store.addFavorite(cmd.guild_id,track.source,track.title);return saved?'Dodano do ulubionych.':'Utwór jest już w ulubionych.';
  }
  case 'favorite-remove':store.removeFavorite(cmd.guild_id,value);return 'Usunięto z ulubionych.';
  case 'radio-search':{
   if(typeof value!=='string'||value.trim().length<1||value.length>70)throw Error('Podaj nazwę stacji (1–70 znaków).');
   // Return only public names and IDs, never radio stream URLs.
   return JSON.stringify(radio.search(value).slice(0,15).map(st=>({id:st.id,name:st.name})));
  }
  case 'search':return searchMusic(value);
  case 'save-list':{
   if(typeof value!=='string'||value.trim().length<1||value.length>40)throw Error('Nazwa playlisty: 1–40 znaków.');
   const count=store.savePlaylist(cmd.guild_id,value,s.queue);
   return 'Zapisano playlistę '+value+' ('+count+' utworów).';
  }
  case 'load-list':{
   if(typeof value!=='string'||value.length>40)throw Error('Nieprawidłowa nazwa.');
   const tracks=store.loadPlaylist(cmd.guild_id,value);
   const available=100-s.queue.length;
   if(!available)throw Error('Kolejka pełna.');
   const subset=tracks.slice(0,available);
   if(!subset.length)throw Error('Zapisana playlista jest pusta.');
   if(s.current?.continuous){s.queue.push(...subset);void s.showControlPanel(s.current);}
   else s.enqueueMany(subset);
   return 'Wczytano '+subset.length+' utworów z playlisty '+value+'.';
  }
  case 'delete-list':{
   if(typeof value!=='string'||value.length>40)throw Error('Nieprawidłowa nazwa.');
   store.deletePlaylist(cmd.guild_id,value);return 'Usunięto playlistę '+value+'.';
  }
  case 'pause':if(!s.pause())throw Error('Nie można wstrzymać odtwarzania.');return 'Wstrzymano odtwarzanie.';
  case 'resume':if(!s.resume())throw Error('Nie można wznowić odtwarzania.');return 'Wznowiono odtwarzanie.';
  case 'skip':if(!s.skip())throw Error('Nie ma utworu do pominięcia.');return 'Pominięto utwór.';
  case 'stop':store.set247(cmd.guild_id,null);s.stop();return 'Odtwarzanie zatrzymane.';
  case 'shuffle':return s.shuffleQueue()?'Kolejka wymieszana.':'Za mało utworów do losowania.';
  case 'repeat':return s.toggleRepeat()==='one'?'Powtarzanie włączone.':'Powtarzanie wyłączone.';
  case 'clear':s.queue=[];void s.showControlPanel(s.current);return 'Wyczyszczono oczekujące utwory.';
  case 'volume':if(!Number.isInteger(value)||value<0||value>150)throw Error('Głośność 0–150%.');s.setVolume(value);return 'Głośność '+value+'%.';
  case 'dj':
   if(!['off','bass','nightcore','slowed','8d','echo','club','deep','vocal','soft','stadium','lofi','crystal'].includes(value))throw Error('Niepoprawny preset DJ.');
   if(premium.PREMIUM_DJ.has(value))premium.requirePremium(cmd.guild_id);
   store.setDJ(cmd.guild_id,value);s.setDJ(value);return 'Efekt DJ: '+value+'.';
  case 'play':{
   if(typeof value!=='string'||value.length>500)throw Error('Nieprawidłowy link YouTube.');
   const url=normalizeYouTubeUrl(value);
   const title=await youtubeVideoTitle(url)||'YouTube • '+new URL(url).searchParams.get('v');
   s.enqueue({kind:'youtube-link',source:url,title});
   return 'Dodano do kolejki: '+title;
  }
  case 'playlist':{
   if(!value||typeof value!=='object'||typeof value.url!=='string'||value.url.length>500||!isYouTubePlaylistUrl(value.url))throw Error('Podaj prawidłowy link playlisty YouTube.');
   const {start,limit}=validateRange({start:value.start,limit:value.limit});
   if(s.queue.length>=100)throw Error('Kolejka jest pełna (100 utworów).');
   const result=await loadYoutubePlaylist(value.url,{start,limit});
   if(s.closed)throw Error('Bot opuścił kanał głosowy.');
   const space=100-s.queue.length;
   if(space<1)throw Error('Kolejka jest pełna (100 utworów).');
   const tracks=result.tracks.slice(0,space);
   // Do not interrupt currently playing radio/AutoDJ when adding a playlist from WWW.
   if(s.current?.continuous){s.queue.push(...tracks);void s.showControlPanel(s.current);}
   else s.enqueueMany(tracks);
   return '✅ Playlista YouTube: znaleziono '+result.tracks.length+' utworów, dodano '+tracks.length+' do kolejki (od pozycji '+start+'). Pominięto '+result.skipped+'.'+(result.partial?' ⚠️ Niektóre pozycje mogły być niedostępne.':'')+(tracks.length<result.tracks.length?' Limit kolejki 100 utworów.':'')+(s.current?.continuous?' Aktualne radio/AutoDJ gra dalej; aby przejść do kolejki, użyj Pomiń.':'');
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
 const guildJobs=new Map();
 function scheduleCommand(command){
  // Keep the commands in order for one guild, but never let a slow playlist
  // extraction on guild A block stop/skip on independent guild B.
  const id=command.guild_id;
  const previous=guildJobs.get(id)||Promise.resolve();
  const next=previous.catch(()=>{}).then(async()=>{
   let status='done',result='';
   try{result=await perform(client,command);}catch(e){status='failed';result=String(e.message||e).slice(0,2000);}
   try{await request('/api/bridge/result',{id:command.id,status,result});}
   catch(e){console.warn('🌐 Web Control: nie zapisano wyniku '+String(e.message));}
  });
  guildJobs.set(id,next);
  void next.finally(()=>{if(guildJobs.get(id)===next)guildJobs.delete(id);}).catch(()=>{});
 }
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
   for(const command of report.commands||[])scheduleCommand(command);
  }catch(e){console.warn('🌐 Web Control: '+String(e.message||e).slice(0,130));}
  finally{busy=false;}
 }
 const timer=setInterval(()=>void tick(),Math.max(1500,intervalMs));
 timer.unref?.();void tick();
 return()=>{stopped=true;clearInterval(timer);};
}
module.exports={safeSnapshot,perform,startWebControl};
