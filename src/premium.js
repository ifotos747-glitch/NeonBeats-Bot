'use strict';
// Guild-scoped NeonBeats Premium. The owner manages entitlements on ALTARE;
// callers of the public website cannot change them without owner verification.
const store=require('./store');
const DAY=24*60*60*1000;
const PREMIUM_DJ=new Set(['stadium','lofi','crystal']);
function status(guildId,at=Date.now(),record=null){
 const saved=record&&typeof record==='object'?record.premium:store.read(guildId).premium;
 const expiresAt=Number(saved?.expiresAt)||0;
 const active=expiresAt>at;
 return {active,expiresAt:expiresAt>0?expiresAt:null,
  daysLeft:active?Math.ceil((expiresAt-at)/DAY):0,
  limits:{playlists:active?50:25,favorites:active?250:100}};
}
function grant(guildId,days,actorId,at=Date.now()){
 if(!Number.isInteger(days)||days<1||days>3650)throw Error('Premium: okres musi wynosić 1–3650 dni.');
 if(!/^[0-9]{15,24}$/.test(String(actorId||'')))throw Error('Premium: brak identyfikatora administratora.');
 const d=store.read(guildId);
 const base=Math.max(at,Number(d.premium?.expiresAt)||0);
 const expiresAt=base+days*DAY;
 d.premium={expiresAt,updatedBy:actorId,updatedAt:at,createdAt:d.premium?.createdAt||d.premium?.updatedAt||at,
  history:[...(d.premium?.history||[]),{action:'grant',at,by:actorId,days}].slice(-100)};
 store.write(guildId,d);
 return status(guildId,at);
}
function revoke(guildId,actorId,at=Date.now()){
 if(!/^[0-9]{15,24}$/.test(String(actorId||'')))throw Error('Premium: brak identyfikatora administratora.');
 const d=store.read(guildId);
 d.premium={expiresAt:0,updatedBy:actorId,updatedAt:at,createdAt:d.premium?.createdAt||d.premium?.updatedAt||at,
  history:[...(d.premium?.history||[]),{action:'revoke',at,by:actorId,days:0}].slice(-100)};
 store.write(guildId,d);return status(guildId,at);
}
function list(guilds,page=0,at=Date.now()){
 if(!Number.isInteger(page)||page<0||page>10000)throw Error('Nieprawidłowa strona listy Premium.');
 if(!Array.isArray(guilds))throw Error('Brak listy serwerów.');
 const items=guilds.filter(g=>/^[0-9]{15,24}$/.test(String(g.id||''))).map(g=>{
  const entry=store.read(g.id).premium;
  if(!entry||!Number.isFinite(entry.updatedAt)||entry.updatedAt<=0)return null;
  const state=status(g.id,at);
  return {id:g.id,name:String(g.name||g.id).slice(0,85),active:state.active,
   expiresAt:state.expiresAt,daysLeft:state.daysLeft,
   updatedAt:entry.updatedAt,createdAt:entry.createdAt||entry.updatedAt,updatedBy:entry.updatedBy||null,
   revoked:entry.expiresAt===0};
 }).filter(Boolean).sort((a,b)=>b.updatedAt-a.updatedAt);
 const pageSize=10,total=items.length,pages=Math.max(1,Math.ceil(total/pageSize));
 return {page,pages,total,active:items.filter(x=>x.active).length,
  expired:items.filter(x=>!x.active).length,
  items:items.slice(page*pageSize,(page+1)*pageSize)};
}
function requirePremium(guildId){
 if(!status(guildId).active)throw Error('Ta funkcja wymaga aktywnego NeonBeats Premium na serwerze.');
}
function requireOwner(userId){
 const id=String(process.env.BOT_OWNER_ID||'');
 if(!/^[0-9]{15,24}$/.test(id)||String(userId)!==id)throw Error('Tylko właściciel NeonBeats (BOT_OWNER_ID) może zarządzać Premium.');
}
module.exports={status,grant,revoke,list,requirePremium,requireOwner,PREMIUM_DJ};
