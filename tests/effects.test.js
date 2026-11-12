'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PRESETS,filterFor}=require('../src/effects');
test('DJ presets are whitelisted',()=>{
 assert.deepEqual(Object.keys(PRESETS).sort(),['8d','bass','club','deep','echo','nightcore','off','slowed','soft','vocal'].sort());
 assert.equal(filterFor('off'),'');
 assert.match(filterFor('bass'),/bass=/);
 assert.match(filterFor('deep'),/bass=/);
 assert.match(filterFor('vocal'),/equalizer=/);
 assert.match(filterFor('soft'),/acompressor=/);
 assert.throws(()=>filterFor('not-allowed'));
});
