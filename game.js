import * as THREE from 'three';
import {initAudio,sfx,wind} from './audio.js';
const $=i=>document.getElementById(i), TAU=Math.PI*2, SAVE='ashfall_save_v1';

/* ===== Данные ===== */
const TIPS=['Сырое мясо портится — готовь его на костре.','Ночью и в дождь тело мёрзнет: грейся у огня.','Топор в руке даёт втрое больше дерева.','Верстак открывает продвинутый крафт.','Куртка из сундука греет, пока лежит в инвентаре.','Бег тратит выносливость, а долгая ходьба — копит усталость.'];
const ITEMS={meat:['🥩','Сырое мясо'],steak:['🍖','Жаркое'],rotten:['🤢','Тухлятина'],coat:['🧥','Тёплая куртка'],axe2:['🪓','Кованый топор'],bench:['🛠️','Верстак'],floor:['🟫','Фундамент'],wood:['🪵','Дерево'],stone:['🪨','Камень'],axe:['🪓','Топор'],pickaxe:['⛏️','Кирка'],campfire:['🔥','Костёр'],wall:['🧱','Стена'],water:['💧','Вода'],food:['🥫','Консервы']};
const RAR={wood:0,stone:0,food:0,water:0,meat:0,rotten:0,steak:1,campfire:1,wall:1,floor:1,axe:1,pickaxe:1,bench:2,axe2:2,coat:3};
const RECIPES=[{id:'floor',cost:{wood:4}},{id:'bench',cost:{wood:8,stone:4}},{id:'axe2',cost:{wood:4,stone:8},adv:1},{id:'axe',cost:{wood:3,stone:2}},{id:'pickaxe',cost:{wood:3,stone:3}},{id:'campfire',cost:{wood:5,stone:3}},{id:'wall',cost:{wood:6}}];
const cfg=Object.assign({q:1,sens:1},JSON.parse(localStorage.getItem('ashfall_cfg')||'{}'));
let st,inv,removed=[],opened=[],placed=[],mode='load';
const DEF=()=>({hp:100,hun:100,thi:100,sta:100,fat:0,tmp:70,meatAge:0,t:.3,x:0,z:0,yaw:0,pitch:0});
const fresh=()=>{st=DEF();inv={};removed=[];opened=[];placed=[]};
fresh();

/* ===== Рендер, сцена, свет ===== */
const renderer=new THREE.WebGLRenderer({canvas:$('c'),antialias:false,powerPreference:'high-performance'});
const scene=new THREE.Scene(), cam=new THREE.PerspectiveCamera(70,1,.1,160);
cam.rotation.order='YXZ';
const hemi=new THREE.HemisphereLight(0xbcd4ff,0x3a3326,.8), sun=new THREE.DirectionalLight(0xfff0d0,1.1);
sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,far:200});
scene.add(hemi,sun,sun.target);scene.fog=new THREE.Fog(0x87b5d6,30,120);
function applyCfg(){
  renderer.setPixelRatio([.7,1,Math.min(devicePixelRatio,2)][cfg.q]);
  renderer.shadowMap.enabled=sun.castShadow=cfg.q==2;
  scene.traverse(o=>{if(o.material)o.material.needsUpdate=true});
  renderer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();
  localStorage.setItem('ashfall_cfg',JSON.stringify(cfg));
}
addEventListener('resize',applyCfg);

/* ===== Процедурный мир ===== */
let rs=1337;const rnd=()=>(rs=rs*16807%2147483647,(rs-1)/2147483646);
const H=(x,z)=>Math.sin(x*.035)*4+Math.cos(z*.03)*4+Math.sin((x+z)*.09)*1.5+Math.sin(x*.2)*Math.cos(z*.2)*.4;
const WATER=-3.5, HALF=150;
const nodes=[], chests=[], obst=[], dummy=new THREE.Object3D(), mat=(c)=>new THREE.MeshStandardMaterial({color:c,flatShading:true,roughness:.95});
const tick=()=>new Promise(r=>setTimeout(r)), prog=(p,t)=>{$('lbar').style.width=p+'%';if(t)$('ltxt').textContent=TIPS[(p/20|0)%TIPS.length]};

