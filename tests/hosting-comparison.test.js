'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {hostLabel}=require('../src/config');

test('host label identifies the hosting under test without exposing secrets',()=>{
 assert.equal(hostLabel({NEONBEATS_HOST_LABEL:'ALTARE'}),'ALTARE');
 assert.equal(hostLabel({NEONBEATS_HOST_LABEL:'BOT-HOSTING'}),'BOT-HOSTING');
 assert.equal(hostLabel({}),'nieoznaczony');
 assert.equal(hostLabel({NEONBEATS_HOST_LABEL:' <@everyone> ALTARE\nTOKEN=xyz'}),'everyone ALTARETOKENxyz');
 assert.equal(hostLabel({NEONBEATS_HOST_LABEL:'a'.repeat(100)}).length,36);
});
