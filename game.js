import * as THREE from 'three';
const $=i=>document.getElementById(i), TAU=Math.PI*2, SAVE='ashfall_save_v1';

/* ===== Данные ===== */
const ITEMS={wood:['🪵','Дерево'],stone:['🪨','Камень'],axe:['🪓','Топор'],pickaxe:['⛏️','Кирка'],campfire:['🔥','Костёр'],wall:['🧱','Стена'],water:['💧','Вода'],food:['🥫','Консервы']};
const RECIPES=[{id:'axe',cost:{wood:3,stone:2}},{id:'pickaxe',cost:{wood:3,stone:3}},{id:'campfire',cost:{wood:5,stone:3}},{id:'wall',cost:{wood:6}}];
const cfg=Object.assign({q:1,sens:1},JSON.parse(localStorage.getItem('ashfall_cfg')||'{}'));
let st,inv,removed=[],opened=[],placed=[],mode='load';
const fresh=()=>{st={hp:100,hun:100,thi:100,t:.3,x:0,z:0,yaw:0,pitch:0};inv={};removed=[];opened=[];placed=[]};
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
const tick=()=>new Promise(r=>setTimeout(r)), prog=(p,t)=>{$('lbar').style.width=p+'%';if(t)$('ltxt').textContent=t};

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
function renderInv(){
  const g=$('grid');g.innerHTML='';const es=Object.entries(inv);
  for(let i=0;i<20;i++){const d=document.createElement('div');d.className='slot';
    if(es[i]){const[k,n]=es[i];d.innerHTML=`${ITEMS[k][0]}<b>${n}</b>`;d.title=ITEMS[k][1];d.onclick=()=>useItem(k)}g.appendChild(d)}
  const r=$('recipes');r.innerHTML='';
  for(const rc of RECIPES){const owned=(rc.id=='axe'||rc.id=='pickaxe')&&inv[rc.id];
    const d=document.createElement('div');d.className='rec';
    d.innerHTML=`<div>${ITEMS[rc.id][0]} ${ITEMS[rc.id][1]}<small>${Object.entries(rc.cost).map(([k,v])=>`${ITEMS[k][0]}×${v}`).join('  ')}</small></div>`;
    const b=document.createElement('button');b.className='btn';b.textContent=owned?'Есть':'Создать';b.disabled=owned||!has(rc.cost);
    b.onclick=()=>{for(const[k,v]of Object.entries(rc.cost))take(k,v);add(rc.id);toast('Создано: '+ITEMS[rc.id][1])};d.appendChild(b);r.appendChild(d)}
}
let lights=0;
function addPlaced(o){
  let m;
  if(o.t=='wall'){m=new THREE.Mesh(new THREE.BoxGeometry(2,2.4,.3),mat(0x8a6a44));m.position.set(o.x,H(o.x,o.z)+1.2,o.z);m.rotation.y=o.ry;m.castShadow=true;obst.push({x:o.x,z:o.z,r:1.1})}
  else{m=new THREE.Group();const f=new THREE.Mesh(new THREE.ConeGeometry(.35,.9,6),new THREE.MeshBasicMaterial({color:0xff8a2a}));f.position.y=.6;m.add(f);
    for(let i=0;i<3;i++){const l=new THREE.Mesh(new THREE.BoxGeometry(.9,.15,.15),mat(0x4a3320));l.position.y=.1;l.rotation.y=i*1.05;m.add(l)}
    if(lights++<4){const pl=new THREE.PointLight(0xff8a3c,2.2,14);pl.position.y=1;m.add(pl)}
    m.position.set(o.x,H(o.x,o.z),o.z);fires.push(o)}
  scene.add(m);
}
const fires=[];
function place(t){
  const fx=-Math.sin(st.yaw),fz=-Math.cos(st.yaw);let x=st.x+fx*3,z=st.z+fz*3,ry=0;
  if(t=='wall'){x=Math.round(x/2)*2;z=Math.round(z/2)*2;ry=Math.abs(fx)>Math.abs(fz)?Math.PI/2:0}
  const o={t,x,z,ry};placed.push(o);addPlaced(o);take(t);toast('Поставлено: '+ITEMS[t][1]);close();
}
function useItem(k){
  if(k=='food'){st.hun=Math.min(100,st.hun+35);take(k);toast('+ сытость')}
  else if(k=='water'){st.thi=Math.min(100,st.thi+40);take(k);toast('+ вода')}
  else if(k=='campfire'||k=='wall')place(k);
}

/* ===== Взаимодействие ===== */
let cd=0;
function target(){
  let best=null,bd=3.4;
  for(const n of nodes){if(n.hp<=0)continue;const d=Math.hypot(n.x-st.x,n.z-st.z)-n.r;if(d<bd){bd=d;best={k:'node',n,label:n.k=='tree'?'Рубить':'Добывать'}}}
  for(const c of chests){if(c.open)continue;const d=Math.hypot(c.x-st.x,c.z-st.z);if(d<bd){bd=d;best={k:'chest',c,label:'Открыть'}}}
  if(!best&&H(st.x,st.z)<WATER+.9)best={k:'water',label:'Пить'};
  return best;
}
function act(){
  const t=target();if(!t||cd>0)return;cd=.45;
  if(t.k=='node'){const n=t.n,tree=n.k=='tree',tool=inv[tree?'axe':'pickaxe']?1:0;
    n.hp-=tool?2:1;add(tree?'wood':'stone',tool?3:1);toast(tree?'+ дерево':'+ камень');
    if(n.hp<=0){hideNode(n);removed.push(n.id)}}
  else if(t.k=='chest'){t.c.open=true;t.c.m.material=mat(0x3a2a18);opened.push(chests.indexOf(t.c));
    const loot=['food','water','wood','stone','food','water'],got=[];for(let i=0;i<3;i++){const k=loot[rnd()*loot.length|0];add(k,1+(rnd()*2|0));got.push(ITEMS[k][0])}
    if(rnd()<.35){add('axe');got.push('🪓')}toast('Лут: '+got.join(' '))}
  else if(t.k=='water'){st.thi=Math.min(100,st.thi+25);toast('+ вода')}
}