async function buildWorld(){
  // Ландшафт: сетка с вершинными цветами (песок / трава / скала)
  const g=new THREE.PlaneGeometry(HALF*2,HALF*2,120,120).rotateX(-Math.PI/2),p=g.attributes.position,col=[];
  for(let i=0;i<p.count;i++){const y=H(p.getX(i),p.getZ(i));p.setY(i,y);const v=rnd()*.08;
    const c=y<WATER+.7?[.62,.56,.38]:y>6.5?[.42,.42,.44]:[.2+v,.38+v,.17];col.push(...c)}
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
  const land=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));land.receiveShadow=true;scene.add(land);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(HALF*2,HALF*2).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x2a5f7a,transparent:true,opacity:.8,roughness:.2}));
  water.position.y=WATER;scene.add(water);prog(20,'Деревни…');await tick();

  // Заброшенные деревни: дома + сундуки с лутом
  const villages=[];
  for(let n=0,tries=0;n<4&&tries<200;tries++){const x=(rnd()-.5)*200,z=(rnd()-.5)*200;
    if(H(x,z)>WATER+1.5&&Math.hypot(x,z)>30&&villages.every(v=>Math.hypot(v[0]-x,v[1]-z)>50)){villages.push([x,z]);n++}}
  const wallM=mat(0x6b5a48),roofM=mat(0x3d2f28),chestM=mat(0x8a5a2b);
  for(const[vx,vz]of villages)for(let k=0,N=4+(rnd()*3|0);k<N;k++){
    const a=k/N*TAU+rnd(),r=9+rnd()*5,x=vx+Math.cos(a)*r,z=vz+Math.sin(a)*r,y=H(x,z);
    const h=new THREE.Group();h.position.set(x,y-.6,z);h.rotation.set((rnd()-.5)*.06,rnd()*TAU,(rnd()-.5)*.06);
    const b=new THREE.Mesh(new THREE.BoxGeometry(5,3.6,5),wallM),rf=new THREE.Mesh(new THREE.ConeGeometry(4.4,2,4),roofM);
    b.position.y=1.8;rf.position.y=4.6;rf.rotation.y=Math.PI/4;b.castShadow=rf.castShadow=true;h.add(b,rf);scene.add(h);
    obst.push({x,z,r:3.3});
    const c=new THREE.Mesh(new THREE.BoxGeometry(.9,.6,.6),chestM);c.position.set(x+Math.cos(a)*3.3,H(x+Math.cos(a)*3.3,z+Math.sin(a)*3.3)+.3,z+Math.sin(a)*3.3);
    scene.add(c);chests.push({m:c,x:c.position.x,z:c.position.z,open:false})}
  // Лагеря торговцев (безопасные зоны с костром)
  for(let n=0,tr=0;n<2&&tr<200;tr++){const x=(rnd()-.5)*180,z=(rnd()-.5)*180;
    if(H(x,z)<WATER+1.5||Math.hypot(x,z)<25||villages.some(v=>Math.hypot(v[0]-x,v[1]-z)<35))continue;n++;
    const y=H(x,z),tent=new THREE.Mesh(new THREE.ConeGeometry(2.4,2.6,6),mat(0x7a4b2a)),tm=new THREE.Group();
    tent.position.set(x+3,y+1.3,z);tent.castShadow=true;
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.3,.35,1.3,8),mat(0x2d4a6b)),head=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),mat(0xc89b78));
    body.position.y=.65;head.position.y=1.5;tm.add(body,head);tm.position.set(x,y,z);scene.add(tent,tm);traders.push({x,z});addPlaced({t:'campfire',x:x-1.8,z:z+1,ry:0})}
  prog(50,'Лес…');await tick();

  // Деревья и камни — InstancedMesh (один draw call на тип)
  const spawn=(count,okFn,build)=>{for(let i=0;i<count;i++){const x=(rnd()-.5)*(HALF*2-10),z=(rnd()-.5)*(HALF*2-10),y=H(x,z);
    if(y<WATER+1||Math.hypot(x,z)<6||villages.some(v=>Math.hypot(v[0]-x,v[1]-z)<20))continue;build(x,y,z,.8+rnd()*.7,rnd()*TAU)}};
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.25,.35,3,6).translate(0,1.5,0),mat(0x5a3d26),300),
        crown=new THREE.InstancedMesh(new THREE.ConeGeometry(1.7,4.2,7).translate(0,5,0),mat(0x1f4d2a),300),
        rock=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),mat(0x77777a),120);
  for(const m of[trunk,crown,rock]){m.castShadow=m.receiveShadow=true;scene.add(m)}
  let ti=0,ri=0;
  spawn(300,0,(x,y,z,s,a)=>{if(ti>=300)return;dummy.position.set(x,y,z);dummy.rotation.set(0,a,0);dummy.scale.setScalar(s);dummy.updateMatrix();
    trunk.setMatrixAt(ti,dummy.matrix);crown.setMatrixAt(ti,dummy.matrix);nodes.push({k:'tree',x,z,hp:3,i:ti,ms:[trunk,crown],r:.7,id:nodes.length});ti++});
  spawn(120,0,(x,y,z,s,a)=>{if(ri>=120)return;dummy.position.set(x,y+.3*s,z);dummy.rotation.set(0,a,0);dummy.scale.set(1.3*s,.85*s,s);dummy.updateMatrix();
    rock.setMatrixAt(ri,dummy.matrix);nodes.push({k:'rock',x,z,hp:4,i:ri,ms:[rock],r:1.2*s,id:nodes.length});ri++});
  trunk.count=crown.count=ti;rock.count=ri;
  prog(100,'Готово');await tick();
}
const hideNode=n=>{dummy.scale.setScalar(0);dummy.updateMatrix();n.ms.forEach(m=>{m.setMatrixAt(n.i,dummy.matrix);m.instanceMatrix.needsUpdate=true})};

