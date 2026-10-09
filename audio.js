// Процедурное аудио (Web Audio API): ветер, шаги, удары, еда, клик UI — без внешних файлов
let ctx,nb,wg,wf,rg;
export function initAudio(){
  if(ctx){ctx.resume();return}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ctx=new AC();
  nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const s=ctx.createBufferSource();s.buffer=nb;s.loop=true;wf=ctx.createBiquadFilter();wf.type='lowpass';wf.frequency.value=500;
  wg=ctx.createGain();wg.gain.value=0;s.connect(wf).connect(wg).connect(ctx.destination);s.start();
  const s2=ctx.createBufferSource(),bp=ctx.createBiquadFilter();s2.buffer=nb;s2.loop=true;bp.type='bandpass';bp.frequency.value=3200;bp.Q.value=.6;rg=ctx.createGain();rg.gain.value=0;s2.connect(bp).connect(rg).connect(ctx.destination);s2.start(0,.7); // шелест листвы
  setInterval(()=>wf.frequency.setTargetAtTime(300+Math.random()*900,ctx.currentTime,1.2),2500); // порывы ветра и шелест листвы
}
export const wind=v=>{if(wg)wg.gain.setTargetAtTime(v,ctx.currentTime,.6)};
function burst(dur,f,type,vol){if(!ctx)return;const s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain(),t=ctx.currentTime;
  s.buffer=nb;fl.type=type;fl.frequency.value=f;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(fl).connect(g).connect(ctx.destination);s.start(t,Math.random()*1.5,dur)}
function tone(f,dur,vol,type='sine'){if(!ctx)return;const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime;
  o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f/2,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+dur)}
export const rustle=v=>{if(rg)rg.gain.setTargetAtTime(v,ctx.currentTime,.4)};
export function listen(x,y,z,yaw){if(!ctx)return;const L=ctx.listener,fx=-Math.sin(yaw),fz=-Math.cos(yaw);
  if(L.positionX){L.positionX.value=x;L.positionY.value=y;L.positionZ.value=z;L.forwardX.value=fx;L.forwardY.value=0;L.forwardZ.value=fz;L.upX.value=0;L.upY.value=1;L.upZ.value=0}else{L.setPosition(x,y,z);L.setOrientation(fx,0,fz,0,1,0)}}
const spatial=(x,y,z)=>{const p=ctx.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=2;p.rolloffFactor=1.4;if(p.positionX){p.positionX.value=x;p.positionY.value=y;p.positionZ.value=z}else p.setPosition(x,y,z);return p};
export function crackle(x,y,z,vol){if(!ctx)return;const s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain(),p=spatial(x,y,z),t=ctx.currentTime,d=.03+Math.random()*.06; // треск костра в 3D
  s.buffer=nb;fl.type='highpass';fl.frequency.value=1800+Math.random()*3000;g.gain.setValueAtTime(vol*(.5+Math.random()),t);g.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(fl).connect(g).connect(p).connect(ctx.destination);s.start(t,Math.random()*1.5,d)}
export const sfx={snap:()=>{burst(.05,2600,'highpass',.35);tone(900,.04,.1,'square')}, // хруст ветки
 
  click:()=>tone(520,.09,.12,'triangle'),
  step:s=>burst([.12,.1,.06][s],[700,2200,1400][s],s?'bandpass':'lowpass',[.15,.12,.2][s]), // 0 песок, 1 трава, 2 камень
  hit:s=>{if(s==0){tone(140,.14,.3,'square');burst(.1,900,'lowpass',.3)}else if(s==1){burst(.08,3000,'highpass',.3);tone(320,.08,.15,'square')}else burst(.1,300,'lowpass',.2)},
  eat:()=>[0,160,320].forEach(t=>setTimeout(()=>burst(.07,1200,'bandpass',.2),t))
};
