// Процедурное аудио (Web Audio API): ветер, шаги, удары, еда, клик UI — без внешних файлов
let ctx,nb,wg,wf;
export function initAudio(){
  if(ctx){ctx.resume();return}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ctx=new AC();
  nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const s=ctx.createBufferSource();s.buffer=nb;s.loop=true;wf=ctx.createBiquadFilter();wf.type='lowpass';wf.frequency.value=500;
  wg=ctx.createGain();wg.gain.value=0;s.connect(wf).connect(wg).connect(ctx.destination);s.start();
  setInterval(()=>wf.frequency.setTargetAtTime(300+Math.random()*900,ctx.currentTime,1.2),2500); // порывы ветра и шелест листвы
}
export const wind=v=>{if(wg)wg.gain.setTargetAtTime(v,ctx.currentTime,.6)};
function burst(dur,f,type,vol){if(!ctx)return;const s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain(),t=ctx.currentTime;
  s.buffer=nb;fl.type=type;fl.frequency.value=f;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(fl).connect(g).connect(ctx.destination);s.start(t,Math.random()*1.5,dur)}
function tone(f,dur,vol,type='sine'){if(!ctx)return;const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime;
  o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f/2,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+dur)}
export const sfx={
  click:()=>tone(520,.09,.12,'triangle'),
  step:s=>burst([.12,.1,.06][s],[700,2200,1400][s],s?'bandpass':'lowpass',[.15,.12,.2][s]), // 0 песок, 1 трава, 2 камень
  hit:s=>{if(s==0){tone(140,.14,.3,'square');burst(.1,900,'lowpass',.3)}else if(s==1){burst(.08,3000,'highpass',.3);tone(320,.08,.15,'square')}else burst(.1,300,'lowpass',.2)},
  eat:()=>[0,160,320].forEach(t=>setTimeout(()=>burst(.07,1200,'bandpass',.2),t))
};
