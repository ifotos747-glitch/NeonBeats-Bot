'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'neon-global-'));
process.env.NEONBEATS_DATA_DIR=dir;
const radio=require('../src/global-radio'),store=require('../src/store');
const a='123456789012345678',b='123456789012345679';
test('Shared catalog and independent guild favorites',()=>{
 const st=radio.add('Radio Test','https://radio.example.org/live.mp3');
 assert.equal(radio.list().length,1);
 assert.equal(radio.search('test')[0].id,st.id);
 assert.equal(radio.find('RADIO TEST').id,st.id);
 assert.throws(()=>radio.add('radio test','https://radio.example.org/other.mp3'));
 radio.favorite(a,st.id,true);
 assert.deepEqual(radio.favorites(a),[st.id]);
 assert.deepEqual(radio.favorites(b),[]);
 radio.edit(st.id,'Test FM',null);
 assert.equal(radio.find(st.id).name,'Test FM');
 assert.deepEqual(radio.favorites(a),[st.id]);
 radio.remove(st.id);
 assert.deepEqual(radio.favorites(a),[]);
});
test('Migrate old guild stations once without erasing local data',()=>{
 store.addRadio(a,'Legacy FM','https://legacy.example.org/live.mp3');
 assert.equal(radio.migrate(),1);
 assert.equal(radio.migrate(),0);
 assert.equal(radio.find('legacy fm').name,'Legacy FM');
 assert.equal(store.read(a).radios.length,1);
});
test.after(()=>fs.rmSync(dir,{force:true,recursive:true}));
