'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'neonbeats-test-'));
process.env.NEONBEATS_DATA_DIR=dir;
const store=require('../src/store');const id='123456789012345678';
test('radio playlist and DJ persistence',()=>{
 store.addRadio(id,'Test Radio','https://radio.example.org/live.mp3');
 assert.equal(store.read(id).radios.length,1);
 assert.throws(()=>store.addRadio(id,'test radio','https://radio.example.org/'));
 assert.throws(()=>store.addRadio(id,'Private','http://127.0.0.1/'));
 store.setDJ(id,'club');assert.equal(store.read(id).dj,'club');
 assert.equal(store.savePlaylist(id,'Demo',[{kind:'file',source:'demo.wav',title:'Demo'}]),1);
 assert.equal(store.loadPlaylist(id,'Demo')[0].source,'demo.wav');
 store.deletePlaylist(id,'Demo');
 assert.equal(Object.keys(store.read(id).playlists).length,0);
 store.removeRadio(id,'Test Radio');
 assert.equal(store.read(id).radios.length,0);
});
test('247 config and isolation',()=>{
 const c={mode:'autodj',channelId:'123456789012345671',textChannelId:'123456789012345672',stationId:null};
 store.set247(id,c);assert.equal(store.read(id).alwaysOn.mode,'autodj');
 assert.equal(store.read('123456789012345679').radios.length,0);
 store.set247(id,null);assert.equal(store.read(id).alwaysOn,null);
 assert.throws(()=>store.read('../bad'));
});
test('3.2 playback history is persistent, bounded, and isolated by guild',()=>{
 const track={kind:'youtube-link',source:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',title:'Test Track'};
 store.recordPlay(id,track);
 store.recordPlay(id,track);
 assert.equal(store.read(id).history.length,1);
 assert.equal(store.read(id).history[0].title,'Test Track');
 assert.equal(store.read('123456789012345679').history.length,0);
 for(let i=0;i<65;i++)store.recordPlay(id,{...track,source:'https://www.youtube.com/watch?v='+String(i).padStart(11,'0'),title:'Song '+i});
 assert.equal(store.read(id).history.length,60);
 assert.equal(store.read(id).history[0].title,'Song 64');
});
test('3.3 favorites and playback counters are isolated per guild',()=>{
 const url='https://www.youtube.com/watch?v=dQw4w9WgXcQ';
 assert.equal(store.addFavorite(id,url,'Test favorite'),true);
 assert.equal(store.addFavorite(id,url,'Test favorite'),false);
 assert.equal(store.read(id).favorites.length,1);
 assert.equal(store.read('123456789012345679').favorites.length,0);
 assert.ok(store.read(id).stats.total>=1);
 assert.ok(store.read(id).stats.youtube>=1);
 assert.throws(()=>store.addFavorite(id,'https://invalid.example/test','No'),/link/);
 store.removeFavorite(id,url);assert.equal(store.read(id).favorites.length,0);
});
test.after(()=>fs.rmSync(dir,{force:true,recursive:true}));
