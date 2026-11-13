'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'neon-dm-welcome-'));
process.env.NEONBEATS_DATA_DIR=temp;
const {welcomeDirectMessage,makeWelcomeEmbed,userKey}=require('../src/dm-welcome');

test('welcome card introduces radio, YouTube and AutoDJ with correct server commands',()=>{
 const card=makeWelcomeEmbed().toJSON();
 assert.match(card.title,/NeonBeats/);
 assert.match(card.description,/muzycznym Discord/);
 const fields=card.fields.map(f=>f.value).join(' ');
 assert.match(fields,/24\/7/);
 assert.match(fields,/YouTube/);
 assert.match(fields,/AutoDJ/);
 assert.match(fields,/\/neonhelp/);
 assert.match(fields,/na serwerze/);
});

test('responds once in a direct DM and persists without writing plain user IDs',async()=>{
 const userId='123456789012345678';
 const sent=[];
 const msg={author:{bot:false,id:userId},guildId:null,channel:{type:1,async send(payload){sent.push(payload);}}};
 assert.equal(await welcomeDirectMessage(msg),true);
 assert.equal(await welcomeDirectMessage(msg),false);
 assert.equal(sent.length,1);
 assert.ok(sent[0].embeds.length===1);
 assert.deepEqual(sent[0].allowedMentions,{parse:[]});
 const json=fs.readFileSync(path.join(temp,'dm-welcome.json'),'utf8');
 assert.ok(!json.includes(userId));
 assert.ok(json.includes(userKey(userId)));
 const id=require.resolve('../src/dm-welcome');
 delete require.cache[id];
 const other=require('../src/dm-welcome');
 assert.equal(await other.welcomeDirectMessage(msg),false);
});

test('no welcome in guilds, group chats, or when sender is a bot',async()=>{
 let sent=0;
 const base={author:{bot:false,id:'222222222222222222'},guildId:null,channel:{type:1,async send(){sent++;}}};
 assert.equal(await welcomeDirectMessage({...base,guildId:'333333333333333333'}),false);
 assert.equal(await welcomeDirectMessage({...base,author:{bot:true,id:'222222222222222222'}}),false);
 assert.equal(await welcomeDirectMessage({...base,channel:{...base.channel,type:3}}),false);
 assert.equal(sent,0);
});

test('failed DM sends do not mark the user as greeted; concurrent incoming messages are deduplicated',async()=>{
 let sendCount=0,release;
 const msg={author:{bot:false,id:'444444444444444444'},guildId:null,
  channel:{type:1,send:async()=>{sendCount++;await new Promise(resolve=>release=resolve);}}};
 const first=welcomeDirectMessage(msg);
 assert.equal(await welcomeDirectMessage(msg),false);
 release();
 assert.equal(await first,true);
 assert.equal(sendCount,1);
 let failed=0;
 const failing={author:{bot:false,id:'555555555555555555'},guildId:null,
  channel:{type:1,async send(){failed++;throw Error('DM blocked');}}};
 assert.equal(await welcomeDirectMessage(failing),false);
 assert.equal(await welcomeDirectMessage(failing),false);
 assert.equal(failed,2);
});
test.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