/* ===== Инвентарь, крафт, постройки ===== */
const has=(c)=>Object.entries(c).every(([k,v])=>(inv[k]||0)>=v);
function add(k,n=1){inv[k]=(inv[k]||0)+n;renderInv()}
function take(k,n=1){inv[k]=(inv[k]||0)-n;if(inv[k]<=0)delete inv[k];renderInv()}
let tt;function toast(t){const e=$('toast');e.textContent=t;e.style.opacity=1;clearTimeout(tt);tt=setTimeout(()=>e.style.opacity=0,1600)}
const hbItems=()=>Object.keys(ITEMS).filter(k=>inv[k]).slice(0,6);
let sel=0;const held=()=>hbItems()[sel];
function hbPress(i){const k=hbItems()[i];if(!k)return;if(sel==i)useItem(k);else{sel=i;renderInv()}}
const nearBench=()=>placed.some(o=>o.t=='bench'&&Math.hypot(o.x-st.x,o.z-st.z)<5);
function renderInv(){
  if(sel>=hbItems().length)sel=0;
  const g=$('grid');g.innerHTML='';const es=Object.entries(inv);
  for(let i=0;i<20;i++){const d=document.createElement('div');
    if(es[i]){const[k,n]=es[i];d.className='slot r'+RAR[k];d.innerHTML=`${ITEMS[k][0]}<b>${n}</b>`;d.title=ITEMS[k][1];d.onclick=()=>useItem(k)}else d.className='slot';g.appendChild(d)}
  const r=$('recipes');r.innerHTML='';
  for(const rc of RECIPES){const owned=['axe','pickaxe','axe2'].includes(rc.id)&&inv[rc.id],lock=rc.adv&&!nearBench();
    const d=document.createElement('div');d.className='rec';
    d.innerHTML=`<div>${ITEMS[rc.id][0]} ${ITEMS[rc.id][1]}<small>${Object.entries(rc.cost).map(([k,v])=>`${ITEMS[k][0]}×${v}`).join('  ')}${rc.adv?' · у верстака':''}</small></div>`;
    const b=document.createElement('button');b.className='btn';b.textContent=owned?'Есть':lock?'Нужен верстак':'Создать';b.disabled=owned||lock||!has(rc.cost);
    b.onclick=()=>{for(const[k,v]of Object.entries(rc.cost))take(k,v);add(rc.id);toast('Создано: '+ITEMS[rc.id][1])};d.appendChild(b);r.appendChild(d)}
  const hb=$('hotbar');hb.innerHTML='';
  hbItems().forEach((k,i)=>{const d=document.createElement('div');d.className='slot r'+RAR[k]+(i==sel?' sel':'');d.innerHTML=`${ITEMS[k][0]}<b>${inv[k]}</b><u>${i+1}</u>`;d.onpointerdown=e=>{e.stopPropagation();hbPress(i)};hb.appendChild(d)});
  setHeld(held());
}
let lights=0;
const fires=[],traders=[],PL={wall:[2,2.4,.3,1.2,1],floor:[2,.25,2,.12,0],bench:[1.4,.9,.7,.45,1]};
let dayF=1,rain=0,rainT=70,rainOn=false,rainM,walk=0,swing=0,eatT=0,stepD=0;
function addPlaced(o){
  let m;const pl=PL[o.t];
  if(pl){m=new THREE.Mesh(new THREE.BoxGeometry(pl[0],pl[1],pl[2]),mat(o.t=='bench'?0x6a4a2a:o.t=='floor'?0x7a5c38:0x8a6a44));
    m.position.set(o.x,H(o.x,o.z)+pl[3],o.z);m.rotation.y=o.ry;m.castShadow=m.receiveShadow=true;if(pl[4])obst.push({x:o.x,z:o.z,r:o.t=='bench'?.9:1.1})}
  else{m=new THREE.Group();const f=new THREE.Mesh(new THREE.ConeGeometry(.35,.9,6),new THREE.MeshBasicMaterial({color:0xff8a2a}));f.position.y=.6;m.add(f);
    for(let i=0;i<3;i++){const l=new THREE.Mesh(new THREE.BoxGeometry(.9,.15,.15),mat(0x4a3320));l.position.y=.1;l.rotation.y=i*1.05;m.add(l)}
    if(lights++<6){const pl=new THREE.PointLight(0xff8a3c,2.2,14);pl.position.y=1;m.add(pl)}
    m.position.set(o.x,H(o.x,o.z),o.z);fires.push(o)}
  scene.add(m);
}
function place(t){
  const fx=-Math.sin(st.yaw),fz=-Math.cos(st.yaw);let x=st.x+fx*3,z=st.z+fz*3,ry=0;
  if(t=='wall'||t=='floor'){x=Math.round(x/2)*2;z=Math.round(z/2)*2;ry=t=='wall'&&Math.abs(fx)>Math.abs(fz)?Math.PI/2:0}else ry=st.yaw;
  const o={t,x,z,ry};placed.push(o);addPlaced(o);take(t);toast('Поставлено: '+ITEMS[t][1]);close();
}
// Использование предмета: еда, вода, готовка, постройки
const eatIt=(k,t)=>{take(k);eatT=1;sfx.eat();toast(t)};
function useItem(k){
  const fire=fires.some(f=>Math.hypot(f.x-st.x,f.z-st.z)<4);
  if(k=='food'){st.hun=Math.min(100,st.hun+35);eatIt(k,'+ сытость')}
  else if(k=='steak'){st.hun=Math.min(100,st.hun+55);eatIt(k,'Вкусно!')}
  else if(k=='meat'){if(fire){take(k);add('steak');toast('Мясо приготовлено на костре')}else{st.hun=Math.min(100,st.hun+15);st.hp-=8;eatIt(k,'Сырое мясо: − здоровье')}}
  else if(k=='rotten'){st.hp-=15;eatIt(k,'Тухлятина: − здоровье')}
  else if(k=='water'){st.thi=Math.min(100,st.thi+40);eatIt(k,'+ вода')}
  else if(PL[k]||k=='campfire')place(k);
  else toast(k=='coat'?'Куртка греет, пока лежит в инвентаре':'Возьми в руки и бей по цели');
}

