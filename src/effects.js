'use strict';
const PRESETS={
 off:[],
 bass:['bass=g=8:f=90:w=0.5'],
 nightcore:['asetrate=48000*1.25','aresample=48000'],
 slowed:['asetrate=48000*0.85','aresample=48000'],
 '8d':['apulsator=hz=0.09'],
 echo:['aecho=0.8:0.7:65:0.3'],
 club:['bass=g=6:f=90','acompressor=threshold=-18dB:ratio=3:attack=15:release=100'],
 deep:['bass=g=12:f=85:w=0.5'],
 vocal:['equalizer=f=2800:t=q:w=1:g=5'],
 soft:['acompressor=threshold=-20dB:ratio=2:attack=20:release=180'],
 stadium:['aecho=0.8:0.7:85:0.34','acompressor=threshold=-18dB:ratio=2.5:attack=15:release=140'],
 lofi:['lowpass=f=4200','highpass=f=100'],
 crystal:['equalizer=f=3400:t=q:w=1:g=4','acompressor=threshold=-19dB:ratio=2:attack=20:release=150']
};
function filterFor(preset){if(!Object.hasOwn(PRESETS,preset))throw Error('Nieznany preset DJ');return PRESETS[preset].join(',');}
module.exports={PRESETS,filterFor};
