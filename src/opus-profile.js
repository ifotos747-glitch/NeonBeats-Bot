'use strict';

// This is a controlled A/B test for potentially unreliable UDP routes.
// A lower and constrained bitrate can reduce bandwidth peaks; inband FEC
// is requested, but Discord's decoder is not guaranteed to use it.
function opusProfile(env=process.env){
 const selected=String(env.NEONBEATS_RADIO_OPUS_PROFILE||'standard').trim().toLowerCase();
 return ['standard','robust','robust-cbr'].includes(selected)?selected:'standard';
}
function opusOutputArgs(profile='standard'){
 const base=['-ac','2','-ar','48000','-c:a','libopus','-application','audio',
  '-frame_duration','20'];
 if(profile==='robust'||profile==='robust-cbr'){
  // Keep bitrate, FEC and frame duration identical for an isolated A/B test.
  // Only the bitrate allocation policy changes from constrained VBR to CBR.
  return [...base,'-b:a','96k','-vbr',profile==='robust-cbr'?'off':'constrained',
   '-packet_loss','10','-fec','1','-f','opus','pipe:1'];
 }
 return [...base,'-b:a','128k','-vbr','on','-f','opus','pipe:1'];
}
module.exports={opusProfile,opusOutputArgs};