/* ===== Руки от первого лица (примитивы Three.js) ===== */
const hm=c=>{const m=mat(c);m.emissive=new THREE.Color(c).multiplyScalar(.2);return m};
const hands=new THREE.Group();cam.add(hands);scene.add(cam);
function arm(x){const g=new THREE.Group(),a=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.55),hm(0x3b4a3a)),h=new THREE.Mesh(new THREE.BoxGeometry(.13,.1,.16),hm(0xc89b78));
  a.position.z=-.1;h.position.z=-.42;g.add(a,h);g.position.set(x,-.32,-.35);hands.add(g);return g}
const aL=arm(-.28),aR=arm(.28);let heldM=null,heldK=null;
function setHeld(k){
  if(k===heldK)return;heldK=k;if(heldM){aR.remove(heldM);heldM=null}if(!k)return;
  const g=new THREE.Group(),B=(w,h,d,c,x=0,y=0,z=0)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),hm(c));m.position.set(x,y,z);g.add(m)};
  if(k=='axe'||k=='axe2'){B(.04,.5,.04,0x6b4a2b,0,.2);B(.04,.14,.2,k=='axe'?0x888888:0x4a5560,0,.42,.08)}
  else if(k=='pickaxe'){B(.04,.5,.04,0x6b4a2b,0,.2);B(.04,.05,.4,0x888888,0,.45)}
  else if(k=='water'){const c=new THREE.Mesh(new THREE.CylinderGeometry(.04,.045,.2,8),hm(0x4aa3ff));c.position.y=.1;g.add(c)}
  else B(.1,.08,.14,{food:0x8a8f55,meat:0xb23a48,steak:0x6b3a1e,rotten:0x556b2f,coat:0x3b6a8a}[k]||0x8a6a44,0,.05);
  g.position.set(0,.02,-.5);g.rotation.x=-.35;aR.add(g);heldM=g;
}

