// Процедурная геометрия: деревья, камни, постройки, волк, анатомические руки, инструменты. Без внешних моделей.
import * as THREE from 'three';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
let sd=777;const rnd=()=>(sd=sd*16807%2147483647,(sd-1)/2147483646);
const N=(x,y,z)=>Math.sin(x*3.1+1.7)*Math.sin(y*2.7+.4)*.12+Math.sin(z*4.3+x*1.9)*.08+Math.sin(y*6.1+z*5.3)*.04; // шум для эрозии/неровностей
const cvs=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t};
export const VM=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92});
const MEATM=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.4,emissive:0x1a0a05});

// --- утилиты: покраска вершин, склейка в один меш, сужающаяся труба по кривой, "живой" эллипсоид
function paint(g,hex,jit=.08,fn){const c=new THREE.Color(hex),p=g.attributes.position,a=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+Math.sin(x*9+y*7+z*5)*.5*jit+(fn?fn(x,y,z):0);a.set([c.r*k,c.g*k,c.b*k],i*3)}
  g.setAttribute('color',new THREE.BufferAttribute(a,3));return g}
export function merge(list){const gs=list.map(g=>g.index?g.toNonIndexed():g);let n=0;gs.forEach(g=>n+=g.attributes.position.count);
  const P=new Float32Array(n*3),Nm=new Float32Array(n*3),C=new Float32Array(n*3).fill(1);let o=0;
  for(const g of gs){P.set(g.attributes.position.array,o*3);Nm.set(g.attributes.normal.array,o*3);if(g.attributes.color)C.set(g.attributes.color.array,o*3);o+=g.attributes.position.count}
  const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(P,3));m.setAttribute('normal',new THREE.BufferAttribute(Nm,3));m.setAttribute('color',new THREE.BufferAttribute(C,3));return m}
function tube(pts,seg,rad,r0,r1,color,sym){const cv=new THREE.CatmullRomCurve3(pts),g=new THREE.TubeGeometry(cv,seg,1,rad,false),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const t=Math.floor(i/(rad+1))/seg,c=cv.getPointAt(t),r=sym?r0+(r1-r0)*Math.abs(2*t-1):r0+(r1-r0)*t;
    p.setXYZ(i,c.x+(p.getX(i)-c.x)*r,c.y+(p.getY(i)-c.y)*r,c.z+(p.getZ(i)-c.z)*r)}
  g.computeVertexNormals();return paint(g,color,.12)}
function blob(cx,cy,cz,rx,ry,rz,color,seg=8){const g=new THREE.SphereGeometry(1,seg,Math.max(5,seg*.75|0)),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),d=1+N(x*2+cx,y*2+cy,z*2+cz)*2;p.setXYZ(i,cx+x*rx*d,cy+y*ry*d,cz+z*rz*d)}
  g.computeVertexNormals();return paint(g,color,.1,(x,y)=>(y-cy)/ry*.14)}

// --- Деревья: изогнутый сужающийся ствол, корни, сучья, многоуровневая крона (0 — лиственное, 1 — хвойное)
export function treeGeo(kind){const P=[],bx=(rnd()-.5)*.9,bz=(rnd()-.5)*.9,H=kind?7.2:6.2,at=y=>[bx*y/H,y,bz*y/H];
  P.push(tube([V(0,0,0),V(bx*.4,H*.3,bz*.4),V(bx*.9,H*.62,bz*.9),V(bx,H,bz)],10,7,.42,.1,0x4a3424));
  for(let i=0;i<4;i++){const a=i*1.57+rnd(),c=Math.cos(a),s=Math.sin(a);P.push(tube([V(c*.15,.5,s*.15),V(c*.5,.15,s*.5),V(c*.95,-.05,s*.95)],4,5,.13,.04,0x3b2a1d))}
  if(!kind){for(let i=0;i<4;i++){const a=i*1.9+rnd(),y=H*(.45+i*.12),b=at(y),e=V(b[0]+Math.cos(a)*1.7,y+1,b[2]+Math.sin(a)*1.7);
      P.push(tube([V(...b),V((b[0]+e.x)/2,y+.4,(b[2]+e.z)/2),e],5,5,.1,.03,0x4a3424),blob(e.x,e.y+.5,e.z,1.3,1,1.3,0x3d6b2e))}
    P.push(blob(bx,H+.4,bz,2,1.6,2,0x4a7a34),blob(bx,H-.9,bz,2.4,1.3,2.4,0x35602a))}
  else{for(let i=0;i<5;i++){const y=H*.36+i*H*.16,b=at(y),r=2.2-i*.4;P.push(blob(b[0],y,b[2],r,.55,r,i%2?0x1f4a30:0x285a38,9))}P.push(blob(bx,H+1,bz,.35,.9,.35,0x2a5a38,6))}
  return merge(P)}
