'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PRESETS,filterFor}=require('../src/effects');
test('DJ presets are whitelisted',()=>{
 assert.deepEqual(Object.keys(PRESETS).sort(),['8d','bass','club','echo','nightcore','off','slowed'].sort());
 assert.equal(filterFor('off'),'');
 assert.match(filterFor('bass'),/bass=/);
 assert.throws(()=>filterFor('not-allowed'));
});
