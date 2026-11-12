'use strict';
// Cloudflare Worker: serve static NeonBeats website + authenticated Discord control API.
// D1 is required; tokens and bridge secrets are provided only via Cloudflare Secrets.
const COOKIE='nb_session';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const fail=(message,status=400)=>json({error:message},status);
const SEC=1000;
const SESSION_TTL=90*24*60*60*SEC; // Renewed on activity; Discord tokens are separately refreshed.
const REFRESH_MARGIN=5*60*SEC;
const COOKIE_MAX_AGE=Math.floor(SESSION_TTL/SEC);
function sessionCookie(id){return COOKIE+'='+id+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+COOKIE_MAX_AGE;}
const now=()=>Date.now();
const validGuild=id=>/^\d{15,24}$/.test(String(id||''));
function cookie(request,key){return (request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1)||'';}
function appOrigin(env){return String(env.PUBLIC_ORIGIN||'').replace(/\/$/,'');}
function secureOrigin(request,env){
 const origin=request.headers.get('origin');
 return origin===appOrigin(env);
}
function isBridge(request,env){
 const a=request.headers.get('authorization')||'';
 return Boolean(env.BRIDGE_SECRET&&env.BRIDGE_SECRET.length>=32&&a==='Bearer '+env.BRIDGE_SECRET);
}
async function apiDiscord(route,token){
 const r=await fetch('https://discord.com/api/v10'+route,{headers:{authorization:'Bearer '+token,'accept':'application/json'}});
 if(!r.ok)throw Error('DISCORD_'+r.status);
 return r.json();
}
async function refreshDiscordToken(env,id,stored,oldValue){
 const form=new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,client_secret:env.DISCORD_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:stored.refresh_token});
 const r=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});
 if(!r.ok)throw Error('DISCORD_REFRESH_'+r.status);
 const token=await r.json();
 if(!token.access_token||!token.refresh_token)throw Error('DISCORD_REFRESH_INCOMPLETE');
 const data={access_token:token.access_token,refresh_token:token.refresh_token,access_expires_at:now()+Math.max(60,Number(token.expires_in||3600))*SEC};
 const update=await env.DB.prepare('UPDATE sessions SET access_token=? WHERE id=? AND access_token=?').bind(JSON.stringify(data),id,oldValue).run();
 if(update.meta?.changes===0){
  // Another request already refreshed and rotated this Discord token.
  const latest=await env.DB.prepare('SELECT access_token FROM sessions WHERE id=?').bind(id).first();
  if(latest){try{const current=JSON.parse(latest.access_token);if(current.access_token)return current;}catch{}}
 }
 return data;
}
async function session(request,env){
 const id=cookie(request,COOKIE);
 if(!/^[a-f0-9-]{36}$/.test(id))return null;
 const s=await env.DB.prepare('SELECT user_id,access_token,expires_at FROM sessions WHERE id=?').bind(id).first();
 if(!s||s.expires_at<=now())return null;
 let token;
 try{token=JSON.parse(s.access_token);}catch{
  // Legacy sessions did not save Discord refresh tokens and require one re-login.
  return null;
 }
 if(!token||typeof token.access_token!=='string'||typeof token.refresh_token!=='string')return null;
 if(!Number.isFinite(token.access_expires_at))return null;
 if(token.access_expires_at<=now()+REFRESH_MARGIN){
  try{token=await refreshDiscordToken(env,id,token,s.access_token);}
  catch(e){
   // A concurrent request may have refreshed first: check the latest stored token.
   const latest=await env.DB.prepare('SELECT access_token FROM sessions WHERE id=?').bind(id).first();
   if(!latest||latest.access_token===s.access_token)return null;
   try{token=JSON.parse(latest.access_token);}catch{return null;}
   if(!token.access_token||token.access_expires_at<=now())return null;
  }
 }
 if(s.expires_at<now()+SESSION_TTL-24*60*60*SEC)
  await env.DB.prepare('UPDATE sessions SET expires_at=? WHERE id=?').bind(now()+SESSION_TTL,id).run();
 return {id,user_id:s.user_id,access_token:token.access_token};
}
async function authorizedGuilds(sessionInfo){
 const guilds=await apiDiscord('/users/@me/guilds',sessionInfo.access_token);
 return guilds.filter(g=>g.owner||(BigInt(g.permissions||'0')&40n)!==0n).map(g=>({id:g.id,name:g.name,icon:g.icon}));
}
function validAction(body){
 if(!body||typeof body!=='object')return false;
 const allowed=['pause','resume','skip','stop','shuffle','repeat','volume','play','radio','dj','clear'];
 if(!allowed.includes(body.action))return false;
 if(body.action==='volume')return Number.isInteger(body.value)&&body.value>=0&&body.value<=150;
 if(body.action==='play')return typeof body.value==='string'&&body.value.length<=500&&/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(body.value);
 if(body.action==='radio')return typeof body.value==='string'&&body.value.length>0&&body.value.length<=100;
 if(body.action==='dj')return ['off','bass','nightcore','slowed','8d','echo','club'].includes(body.value);
 return body.value===undefined||body.value===null;
}
async function botOnline(env,guildId){
 const s=await env.DB.prepare('SELECT payload,updated_at FROM snapshots WHERE guild_id=?').bind(guildId).first();
 if(!s||now()-s.updated_at>30000)return null;
 return JSON.parse(s.payload);
}
async function handle(request,env){
 const url=new URL(request.url),pathname=url.pathname;
 if(pathname==='/dashboard'&&request.method==='GET'){
  // Fetch the canonical, extensionless asset path directly to avoid an HTML redirect loop.
  return env.ASSETS.fetch(request);
 }
 if(pathname==='/api/health')return json({ok:true,service:'NeonBeats Web Control',time:now()});
 if(pathname==='/auth/login'&&request.method==='GET'){
  if(!env.DISCORD_CLIENT_ID||!env.DISCORD_CLIENT_SECRET||!appOrigin(env))return fail('Nie skonfigurowano OAuth Discord.',503);
  const state=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO oauth_states(state,created_at) VALUES(?,?)').bind(state,now()).run();
  const query=new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,redirect_uri:appOrigin(env)+'/auth/callback',response_type:'code',scope:'identify guilds',state});
  return Response.redirect('https://discord.com/oauth2/authorize?'+query.toString(),302);
 }
 if(pathname==='/auth/callback'&&request.method==='GET'){
  const code=url.searchParams.get('code'),state=url.searchParams.get('state');
  if(!code||!state||state.length>150)return fail('Brak kodu Discord OAuth.',400);
  const saved=await env.DB.prepare('DELETE FROM oauth_states WHERE state=? RETURNING created_at').bind(state).first();
  if(!saved||now()-saved.created_at>10*60*SEC)return fail('Sesja logowania wygasła.',403);
  const form=new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,client_secret:env.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code,redirect_uri:appOrigin(env)+'/auth/callback'});
  const response=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});
  if(!response.ok)return fail('Discord odrzucił logowanie.',401);
  const token=await response.json(),user=await apiDiscord('/users/@me',token.access_token);
  if(!token.refresh_token)return fail('Discord nie zwrócił tokenu odnawiania.',502);
  const id=crypto.randomUUID(),expires=now()+SESSION_TTL;
  const stored=JSON.stringify({access_token:token.access_token,refresh_token:token.refresh_token,access_expires_at:now()+Math.max(60,Number(token.expires_in||3600))*SEC});
  await env.DB.prepare('INSERT INTO sessions(id,user_id,access_token,expires_at) VALUES(?,?,?,?)').bind(id,user.id,stored,expires).run();
  const h=new Headers({location:'/dashboard','cache-control':'no-store'});
  h.append('set-cookie',sessionCookie(id));
  return new Response(null,{status:302,headers:h});
 }
 if(pathname==='/auth/logout'&&request.method==='POST'){
  if(!secureOrigin(request,env))return fail('Błędne pochodzenie żądania.',403);
  const id=cookie(request,COOKIE);
  if(id)await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(id).run();
  const h=new Headers({'content-type':'application/json','cache-control':'no-store'});
  h.set('set-cookie',COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return new Response('{"ok":true}',{headers:h});
 }
 if(pathname==='/api/bridge/sync'&&request.method==='POST'){
  if(!isBridge(request,env))return fail('Nieautoryzowany bot.',401);
  const data=await request.json();
  if(!Array.isArray(data.guilds)||data.guilds.length>300)return fail('Nieprawidłowe dane bota.');
  const batch=data.guilds.filter(g=>validGuild(g.id)).map(g=>env.DB.prepare(
   'INSERT INTO snapshots(guild_id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(guild_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at WHERE snapshots.payload<>excluded.payload OR snapshots.updated_at<excluded.updated_at-15000'
  ).bind(g.id,JSON.stringify({connected:!!g.connected,channelId:g.channelId||null,nowPlaying:String(g.nowPlaying||'').slice(0,140),queue:(g.queue||[]).slice(0,15).map(x=>String(x).slice(0,140)),volume:g.volume??85,repeat:g.repeat||'off',dj:g.dj||'off',playerStatus:g.playerStatus||'idle'}),now()));
  for(let i=0;i<batch.length;i+=50)await env.DB.batch(batch.slice(i,i+50));
  const cmds=await env.DB.prepare("UPDATE commands SET status='running' WHERE id IN (SELECT id FROM commands WHERE status='pending' ORDER BY created_at ASC LIMIT 15) RETURNING id,guild_id,action,value").all();
  return json({commands:cmds.results||[]});
 }
 if(pathname==='/api/bridge/result'&&request.method==='POST'){
  if(!isBridge(request,env))return fail('Nieautoryzowany bot.',401);
  const body=await request.json();
  if(typeof body.id!=='string'||!['done','failed'].includes(body.status))return fail('Niepoprawny wynik.');
  await env.DB.prepare("UPDATE commands SET status=?,result=? WHERE id=? AND status='running'").bind(body.status,String(body.result||'').slice(0,250),body.id).run();
  return json({ok:true});
 }
 if(pathname.startsWith('/api/')){
  const s=await session(request,env);
  if(!s)return fail('Zaloguj się przez Discord.',401);
  let guilds;try{guilds=await authorizedGuilds(s);}catch{return fail('Sesja Discord wygasła. Zaloguj się ponownie.',401);}
  if(pathname==='/api/me'&&request.method==='GET')return json({userId:s.user_id,guilds:await Promise.all(guilds.map(async g=>({...g,botOnline:!!(await botOnline(env,g.id))})))});
  const match=pathname.match(/^\/api\/guild\/(\d{15,24})(?:\/(control))?$/);
  if(match){
   const guildId=match[1];
   if(!guilds.some(g=>g.id===guildId))return fail('Brak uprawnień Zarządzanie serwerem.',403);
   const bot=await botOnline(env,guildId);
   if(!bot)return fail('Bot nie jest połączony z panelem lub serwer jest niedostępny.',409);
   if(request.method==='GET'&&!match[2])return json({guild:guilds.find(g=>g.id===guildId),bot});
   if(request.method==='POST'&&match[2]){
    if(!secureOrigin(request,env)||!(request.headers.get('content-type')||'').startsWith('application/json'))return fail('Zablokowano żądanie.',403);
    if(!bot.connected)return fail('Najpierw uruchom odtwarzanie na kanale Discord, aby połączyć bota z głosem.',409);
    const body=await request.json();
    if(!validAction(body))return fail('Niepoprawna komenda.',400);
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO commands(id,guild_id,user_id,action,value,status,created_at,result) VALUES(?,?,?,?,?,?,?,?)').bind(id,guildId,s.user_id,body.action,body.value===undefined?null:JSON.stringify(body.value),'pending',now(),'').run();
    return json({ok:true,id},202);
   }
  }
  const cmd=pathname.match(/^\/api\/command\/([a-f0-9-]{36})$/);
  if(cmd&&request.method==='GET'){
   const c=await env.DB.prepare('SELECT id,guild_id,status,result FROM commands WHERE id=? AND user_id=?').bind(cmd[1],s.user_id).first();
   if(!c||!guilds.some(g=>g.id===c.guild_id))return fail('Nie znaleziono komendy.',404);
   return json(c);
  }
  return fail('Nie znaleziono zasobu.',404);
 }
 return env.ASSETS.fetch(request);
}
export default {async fetch(request,env){
 try{
  if(!env.DB)return fail('Brak powiązania z bazą D1.',503);
  const response=await handle(request,env);
  // Sliding browser cookie for successfully authenticated panel API requests.
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')&&path!=='/api/health'&&(response.status===200||response.status===202)){
   const id=cookie(request,COOKIE);
   if(/^[a-f0-9-]{36}$/.test(id))response.headers.append('set-cookie',sessionCookie(id));
  }
  return response;
 }catch(e){
  console.error('NeonBeats Web Control',e);
  return fail('Błąd serwera. Sprawdź konfigurację Cloudflare.',500);
 }
}};
