// Процедурная геометрия v4: шум Перлина, кора с рельефом, ветер на GPU, осколочные камни, гуманоид, анатомические руки, огонь с частицами.
import * as THREE from 'three';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
let sd=777;const rnd=()=>(sd=sd*16807%2147483647,(sd-1)/2147483646);
// --- 3D шум Перлина (улучшенный)
const PERM=(()=>{const p=[...Array(256).keys()];let s=1234;for(let i=255;i>0;i--){s=s*16807%2147483647;const j=s%(i+1);[p[i],p[j]]=[p[j],p[i]]}return[...p,...p]})();
const fade=t=>t*t*t*(t*(t*6-15)+10),lerp=(a,b,t)=>a+(b-a)*t,grad=(h,x,y,z)=>{h&=15;const u=h<8?x:y,v=h<4?y:h==12||h==14?x:z;return((h&1)?-u:u)+((h&2)?-v:v)};
export function perlin(x,y,z){const X=Math.floor(x)&255,Y=Math.floor(y)&255,Z=Math.floor(z)&255;x-=Math.floor(x);y-=Math.floor(y);z-=Math.floor(z);
  const u=fade(x),v=fade(y),w=fade(z),A=PERM[X]+Y,AA=PERM[A]+Z,AB=PERM[A+1]+Z,B=PERM[X+1]+Y,BA=PERM[B]+Z,BB=PERM[B+1]+Z;
  return lerp(lerp(lerp(grad(PERM[AA],x,y,z),grad(PERM[BA],x-1,y,z),u),lerp(grad(PERM[AB],x,y-1,z),grad(PERM[BB],x-1,y-1,z),u),v),lerp(lerp(grad(PERM[AA+1],x,y,z-1),grad(PERM[BA+1],x-1,y,z-1),u),lerp(grad(PERM[AB+1],x,y-1,z-1),grad(PERM[BB+1],x-1,y-1,z-1),u),v),w)}
const cvs=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t};
const LV=a=>a.map(v=>new THREE.Vector2(...v));

