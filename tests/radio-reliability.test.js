'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {MusicSession,MAX_MISSED_FRAMES,audioBufferMs,retryRadioTrack}=require('../src/player');
const DAY=24*60*60*1000;

test('Discord voice allows short radio stalls before dropping playback',()=>{
 assert.equal(MAX_MISSED_FRAMES,100);
});

test('radio buffer is independently configurable without increasing YouTube latency',()=>{
 const env={NEONBEATS_PREBUFFER_MS:'450'};
 assert.equal(audioBufferMs({kind:'youtube-link'},env),450);
 assert.equal(audioBufferMs({kind:'radio'},env),1000);
 assert.equal(audioBufferMs({kind:'stream'},{NEONBEATS_RADIO_PREBUFFER_MS:'1600'}),1600);
 assert.equal(audioBufferMs({kind:'radio'},{NEONBEATS_RADIO_PREBUFFER_MS:'99999'}),3000);
 assert.equal(audioBufferMs({kind:'radio'},{NEONBEATS_RADIO_PREBUFFER_MS:'0'}),0);
 assert.equal(audioBufferMs({kind:'file'},{}),280);
});

test('radio reconnect is bounded per failure window and resets after stable period',()=>{
 const first={kind:'radio',source:'https://radio.example/audio',title:'Station'};
 const at=Date.now();
 const one=retryRadioTrack(first,at);
 assert.equal(one.reconnectRetries,1);
 const two=retryRadioTrack(one,at+1000);
 const three=retryRadioTrack(two,at+2000);
 assert.equal(three.reconnectRetries,3);
 assert.equal(retryRadioTrack(three,at+3000),null);
 const recovered=retryRadioTrack(three,at+121000);
 assert.equal(recovered.reconnectRetries,1);
 assert.equal(retryRadioTrack({...three,continuous:true},at),null);
 assert.equal(retryRadioTrack({kind:'youtube-link'},at),null);
});

function mockRadioSession(track,skipRequested=false){
 let started=0;
 return {closed:false,current:track,queue:[],repeatMode:'off',skipRequested,starting:false,
  resource:{},retryCount:0,blockUntil:0,playingSince:Date.now()-DAY,cleanProcess(){},
  showControlPanel(){},announce(){},startNext(){started++;},getStarted(){return started;}};
}

test('radio reconnects if the audio stream ends without throwing',()=>{
 const s=mockRadioSession({kind:'radio',title:'Live',source:'https://radio.example/audio'});
 MusicSession.prototype.onIdle.call(s);
 assert.equal(s.queue.length,1);
 assert.equal(s.queue[0].reconnectRetries,1);
 assert.ok(s.blockUntil>Date.now());
 assert.equal(s.current,null);
 assert.equal(s.getStarted(),1);
});

test('24/7 radio retries on normal EOF with backoff and does not leave the voice channel',()=>{
 const s=mockRadioSession({kind:'radio',title:'Live',continuous:true});
 MusicSession.prototype.onIdle.call(s);
 assert.equal(s.queue.length,0);
 assert.ok(s.blockUntil>Date.now());
 assert.equal(s.retryCount,1);
 assert.equal(s.getStarted(),1);
});

test('skip and stop never requeue a live radio station',()=>{
 const s=mockRadioSession({kind:'radio',title:'Live'},true);
 MusicSession.prototype.onIdle.call(s);
 assert.equal(s.queue.length,0);
});

test('repeat-one never causes unbounded manual radio reconnects',()=>{
 const s=mockRadioSession({kind:'radio',title:'Live'},false);
 s.repeatMode='one';
 MusicSession.prototype.onIdle.call(s);
 assert.equal(s.queue.length,1);
 assert.equal(s.queue[0].reconnectRetries,1);
});
