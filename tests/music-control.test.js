'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {panel}=require('../src/bot');
test('MUSIC CONTROL panel shows current YouTube title and interactive controls',()=>{
 const data=panel({title:'Super Remix 2026'});
 assert.match(data.embeds[0].toJSON().title,/MUSIC CONTROL/);
 assert.match(data.embeds[0].toJSON().description,/Super Remix 2026/);
 assert.equal(data.components.length,2);
 assert.ok(data.components[0].components.some(x=>x.data.custom_id==='neon:pause'));
 assert.ok(data.components[0].components.some(x=>x.data.custom_id==='neon:skip'));
});
test('MUSIC CONTROL panel still works without a track',()=>{
 assert.match(panel().embeds[0].toJSON().description,/Sterowanie muzyką/);
});