// --- Материалы: общий процедурный рельеф (bump) коры/досок/камня; ветер в кронах считается на GPU
const bump=cvs(128,256,(c,w,h)=>{const d=c.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=Math.abs(perlin(x*.16,y*.018,1))*1.3+Math.abs(perlin(x*.5,y*.06,5))*.5,k=255-Math.min(255,v*210);d.data.set([k,k,k,255],(y*w+x)*4)}c.putImageData(d,0,0)});
export const VM=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,bumpMap:bump,bumpScale:2.5});
export const WIND={value:0};
export const TM=VM.clone();TM.onBeforeCompile=sh=>{sh.uniforms.uT=WIND;
  sh.vertexShader='uniform float uT;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  #ifdef USE_INSTANCING
  float ph=instanceMatrix[3].x*.7+instanceMatrix[3].z*.5;
  #else
  float ph=0.;
  #endif
  float sw=smoothstep(1.5,8.,position.y);
  transformed.x+=sin(uT*1.6+ph+position.y*.5+position.z*.8)*.16*sw;
  transformed.z+=cos(uT*1.3+ph+position.x*.7)*.11*sw;`)};
const TENTM=VM.clone();TENTM.side=THREE.DoubleSide;
const MEATM=m=>new THREE.MeshStandardMaterial({map:m,roughness:.35,emissive:0x1a0a05});

// --- Утилиты геометрии
function paint(g,hex,jit=.08,fn){const c=new THREE.Color(hex),p=g.attributes.position,a=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+perlin(x*7,y*7,z*7)*jit*1.6+(fn?fn(x,y,z):0);a.set([c.r*k,c.g*k,c.b*k],i*3)}
  g.setAttribute('color',new THREE.BufferAttribute(a,3));return g}
export function merge(list){const gs=list.map(g=>g.index?g.toNonIndexed():g);let n=0;gs.forEach(g=>n+=g.attributes.position.count);
  const P=new Float32Array(n*3),Nm=new Float32Array(n*3),C=new Float32Array(n*3).fill(1),U=new Float32Array(n*2);let o=0;
  for(const g of gs){P.set(g.attributes.position.array,o*3);Nm.set(g.attributes.normal.array,o*3);if(g.attributes.color)C.set(g.attributes.color.array,o*3);if(g.attributes.uv)U.set(g.attributes.uv.array,o*2);o+=g.attributes.position.count}
  const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(P,3));m.setAttribute('normal',new THREE.BufferAttribute(Nm,3));m.setAttribute('color',new THREE.BufferAttribute(C,3));m.setAttribute('uv',new THREE.BufferAttribute(U,2));return m}
// труба по кривой: сужение + рельефные борозды коры (bk) через шум Перлина
function tube(pts,seg,rad,r0,r1,color,sym,bk=0){const cv=new THREE.CatmullRomCurve3(pts),g=new THREE.TubeGeometry(cv,seg,1,rad,false),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const t=Math.floor(i/(rad+1))/seg,c=cv.getPointAt(t),r=(sym?r0+(r1-r0)*Math.abs(2*t-1):r0+(r1-r0)*t)*(1+(bk?perlin(p.getX(i)*4+1,p.getY(i)*1.2,p.getZ(i)*4)*bk:0));
    p.setXYZ(i,c.x+(p.getX(i)-c.x)*r,c.y+(p.getY(i)-c.y)*r,c.z+(p.getZ(i)-c.z)*r)}
  g.computeVertexNormals();return paint(g,color,.12)}
// органический эллипсоид: вращение профиля (Lathe) + деформация шумом Перлина
function blob(cx,cy,cz,rx,ry,rz,color,seg=8,amp=.22){const rings=Math.max(4,seg*.7|0),pts=[];
  for(let i=0;i<=rings;i++){const a=-Math.PI/2+Math.PI*i/rings;pts.push(new THREE.Vector2(Math.max(.001,Math.cos(a)),Math.sin(a)))}
  const g=new THREE.LatheGeometry(pts,seg),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),d=1+perlin(x*1.6+cx*.7+3,y*1.6+cy*.7,z*1.6+cz*.7)*amp;p.setXYZ(i,cx+x*rx*d,cy+y*ry*d,cz+z*rz*d)}
  g.computeVertexNormals();return paint(g,color,.1,(x,y)=>(y-cy)/ry*.14)}
const skirt=(cx,y,cz,r,h,color)=>{const g=new THREE.LatheGeometry(LV([[.001,h*.5],[r*.55,h*.2],[r,-h*.3],[r*.85,-h*.5],[r*.4,-h*.3],[.001,-h*.2]]),11),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),yy=p.getY(i),z=p.getZ(i),d=1+perlin(x*2.2+cx,yy*2+y,z*2.2+cz)*.28;p.setXYZ(i,cx+x*d,y+yy,cz+z*d)}g.computeVertexNormals();return paint(g,color,.1,(x,yy)=>(yy-y)/h*.2)};

// --- Деревья: изогнутый ствол с корой-рельефом, корни, сучья, пучки листвы (0 — лиственное, 1 — хвойное)
export function treeGeo(kind){const P=[],bx=(rnd()-.5)*.9,bz=(rnd()-.5)*.9,H=kind?7.2:6.2,at=y=>[bx*y/H,y,bz*y/H];
  P.push(tube([V(0,0,0),V(bx*.4,H*.3,bz*.4),V(bx*.9,H*.62,bz*.9),V(bx,H,bz)],12,8,.44,.1,0x4a3424,false,.28));
  for(let i=0;i<4;i++){const a=i*1.57+rnd(),c=Math.cos(a),s=Math.sin(a);P.push(tube([V(c*.15,.6,s*.15),V(c*.5,.2,s*.5),V(c*1.05,-.05,s*1.05)],4,6,.15,.04,0x3b2a1d,false,.3))}
  if(!kind){for(let i=0;i<4;i++){const a=i*1.9+rnd(),y=H*(.45+i*.12),b=at(y),e=V(b[0]+Math.cos(a)*1.8,y+1.1,b[2]+Math.sin(a)*1.8);
      P.push(tube([V(...b),V((b[0]+e.x)/2,y+.45,(b[2]+e.z)/2),e],5,6,.11,.03,0x4a3424,false,.2));
      for(let k=0;k<2;k++)P.push(blob(e.x+(rnd()-.5)*.9,e.y+.3+rnd()*.7,e.z+(rnd()-.5)*.9,.75+rnd()*.4,.55+rnd()*.3,.75+rnd()*.4,[0x3d6b2e,0x4a7a34,0x35602a][k+i&1?1:0],7,.3))}
    for(let k=0;k<5;k++){const a=k*1.25;P.push(blob(bx+Math.cos(a)*.8,H-.2+(k%2)*.9,bz+Math.sin(a)*.8,1.05,.7,1.05,[0x4a7a34,0x3d6b2e,0x5a8a3a][k%3],7,.3))}}
  else{for(let i=0;i<5;i++){const y=H*.34+i*H*.16,b=at(y);P.push(skirt(b[0],y,b[2],2.3-i*.42,.9,i%2?0x1f4a30:0x2a5c3a))}P.push(skirt(bx,H+.9,bz,.4,1.4,0x2a5a38))}
  return merge(P)}
// --- Камень: осколочные грани (ridged-шум, плоские нормали) и трещины (тёмные линии по нулям шума)
export function rockGeo(){const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position,col=new Float32Array(p.count*3),c=new THREE.Color(0x7d7b76);
  for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const l=Math.hypot(x,y,z);x/=l;y/=l;z/=l;
    const r=.9+(1-Math.abs(perlin(x*1.8+5,y*1.8,z*1.8)))*.3+perlin(x*4,y*4,z*4)*.07,cr=Math.abs(perlin(x*3.2,y*3.2+9,z*3.2)),k=(cr<.07?.4:1)*(.9+perlin(x*9,y*9,z*9)*.15);
    p.setXYZ(i,x*r,(y<0?y*.4:y)*r*.85,z*r);col.set([c.r*k,c.g*k,c.b*k],i*3)}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();return g}
let _rg;const ROCKG=()=>_rg||(_rg=rockGeo());
// --- Хижина (профили вращения), бочка, палатка
export function hut(wm,rm){wm.side=rm.side=THREE.DoubleSide;const g=new THREE.Group(),L=(a,m)=>new THREE.Mesh(new THREE.LatheGeometry(LV(a),16),m);
  const w=L([[2.3,0],[2.45,1],[2.35,2.4],[2.5,2.7]],wm),r=L([[2.9,2.5],[2.4,3.3],[1.4,4.1],[.5,4.6],[0,4.7]],rm);w.castShadow=r.castShadow=true;g.add(w,r);return g}
export const barrelGeo=()=>new THREE.LatheGeometry(LV([[.001,-.35],[.3,-.35],[.37,-.1],[.37,.1],[.3,.35],[.001,.35]]),12);
export function tent(){const g=new THREE.LatheGeometry(LV([[2.4,0],[2,1.1],[1.1,1.9],[.2,2.5],[.001,2.55]]),9),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),d=1+perlin(x*1.3,y*1.3,z*1.3)*.12;p.setXYZ(i,x*d,y,z*d)}g.computeVertexNormals();paint(g,0x8a6a45,.2);
  const m=new THREE.Mesh(g,TENTM);m.castShadow=true;return m}
// --- Укрытия: доски (экструзия со скруглением и фасками), каменная кладка из шумовых валунов, верстак
const rr=(w,h,r)=>{const s=new THREE.Shape(),x=w/2,y=h/2;s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);s.lineTo(-x+r,y);s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);return s};
const plank=(w,h,d,x,y,z,color,rx=0,rz=0)=>{const g=new THREE.ExtrudeGeometry(rr(w,h,.02),{depth:d,bevelEnabled:true,bevelThickness:.01,bevelSize:.01,bevelSegments:2,curveSegments:3});
  g.translate(0,0,-d/2);g.rotateX(rx);g.rotateZ(rz);g.translate(x,y,z);return paint(g,color,.3)};
export function piece(t){const P=[],woods=[0x8a6a44,0x7a5a38,0x96744a,0x6e5233];
  if(t=='wall'){for(let i=-3;i<=3;i++){const h=2.3+rnd()*.25;P.push(plank(.27,h,.08,i*.29,h/2,rnd()*.03,woods[i+3&3],0,(rnd()-.5)*.03))}P.push(plank(2,.14,.06,0,.5,.07,0x4f3b26),plank(2,.14,.06,0,1.8,.07,0x4f3b26))}
  else if(t=='swall'){const gr=[0x6f6d68,0x7d7b76,0x625f5a,0x858279];for(let r=0;r<5;r++)for(let i=0;i<5;i++){const x=-.8+i*.4+(r%2?.2:0);if(x>.95)continue;P.push(blob(x,.2+r*.4,0,.23+rnd()*.04,.21,.17+rnd()*.04,gr[rnd()*4|0],6,.18))}}
  else if(t=='floor'){for(let i=-3;i<=2;i++)P.push(plank(.32,1.98,.1,i*.33+.16,.06,0,woods[i+3&3],Math.PI/2))}
  else{for(let j=-1;j<=1;j++)P.push(plank(1.4,.24,.07,0,.92,j*.25,woods[j+1],Math.PI/2));P.push(blob(.55,1.05,.1,.1,.1,.1,0x555555,6,.1));
    for(let i=0;i<4;i++){const a=i*1.57+.78;P.push(tube([V(Math.cos(a)*.5,.9,Math.sin(a)*.5),V(Math.cos(a)*.55,.4,Math.sin(a)*.55),V(Math.cos(a)*.6,0,Math.sin(a)*.6)],4,6,.07,.06,0x5a3d26,false,.15))}}
  const m=new THREE.Mesh(merge(P),VM);m.castShadow=m.receiveShadow=true;return m}
// --- Волк
export function wolf(){const c=0x6b6b70,d=0x4d4d52,P=[blob(0,.8,.1,.28,.32,.62,c,9),blob(0,.86,-.38,.3,.36,.34,d,9),blob(0,.95,-.85,.2,.2,.24,c,8),blob(0,.86,-1.12,.09,.09,.2,d,6),
  skirt(-.1,1.18,-.8,.06,.2,d),skirt(.1,1.18,-.8,.06,.2,d),tube([V(0,.9,.65),V(0,.85,.95),V(0,.55,1.2)],5,5,.07,.03,d,false,.2)];
  for(const sx of[-.16,.16])for(const sz of[-.45,.5])P.push(tube([V(sx,.7,sz),V(sx,.35,sz+.03),V(sx,0,sz)],4,6,.09,.045,c,false,.1));
  const m=new THREE.Mesh(merge(P),VM);m.castShadow=true;const g=new THREE.Group();g.add(m);return g}
// --- Гуманоид (торговец): торс, плащ, шарф, голова с носом/глазами/бородой/шапкой, руки с локтями и кистями, ноги, сапоги
export function human(){const g=new THREE.Group(),coat=0x2d4a6b,pants=0x3a3326,skin=0xc68f6b,B=(parts)=>{const m=new THREE.Mesh(merge(parts),VM);m.castShadow=true;return m};
  const body=B([blob(0,1.2,0,.25,.33,.15,coat,10,.07),blob(0,.9,0,.23,.2,.15,pants,9,.05),
    paint(new THREE.LatheGeometry(LV([[.001,.95],[.26,.9],[.3,.5],[.28,.35]]),12).scale(1,1,.7),coat,.12),
    tube([V(0,1.45,0),V(0,1.55,0)],3,8,.07,.06,skin),blob(0,1.43,0,.28,.07,.17,0x6a2a2a,8,.05),
    ...[-.11,.11].flatMap(x=>[tube([V(x,.85,0),V(x,.45,.02),V(x,.08,0)],5,8,.1,.065,pants,false,.05),blob(x,.05,-.05,.075,.05,.13,0x241a12,7,.05)])]);
  const head=new THREE.Group();head.position.y=1.65;head.add(B([blob(0,0,0,.115,.14,.12,skin,10,.05),blob(0,-.01,-.12,.02,.035,.03,skin,5,0),blob(-.04,.02,-.1,.016,.011,.01,0x15110e,5,0),blob(.04,.02,-.1,.016,.011,.01,0x15110e,5,0),
    blob(0,-.09,-.07,.085,.06,.05,0x3a3028,7,.1),blob(0,.09,.01,.13,.1,.13,0x6a2a2a,9,.06)]));
  const arm=s=>{const a=new THREE.Group();a.position.set(s*.3,1.42,0);a.add(B([tube([V(0,0,0),V(0,-.27,-.02),V(0,-.5,-.1)],5,8,.065,.05,coat,false,.06),blob(0,-.56,-.12,.05,.065,.05,skin,7,.05)]));return a},aL=arm(-1),aR=arm(1);
  g.add(body,head,aL,aR);let hy=0;
  g.userData.anim=(dt,t,px,pz)=>{const rel=Math.atan2(-(px-g.position.x),-(pz-g.position.z))-g.rotation.y,w=((rel+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
    hy+=(Math.max(-1,Math.min(1,w))-hy)*Math.min(1,dt*3);head.rotation.y=hy;head.rotation.x=Math.sin(t*.7)*.03;body.scale.y=1+Math.sin(t*1.8)*.006;aL.rotation.x=Math.sin(t*1.4)*.05;aR.rotation.x=Math.sin(t*1.4+1)*.05};
  return g}

// --- Огонь: пламя, искры и дым из спрайтов с градиентом, уголья с пульсацией, мерцающий PointLight
const sprTex=(f)=>cvs(64,64,f);
const flameTex=sprTex(c=>{c.save();c.scale(.62,1);const g=c.createRadialGradient(52,32,2,52,32,30);g.addColorStop(0,'rgba(255,245,200,1)');g.addColorStop(.35,'rgba(255,160,50,.85)');g.addColorStop(1,'rgba(255,60,0,0)');c.fillStyle=g;c.fillRect(0,0,110,64);c.restore()});
const sparkTex=sprTex(c=>{const g=c.createRadialGradient(32,32,0,32,32,16);g.addColorStop(0,'rgba(255,235,170,1)');g.addColorStop(1,'rgba(255,120,20,0)');c.fillStyle=g;c.fillRect(0,0,64,64)});
const smokeTex=sprTex(c=>{const g=c.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,'rgba(120,120,125,.55)');g.addColorStop(1,'rgba(90,90,95,0)');c.fillStyle=g;c.fillRect(0,0,64,64)});
const spr=(map,add)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map,blending:add?THREE.AdditiveBlending:THREE.NormalBlending,depthWrite:false,transparent:true,fog:!add}));return s};
function flames(n,{w=.5,h=1.1,sc=.9,smoke=false}={}){const g=new THREE.Group(),F=[],S=[],K=[];
  for(let i=0;i<n;i++){const s=spr(flameTex,1);s.userData={t:i/n,sp:.8+rnd()*.6,ph:rnd()*9};g.add(s);F.push(s)}
  for(let i=0;i<Math.ceil(n/2);i++){const s=spr(sparkTex,1);s.userData={t:rnd(),vx:(rnd()-.5)*.8,vz:(rnd()-.5)*.8,sp:.4+rnd()*.5};g.add(s);S.push(s)}
  if(smoke)for(let i=0;i<6;i++){const s=spr(smokeTex,0);s.userData={t:i/6,ph:rnd()*9};g.add(s);K.push(s)}
  g.userData.upd=(dt,t)=>{for(const s of F){const u=s.userData,k=u.t=(u.t+dt*u.sp)%1;s.position.set(Math.sin(t*5+u.ph)*w*.5*(1-k),.05+k*h*.9,Math.cos(t*4+u.ph)*w*.4*(1-k));s.scale.set(sc*(.5*(1-k*.8)+.08),sc*(.8*(1-k*.6)+.1),1);s.material.opacity=Math.min(1,k*8)*(1-k*k);s.material.color.setHSL(.12-.09*k,1,.55+.15*(1-k))}
    for(const s of S){const u=s.userData,k=u.t=(u.t+dt*u.sp)%1;s.position.set(u.vx*k*1.6+Math.sin(t*3+k*9)*.05,.2+k*h*1.8,u.vz*k*1.6);s.scale.setScalar(.06*sc*(1-k));s.material.opacity=1-k}
    for(const s of K){const u=s.userData,k=u.t=(u.t+dt*.3)%1;s.position.set(.5*k+Math.sin(t+u.ph)*.2,h*.9+k*h*2.4,Math.cos(t*.8+u.ph)*.2);s.scale.setScalar(sc*(.5+k*1.7));s.material.opacity=.22*Math.sin(k*Math.PI)}};
  return g}
const COAL=new THREE.MeshStandardMaterial({color:0x2a1008,emissive:0xff4a10,emissiveIntensity:1,roughness:1});
export function campfire(light){const g=new THREE.Group(),L=[];
  for(let i=0;i<5;i++){const a=i*1.26+.3,c=Math.cos(a),s=Math.sin(a);L.push(tube([V(c*.75,.08,s*.75),V(c*.4,.22,s*.4),V(c*.08,.38,s*.08)],5,7,.1,.07,0x2e2218,false,.3))}
  const lm=new THREE.Mesh(merge(L),VM);lm.castShadow=true;g.add(lm);g.add(new THREE.Mesh(blob(0,.07,0,.55,.1,.55,0xffffff,8,.35),COAL));
  for(let i=0;i<8;i++){const a=i*.785,m=new THREE.Mesh(ROCKG(),VM);m.position.set(Math.cos(a)*.85,.08,Math.sin(a)*.85);m.scale.set(.2+rnd()*.1,.15,.2+rnd()*.1);m.rotation.y=rnd()*6;g.add(m)}
  const fx=flames(14,{smoke:true});g.add(fx);let pl;if(light){pl=new THREE.PointLight(0xff8a3c,2.4,15,2);pl.position.y=.9;g.add(pl)}
  g.userData.fx=(dt,t)=>{fx.userData.upd(dt,t);COAL.emissiveIntensity=.9+.35*Math.sin(t*3)+.2*Math.sin(t*7.3);if(pl)pl.intensity=2.3+Math.sin(t*23)*.3+Math.sin(t*37.1)*.25+(Math.random()-.5)*.3};
  return g}

// --- Анатомическая рука: сморщенный рукав, запястье, ладонь (экструзия с фасками), 4 пальца × 3 фаланги с суставами и ногтями, большой палец
const SKINM=new THREE.MeshStandardMaterial({vertexColors:true,map:cvs(128,128,(c,w,h)=>{c.fillStyle='#c68f6b';c.fillRect(0,0,w,h);for(let i=0;i<500;i++){c.fillStyle=`rgba(${rnd()<.5?'120,70,50':'230,170,140'},${.05+rnd()*.12})`;c.fillRect(rnd()*w,rnd()*h,1+rnd()*2,1+rnd()*2)}
  for(let i=0;i<6;i++){c.strokeStyle='rgba(90,110,150,.12)';c.lineWidth=2;c.beginPath();c.moveTo(rnd()*w,0);c.bezierCurveTo(rnd()*w,h*.3,rnd()*w,h*.6,rnd()*w,h);c.stroke()}}),roughness:.55,emissive:0x2a1208});
const W=0xffffff,fseg=(L,r,nail)=>new THREE.Mesh(merge([tube([V(0,0,0),V(0,0,-L)],3,8,r,r*.88,W,false,.05),blob(0,0,-L,r*.92,r*.9,r*.9,W,6,.04),...(nail?[blob(0,r*.78,-L*.8,r*.6,r*.18,L*.4,0xffd8c8,5,0)]:[])]),SKINM);
export function hand(right){const g=new THREE.Group(),s=right?1:-1,fing=[];
  const sl=new THREE.LatheGeometry(LV([[.056,0],[.066,.015],[.058,.04],[.054,.08],[.058,.3],[.066,.62]]),16).rotateX(Math.PI/2),sp=sl.attributes.position;
  for(let i=0;i<sp.count;i++){const x=sp.getX(i),y=sp.getY(i),z=sp.getZ(i),d=1+perlin(x*40,y*40,z*8)*.05;sp.setXYZ(i,x*d,y*d,z)}sl.computeVertexNormals();g.add(new THREE.Mesh(paint(sl,0x3a4636,.15),VM));
  g.add(new THREE.Mesh(merge([tube([V(0,0,.03),V(0,0,-.01)],3,10,.036,.04,W)]),SKINM));
  const ps=new THREE.Shape();ps.moveTo(-.035,0);ps.lineTo(.035,0);ps.bezierCurveTo(.05,.03,.047,.07,.045,.095);ps.lineTo(-.045,.095);ps.bezierCurveTo(-.047,.07,-.05,.03,-.035,0);
  const pg=new THREE.ExtrudeGeometry(ps,{depth:.02,bevelEnabled:true,bevelThickness:.008,bevelSize:.01,bevelSegments:3,curveSegments:8});pg.translate(0,0,-.01).rotateX(-Math.PI/2);
  g.add(new THREE.Mesh(paint(pg,W,.04),SKINM));g.add(new THREE.Mesh(merge([blob(-s*.034,-.004,-.045,.02,.016,.03,W,7,.05),...[-.034,-.012,.011,.032].map(x=>blob(x,.02,-.098,.011,.008,.01,W,6,.05))]),SKINM));
  const mk=(x,z,lens,r,ry=0)=>{const root=new THREE.Group(),segs=[];root.position.set(x,0,z);root.rotation.y=ry;let par=root;
    lens.forEach((L,i)=>{const sg=new THREE.Group();if(i)sg.position.z=-lens[i-1];sg.add(fseg(L,r*(1-i*.1),i==lens.length-1));par.add(sg);par=sg;segs.push(sg)});g.add(root);return segs};
  [[-.034,[.034,.026,.02]],[-.012,[.038,.028,.021]],[.011,[.035,.026,.02]],[.032,[.028,.02,.018]]].forEach(([x,l])=>fing.push(mk(x,-.1,l,.0085)));
  return{g,fing,thumb:mk(-s*.04,-.05,[.03,.024],.0105,s*.9)}}
export const curl=(h,a)=>{h.fing.forEach(f=>f.forEach((sg,i)=>sg.rotation.x=-a*[1.15,1.35,.9][i]));h.thumb.forEach((sg,i)=>sg.rotation.x=-a*.4*(i+1))};

// --- Предметы в руке: топор (кожаная обмотка, фаски лезвия), кирка, факел, мясо с прожилками жира, банка, бутылка
const WOOD=new THREE.MeshStandardMaterial({map:cvs(64,128,(c,w,h)=>{c.fillStyle='#7a5232';c.fillRect(0,0,w,h);for(let i=0;i<70;i++){c.strokeStyle=`rgba(${rnd()<.5?'40,24,10':'170,120,70'},${.15+rnd()*.25})`;c.lineWidth=1+rnd()*2;const y=rnd()*h;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(w*.3,y+rnd()*6-3,w*.6,y+rnd()*6-3,w,y);c.stroke()}}),roughness:.75,emissive:0x1c1008});
const scr=cvs(128,128,(c,w,h)=>{c.fillStyle='#9ea3a8';c.fillRect(0,0,w,h);for(let i=0;i<60;i++){c.strokeStyle=`rgba(${rnd()<.5?'255,255,255':'30,30,34'},${.15+rnd()*.3})`;c.lineWidth=.6;c.beginPath();const x=rnd()*w,y=rnd()*h;c.moveTo(x,y);c.lineTo(x+rnd()*40-20,y+rnd()*40-20);c.stroke()}});
const METAL=new THREE.MeshStandardMaterial({map:scr,metalness:.5,roughness:.42,emissive:0x101214}),METAL2=new THREE.MeshStandardMaterial({map:scr,color:0x8497a6,metalness:.5,roughness:.4,emissive:0x0c1014}),LEATHER=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,emissive:0x140a05});
const meatTex=(base,cooked)=>cvs(128,128,(c,w,h)=>{c.fillStyle=base;c.fillRect(0,0,w,h);for(let i=0;i<34;i++){c.strokeStyle=`rgba(255,${cooked?210:225},${cooked?170:220},${.25+rnd()*.35})`;c.lineWidth=1+rnd()*3;const y=rnd()*h;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(w*.3,y+rnd()*24-12,w*.6,y+rnd()*24-12,w,y);c.stroke()}
  if(cooked)for(let i=-2;i<8;i++){c.strokeStyle='rgba(30,12,4,.55)';c.lineWidth=5;c.beginPath();c.moveTo(i*22,0);c.lineTo(i*22+h,h);c.stroke()}for(let i=0;i<300;i++){c.fillStyle='rgba(0,0,0,.08)';c.fillRect(rnd()*w,rnd()*h,2,2)}});
export function tool(k){const g=new THREE.Group(),A=(geo,m)=>{const x=new THREE.Mesh(geo,m);g.add(x);return x},
  handle=(len,cv)=>tube([V(0,-.14,0),V(cv,.1,.01),V(-cv,.3,0),V(0,len,.01)],12,8,.02,.016,0x7a5232),
  wrap=()=>A(tube([V(0,-.14,0),V(0,.06,0)],8,8,.027,.027,0x4a2c1a,false,.4),LEATHER);
  if(k=='axe'||k=='axe2'){A(handle(.52,.012),WOOD);wrap();A(blob(0,-.15,0,.03,.02,.03,0x3a2314,6,.1),LEATHER);
    const sh=new THREE.Shape();sh.moveTo(.04,-.04);sh.lineTo(.045,.05);sh.lineTo(-.01,.055);sh.quadraticCurveTo(-.1,.12,-.17,.11);sh.quadraticCurveTo(-.15,0,-.17,-.12);sh.quadraticCurveTo(-.1,-.07,-.01,-.055);sh.lineTo(.04,-.04);
    const hg=new THREE.ExtrudeGeometry(sh,{depth:.03,bevelEnabled:true,bevelThickness:.007,bevelSize:.007,bevelSegments:3,curveSegments:14});hg.translate(0,0,-.015).rotateY(-Math.PI/2);
    A(hg,k=='axe'?METAL:METAL2).position.y=.44;A(new THREE.LatheGeometry(LV([[.02,.41],[.032,.42],[.032,.47],[.02,.48]]),12),METAL)}
  else if(k=='pickaxe'){A(handle(.5,.006),WOOD);wrap();A(tube([V(0,-.07,-.27),V(0,0,-.15),V(0,.04,0),V(0,0,.15),V(0,-.07,.27)],16,8,.03,.004,0x999999,true,.05),METAL).position.y=.48;A(new THREE.LatheGeometry(LV([[.02,.44],[.035,.46],[.035,.5],[.02,.52]]),12),METAL)}
  else if(k=='torch'){A(tube([V(0,-.14,0),V(0,.1,0),V(0,.28,0)],6,8,.022,.03,0x7a5232,false,.15),WOOD);
    A(new THREE.LatheGeometry(LV([[.01,.26],[.035,.3],[.04,.36],[.03,.42],[.01,.44]]),10),new THREE.MeshStandardMaterial({color:0x2a2118,emissive:0x802a10,roughness:1}));
    const f=flames(8,{w:.1,h:.2,sc:.16});f.position.y=.45;g.add(f);g.userData.fl=dt=>f.userData.upd(dt,performance.now()/1000)}
  else if(k=='meat'||k=='steak'||k=='rotten'){const base={meat:'#b0394a',steak:'#6a3516',rotten:'#5d6b2e'}[k],t=meatTex(base,k=='steak');t.repeat.set(9,9);
    const sh=new THREE.Shape();sh.moveTo(-.02,-.09);sh.bezierCurveTo(.07,-.1,.11,-.02,.09,.05);sh.bezierCurveTo(.07,.11,-.02,.12,-.07,.08);sh.bezierCurveTo(-.11,.04,-.09,-.07,-.02,-.09);
    const sg=new THREE.ExtrudeGeometry(sh,{depth:.035,bevelEnabled:true,bevelThickness:.014,bevelSize:.014,bevelSegments:4,curveSegments:14});sg.translate(0,0,-.017).rotateX(-Math.PI/2);A(sg,MEATM(t));
    A(merge([tube([V(-.07,.0,.05),V(-.1,.01,.13),V(-.12,.01,.2)],5,6,.013,.01,0xeee6d4),blob(-.12,.01,.21,.022,.02,.022,0xeee6d4,6,.1)]),VM)}
  else if(k=='food'){A(new THREE.LatheGeometry(LV([[.001,0],[.04,0],[.042,.005],[.04,.01],[.04,.08],[.042,.085],[.04,.09],[.001,.09]]),16),METAL);A(new THREE.LatheGeometry(LV([[.0408,.015],[.0408,.075]]),16),new THREE.MeshStandardMaterial({color:0xb5502a,roughness:.7,side:THREE.DoubleSide}))}
  else if(k=='water')A(new THREE.LatheGeometry(LV([[.001,0],[.04,0],[.045,.12],[.02,.17],[.018,.21],[.001,.21]]),12),new THREE.MeshStandardMaterial({color:0x6bb7e8,transparent:true,opacity:.7,roughness:.2}));
  else A(blob(0,.05,0,.07,.06,.07,0x8a6a44,8,.15),VM);
  return g}
export const noiseTex=rep=>{const t=cvs(128,128,(c,w,h)=>{const d=c.createImageData(w,h);for(let i=0;i<w*h;i++){const v=185+rnd()*70;d.data.set([v,v,v,255],i*4)}c.putImageData(d,0,0)});t.repeat.set(rep,rep);return t};