// --- Камень: обточенный эрозией валун
export function rockGeo(){const g=new THREE.SphereGeometry(1,10,8),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i);let y=p.getY(i);const z=p.getZ(i),d=1+N(x*1.7,y*1.7,z*1.7)*2.6;y=y<0?y*.35:y;p.setXYZ(i,x*d,y*d*.8,z*d)}
  g.computeVertexNormals();return paint(g,0x7d7b76,.18,(x,y)=>y*.12)}
// --- Круглая заброшенная хижина (вращение профиля) и бочка-сундук
export function hut(wm,rm){wm.side=rm.side=THREE.DoubleSide;const g=new THREE.Group(),L=(a,m)=>new THREE.Mesh(new THREE.LatheGeometry(a.map(v=>new THREE.Vector2(...v)),16),m);
  const w=L([[2.3,0],[2.45,1],[2.35,2.4],[2.5,2.7]],wm),r=L([[2.9,2.5],[2.4,3.3],[1.4,4.1],[.5,4.6],[0,4.7]],rm);w.castShadow=r.castShadow=true;g.add(w,r);return g}
export const barrelGeo=()=>new THREE.LatheGeometry([[.001,-.35],[.3,-.35],[.37,-.1],[.37,.1],[.3,.35],[.001,.35]].map(v=>new THREE.Vector2(...v)),12);
// --- Строительные детали: частокол, круглый настил, верстак
export function piece(t){let g;
  if(t=='wall'){const P=[];for(let i=-2;i<=2;i++){const x=i*.42,h=2.3+rnd()*.3;P.push(tube([V(x,0,0),V(x+.02,h/2,.03),V(x,h,0)],6,7,.2,.13,0x7a5a38),paint(new THREE.ConeGeometry(.14,.45,8).translate(x,h+.2,0),0x7a5a38))}g=merge(P)}
  else if(t=='floor')g=paint(new THREE.CylinderGeometry(1.35,1.4,.22,18).translate(0,.11,0),0x7a5c38,.2);
  else{const P=[paint(new THREE.CylinderGeometry(.75,.75,.1,16).translate(0,.9,0),0x8a6a44,.15),blob(.5,1.05,.1,.1,.1,.1,0x555555)];
    for(let i=0;i<4;i++){const a=i*1.57+.78;P.push(tube([V(Math.cos(a)*.5,.9,Math.sin(a)*.5),V(Math.cos(a)*.55,.4,Math.sin(a)*.55),V(Math.cos(a)*.6,0,Math.sin(a)*.6)],4,6,.07,.06,0x5a3d26))}g=merge(P)}
  const m=new THREE.Mesh(g,VM);m.castShadow=m.receiveShadow=true;return m}
// --- Волк
export function wolf(){const c=0x6b6b70,d=0x4d4d52,P=[blob(0,.8,.1,.28,.32,.62,c,9),blob(0,.86,-.38,.3,.36,.34,d,9),blob(0,.95,-.85,.2,.2,.24,c,8),blob(0,.86,-1.12,.09,.09,.2,d,6),
  paint(new THREE.ConeGeometry(.06,.18,5).translate(-.1,1.18,-.8),d),paint(new THREE.ConeGeometry(.06,.18,5).translate(.1,1.18,-.8),d),tube([V(0,.9,.65),V(0,.85,.95),V(0,.55,1.2)],5,5,.07,.03,d)];
  for(const sx of[-.16,.16])for(const sz of[-.45,.5])P.push(tube([V(sx,.7,sz),V(sx,.35,sz+.03),V(sx,0,sz)],4,6,.09,.045,c));
  const m=new THREE.Mesh(merge(P),VM);m.castShadow=true;const g=new THREE.Group();g.add(m);return g}

