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

test('MUSIC CONTROL 2.5 shows up next, queue size, volume and repeat',()=>{
 const session={queue:[{title:'Drugi utwór'},{title:'Trzeci utwór'}],volume:65,dj:'club',repeatMode:'one',player:{state:{status:'playing'}}};
 const data=panel({title:'Pierwszy remix'},session);
 const desc=data.embeds[0].toJSON().description;
 assert.match(desc,/Pierwszy remix/);
 assert.match(desc,/Drugi utwór/);
 assert.match(desc,/2 utworów/);
 assert.match(desc,/65%/);
 assert.match(desc,/club/);
 assert.match(desc,/jeden utwór/);
 assert.equal(data.components.length,3);
 const ids=data.components.flatMap(row=>row.components.map(c=>c.data.custom_id));
 for(const id of ['neon:shuffle','neon:repeat','neon:refresh','neon:skip','neon:pause'])assert.ok(ids.includes(id));
});
