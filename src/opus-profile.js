'use strict';

// This is a controlled A/B test for potentially unreliable UDP routes.
// A lower and constrained bitrate can reduce bandwidth peaks; inband FEC
// is requested, but Discord's decoder is not guaranteed to use it.
function opusProfile(env=process.env){
 return String(env.NEONBEATS_RADIO_OPUS_PROFILE||'standard').trim().toLowerCase()==='robust'?'robust':'standard';
}
function opusOutputArgs(profile='standard'){
 const base=['-ac','2','-ar','48000','-c:a','libopus','-application','audio',
  '-frame_duration','20'];
 if(profile==='robust'){
  return [...base,'-b:a','96k','-vbr','constrained','-packet_loss','10','-fec','1','-f','opus','pipe:1'];
 }
 return [...base,'-b:a','128k','-vbr','on','-f','opus','pipe:1'];
}
module.exports={opusProfile,opusOutputArgs};