/* ===== Управление ===== */
const keys={};let sv={x:0,y:0};
addEventListener('keydown',e=>{keys[e.code]=1;if(mode!='play')return;if(e.code=='KeyE')act();if(e.code=='KeyI')open('mInv');if(e.code=='KeyC')open('mCraft');if(e.code=='Escape')close()});
addEventListener('keyup',e=>keys[e.code]=0);
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
  try{const s=JSON.parse(localStorage.getItem(SAVE));st=s.st;inv=s.inv;removed=s.removed;opened=s.opened;placed=s.placed;
    removed.forEach(i=>{nodes[i].hp=0;hideNode(nodes[i])});opened.forEach(i=>{chests[i].open=true;chests[i].m.material=mat(0x3a2a18)});placed.forEach(addPlaced)}catch(e){fresh()}
}
setInterval(persist,8000);addEventListener('pagehide',persist);

/* ===== Главный цикл ===== */
const sky=[new THREE.Color(0x070b14),new THREE.Color(0x87b5d6)],skyC=new THREE.Color();
let last=performance.now(),clockT=0;
function loop(now){
  requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;cd-=dt;
  // день/ночь
  st.t=(st.t+dt/480)%1;const sh=Math.cos((st.t-.25)*TAU),day=Math.max(0,Math.min(1,(sh+.1)/.4));
  skyC.lerpColors(sky[0],sky[1],day);scene.background=skyC;scene.fog.color.copy(skyC);
  sun.intensity=day*1.15;hemi.intensity=.12+day*.7;
  if(mode=='play')update(dt);else{ // кинематографичный облёт в меню
    const a=now/14000;st.x=Math.cos(a)*60;st.z=Math.sin(a)*60;cam.position.set(st.x,H(st.x,st.z)+14,st.z);cam.lookAt(0,H(0,0)+4,0);st.t=.72}
  sun.position.set(st.x+Math.sin((st.t-.25)*TAU)*80,sh*80+5,st.z+30);sun.target.position.set(st.x,0,st.z);
  renderer.render(scene,cam);
}
function update(dt){
  // движение (WASD или стик), коллизии
  let ix=(keys.KeyD?1:0)-(keys.KeyA?1:0)+sv.x,iz=(keys.KeyS?1:0)-(keys.KeyW?1:0)+sv.y;const l=Math.hypot(ix,iz);if(l>1){ix/=l;iz/=l}
  const sp=(keys.ShiftLeft?7:4.5)*(st.thi<15?.7:1),c=Math.cos(st.yaw),s=Math.sin(st.yaw);
  let nx=st.x+(ix*c+iz*s)*sp*dt,nz=st.z+(-ix*s+iz*c)*sp*dt;
  const push=o=>{const dx=nx-o.x,dz=nz-o.z,d=Math.hypot(dx,dz),m=o.r+.4;if(d<m&&d>0){nx=o.x+dx/d*m;nz=o.z+dz/d*m}};
  for(const n of nodes)if(n.hp>0&&Math.abs(n.x-nx)<3&&Math.abs(n.z-nz)<3)push(n);
  for(const o of obst)if(Math.abs(o.x-nx)<5&&Math.abs(o.z-nz)<5)push(o);
  st.x=Math.max(-HALF+3,Math.min(HALF-3,nx));st.z=Math.max(-HALF+3,Math.min(HALF-3,nz));
  const gy=H(st.x,st.z);cam.position.set(st.x,Math.max(gy,WATER+.3)+1.7,st.z);cam.rotation.set(st.pitch,st.yaw,0);
  // выживание
  st.hun=Math.max(0,st.hun-dt*.12);st.thi=Math.max(0,st.thi-dt*.18);
  if(st.hun<=0||st.thi<=0)st.hp-=dt;else if(st.hun>50&&st.thi>50)st.hp=Math.min(100,st.hp+dt*.3);
  if(fires.some(f=>Math.hypot(f.x-st.x,f.z-st.z)<4))st.hp=Math.min(100,st.hp+dt*2);
  if(st.hp<=0){mode='dead';localStorage.removeItem(SAVE);$('dead').classList.remove('hidden');return}
  // HUD
  $('bHp').style.width=st.hp+'%';$('bHun').style.width=st.hun+'%';$('bThi').style.width=st.thi+'%';
  const hh=(st.t*24+6)%24|0,mm=((st.t*24+6)%1*60)|0;$('clock').textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  const t=target(),b=$('bAct');b.classList.toggle('hidden',!t);if(t)b.textContent=t.label+(keys.KeyE===undefined?'':' [E]');
}

/* ===== Старт ===== */
(async()=>{
  applyCfg();await buildWorld();
  $('loading').classList.add('hidden');$('menu').classList.remove('hidden');mode='menu';
  if(localStorage.getItem(SAVE))$('bCont').classList.remove('hidden');
  requestAnimationFrame(loop);
  const go=sessionStorage.getItem('ashfall_go');sessionStorage.removeItem('ashfall_go');
  if(go=='new'){fresh();start()}
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
