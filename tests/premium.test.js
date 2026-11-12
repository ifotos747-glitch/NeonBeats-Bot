'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'neonbeats-premium-'));
process.env.NEONBEATS_DATA_DIR=dir;
const store=require('../src/store'),premium=require('../src/premium');
const guild='123456789012345678',owner='1471988860828516423',day=86400000,now=1760000000000;

test('Premium requires the configured owner ID and denies everyone else',()=>{
 const previous=process.env.BOT_OWNER_ID;
 try{
  delete process.env.BOT_OWNER_ID;
  assert.throws(()=>premium.requireOwner(owner),/właściciel/);
  process.env.BOT_OWNER_ID=owner;
  assert.doesNotThrow(()=>premium.requireOwner(owner));
  assert.throws(()=>premium.requireOwner('123456789012345679'),/właściciel/);
 }finally{if(previous===undefined)delete process.env.BOT_OWNER_ID;else process.env.BOT_OWNER_ID=previous;}
});

test('Premium status, extension, expiry and revoke are persistent and guild-isolated',()=>{
 assert.equal(premium.status(guild,now).active,false);
 const a=premium.grant(guild,30,owner,now);
 assert.equal(a.active,true);assert.equal(a.daysLeft,30);
 assert.equal(a.limits.playlists,50);assert.equal(a.limits.favorites,250);
 const b=premium.grant(guild,5,owner,now+day);
 assert.equal(b.expiresAt,now+35*day);
 assert.equal(premium.status(guild,now+36*day).active,false);
 assert.equal(premium.status('123456789012345679',now).active,false);
 const c=premium.revoke(guild,owner,now+day);
 assert.equal(c.active,false);
 assert.equal(store.read(guild).premium.expiresAt,0);
 assert.throws(()=>premium.grant(guild,0,owner),/okres/);
 assert.throws(()=>premium.grant(guild,3651,owner),/okres/);
});

test('Premium increases limits without discarding existing items after expiry',()=>{
 premium.grant(guild,30,owner,Date.now());
 for(let i=0;i<26;i++)store.savePlaylist(guild,'Playlist '+i,[{kind:'file',source:'demo.wav',title:'Demo'}]);
 assert.equal(Object.keys(store.read(guild).playlists).length,26);
 premium.revoke(guild,owner);
 assert.equal(Object.keys(store.read(guild).playlists).length,26);
 assert.throws(()=>store.savePlaylist(guild,'Another',[{kind:'file',source:'demo.wav',title:'Demo'}]),/Limit 25/);
 assert.equal(store.loadPlaylist(guild,'Playlist 0').length,1);
});

test.after(()=>fs.rmSync(dir,{force:true,recursive:true}));