// --- Анатомическая рука: предплечье, запястье, ладонь, 4 пальца по 3 фаланги + большой палец
const SKIN=new THREE.MeshStandardMaterial({color:0xc68f6b,roughness:.6,emissive:0x2a1208}),SLV=new THREE.MeshStandardMaterial({color:0x3a4636,roughness:.95,emissive:0x0c120b});
export function hand(right){const g=new THREE.Group(),s=right?1:-1,M=(geo,m)=>g.add(new THREE.Mesh(geo,m)),fing=[];
  M(new THREE.CylinderGeometry(.05,.062,.62,14).rotateX(Math.PI/2).translate(0,0,.31),SLV);
  M(new THREE.TorusGeometry(.056,.014,8,16).translate(0,0,.02),SLV);
  M(new THREE.CylinderGeometry(.034,.04,.07,12).rotateX(Math.PI/2).translate(0,0,-.02),SKIN);
  M(new THREE.SphereGeometry(1,16,12).scale(.047,.022,.058).translate(0,0,-.07),SKIN);
  const mk=(x,z,lens,r,ry=0)=>{const root=new THREE.Group(),segs=[];root.position.set(x,0,z);root.rotation.y=ry;let par=root;
    lens.forEach((L,i)=>{const sg=new THREE.Group();if(i)sg.position.z=-lens[i-1]-r;sg.add(new THREE.Mesh(new THREE.CapsuleGeometry(r*(1-i*.1),L,4,8).rotateX(Math.PI/2).translate(0,0,-(L/2+r)),SKIN));par.add(sg);par=sg;segs.push(sg)});g.add(root);return segs};
  [[-.034,[.034,.026,.02]],[-.012,[.038,.028,.021]],[.011,[.035,.026,.02]],[.032,[.028,.02,.018]]].forEach(([x,l])=>fing.push(mk(x,-.12,l,.0085)));
  return{g,fing,thumb:mk(-s*.04,-.05,[.03,.024],.0105,s*.9)}}
export const curl=(h,a)=>{h.fing.forEach(f=>f.forEach((sg,i)=>sg.rotation.x=-a*[1.15,1.35,.9][i]));h.thumb.forEach((sg,i)=>sg.rotation.x=-a*.4*(i+1))};

