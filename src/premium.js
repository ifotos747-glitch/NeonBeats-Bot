'use strict';
// Guild-scoped NeonBeats Premium. The owner manages entitlements on ALTARE;
// callers of the public website cannot change them without owner verification.
const store=require('./store');
const DAY=24*60*60*1000;
const PREMIUM_DJ=new Set(['stadium','lofi','crystal']);
function status(guildId,at=Date.now()){
 const saved=store.read(guildId).premium;
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
 d.premium={expiresAt,updatedBy:actorId,updatedAt:at};
 store.write(guildId,d);
 return status(guildId,at);
}
function revoke(guildId,actorId,at=Date.now()){
 if(!/^[0-9]{15,24}$/.test(String(actorId||'')))throw Error('Premium: brak identyfikatora administratora.');
 const d=store.read(guildId);
 d.premium={expiresAt:0,updatedBy:actorId,updatedAt:at};
 store.write(guildId,d);return status(guildId,at);
}
function requirePremium(guildId){
 if(!status(guildId).active)throw Error('Ta funkcja wymaga aktywnego NeonBeats Premium na serwerze.');
}
function requireOwner(userId){
 const id=String(process.env.BOT_OWNER_ID||'');
 if(!/^[0-9]{15,24}$/.test(id)||String(userId)!==id)throw Error('Tylko właściciel NeonBeats (BOT_OWNER_ID) może zarządzać Premium.');
}
module.exports={status,grant,revoke,requirePremium,requireOwner,PREMIUM_DJ};
