'use strict';
const test=require('node:test'),assert=require('node:assert/strict');

// Each test file runs in its own Node test process; select the idle=0
// environment before importing modules that read configuration at startup.
process.env.IDLE_MINUTES='0';
const {IDLE_MINUTES,parseIdleMinutes}=require('../src/config');
const {MusicSession}=require('../src/player');

test('IDLE_MINUTES=0 disables the idle timer without disabling manual leave',()=>{
 assert.equal(IDLE_MINUTES,0);
 assert.equal(parseIdleMinutes('0'),0);
 assert.equal(parseIdleMinutes(0),0);
 assert.equal(typeof MusicSession.prototype.destroy,'function');
});

test('positive, missing and invalid idle configurations preserve previous behavior',()=>{
 assert.equal(parseIdleMinutes(undefined),15);
 assert.equal(parseIdleMinutes(''),15);
 assert.equal(parseIdleMinutes('NaN'),15);
 assert.equal(parseIdleMinutes('-1'),15);
 assert.equal(parseIdleMinutes('1'),2);
 assert.equal(parseIdleMinutes('15'),15);
 assert.equal(parseIdleMinutes('999'),120);
});

test('idle session with zero timeout stays on voice indefinitely without scheduling disconnect',async()=>{
 let destroyed=0,shown=0;
 const session={
  closed:false,starting:false,current:null,timer:null,retry:null,
  alwaysOn:null,autodj:false,queue:[],blockUntil:0,
  clearTimer(){this.timer=null;},
  chooseNext(){return null;},
  showControlPanel(){shown++;return Promise.resolve();},
  destroy(){destroyed++;}
 };
 await MusicSession.prototype.startNext.call(session);
 assert.equal(session.starting,false);
 assert.equal(shown,1);
 assert.equal(session.timer,null);
 assert.equal(destroyed,0);
 await new Promise(resolve=>setTimeout(resolve,35));
 assert.equal(destroyed,0);
});

test('stop command with no music does not disconnect idle keep-connected session',()=>{
 let destroyed=0,shown=0;
 const session={
  queue:[{title:'queued'}],autodj:true,alwaysOn:{mode:'radio'},
  repeatMode:'one',blockUntil:50,retry:null,timer:null,current:null,
  clearTimer(){this.timer=null;},
  showControlPanel(){shown++;return Promise.resolve();},
  destroy(){destroyed++;}
 };
 MusicSession.prototype.stop.call(session);
 assert.deepEqual(session.queue,[]);
 assert.equal(session.autodj,false);
 assert.equal(session.alwaysOn,null);
 assert.equal(destroyed,0);
 assert.equal(shown,1);
});