// --- Предметы в руке
const WOOD=new THREE.MeshStandardMaterial({map:cvs(64,128,(c,w,h)=>{c.fillStyle='#7a5232';c.fillRect(0,0,w,h);for(let i=0;i<70;i++){c.strokeStyle=`rgba(${rnd()<.5?'40,24,10':'170,120,70'},${.15+rnd()*.25})`;c.lineWidth=1+rnd()*2;const y=rnd()*h;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(w*.3,y+rnd()*6-3,w*.6,y+rnd()*6-3,w,y);c.stroke()}}),roughness:.75,emissive:0x1c1008});
const scr=cvs(128,128,(c,w,h)=>{c.fillStyle='#9ea3a8';c.fillRect(0,0,w,h);for(let i=0;i<60;i++){c.strokeStyle=`rgba(${rnd()<.5?'255,255,255':'30,30,34'},${.15+rnd()*.3})`;c.lineWidth=.6;c.beginPath();const x=rnd()*w,y=rnd()*h;c.moveTo(x,y);c.lineTo(x+rnd()*40-20,y+rnd()*40-20);c.stroke()}});
const METAL=new THREE.MeshStandardMaterial({map:scr,metalness:.5,roughness:.42,emissive:0x101214}),METAL2=new THREE.MeshStandardMaterial({map:scr,color:0x8497a6,metalness:.5,roughness:.4,emissive:0x0c1014});
const flameTex=cvs(64,64,(c)=>{const g=c.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,'rgba(255,240,180,1)');g.addColorStop(.4,'rgba(255,150,40,.8)');g.addColorStop(1,'rgba(255,60,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64)});
export function tool(k){const g=new THREE.Group(),A=(geo,m)=>{const x=new THREE.Mesh(geo,m);g.add(x);return x},
  handle=(len,cv)=>tube([V(0,-.14,0),V(cv,.1,.01),V(-cv,.3,0),V(0,len,.01)],12,8,.02,.016,0x7a5232);
  if(k=='axe'||k=='axe2'){A(handle(.52,.012),WOOD);const sh=new THREE.Shape();sh.moveTo(.04,-.04);sh.lineTo(.045,.05);sh.lineTo(-.01,.055);sh.quadraticCurveTo(-.1,.12,-.17,.11);sh.quadraticCurveTo(-.15,0,-.17,-.12);sh.quadraticCurveTo(-.1,-.07,-.01,-.055);sh.lineTo(.04,-.04);
    const hg=new THREE.ExtrudeGeometry(sh,{depth:.03,bevelEnabled:true,bevelThickness:.007,bevelSize:.007,bevelSegments:2,curveSegments:8});hg.translate(0,0,-.015).rotateY(-Math.PI/2);
    A(hg,k=='axe'?METAL:METAL2).position.y=.44;A(new THREE.CylinderGeometry(.026,.026,.05,10).translate(0,.44,0),METAL)}
  else if(k=='pickaxe'){A(handle(.5,.006),WOOD);A(tube([V(0,-.07,-.27),V(0,0,-.15),V(0,.04,0),V(0,0,.15),V(0,-.07,.27)],14,8,.03,.004,0x999999,true),METAL).position.y=.48}
  else if(k=='torch'){A(tube([V(0,-.14,0),V(0,.1,0),V(0,.28,0)],6,8,.022,.03,0x7a5232),WOOD);
    A(new THREE.LatheGeometry([[.01,.26],[.035,.3],[.04,.36],[.03,.42],[.01,.44]].map(v=>new THREE.Vector2(...v)),10),new THREE.MeshStandardMaterial({color:0x2a2118,emissive:0x602010,roughness:1}));
    const S=[];for(let i=0;i<8;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:flameTex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));s.userData.t=i/8;g.add(s);S.push(s)}
    g.userData.fl=dt=>S.forEach((s,i)=>{const t=s.userData.t=(s.userData.t+dt*1.6)%1;s.position.set(Math.sin(t*6+i)*.012*(1-t),.45+t*.17,0);s.scale.setScalar(.13*(1-t*.6)+.02);s.material.opacity=1-t})}
  else if(k=='meat'||k=='steak'||k=='rotten'){const c={meat:0xb83a4b,steak:0x6a3516,rotten:0x5d6b2e}[k];
    A(merge([blob(0,.05,0,.075,.05,.105,c,10),blob(0,.085,-.01,.05,.012,.075,k=='steak'?0xe6d3a0:0xe8b0b8,8),tube([V(0,.04,.09),V(0,.05,.17)],3,6,.014,.012,0xeee6d4),blob(0,.05,.185,.022,.02,.022,0xeee6d4,6)]),MEATM)}
  else if(k=='food'){A(new THREE.CylinderGeometry(.04,.04,.09,16),METAL);A(new THREE.CylinderGeometry(.0405,.0405,.05,16),new THREE.MeshStandardMaterial({color:0xb5502a,roughness:.7}))}
  else if(k=='water')A(new THREE.LatheGeometry([[.001,0],[.04,0],[.045,.12],[.02,.17],[.018,.21],[.001,.21]].map(v=>new THREE.Vector2(...v)),12),new THREE.MeshStandardMaterial({color:0x6bb7e8,transparent:true,opacity:.7,roughness:.2}));
  else A(new THREE.SphereGeometry(.06,12,10),WOOD);
  return g}
export const noiseTex=rep=>{const t=cvs(128,128,(c,w,h)=>{const d=c.createImageData(w,h);for(let i=0;i<w*h;i++){const v=185+rnd()*70;d.data.set([v,v,v,255],i*4)}c.putImageData(d,0,0)});t.repeat.set(rep,rep);return t};