/* ===== Взаимодействие ===== */
let cd=0;
function target(){
  let best=null,bd=3.4;
  for(const n of nodes){if(n.hp<=0)continue;const d=Math.hypot(n.x-st.x,n.z-st.z)-n.r;if(d<bd){bd=d;best={k:'node',n,label:n.k=='tree'?'Рубить':'Добывать'}}}
  for(const c of chests){if(c.open)continue;const d=Math.hypot(c.x-st.x,c.z-st.z);if(d<bd){bd=d;best={k:'chest',c,label:'Открыть'}}}
  for(const t of traders){const d=Math.hypot(t.x-st.x,t.z-st.z);if(d<bd){bd=d;best={k:'trader',label:'Торговать'}}}
  if(!best&&H(st.x,st.z)<WATER+.9)best={k:'water',label:'Пить'};
  return best;
}
function act(){
  if(cd>0)return;cd=.5;swing=1;const t=target();
  if(!t){sfx.hit(2);return}
  if(t.k=='node'){const n=t.n,tree=n.k=='tree',h=held(),mul=tree?({axe:3,axe2:5}[h]||1):(h=='pickaxe'?3:1);
    sfx.hit(tree?0:1);n.hp-=mul>1?2:1;add(tree?'wood':'stone',mul);toast((tree?'+ дерево ×':'+ камень ×')+mul);
    if(n.hp<=0){hideNode(n);removed.push(n.id)}}
  else if(t.k=='chest'){t.c.open=true;t.c.m.material=mat(0x3a2a18);opened.push(chests.indexOf(t.c));sfx.hit(0);
    const loot=['food','water','wood','stone','meat','water','meat'],got=[];for(let i=0;i<3;i++){const k=loot[rnd()*loot.length|0];add(k,1+(rnd()*2|0));got.push(ITEMS[k][0])}
    if(rnd()<.3){add('axe');got.push('🪓')}if(rnd()<.08){add('coat');got.push('🧥')}toast('Лут: '+got.join(' '))}
  else if(t.k=='trader'){if((inv.wood||0)>=3){take('wood',3);add('food');toast('Обмен: 3 дерева → консервы')}else if((inv.stone||0)>=4){take('stone',4);add('water');toast('Обмен: 4 камня → вода')}else toast('Торговец берёт 3 дерева или 4 камня')}
  else if(t.k=='water'){st.thi=Math.min(100,st.thi+25);toast('+ вода')}
}

