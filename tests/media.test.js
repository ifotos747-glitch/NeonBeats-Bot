'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {isPrivateHost,validatePublicUrl,classifyInput,localFile,musicFiles,restoreTrack}=require('../src/media');
test('demo and path validation',()=>{
 assert.ok(musicFiles().includes('demo.wav'));
 assert.equal(localFile('demo.wav').kind,'file');
 for(const v of ['../secret.mp3','/etc/passwd','..\\private.wav','none.wav'])assert.throws(()=>localFile(v));
});
test('private URLs blocked',()=>{
 for(const h of ['localhost','service.internal','10.1.2.3','127.0.0.1','172.16.1.1','192.168.0.1','169.254.0.5','100.96.0.1','::1'])assert.equal(isPrivateHost(h),true,h);
 for(const u of ['file:///etc/passwd','http://127.0.0.1:8000','http://localhost:80','http://user:password@example.com/'])assert.throws(()=>validatePublicUrl(u));
});
test('source classification',()=>{
 const st={id:'a',name:'My Radio',url:'https://radio.example.org/live.mp3'};
 assert.equal(classifyInput('my radio',[st]).kind,'radio');
 assert.equal(classifyInput('demo.wav').kind,'file');
 assert.equal(classifyInput('https://youtube.com/watch?v=test').kind,'youtube-link');
 assert.equal(classifyInput('https://open.spotify.com/track/123').kind,'spotify-link');
 assert.equal(classifyInput(st.url).kind,'stream');
});
test('playlists reject unknown source kinds',()=>{
 assert.equal(restoreTrack({kind:'file',source:'demo.wav'}).kind,'file');
 assert.equal(restoreTrack({kind:'radio',source:'https://radio.example.org/live'}).kind,'radio');
 assert.throws(()=>restoreTrack({kind:'radio',source:'http://localhost/test'}));
 assert.throws(()=>restoreTrack({kind:'youtube',source:'https://youtube.com/watch?v=123'}));
});
