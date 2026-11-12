'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {shouldRetryYouTube}=require('../src/player');
test('transient YouTube failures are retried only twice',()=>{
 const track={kind:'youtube-link',compatRetries:0};
 assert.equal(shouldRetryYouTube(track,'YouTube: network timeout'),true);
 assert.equal(shouldRetryYouTube({...track,compatRetries:1},'FFmpeg: broken pipe'),true);
 assert.equal(shouldRetryYouTube({...track,compatRetries:2},'network timeout'),false);
 assert.equal(shouldRetryYouTube({kind:'radio'},'network timeout'),false);
});
test('access and unavailable errors are not retried',()=>{
 for(const reason of ['Sign in to confirm you are not a bot','Video unavailable','HTTP 403','copyright','private video'])
  assert.equal(shouldRetryYouTube({kind:'youtube-link'},reason),false);
});