/* ===== Управление ===== */
const keys={};let sv={x:0,y:0};
addEventListener('keydown',e=>{keys[e.code]=1;if(mode!='play')return;if(e.code=='KeyE')act();if(e.code=='KeyI')open('mInv');if(e.code=='KeyC')open('mCraft');if(e.code=='Escape')close()});
addEventListener('keyup',e=>keys[e.code]=0);
addEventListener('keydown',e=>{if(mode=='play'&&/^Digit[1-6]$/.test(e.code))hbPress(+e.code[5]-1)});
addEventListener('pointerdown',initAudio,{once:true});addEventListener('keydown',initAudio,{once:true});
document.addEventListener('click',e=>{if(e.target.closest('.btn,.round,.slot'))sfx.click()});
const stick=$('stick'),knob=$('knob');let sid=null;
const mv=e=>{const r=stick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,m=Math.min(1,Math.hypot(dx,dy)/60),a=Math.atan2(dy,dx);
  sv={x:Math.cos(a)*m,y:Math.sin(a)*m};knob.style.transform=`translate(${sv.x*35}px,${sv.y*35}px)`};
stick.onpointerdown=e=>{sid=e.pointerId;stick.setPointerCapture(sid);mv(e)};
stick.onpointermove=e=>{if(e.pointerId==sid)mv(e)};
stick.onpointerup=stick.onpointercancel=e=>{if(e.pointerId==sid){sid=null;sv={x:0,y:0};knob.style.transform=''}};
// Обзор: тач/мышь по canvas
let lid=null,lx=0,ly=0;const cv=$('c');
cv.onpointerdown=e=>{if(mode!='play')return;lid=e.pointerId;lx=e.clientX;ly=e.clientY;cv.setPointerCapture(lid)};
cv.onpointermove=e=>{if(e.pointerId!=lid)return;const k=.005*cfg.sens;st.yaw-=(e.clientX-lx)*k;st.pitch=Math.max(-1.3,Math.min(1.3,st.pitch-(e.clientY-ly)*k));lx=e.clientX;ly=e.clientY};
cv.onpointerup=cv.onpointercancel=()=>lid=null;
$('bAct').onpointerdown=act;

/* ===== UI: меню, окна ===== */
const open=id=>{renderInv();$(id).classList.remove('hidden')},close=()=>document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));
document.querySelectorAll('.close').forEach(b=>b.onclick=close);
$('bInv').onclick=()=>open('mInv');$('bCraft').onclick=()=>open('mCraft');
$('bSet').onclick=()=>open('mSet');$('bAbout').onclick=()=>open('mAbout');
$('selQ').value=cfg.q;$('rngS').value=cfg.sens;
$('selQ').onchange=e=>{cfg.q=+e.target.value;applyCfg()};$('rngS').oninput=e=>{cfg.sens=+e.target.value;applyCfg()};
$('bNew').onclick=()=>{localStorage.removeItem(SAVE);sessionStorage.setItem('ashfall_go','new');location.reload()};
$('bCont').onclick=()=>{loadSave();start()};
$('bExit').onclick=()=>{persist();location.reload()};
$('bRe').onclick=$('bNew').onclick;
function start(){
  mode='play';$('menu').classList.add('hidden');$('hud').classList.remove('hidden');
  if(st.x==0&&st.z==0){st.x=0;st.z=0}
  renderInv();toast('Найди топор в деревнях или создай из дерева и камня');
}

/* ===== Сохранения ===== */
function persist(){if(mode!='play')return;localStorage.setItem(SAVE,JSON.stringify({st,inv,removed,opened,placed}))}
function loadSave(){
  try{const s=JSON.parse(localStorage.getItem(SAVE));st=Object.assign(DEF(),s.st);inv=s.inv;removed=s.removed;opened=s.opened;placed=s.placed;
    removed.forEach(i=>{nodes[i].hp=0;hideNode(nodes[i])});opened.forEach(i=>{chests[i].open=true;chests[i].m.material=mat(0x3a2a18)});placed.forEach(addPlaced)}catch(e){fresh()}
}
setInterval(persist,8000);addEventListener('pagehide',persist);

/* ===== Главный цикл ===== */
const sky=[new THREE.Color(0x070b14),new THREE.Color(0x87b5d6)],skyC=new THREE.Color();
let last=performance.now(),clockT=0;
function loop(now){
  requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;cd-=dt;
  // день/ночь
  st.t=(st.t+dt/480)%1;const sh=Math.cos((st.t-.25)*TAU),day=dayF=Math.max(0,Math.min(1,(sh+.1)/.4));
  skyC.lerpColors(sky[0],sky[1],day);scene.background=skyC;scene.fog.color.copy(skyC);scene.fog.far=120-rain*60;
  sun.intensity=day*1.15;hemi.intensity=.12+day*.7;
  if(mode=='play')update(dt);else{hands.visible=false; // облёт в меню
    const a=now/14000;st.x=Math.cos(a)*60;st.z=Math.sin(a)*60;cam.position.set(st.x,H(st.x,st.z)+14,st.z);cam.lookAt(0,H(0,0)+4,0);st.t=.72}
  sun.position.set(st.x+Math.sin((st.t-.25)*TAU)*80,sh*80+5,st.z+30);sun.target.position.set(st.x,0,st.z);
  renderer.render(scene,cam);
}
function update(dt){
  hands.visible=true;const px=st.x,pz=st.z;
  // погода
  rainT-=dt;if(rainT<=0){rainOn=!rainOn;rainT=rainOn?50+rnd()*40:80+rnd()*80;toast(rainOn?'Начался дождь':'Дождь стихает')}
  rain+=((rainOn?1:0)-rain)*dt*.3;
  // движение (WASD или стик), коллизии, спринт
  let ix=(keys.KeyD?1:0)-(keys.KeyA?1:0)+sv.x,iz=(keys.KeyS?1:0)-(keys.KeyW?1:0)+sv.y;const l=Math.hypot(ix,iz);if(l>1){ix/=l;iz/=l}
  const moving=l>.1,sprint=moving&&st.sta>5&&(keys.ShiftLeft||Math.hypot(sv.x,sv.y)>.97);
  const sp=(sprint?7:4.5)*(1-st.fat/100*.35)*(st.thi<15?.7:1)*(st.tmp<25?.8:1),c=Math.cos(st.yaw),sn=Math.sin(st.yaw);
  let nx=st.x+(ix*c+iz*sn)*sp*dt,nz=st.z+(-ix*sn+iz*c)*sp*dt;
  const push=o=>{const dx=nx-o.x,dz=nz-o.z,d=Math.hypot(dx,dz),m=o.r+.4;if(d<m&&d>0){nx=o.x+dx/d*m;nz=o.z+dz/d*m}};
  for(const n of nodes)if(n.hp>0&&Math.abs(n.x-nx)<3&&Math.abs(n.z-nz)<3)push(n);
  for(const o of obst)if(Math.abs(o.x-nx)<5&&Math.abs(o.z-nz)<5)push(o);
  st.x=Math.max(-HALF+3,Math.min(HALF-3,nx));st.z=Math.max(-HALF+3,Math.min(HALF-3,nz));
  const gy=H(st.x,st.z);cam.position.set(st.x,Math.max(gy,WATER+.3)+1.7,st.z);cam.rotation.set(st.pitch,st.yaw,0);
  // шаги и ветер
  stepD+=Math.hypot(st.x-px,st.z-pz);if(stepD>(sprint?2.2:1.7)){stepD=0;sfx.step(gy<WATER+.7?0:gy>6.5?2:1)}
  wind(.05+.07*rain+.05*(1-dayF));
  // выносливость, усталость, температура
  const nearFire=fires.some(f=>Math.hypot(f.x-st.x,f.z-st.z)<5);
  st.sta=sprint?Math.max(0,st.sta-18*dt):Math.min(100,st.sta+(moving?6:14)*dt*(1-st.fat/150));
  st.fat=Math.max(0,Math.min(100,st.fat+(moving?.25:-.3)*dt-(nearFire?2*dt:0)));
  const tgt=Math.min(100,Math.max(0,22+48*dayF-rain*22+(inv.coat?28:0)+(nearFire?60:0)));
  st.tmp+=(tgt-st.tmp)*dt*(tgt>st.tmp?.15:.04);
  // голод, жажда, здоровье
  st.hun=Math.max(0,st.hun-dt*.12);st.thi=Math.max(0,st.thi-dt*.18);
  if(st.hun<=0||st.thi<=0)st.hp-=dt;else if(st.hun>50&&st.thi>50&&st.tmp>40)st.hp=Math.min(100,st.hp+dt*.3);
  if(st.tmp<20)st.hp-=.8*dt;
  if(nearFire)st.hp=Math.min(100,st.hp+dt*2);
  // порча мяса: сырое мясо гниёт за 150 с, если не приготовить
  if(inv.meat){st.meatAge+=dt;if(st.meatAge>150){add('rotten',inv.meat);delete inv.meat;st.meatAge=0;renderInv();toast('Мясо протухло!')}}else st.meatAge=0;
  if(st.hp<=0){mode='dead';localStorage.removeItem(SAVE);$('dead').classList.remove('hidden');return}
  // дождь (частицы)
  if(!rainM){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(Float32Array.from({length:1500},(_,i)=>i%3==1?Math.random()*14:(Math.random()-.5)*24),3));
    rainM=new THREE.Points(g,new THREE.PointsMaterial({color:0xaec8e0,size:.08,transparent:true,opacity:.6}));rainM.frustumCulled=false;scene.add(rainM)}
  rainM.visible=rain>.05;rainM.position.set(st.x,gy,st.z);
  if(rainM.visible){const pa=rainM.geometry.attributes.position;for(let i=0;i<pa.count;i++){let y=pa.getY(i)-22*dt;if(y<0)y=14;pa.setY(i,y)}pa.needsUpdate=true}
  // анимация рук: покачивание, замах, поедание
  walk+=moving?dt*(sprint?11:8):0;hands.position.y=moving?Math.sin(walk)*.012:0;
  swing=Math.max(0,swing-dt*3.2);eatT=Math.max(0,eatT-dt*1.1);
  const sw=Math.sin(swing*Math.PI),ea=Math.sin(eatT*Math.PI);
  aR.rotation.x=.1-sw*1.1+ea*.9;aR.position.set(.28-ea*.2,-.32+ea*.3-sw*.05,-.35+ea*.05);aL.rotation.x=.1;
  // HUD
  $('bHp').style.width=st.hp+'%';$('bHun').style.width=st.hun+'%';$('bThi').style.width=st.thi+'%';
  $('bSta').style.width=st.sta+'%';$('bTmp').style.width=st.tmp+'%';$('bFat').style.width=st.fat+'%';
  const hh=(st.t*24+6)%24|0,mm=((st.t*24+6)%1*60)|0;$('clock').textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`+(rain>.3?' 🌧':'');
  const t=target(),b=$('bAct');b.classList.toggle('hidden',!t);if(t)b.textContent=t.label;
}

/* ===== Старт ===== */
(async()=>{
  applyCfg();await buildWorld();await new Promise(r=>setTimeout(r,1800));
  $('loading').classList.add('hidden');$('menu').classList.remove('hidden');mode='menu';
  if(localStorage.getItem(SAVE))$('bCont').classList.remove('hidden');
  requestAnimationFrame(loop);
  const go=sessionStorage.getItem('ashfall_go');sessionStorage.removeItem('ashfall_go');
  if(go=='new'){fresh();start()}
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
