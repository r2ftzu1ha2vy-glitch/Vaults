'use strict';

// ── CONFIG ──
const SETTINGS={quality:'medium',sound:true,jumpscares:true,sensMult:1.0,mobileForce:null,username:'Player'+Math.floor(Math.random()*9000+1000)};
const QUALITY={low:{px:.6,fog:.14,shadows:false,rooms:3},medium:{px:1.0,fog:.09,shadows:false,rooms:5},high:{px:1.5,fog:.07,shadows:true,rooms:7}};
const CFG={VAULTS_TOTAL:100,ROOM_W:8,ROOM_H:4,ROOM_D:14,PLAYER_SPEED:4.5,PLAYER_SPRINT:8.5,PLAYER_CROUCH_SPEED:2.5,PLAYER_HEIGHT:1.65,PLAYER_CROUCH_HEIGHT:0.95,PLAYER_RADIUS:0.32,SPRINT_MAX:100,SPRINT_DRAIN:22,SPRINT_REGEN:9,FOV:75,MOUSE_SENS_BASE:.0022,WARDEN_SPEED_BASE:3.4,WARDEN_SIGHT:20,HP_DRAIN_RATE:30};

// ── SKIN SYSTEM ──
const SKINS={
  bodyColor:'#2a4a6a',
  jacketColor:'#1a3a5a',
  hatType:'none',
  hatColor:'#8b0000'
};

const HATS={
  none:{label:'None'},
  cap:{label:'Baseball Cap'},
  tophat:{label:'Top Hat'},
  crown:{label:'Crown'},
  beanie:{label:'Beanie'},
  cowboy:{label:'Cowboy Hat'}
};

// ── FIREBASE CONFIG ──
const firebaseConfig={apiKey:"AIzaSyD29EJMXjXwlg7avUxA-g_ORGEd8O2qDgo",authDomain:"vaults-b986e.firebaseapp.com",projectId:"vaults-b986e",storageBucket:"vaults-b986e.firebasestorage.app",messagingSenderId:"210909006868",appId:"1:210909006868:web:51f107e01968a5f9edab01",measurementId:"G-E117TTJK9R",databaseURL:"https://vaults-b986e-default-rtdb.firebaseio.com/"};

// ── MULTIPLAYER STATE ──
let mp={active:false,roomCode:null,playerId:null,isHost:false,db:null,players:{},chatMessages:[],chatRef:null,roomRef:null,playerRef:null,stateRef:null,updateTimer:0};

// ── AUDIO ──
const BASE='https://raw.githubusercontent.com/r2ftzu1ha2vy-glitch/Vaults/main/';
const SOUND_FILES={doorOpen:BASE+'dragon-studio-opening-door-450444.mp3',doorLocked:BASE+'dragon-studio-heavy-door-unlocking-515258.mp3',pickup:BASE+'freesound_community-key-get-39925.mp3',heal:BASE+'yodguard-healing-magic-2-378663.mp3',footstep:BASE+'freesound_community-footstep-1-83098.mp3',heartbeat:BASE+'universfield-heartbeat-single-383748.mp3',wardenRoar:BASE+'freesound_community-scary-monster-roar-2-6256.mp3',jumpscare:BASE+'freesounds123-jumpscare-335598.mp3',drawerOpen:BASE+'freesound_community-drawer-open-mid-84663.mp3',creak:BASE+'dragon-studio-floorboard-creak-01-499645.mp3',surgeRoar:BASE+'alex_jauk-monstrous-scream-187949.mp3',echoRoar:BASE+'freesound_community-demonic-woman-scream-6333.mp3',gazeMusic:BASE+'universfield-tense-music-box-for-horror-scenes-15s-158862.mp3',twistSound:BASE+'freesound_community-teleport-90324.mp3'};
const _audioCache={};
function playSound(key,vol=1.0,loop=false){if(!SETTINGS.sound)return null;try{const a=loop?(_audioCache[key]||(_audioCache[key]=new Audio(SOUND_FILES[key]))):new Audio(SOUND_FILES[key]);a.volume=Math.min(1,vol);a.loop=loop;a.play().catch(()=>{});return a;}catch(e){return null;}}
function stopSound(a){if(a){try{a.pause();a.currentTime=0;}catch(e){}}}
const SFX={doorOpen(){playSound('doorOpen',.7);},doorLocked(){playSound('doorLocked',.7);},pickup(){playSound('pickup',.8);},heal(){playSound('heal',.8);},footstep(){playSound('footstep',.35);},heartbeat(){playSound('heartbeat',.9);},wardenRoar(){playSound('wardenRoar',1.0);},jumpscare(){playSound('jumpscare',1.0);},drawerOpen(){playSound('drawerOpen',.6);},creak(){playSound('creak',.6);},surgeRoar(){playSound('surgeRoar',1.0);},echoRoar(){playSound('echoRoar',1.0);},twistSound(){playSound('twistSound',.8);},gazeStart(){return playSound('gazeMusic',.0,true);}};

// ── GAME STATE ──
let state={phase:'menu',vault:0,hp:100,flashOn:true,sprint:100,crouching:false,inCloset:false,wardenActive:false,wardenAlerted:false,keys:{},yaw:0,pitch:0,pointerLocked:false,roomsBuilt:[],items:[],hasKey:false,loopStarted:false,isMobile:false,joystick:{dx:0,dy:0},mobileSprint:false,crouchY:CFG.PLAYER_HEIGHT,chatOpen:false};
let collisionBoxes=[];
let renderer,scene,camera,clock,flashlight,ambientLight,playerObj,threeInited=false;
let monsters={warden:null,surge:null,echo:null,gaze:null,twist:null};
let gazeAudio=null;
let remotePlayerMeshes={};

const $=id=>document.getElementById(id);
const canvas=$('gameCanvas'),menuEl=$('menu'),hudEl=$('hud'),deathEl=$('death-screen'),winEl=$('win-screen'),plOverlay=$('pointer-lock-overlay'),interactHint=$('interact-hint'),vaultNum=$('vault-num'),healthBar=$('health-bar'),healthTxt=$('health-txt'),sprintBar=$('sprint-bar'),flStatus=$('fl-status'),wardenAlert=$('warden-alert'),keyIcon=$('key-icon'),crouchIcon=$('crouch-icon'),mobileControls=$('mobile-controls');
const qualBadge=document.createElement('div');qualBadge.id='quality-badge';document.body.appendChild(qualBadge);

// ── INIT THREE ──
function initThree(){
  if(threeInited)return;threeInited=true;
  const q=QUALITY[SETTINGS.quality];
  renderer=new THREE.WebGLRenderer({canvas,antialias:SETTINGS.quality==='high',powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,q.px));
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.shadowMap.enabled=q.shadows;
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x080002,q.fog);scene.background=new THREE.Color(0x030000);
  clock=new THREE.Clock();
  camera=new THREE.PerspectiveCamera(CFG.FOV,window.innerWidth/window.innerHeight,.1,60);
  playerObj=new THREE.Object3D();playerObj.position.set(0,0,2);scene.add(playerObj);
  ambientLight=new THREE.AmbientLight(0x120406,.55);scene.add(ambientLight);
  flashlight=new THREE.SpotLight(0xffe0b0,4.5,28,Math.PI/5,.55,1.2);
  flashlight.castShadow=false;
  scene.add(flashlight);scene.add(flashlight.target);
  window.addEventListener('resize',()=>{if(!camera)return;camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});
  buildAllMonsters();
}
function applyQuality(){
  if(!renderer)return;
  const q=QUALITY[SETTINGS.quality];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,q.px));
  scene.fog.density=q.fog;
  renderer.shadowMap.enabled=q.shadows;
  const ambMap={low:.75,medium:.55,high:.35};
  ambientLight.intensity=ambMap[SETTINGS.quality];
  qualBadge.textContent='GFX: '+SETTINGS.quality.toUpperCase();
}

// ── MATERIALS ──
function mkTex(w,h,c1,c2){const cv=document.createElement('canvas');cv.width=w;cv.height=h;const cx=cv.getContext('2d');cx.fillStyle=c1;cx.fillRect(0,0,w,h);for(let i=0;i<w*h*.1;i++){cx.fillStyle=c2;cx.globalAlpha=Math.random()*.5;cx.fillRect(Math.random()*w,Math.random()*h,Math.random()*5+1,Math.random()*5+1);}cx.globalAlpha=1;const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);return t;}
const MAT=(()=>{const ts=128;return{
  wall:new THREE.MeshLambertMaterial({map:mkTex(ts,ts,'#1c0f0f','#2e1818')}),
  floor:new THREE.MeshLambertMaterial({map:mkTex(ts,ts,'#100c0c','#1c1212')}),
  ceil:new THREE.MeshLambertMaterial({map:mkTex(64,64,'#0a0606','#130909')}),
  door:new THREE.MeshLambertMaterial({map:mkTex(64,128,'#3e1b06','#5d2b09')}),
  doorFrame:new THREE.MeshLambertMaterial({color:0x1c0900}),
  gold:new THREE.MeshLambertMaterial({color:0xd4a017,emissive:0x3a2000}),
  closet:new THREE.MeshLambertMaterial({map:mkTex(64,128,'#1a1208','#251a0a')}),
  closetDoor:new THREE.MeshLambertMaterial({map:mkTex(64,128,'#241608','#35200c')}),
  closetFrm:new THREE.MeshLambertMaterial({color:0x0e0900}),
  drawer:new THREE.MeshLambertMaterial({map:mkTex(64,64,'#2a1a0a','#3a2510')}),
  drawerFace:new THREE.MeshLambertMaterial({map:mkTex(32,32,'#341e0c','#4a2c12')}),
  wardenSkin:new THREE.MeshLambertMaterial({color:0x0a0a0a,emissive:0x050000}),
  wardenEye:new THREE.MeshBasicMaterial({color:0xff1800}),
  wardenTooth:new THREE.MeshBasicMaterial({color:0xddcc99}),
  wardenVein:new THREE.MeshBasicMaterial({color:0x550000,wireframe:true}),
  surgeBody:new THREE.MeshLambertMaterial({color:0x0d0018,emissive:0x1a003a}),
  surgeSkin:new THREE.MeshLambertMaterial({color:0x1a0030,emissive:0x08001a}),
  surgeEye:new THREE.MeshBasicMaterial({color:0xcc00ff}),
  surgeGlow:new THREE.MeshBasicMaterial({color:0x7700cc,transparent:true,opacity:.6}),
  surgeCrack:new THREE.MeshBasicMaterial({color:0xaa00ff,transparent:true,opacity:.8}),
  echoBody:new THREE.MeshLambertMaterial({color:0x001820,transparent:true,opacity:.85}),
  echoSkin:new THREE.MeshLambertMaterial({color:0x002830,emissive:0x001a20,transparent:true,opacity:.7}),
  echoEye:new THREE.MeshBasicMaterial({color:0x00ffee}),
  echoAura:new THREE.MeshBasicMaterial({color:0x00aaaa,transparent:true,opacity:.25,side:THREE.BackSide}),
  gazeBody:new THREE.MeshBasicMaterial({color:0xffe566,transparent:true,opacity:.9}),
  gazePupil:new THREE.MeshBasicMaterial({color:0x000000}),
  gazeIris:new THREE.MeshBasicMaterial({color:0xff8800}),
  gazeLid:new THREE.MeshLambertMaterial({color:0x0a0606,emissive:0x060202}),
  gazeTendon:new THREE.MeshBasicMaterial({color:0x440000,transparent:true,opacity:.5}),
  twistBody:new THREE.MeshLambertMaterial({color:0x020005,emissive:0x010003}),
  twistShell:new THREE.MeshLambertMaterial({color:0x07000f,emissive:0x030007}),
  twistEye:new THREE.MeshBasicMaterial({color:0xff6600}),
  twistCrack:new THREE.MeshBasicMaterial({color:0xff4400,transparent:true,opacity:.75}),
  playerBody:new THREE.MeshLambertMaterial({color:0x2a4a6a,emissive:0x0a1a2a}),
  playerHead:new THREE.MeshLambertMaterial({color:0xc8a882}),
  playerJacket:new THREE.MeshLambertMaterial({color:0x1a3a5a,emissive:0x050f1a}),
  playerBoots:new THREE.MeshLambertMaterial({color:0x1a1008}),
  playerFlash:new THREE.MeshBasicMaterial({color:0xffcc44}),
  playerHair:new THREE.MeshLambertMaterial({color:0x1a1008}),
  key:new THREE.MeshBasicMaterial({color:0xffd700}),
  crystal:new THREE.MeshBasicMaterial({color:0x4af0ff}),
  trap:new THREE.MeshLambertMaterial({color:0x260000,emissive:0x0f0000}),
  barrel:new THREE.MeshLambertMaterial({color:0x2a1e10})
};})();

const GEO={_c:new Map(),box(w,h,d){const k=`b${w}_${h}_${d}`;if(!this._c.has(k))this._c.set(k,new THREE.BoxGeometry(w,h,d));return this._c.get(k);},cyl(rt,rb,h,s){const k=`c${rt}_${rb}_${h}_${s}`;if(!this._c.has(k))this._c.set(k,new THREE.CylinderGeometry(rt,rb,h,s));return this._c.get(k);},sph(r,w,h){const k=`s${r}_${w}_${h}`;if(!this._c.has(k))this._c.set(k,new THREE.SphereGeometry(r,w,h));return this._c.get(k);}};
function mk(geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);return m;}

// ── COLLISION ──
function addBox(x1,x2,z1,z2,tag){const box={minX:x1,maxX:x2,minZ:z1,maxZ:z2,tag:tag||null};collisionBoxes.push(box);return box;}
function removeBox(box){const i=collisionBoxes.indexOf(box);if(i>-1)collisionBoxes.splice(i,1);}
function resolve(px,pz){const R=CFG.PLAYER_RADIUS;let rx=px,rz=pz;for(const b of collisionBoxes){const nx=Math.max(b.minX,Math.min(b.maxX,rx)),nz=Math.max(b.minZ,Math.min(b.maxZ,rz)),dx=rx-nx,dz=rz-nz,dist=Math.sqrt(dx*dx+dz*dz);if(dist<R&&dist>.001){const p=(R-dist)/dist;rx+=dx*p;rz+=dz*p;}}return{x:rx,z:rz};}

// ── ROOM ──
const RW=CFG.ROOM_W,RH=CFG.ROOM_H,RD=CFG.ROOM_D,DW=1.6,DH=2.8;
function aType(i){if(i===0)return'normal';const r=Math.random();if(r<.09)return'trap';if(r<.20)return'closet';if(r<.28)return'key_room';if(r<.35)return'crystal_room';if(r<.40)return'dark';return'normal';}
function keyIsAvailable(){return state.hasKey||state.items.some(it=>it.visible&&it.userData.isKey);}

function buildRoom(idx){
  const grp=new THREE.Group(),z0=idx*RD;
  grp.add(mk(GEO.box(RW,.1,RD),MAT.floor,0,-.05,z0));
  grp.add(mk(GEO.box(RW,.1,RD),MAT.ceil,0,RH+.05,z0));
  grp.add(mk(GEO.box(.2,RH,RD),MAT.wall,-RW/2-.1,RH/2,z0));
  grp.add(mk(GEO.box(.2,RH,RD),MAT.wall,RW/2+.1,RH/2,z0));
  addBox(-RW/2-.22,-RW/2,z0-RD/2,z0+RD/2);
  addBox(RW/2,RW/2+.22,z0-RD/2,z0+RD/2);
  const ws=(RW-DW)/2,wa=RH-DH;
  grp.add(mk(GEO.box(RW,wa,.2),MAT.wall,0,RH-wa/2,z0+RD/2));
  grp.add(mk(GEO.box(ws,DH,.2),MAT.wall,-(DW/2+ws/2),DH/2,z0+RD/2));
  grp.add(mk(GEO.box(ws,DH,.2),MAT.wall,(DW/2+ws/2),DH/2,z0+RD/2));
  const wallBox=addBox(-RW/2,RW/2,z0+RD/2-.18,z0+RD/2+.18);
  const ft=.14;
  grp.add(mk(GEO.box(DW+ft*2,ft,.2),MAT.doorFrame,0,DH+ft/2,z0+RD/2));
  grp.add(mk(GEO.box(ft,DH+ft,.2),MAT.doorFrame,-DW/2-ft/2,DH/2,z0+RD/2));
  grp.add(mk(GEO.box(ft,DH+ft,.2),MAT.doorFrame,DW/2+ft/2,DH/2,z0+RD/2));
  const door=mk(GEO.box(DW,DH,.08),MAT.door,0,DH/2,z0+RD/2-.06);
  const type=aType(idx);
  const wantLock=idx>0&&Math.random()<.28;
  door.userData={isDoor:true,open:false,vaultIdx:idx,openY:DH+.6,opening:false,locked:false,type,wallBox};
  grp.add(mkDoorNum(idx+1,z0+RD/2-.12));
  grp.add(door);grp.userData.door=door;
  addLamp(grp,z0,type);
  addFeatures(grp,z0,idx,type,wantLock,door);
  grp.userData.vaultIdx=idx;grp.userData.roomType=type;grp.userData.roomZ=z0;
  return grp;
}
function addLamp(grp,z,type){
  grp.add(mk(GEO.box(.22,.06,.22),MAT.gold,0,RH-.04,z));
  const col=type==='trap'?0xff3300:type==='crystal_room'?0x00aaff:0xff7700;
  const pl=new THREE.PointLight(col,1.8,18);pl.position.set(0,RH-.25,z);pl.userData.flicker=true;pl.userData.phase=Math.random()*Math.PI*2;grp.add(pl);
}
function addFeatures(grp,z,idx,type,wantLock,door){
  let forceKey=false;
  if(wantLock&&!keyIsAvailable()){door.userData.locked=true;forceKey=true;const lockLight=new THREE.PointLight(0xff2200,.6,3);lockLight.position.set(0,DH*.6,z+RD/2-.2);grp.add(lockLight);}
  const hasDrawer=Math.random()<.7||forceKey;
  if(hasDrawer){const sx=Math.random()<.5?-1:1;addDrawerUnit(grp,sx*(RW/2-.55),z-RD/4,forceKey);}
  if(forceKey&&!hasDrawer){const k=mkKey((Math.random()-.5)*3,z-2);grp.add(k);state.items.push(k);const gl=new THREE.PointLight(0xffd700,2,5);gl.position.set(0,1,z-2);grp.add(gl);}
  if(type==='closet'||(idx>4&&Math.random()<.38)){const cx=Math.random()<.5?-(RW/2-.75):(RW/2-.75);addCloset(grp,cx,z-1.5);}
  if(Math.random()<.28){const n=Math.floor(Math.random()*3)+1;for(let i=0;i<n;i++){const bx=(Math.random()-.5)*(RW-2.5),bz=z+(Math.random()-.5)*(RD-5);grp.add(mk(GEO.cyl(.28,.28,.9,7),MAT.barrel,bx,.45,bz));addBox(bx-.36,bx+.36,bz-.36,bz+.36);}}
  if(type==='trap'){const p=mk(GEO.box(1.4,.04,1.4),MAT.trap,0,.02,z);p.userData.isTrap=true;grp.add(p);const gl=new THREE.PointLight(0xff0000,1.5,5);gl.position.set(0,.6,z);grp.add(gl);}
  if(type==='key_room'){const k=mkKey(0,z-1);grp.add(k);state.items.push(k);const gl=new THREE.PointLight(0xffd700,2,5);gl.position.set(0,1,z-1);grp.add(gl);}
  if(type==='crystal_room'){const c=mkCrystal(0,z-1);grp.add(c);state.items.push(c);const gl=new THREE.PointLight(0x00ccff,1.8,6);gl.position.set(0,1.2,z-1);grp.add(gl);}
}
function addCloset(grp,x,z){
  const W=1.1,H=2.1,D=.65,dW=W/2-.02,dH=H-.08;
  const body=mk(GEO.box(W,H,D),MAT.closet,0,H/2,0);
  const frL=mk(GEO.box(.055,H,.09),MAT.closetFrm,-W/2,H/2,D/2);
  const frR=mk(GEO.box(.055,H,.09),MAT.closetFrm,W/2,H/2,D/2);
  const frT=mk(GEO.box(W,.07,.09),MAT.closetFrm,0,H,D/2);
  const frB=mk(GEO.box(W,.07,.09),MAT.closetFrm,0,0,D/2);
  const div=mk(GEO.box(.05,H-.08,.08),MAT.closetFrm,0,dH/2+.05,D/2);
  const dL=mk(GEO.box(dW,dH,.06),MAT.closetDoor,-dW/2-.01,dH/2+.05,D/2+.04);
  const dR=mk(GEO.box(dW,dH,.06),MAT.closetDoor,dW/2+.01,dH/2+.05,D/2+.04);
  const hL=mk(GEO.box(.04,.09,.07),MAT.gold,-.08,dH*.55,D/2+.09);
  const hR=mk(GEO.box(.04,.09,.07),MAT.gold,.08,dH*.55,D/2+.09);
  const rod=mk(GEO.cyl(.02,.02,W-.1,6),MAT.closetFrm,0,H-.3,0);rod.rotation.z=Math.PI/2;
  const shelf=mk(GEO.box(W-.08,.04,D-.1),MAT.closet,0,H*.55,0);
  const cg=new THREE.Group();
  cg.add(body,frL,frR,frT,frB,div,dL,dR,hL,hR,rod,shelf);
  cg.position.set(x,0,z);cg.rotation.y=x<0?Math.PI/2:-Math.PI/2;
  cg.userData.isCloset=true;cg.userData.doorsOpen=false;
  grp.add(cg);addBox(x-.62,x+.62,z-.42,z+.42);
}
function addDrawerUnit(grp,x,z,forceKey=false){
  const W=.7,H=1.0,D=.5;
  const body=mk(GEO.box(W,H,D),MAT.drawer,0,H/2,0);
  const dg=new THREE.Group();dg.add(body);
  const rows=3,dH=(H-.12)/rows;
  for(let i=0;i<rows;i++){
    const dy=.06+dH*i+dH/2;
    const face=mk(GEO.box(W-.06,dH-.05,.06),MAT.drawerFace,0,0,D/2+.03);
    const handle=mk(GEO.box(.13,.035,.05),MAT.gold,0,0,D/2+.075);
    const sep=mk(GEO.box(W-.04,.025,D+.01),MAT.closetFrm,0,dH*i+.05,0);
    const dr=new THREE.Group();dr.add(face,handle);dr.position.set(0,dy,0);
    dr.userData.isDrawer=true;dr.userData.open=false;
    dr.userData.hasItem=(i===1)?(forceKey||Math.random()<.55):false;
    if(forceKey&&i===1)dr.userData.forceKeyItem=true;
    dg.add(dr,sep);
  }
  [[-W/2+.08,.08,-D/2+.07],[W/2-.08,.08,-D/2+.07],[-W/2+.08,.08,D/2-.07],[W/2-.08,.08,D/2-.07]].forEach(([lx,ly,lz])=>dg.add(mk(GEO.box(.07,.15,.07),MAT.closetFrm,lx,ly,lz)));
  dg.add(mk(GEO.box(W+.02,.04,D+.02),MAT.closetFrm,0,H+.02,0));
  dg.position.set(x,0,z);dg.rotation.y=x<0?Math.PI/2:-Math.PI/2;
  dg.userData.isDrawerUnit=true;grp.add(dg);
  addBox(x-.46,x+.46,z-.32,z+.32);
}
function mkKey(x,z){const g=new THREE.TorusGeometry(.12,.025,6,12),m=new THREE.Mesh(g,MAT.key);m.position.set(x,.7,z);m.userData.isKey=true;m.userData.rotSpeed=1.2;m.userData.bobOffset=Math.random()*Math.PI*2;return m;}
function mkCrystal(x,z){const g=new THREE.OctahedronGeometry(.2,0),m=new THREE.Mesh(g,MAT.crystal);m.position.set(x,.65,z);m.userData.isCrystal=true;m.userData.rotSpeed=.9;m.userData.bobOffset=Math.random()*Math.PI*2;return m;}
function mkDoorNum(n,z){const cv=document.createElement('canvas');cv.width=128;cv.height=64;const cx=cv.getContext('2d');cx.fillStyle='#1a0800';cx.fillRect(0,0,128,64);cx.fillStyle='#d4a017';cx.font='bold 34px monospace';cx.textAlign='center';cx.fillText(String(n).padStart(3,'0'),64,44);const m=new THREE.Mesh(new THREE.PlaneGeometry(.5,.25),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true}));m.position.set(0,DH-.32,z);return m;}

// ══════════════════════════════════════════════════
// ── MONSTER MODELS ──
// ══════════════════════════════════════════════════
function buildAllMonsters(){
  monsters.warden=buildWarden();
  monsters.surge=buildSurge();
  monsters.echo=buildEcho();
  monsters.gaze=buildGaze();
  monsters.twist=buildTwist();
  Object.values(monsters).forEach(m=>{if(m){m.mesh.visible=false;scene.add(m.mesh);}});
}

function buildWarden(){
  const grp=new THREE.Group();const root=new THREE.Group();grp.add(root);
  const torso=mk(GEO.box(.62,1.5,.38),MAT.wardenSkin,0,1.3,0);root.add(torso);
  for(let i=0;i<5;i++){const rib=mk(GEO.box(.7,.04,.04),MAT.wardenSkin,0,.85+i*.15,0);rib.scale.x=0.85+i*.03;root.add(rib);}
  root.add(mk(GEO.box(.58,.22,.34),MAT.wardenSkin,0,.48,0));
  const head=new THREE.Group();head.position.set(0,2.1,0);root.add(head);
  head.add(mk(GEO.box(.5,.72,.42),MAT.wardenSkin,0,.36,0));
  head.add(mk(GEO.box(.44,.22,.38),MAT.wardenSkin,0,.06,.02));
  head.add(mk(GEO.box(.08,.12,.44),MAT.wardenSkin,0,.76,-.04));
  head.add(mk(GEO.box(.54,.1,.1),MAT.wardenSkin,0,.44,.1));
  for(let i=0;i<6;i++){head.add(mk(GEO.box(.055,.12,.04),MAT.wardenTooth,-0.15+i*.06,.1,.22));}
  head.add(mk(GEO.box(.16,.14,.08),MAT.wardenSkin,-.16,.44,.18));
  head.add(mk(GEO.box(.16,.14,.08),MAT.wardenSkin,.16,.44,.18));
  const eyeGeo=new THREE.SphereGeometry(.065,8,8);
  const eL=new THREE.Mesh(eyeGeo,MAT.wardenEye);eL.position.set(-.16,.44,.2);head.add(eL);
  const eR=new THREE.Mesh(eyeGeo,MAT.wardenEye);eR.position.set(.16,.44,.2);head.add(eR);
  const gw=new THREE.PointLight(0xff1500,1.6,4);gw.position.set(0,.44,.3);head.add(gw);
  root.add(mk(GEO.box(.18,.32,.18),MAT.wardenSkin,0,1.94,0));
  const aL=new THREE.Group();aL.position.set(-.38,1.7,0);root.add(aL);
  aL.add(mk(GEO.box(.14,1.1,.13),MAT.wardenSkin,0,-.55,0));
  aL.add(mk(GEO.box(.11,.9,.11),MAT.wardenSkin,-.04,-1.15,0));
  for(let i=0;i<4;i++){const f=mk(GEO.box(.04,.3,.04),MAT.wardenSkin,-0.06+i*.04,-1.76,0);f.rotation.z=-.1+i*.07;aL.add(f);}
  const aR=new THREE.Group();aR.position.set(.38,1.7,0);root.add(aR);
  aR.add(mk(GEO.box(.14,1.1,.13),MAT.wardenSkin,0,-.55,0));
  aR.add(mk(GEO.box(.11,.9,.11),MAT.wardenSkin,.04,-1.15,0));
  for(let i=0;i<4;i++){const f=mk(GEO.box(.04,.3,.04),MAT.wardenSkin,-0.06+i*.04,-1.76,0);f.rotation.z=.1-i*.07;aR.add(f);}
  const lgL=new THREE.Group();lgL.position.set(-.2,0,0);root.add(lgL);
  lgL.add(mk(GEO.box(.17,.9,.17),MAT.wardenSkin,0,.38,0));
  lgL.add(mk(GEO.box(.14,.8,.14),MAT.wardenSkin,0,-.45,.05));
  lgL.add(mk(GEO.box(.2,.08,.32),MAT.wardenSkin,0,-1.04,.1));
  const lgR=new THREE.Group();lgR.position.set(.2,0,0);root.add(lgR);
  lgR.add(mk(GEO.box(.17,.9,.17),MAT.wardenSkin,0,.38,0));
  lgR.add(mk(GEO.box(.14,.8,.14),MAT.wardenSkin,0,-.45,.05));
  lgR.add(mk(GEO.box(.2,.08,.32),MAT.wardenSkin,0,-1.04,.1));
  const aura=new THREE.Mesh(GEO.box(.68,1.6,.42),MAT.wardenVein);aura.position.set(0,1.3,0);root.add(aura);
  return{mesh:grp,active:false,alerted:false,lastKnownPos:new THREE.Vector3(),noiseLevel:0,gw,armL:aL,armR:aR,headGroup:head,heartbeatTimer:0,type:'warden'};
}

function buildSurge(){
  const grp=new THREE.Group();const root=new THREE.Group();grp.add(root);
  root.add(mk(GEO.box(.72,1.2,.5),MAT.surgeBody,0,.9,0));
  root.add(mk(GEO.box(.68,.5,.48),MAT.surgeSkin,0,1.1,0));
  root.add(mk(GEO.box(.22,.3,.48),MAT.surgeBody,-.5,1.35,0));
  root.add(mk(GEO.box(.22,.3,.48),MAT.surgeBody,.5,1.35,0));
  const head=new THREE.Group();head.position.set(0,1.72,0);root.add(head);
  head.add(mk(GEO.box(.52,.52,.46),MAT.surgeBody,0,.26,0));
  head.add(mk(GEO.box(.56,.1,.5),MAT.surgeBody,0,.42,.04));
  const eg=new THREE.SphereGeometry(.07,8,8);
  const eL=new THREE.Mesh(eg,MAT.surgeEye);eL.position.set(-.15,.3,.25);head.add(eL);
  const eR=new THREE.Mesh(eg,MAT.surgeEye);eR.position.set(.15,.3,.25);head.add(eR);
  const co1=new THREE.Mesh(GEO.sph(.1,6,6),MAT.surgeGlow);co1.position.set(-.5,1.55,.05);root.add(co1);
  const co2=new THREE.Mesh(GEO.sph(.1,6,6),MAT.surgeGlow);co2.position.set(.5,1.55,.05);root.add(co2);
  root.add(mk(GEO.box(.24,.28,.24),MAT.surgeBody,0,1.56,0));
  const aL=mk(GEO.box(.2,.9,.2),MAT.surgeSkin,-.52,.95,.05);aL.rotation.z=.25;root.add(aL);
  const aR=mk(GEO.box(.2,.9,.2),MAT.surgeSkin,.52,.95,.05);aR.rotation.z=-.25;root.add(aR);
  root.add(mk(GEO.box(.16,.7,.16),MAT.surgeBody,-.65,.35,.05));
  root.add(mk(GEO.box(.16,.7,.16),MAT.surgeBody,.65,.35,.05));
  root.add(mk(GEO.box(.6,.22,.44),MAT.surgeBody,0,.3,0));
  root.add(mk(GEO.box(.24,.8,.26),MAT.surgeBody,-.22,-.1,0));
  root.add(mk(GEO.box(.24,.8,.26),MAT.surgeBody,.22,-.1,0));
  root.add(mk(GEO.box(.2,.6,.22),MAT.surgeBody,-.22,-.72,.04));
  root.add(mk(GEO.box(.2,.6,.22),MAT.surgeBody,.22,-.72,.04));
  root.add(mk(GEO.box(.26,.12,.36),MAT.wardenTooth,-.22,-1.12,.08));
  root.add(mk(GEO.box(.26,.12,.36),MAT.wardenTooth,.22,-1.12,.08));
  const core=new THREE.Mesh(GEO.sph(.08,6,6),MAT.surgeCrack);core.position.set(0,1.1,.28);root.add(core);
  const pw=new THREE.PointLight(0xaa00ff,2,5);pw.position.set(0,1.5,.3);root.add(pw);
  return{mesh:grp,active:false,dir:1,speed:14,pw,co1,co2,core,type:'surge'};
}

function buildEcho(){
  const grp=new THREE.Group();const root=new THREE.Group();grp.add(root);
  for(let layer=0;layer<3;layer++){const offset=layer*.06;const lgrp=new THREE.Group();lgrp.position.set(0,0,offset);lgrp.add(mk(GEO.box(.5-layer*.08,1.4,.34-layer*.04),layer===0?MAT.echoBody:MAT.echoSkin,0,.9,0));lgrp.add(mk(GEO.box(.44,.5,.32),layer===0?MAT.echoBody:MAT.echoSkin,0,1.82,0));root.add(lgrp);}
  const head=new THREE.Group();head.position.set(0,1.7,0);root.add(head);
  head.add(mk(GEO.box(.46,.56,.4),MAT.echoBody,0,.28,0));
  head.add(mk(GEO.box(.2,.1,.06),MAT.echoBody,-.14,.36,.22));
  head.add(mk(GEO.box(.2,.1,.06),MAT.echoBody,.14,.36,.22));
  const eg=new THREE.SphereGeometry(.08,8,8);
  const eL=new THREE.Mesh(eg,MAT.echoEye);eL.position.set(-.14,.36,.22);head.add(eL);
  const eR=new THREE.Mesh(eg,MAT.echoEye);eR.position.set(.14,.36,.22);head.add(eR);
  head.add(mk(GEO.box(.28,.08,.06),MAT.gazePupil,0,.12,.22));
  for(let i=0;i<5;i++){const t=mk(GEO.box(.04,.3+i*.08,.04),MAT.echoSkin,-.16+i*.08,.4,-.22-i*.04);t.rotation.x=-.3-i*.15;root.add(t);}
  for(let i=0;i<4;i++){const w=mk(GEO.box(.06,.4,.06),MAT.echoSkin,-.15+i*.1,-.2+i*.1*Math.sin(i),-i*.05);root.add(w);}
  const aura=new THREE.Mesh(GEO.box(.7,2.2,.6),MAT.echoAura);aura.position.set(0,.8,0);root.add(aura);
  const pw=new THREE.PointLight(0x00ffee,1.8,5);pw.position.set(0,1.9,.3);root.add(pw);
  return{mesh:grp,active:false,bounces:0,maxBounces:3,dir:1,speed:10,startZ:0,endZ:0,pw,type:'echo'};
}

function buildGaze(){
  const grp=new THREE.Group();const root=new THREE.Group();grp.add(root);
  const eyeData=[{x:0,y:1.5,z:.05,r:.14},{x:-.28,y:1.18,z:0,r:.11},{x:.3,y:1.12,z:.02,r:.1},{x:.1,y:1.75,z:-.04,r:.09},{x:-.12,y:.88,z:.06,r:.1},{x:.22,y:1.55,z:.08,r:.08},{x:-.2,y:1.4,z:.06,r:.07}];
  eyeData.forEach((e,idx)=>{
    const eg=new THREE.Group();eg.position.set(e.x,e.y,e.z);
    const sclera=new THREE.Mesh(GEO.sph(e.r,10,10),MAT.gazeBody);eg.add(sclera);
    const iris=new THREE.Mesh(new THREE.CircleGeometry(e.r*.55,12),MAT.gazeIris);iris.position.set(0,0,e.r*.95);eg.add(iris);
    const pupil=new THREE.Mesh(new THREE.CircleGeometry(e.r*.3,10),MAT.gazePupil);pupil.position.set(0,0,e.r*.97);eg.add(pupil);
    const lid=mk(GEO.box(e.r*2.2,e.r*.6,e.r*1.1),MAT.gazeLid,0,e.r*.4,0);eg.add(lid);
    if(idx%2===0){const tend=mk(GEO.box(.01,.15,.01),MAT.gazeTendon,0,-e.r*1.2,0);eg.add(tend);}
    eg.userData.gazeEye=true;eg.userData.baseScale=1;root.add(eg);
  });
  const blob=new THREE.Mesh(GEO.sph(.22,8,8),MAT.gazeLid);blob.position.set(0,1.3,-.1);root.add(blob);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const vein=mk(GEO.cyl(.005,.005,.35,3),MAT.gazeTendon,Math.cos(a)*.2,1.3+Math.sin(a)*.15,Math.sin(a)*.1);vein.rotation.z=a;root.add(vein);}
  const pw=new THREE.PointLight(0xffdd00,0,8);pw.position.set(0,1.3,0);root.add(pw);
  return{mesh:grp,active:false,pw,type:'gaze',damageTimer:0};
}

function buildTwist(){
  const grp=new THREE.Group();const root=new THREE.Group();grp.add(root);
  root.add(mk(GEO.box(.36,1.9,.28),MAT.twistBody,0,1.0,0));
  const shardOffsets=[[-.25,.5,0,.3],[.25,.8,0,-.3],[-.22,1.1,0,.2],[.22,1.3,0,-.25],[-.18,1.6,0,.15],[.18,1.7,0,-.15]];
  shardOffsets.forEach(([sx,sy,sz,rz])=>{const s=mk(GEO.box(.18,.42,.06),MAT.twistShell,sx,sy,sz);s.rotation.z=rz;root.add(s);});
  const head=new THREE.Group();head.position.set(0,2.0,0);root.add(head);
  head.add(mk(GEO.box(.34,.58,.28),MAT.twistBody,0,.29,0));
  head.add(mk(GEO.box(.4,.1,.3),MAT.twistShell,0,.5,.02));
  head.add(mk(GEO.box(.2,.16,.2),MAT.twistBody,0,.02,.02));
  const eL=mk(GEO.box(.12,.06,.04),MAT.twistEye,-.1,.36,.16);head.add(eL);
  const eR=mk(GEO.box(.12,.06,.04),MAT.twistEye,.1,.36,.16);head.add(eR);
  const cracks=[{x:0,y:.8,z:.15,w:.04,h:.5},{x:-.1,y:1.2,z:.15,w:.03,h:.35},{x:.08,y:.5,z:.15,w:.03,h:.4}];
  cracks.forEach(c=>{root.add(mk(GEO.box(c.w,c.h,.02),MAT.twistCrack,c.x,c.y,c.z));});
  const limbShards=[[-.28,1.4,0,-.55,.04,0.28,.9,.12],[.28,1.4,0,.55,.04,0.28,.9,.12]];
  limbShards.forEach(([x,y,z,rz])=>{const s=mk(GEO.box(.1,.7,.1),MAT.twistBody,x,y,z);s.rotation.z=rz;root.add(s);const tip=mk(GEO.box(.06,.2,.06),MAT.twistCrack,x+(x<0?-.12:.12),y-.4,z);root.add(tip);});
  root.add(mk(GEO.box(.18,.7,.2),MAT.twistBody,-.14,-.1,.02));
  root.add(mk(GEO.box(.18,.7,.2),MAT.twistBody,.14,-.1,.02));
  const pw=new THREE.PointLight(0xff6600,1.5,6);pw.position.set(0,2.3,.2);root.add(pw);
  return{mesh:grp,active:false,pw,type:'twist',teleTimer:0,freezeTimer:0,frozen:false,seenByPlayer:false};
}

// ══════════════════════════════════════════════════
// ── PLAYER MODEL FOR REMOTE PLAYERS ──
// ── Proper proportions, correct face orientation  ──
// ══════════════════════════════════════════════════
function hexToThreeColor(hex){
  const n=parseInt(hex.replace('#',''),16);
  return new THREE.Color(n>>16&255,n>>8&255,n&255).multiplyScalar(1/255);
}

function buildHatMesh(hatType,hatColor){
  const grp=new THREE.Group();
  const col=new THREE.MeshLambertMaterial({color:new THREE.Color(hatColor)});
  const colDark=new THREE.MeshLambertMaterial({color:new THREE.Color(hatColor).multiplyScalar(.6)});
  switch(hatType){
    case'cap':{
      // Bill
      const bill=mk(GEO.box(.28,.04,.22),col,0,.005,.13);grp.add(bill);
      // Dome
      const dome=new THREE.Mesh(new THREE.SphereGeometry(.185,10,8,0,Math.PI*2,0,Math.PI*.55),col);
      dome.position.set(0,0,0);grp.add(dome);
      // Button top
      grp.add(mk(GEO.cyl(.025,.025,.04,6),colDark,0,.18,0));
      break;}
    case'tophat':{
      // Brim
      grp.add(mk(GEO.cyl(.28,.28,.03,12),col,0,.01,0));
      // Cylinder body
      grp.add(mk(GEO.cyl(.16,.16,.38,12),col,0,.22,0));
      // Top cap
      grp.add(mk(GEO.cyl(.17,.17,.03,12),colDark,0,.42,0));
      // Band
      grp.add(mk(GEO.cyl(.165,.165,.04,12),colDark,0,.08,0));
      break;}
    case'crown':{
      const goldMat=new THREE.MeshLambertMaterial({color:0xffd700,emissive:0x332200});
      const gemMat=new THREE.MeshBasicMaterial({color:0xff2244});
      // Ring base
      grp.add(mk(GEO.cyl(.18,.18,.06,12),goldMat,0,.03,0));
      // Points (5)
      for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const pt=mk(GEO.box(.06,.18,.06),goldMat,Math.cos(a)*.13,.12,Math.sin(a)*.13);grp.add(pt);}
      // Gems
      for(let i=0;i<5;i++){const a=(i+.5)/5*Math.PI*2;const gem=new THREE.Mesh(GEO.sph(.03,6,6),gemMat);gem.position.set(Math.cos(a)*.13,.07,Math.sin(a)*.13);grp.add(gem);}
      break;}
    case'beanie':{
      // Main dome — slightly squished
      const bDome=new THREE.Mesh(new THREE.SphereGeometry(.195,10,8),col);
      bDome.scale.y=.78;bDome.position.set(0,.04,0);grp.add(bDome);
      // Rib band
      grp.add(mk(GEO.cyl(.2,.2,.06,14),colDark,0,-.02,0));
      // Pom-pom
      grp.add(new THREE.Mesh(GEO.sph(.055,8,8),col));
      grp.children[grp.children.length-1].position.set(0,.19,0);
      break;}
    case'cowboy':{
      // Wide brim
      const brimGeo=new THREE.CylinderGeometry(.35,.35,.03,16);
      grp.add(new THREE.Mesh(brimGeo,col));
      // Crown
      grp.add(mk(GEO.cyl(.17,.17,.24,12),col,0,.14,0));
      // Dent/crease on top — represented by a darker top disc
      grp.add(mk(GEO.cyl(.14,.14,.02,12),colDark,0,.27,0));
      // Band
      grp.add(mk(GEO.cyl(.175,.175,.04,12),colDark,0,.06,0));
      break;}
    default: break;
  }
  return grp;
}

function buildPlayerModel(username,skinData){
  const skin=skinData||{bodyColor:SKINS.bodyColor,jacketColor:SKINS.jacketColor,hatType:SKINS.hatType,hatColor:SKINS.hatColor};

  // Dynamic materials per player
  const bodyMat=new THREE.MeshLambertMaterial({color:new THREE.Color(skin.bodyColor)});
  const jacketMat=new THREE.MeshLambertMaterial({color:new THREE.Color(skin.jacketColor)});
  const skinMat=new THREE.MeshLambertMaterial({color:0xc8a882});
  const hairMat=new THREE.MeshLambertMaterial({color:0x1a1008});
  const bootsMat=new THREE.MeshLambertMaterial({color:0x1a1008});
  const flashMat=new THREE.MeshBasicMaterial({color:0xffcc44});
  const eyeMat=new THREE.MeshBasicMaterial({color:0x111111});
  const eyeWhiteMat=new THREE.MeshLambertMaterial({color:0xfff8f0});
  const goldMat=new THREE.MeshLambertMaterial({color:0xd4a017});

  const grp=new THREE.Group();

  // ── ROOT GROUP — feet at y=0 ──
  // Total model height: ~1.9 units, feet at 0

  // BOOTS (y 0 to 0.14)
  grp.add(mk(GEO.box(.2,.14,.28),bootsMat,-.12,.07,.04));
  grp.add(mk(GEO.box(.2,.14,.28),bootsMat,.12,.07,.04));

  // LOWER LEGS (y 0.14 to 0.62)
  grp.add(mk(GEO.box(.17,.48,.19),bodyMat,-.12,.38,0));
  grp.add(mk(GEO.box(.17,.48,.19),bodyMat,.12,.38,0));

  // UPPER LEGS / HIPS (y 0.62 to 1.05)
  grp.add(mk(GEO.box(.19,.43,.2),bodyMat,-.11,.84,0));
  grp.add(mk(GEO.box(.19,.43,.2),bodyMat,.11,.84,0));

  // PELVIS (y 1.0 to 1.1)
  grp.add(mk(GEO.box(.38,.18,.26),jacketMat,0,1.04,0));

  // TORSO / JACKET (y 1.05 to 1.72)
  grp.add(mk(GEO.box(.46,.62,.3),jacketMat,0,1.38,0));
  // Chest detail stripe
  grp.add(mk(GEO.box(.08,.48,.32),bodyMat,0,1.38,0));

  // NECK (y 1.72 to 1.84)
  grp.add(mk(GEO.box(.16,.12,.16),skinMat,0,1.78,0));

  // HEAD GROUP — centered at neck top (y 1.84), size ~0.36 tall
  const headGrp=new THREE.Group();
  headGrp.position.set(0,1.84,0);

  // Skull — slightly wide, proper size
  const skull=new THREE.Mesh(GEO.box(.38,.38,.32),skinMat);
  skull.position.set(0,.19,0);
  headGrp.add(skull);

  // Forehead brow ridge
  headGrp.add(mk(GEO.box(.34,.06,.06),skinMat,0,.36,.14));

  // Hair — covers top and back
  headGrp.add(mk(GEO.box(.4,.1,.34),hairMat,0,.4,-.01));   // top
  headGrp.add(mk(GEO.box(.38,.3,.08),hairMat,0,.24,-.14)); // back

  // Eyes — face +Z direction
  // Eye sockets (slightly recessed)
  headGrp.add(mk(GEO.box(.12,.09,.04),eyeWhiteMat,-.11,.2,.15));
  headGrp.add(mk(GEO.box(.12,.09,.04),eyeWhiteMat,.11,.2,.15));
  // Pupils (slightly in front)
  const pupilL=new THREE.Mesh(GEO.box(.07,.06,.02),eyeMat);
  pupilL.position.set(-.11,.2,.18); headGrp.add(pupilL);
  const pupilR=new THREE.Mesh(GEO.box(.07,.06,.02),eyeMat);
  pupilR.position.set(.11,.2,.18); headGrp.add(pupilR);

  // Nose bump
  headGrp.add(mk(GEO.box(.07,.08,.07),skinMat,0,.12,.16));
  // Mouth line
  headGrp.add(mk(GEO.box(.14,.02,.02),eyeMat,0,.05,.16));

  grp.add(headGrp);

  // SHOULDERS (at jacket top)
  grp.add(mk(GEO.box(.12,.14,.28),jacketMat,-.29,1.66,0));
  grp.add(mk(GEO.box(.12,.14,.28),jacketMat,.29,1.66,0));

  // UPPER ARMS
  const armL=new THREE.Group(); armL.position.set(-.34,1.55,0);
  armL.add(mk(GEO.box(.14,.42,.16),jacketMat,0,-.21,0));
  armL.rotation.z=.1; grp.add(armL);

  const armR=new THREE.Group(); armR.position.set(.34,1.55,0);
  armR.add(mk(GEO.box(.14,.42,.16),jacketMat,0,-.21,0));
  armR.rotation.z=-.1; grp.add(armR);

  // FOREARMS
  grp.add(mk(GEO.box(.12,.38,.14),skinMat,-.34,1.04,0));
  grp.add(mk(GEO.box(.12,.38,.14),skinMat,.34,1.04,0));

  // HANDS
  grp.add(mk(GEO.box(.14,.16,.14),skinMat,-.34,.78,0));
  grp.add(mk(GEO.box(.14,.16,.14),skinMat,.34,.78,0));

  // FLASHLIGHT in right hand (+Z = forward)
  const flashGrp=new THREE.Group();
  flashGrp.position.set(.34,.8,.1);
  flashGrp.add(mk(GEO.cyl(.028,.028,.2,7),new THREE.MeshLambertMaterial({color:0x222222}),0,0,0));
  flashGrp.rotation.x=Math.PI/2;
  const bulb=new THREE.Mesh(GEO.sph(.04,7,7),flashMat);
  bulb.position.set(0,.12,0); flashGrp.add(bulb);
  grp.add(flashGrp);

  // ── NAME LABEL ──
  const labelCanvas=document.createElement('canvas');
  labelCanvas.width=256;labelCanvas.height=48;
  const lctx=labelCanvas.getContext('2d');
  lctx.fillStyle='rgba(0,0,0,0.78)';
  lctx.fillRect(4,4,248,40);
  lctx.strokeStyle='rgba(212,160,23,0.6)';
  lctx.lineWidth=1.5;
  lctx.strokeRect(4,4,248,40);
  lctx.fillStyle='#d4a017';
  lctx.font='bold 20px monospace';
  lctx.textAlign='center';
  lctx.fillText(username.slice(0,16),128,28);
  const labelTex=new THREE.CanvasTexture(labelCanvas);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.21),new THREE.MeshBasicMaterial({map:labelTex,transparent:true,depthTest:false}));
  label.position.set(0,2.28,0);
  grp.add(label);

  // ── HAT ──
  if(skin.hatType&&skin.hatType!=='none'){
    const hatMesh=buildHatMesh(skin.hatType,skin.hatColor);
    // Position hat on top of head: head center y=1.84+0.19=2.03, top of head y≈2.03+0.19=2.22
    hatMesh.position.set(0,2.22,0);
    grp.add(hatMesh);
  }

  grp.userData.isPlayerModel=true;
  grp.userData.username=username;
  grp.userData.label=label;
  grp.userData.headGroup=headGrp;
  grp.userData.skinData=skin;
  return grp;
}

// ── SKIN EDITOR UI ──
function buildSkinEditorUI(){
  if($('skin-editor'))return;
  const panel=document.createElement('div');
  panel.id='skin-editor';
  panel.innerHTML=`
<div id="skin-editor-inner">
  <h2>🎨 CUSTOMIZE</h2>
  <div class="skin-row">
    <label>BODY COLOR</label>
    <div class="skin-color-row">
      <input type="color" id="skin-body-color" value="${SKINS.bodyColor}" class="skin-colorpick"/>
      <span class="skin-color-label" id="skin-body-label">${SKINS.bodyColor.toUpperCase()}</span>
    </div>
  </div>
  <div class="skin-row">
    <label>JACKET COLOR</label>
    <div class="skin-color-row">
      <input type="color" id="skin-jacket-color" value="${SKINS.jacketColor}" class="skin-colorpick"/>
      <span class="skin-color-label" id="skin-jacket-label">${SKINS.jacketColor.toUpperCase()}</span>
    </div>
  </div>
  <div class="skin-row">
    <label>HAT</label>
    <div class="skin-hat-grid" id="skin-hat-grid">
      ${Object.entries(HATS).map(([k,v])=>`<button class="hat-btn${SKINS.hatType===k?' active':''}" data-hat="${k}">${v.label}</button>`).join('')}
    </div>
  </div>
  <div class="skin-row" id="skin-hat-color-row" style="${SKINS.hatType==='none'?'display:none':''}">
    <label>HAT COLOR</label>
    <div class="skin-color-row">
      <input type="color" id="skin-hat-color" value="${SKINS.hatColor}" class="skin-colorpick"/>
      <span class="skin-color-label" id="skin-hat-label">${SKINS.hatColor.toUpperCase()}</span>
    </div>
  </div>
  <div id="skin-preview-wrap">
    <canvas id="skin-preview-canvas" width="160" height="220"></canvas>
    <p class="skin-preview-label">PREVIEW</p>
  </div>
  <button id="btn-close-skin" class="menu-btn" style="margin-top:18px">DONE</button>
</div>`;
  document.body.appendChild(panel);

  // Wire up color pickers
  $('skin-body-color').addEventListener('input',e=>{
    SKINS.bodyColor=e.target.value;
    $('skin-body-label').textContent=e.target.value.toUpperCase();
    updateSkinPreview();
  });
  $('skin-jacket-color').addEventListener('input',e=>{
    SKINS.jacketColor=e.target.value;
    $('skin-jacket-label').textContent=e.target.value.toUpperCase();
    updateSkinPreview();
  });
  $('skin-hat-color').addEventListener('input',e=>{
    SKINS.hatColor=e.target.value;
    $('skin-hat-label').textContent=e.target.value.toUpperCase();
    updateSkinPreview();
  });

  // Hat buttons
  $('skin-hat-grid').addEventListener('click',e=>{
    const btn=e.target.closest('.hat-btn');
    if(!btn)return;
    document.querySelectorAll('.hat-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    SKINS.hatType=btn.dataset.hat;
    $('skin-hat-color-row').style.display=SKINS.hatType==='none'?'none':'';
    updateSkinPreview();
  });

  $('btn-close-skin').addEventListener('click',()=>{
    $('skin-editor').classList.add('hidden');
    if(state.phase==='playing')requestPointerLock();
  });

  updateSkinPreview();
}

function updateSkinPreview(){
  const cv=$('skin-preview-canvas');
  if(!cv)return;
  const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.fillStyle='#0a0a0a';
  ctx.fillRect(0,0,cv.width,cv.height);

  const W=cv.width,H=cv.height;
  const cx=W/2;
  // Draw a simple front-view 2D avatar
  const sc=2.8; // scale factor pixels per unit

  function rect(x,y,w,h,col,stroke){
    ctx.fillStyle=col;
    ctx.fillRect(cx+x*sc,H-y*sc-h*sc,w*sc,h*sc);
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.strokeRect(cx+x*sc,H-y*sc-h*sc,w*sc,h*sc);}
  }
  function circle(x,y,r,col){ctx.beginPath();ctx.arc(cx+x*sc,H-y*sc,r*sc,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();}

  // Boots
  rect(-.12-.1,.0,.2,.14,SKINS.jacketColor);
  rect(.12-.1,.0,.2,.14,SKINS.jacketColor);
  // Legs
  rect(-.12-.085,.14,.17,.48,SKINS.bodyColor);
  rect(.12-.085,.14,.17,.48,SKINS.bodyColor);
  // Hips
  rect(-.19,.97,.38,.12,SKINS.jacketColor);
  // Torso
  rect(-.23,1.09,.46,.63,SKINS.jacketColor);
  rect(-.04,1.09,.08,.63,SKINS.bodyColor);
  // Arms
  rect(-.37,1.1,.14,.6,SKINS.jacketColor);
  rect(.23,1.1,.14,.6,SKINS.jacketColor);
  // Hands
  rect(-.38,.78,.15,.2,'#c8a882');
  rect(.23,.78,.15,.2,'#c8a882');
  // Neck
  rect(-.08,1.72,.16,.12,'#c8a882');
  // Head
  rect(-.19,1.84,.38,.38,'#c8a882','#555');
  // Hair
  rect(-.2,2.17,.4,.08,'#1a1008');
  // Eyes
  rect(-.16,2.0,.11,.09,'#fff8f0','#888');
  rect(.05,2.0,.11,.09,'#fff8f0','#888');
  rect(-.14,2.02,.07,.06,'#111');
  rect(.07,2.02,.07,.06,'#111');
  // Nose
  rect(-.035,1.92,.07,.08,'#b89070');

  // Hat
  if(SKINS.hatType!=='none'){
    const hc=SKINS.hatColor;
    const hcDark=darkenHex(hc,.6);
    switch(SKINS.hatType){
      case'cap':
        rect(-.19,2.22,.38,.14,hc);
        rect(-.05,2.22,.28,.05,hcDark);// bill
        break;
      case'tophat':
        rect(-.24,2.22,.48,.04,hcDark); // brim
        rect(-.16,2.26,.32,.32,hc);
        rect(-.17,2.57,.34,.04,hcDark);
        break;
      case'crown':
        rect(-.19,2.22,.38,.06,'#d4a017');
        // Points
        for(let i=0;i<5;i++){rect(-.18+i*.09,2.28,.07,.16,'#d4a017');}
        break;
      case'beanie':
        rect(-.21,2.22,.42,.22,hc);
        rect(-.22,2.22,.44,.06,hcDark);
        circle(0,2.46,.055,hc);
        break;
      case'cowboy':
        rect(-.27,2.22,.54,.04,hc); // brim
        rect(-.17,2.26,.34,.2,hc);
        rect(-.15,2.45,.3,.03,hcDark);
        break;
    }
  }

  // Username
  ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(10,6,W-20,22);
  ctx.strokeStyle='rgba(212,160,23,0.5)';ctx.lineWidth=1;ctx.strokeRect(10,6,W-20,22);
  ctx.fillStyle='#d4a017';ctx.font='bold 12px monospace';ctx.textAlign='center';
  ctx.fillText(SETTINGS.username.slice(0,14),W/2,22);
}

function darkenHex(hex,f){
  let c=parseInt(hex.replace('#',''),16);
  const r=Math.round((c>>16&255)*f),g=Math.round((c>>8&255)*f),b=Math.round((c&255)*f);
  return'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function openSkinEditor(){
  buildSkinEditorUI();
  $('skin-editor').classList.remove('hidden');
  if(document.pointerLockElement)document.exitPointerLock();
}

// ══════════════════════════════════════════════════
// ── GAME START / ROOM LOGIC ──
// ══════════════════════════════════════════════════
function startGame(){
  state.vault=0;state.hp=100;state.flashOn=true;state.sprint=100;state.crouching=false;state.inCloset=false;state.wardenAlerted=false;state.yaw=0;state.pitch=0;state.items=[];state.hasKey=false;state.keys={};state.phase='playing';state.crouchY=CFG.PLAYER_HEIGHT;state.chatOpen=false;
  collisionBoxes=[];
  state.roomsBuilt.forEach(r=>scene.remove(r));state.roomsBuilt=[];
  playerObj.position.set(0,0,2);
  Object.values(monsters).forEach(m=>{if(m){m.active=false;m.mesh.visible=false;m.mesh.position.set(0,0,-200);}});
  if(monsters.warden)monsters.warden.noiseLevel=0;
  if(monsters.echo)monsters.echo.bounces=0;
  if(monsters.twist){monsters.twist.frozen=false;monsters.twist.teleTimer=0;}
  if(gazeAudio){stopSound(gazeAudio);gazeAudio=null;}
  wardenAlert.classList.remove('active');
  const vis=QUALITY[SETTINGS.quality].rooms;
  for(let i=0;i<=vis;i++)spawnRoom(i);
  updateHUD();keyIcon.classList.add('hidden');crouchIcon.classList.add('hidden');
  canvas.style.display='block';menuEl.classList.add('hidden');hudEl.classList.remove('hidden');deathEl.classList.add('hidden');winEl.classList.add('hidden');
  qualBadge.textContent='GFX: '+SETTINGS.quality.toUpperCase();
  detectMobile();
  if(!state.loopStarted){state.loopStarted=true;loop();}
  requestPointerLock();
  flashlight.intensity=4.5;flStatus.textContent='ON';
  if(mp.active&&mp.playerRef){
    mp.playerRef.update({username:SETTINGS.username,vault:0,hp:100,alive:true,x:0,z:2,yaw:0,
      skin:JSON.stringify(SKINS)});
  }
}

function spawnRoom(i){if(i>=CFG.VAULTS_TOTAL)return;if(state.roomsBuilt.find(r=>r.userData.vaultIdx===i))return;const r=buildRoom(i);scene.add(r);state.roomsBuilt.push(r);}

function advanceVault(from){
  SFX.doorOpen();state.vault=from+1;
  if(state.vault>=CFG.VAULTS_TOTAL){triggerWin();return;}
  const vis=QUALITY[SETTINGS.quality].rooms;
  for(let i=state.vault;i<=Math.min(state.vault+vis,CFG.VAULTS_TOTAL-1);i++)spawnRoom(i);
  state.roomsBuilt=state.roomsBuilt.filter(r=>{if(r.userData.vaultIdx<state.vault-2){scene.remove(r);return false;}return true;});
  state.items=state.items.filter(it=>it.visible);
  updateHUD();
  const anyActive=Object.values(monsters).some(m=>m&&m.active);
  if(!anyActive&&state.vault>1){
    const roll=Math.random();
    if(roll<.22)spawnWarden();
    else if(roll<.40)spawnSurge();
    else if(roll<.55)spawnEcho();
    else if(roll<.68)spawnGaze();
    else if(roll<.78)spawnTwist();
  }
}

// ── POINTER LOCK ──
function requestPointerLock(){
  if(state.isMobile){plOverlay.classList.add('hidden');return;}
  // Don't lock if chat is open or settings/skin editor is open
  if(state.chatOpen)return;
  if(!$('settings-panel').classList.contains('hidden'))return;
  if($('skin-editor')&&!$('skin-editor').classList.contains('hidden'))return;
  const fn=canvas.requestPointerLock||canvas.mozRequestPointerLock;
  if(fn)fn.call(canvas);
  else plOverlay.classList.remove('hidden');
}
document.addEventListener('pointerlockchange',()=>{
  state.pointerLocked=(document.pointerLockElement===canvas);
  if(!state.isMobile){
    // Only show the click-to-capture overlay if we're in-game and NOT chatting
    const showOverlay=!state.pointerLocked&&state.phase==='playing'&&!state.chatOpen;
    plOverlay.classList.toggle('hidden',!showOverlay);
  }
});
document.addEventListener('mousemove',e=>{if(!state.pointerLocked||state.phase!=='playing'||state.inCloset)return;const s=CFG.MOUSE_SENS_BASE*SETTINGS.sensMult;state.yaw-=e.movementX*s;state.pitch-=e.movementY*s;state.pitch=Math.max(-1.1,Math.min(1.1,state.pitch));});

// ── INPUT ──
document.addEventListener('keydown',e=>{
  // Don't process game keys while chat input is focused
  if(state.chatOpen&&e.target&&e.target.id==='chat-input'){return;}

  state.keys[e.code]=true;
  if(state.phase!=='playing'&&!state.inCloset)return;
  if(e.code==='KeyF')toggleFlash();
  if(e.code==='KeyC')toggleCrouch();
  if(e.code==='KeyE'&&!state.inCloset)tryInteract();
  if((e.code==='KeyE'||e.code==='Escape')&&state.inCloset)exitCloset();
  if(e.code==='Escape'&&!state.inCloset&&state.phase==='playing'){
    // Only open settings if not chatting
    if(!state.chatOpen)openSettings();
  }
  if(e.code==='KeyT'&&mp.active&&state.phase==='playing'){
    e.preventDefault();
    openChat();
  }
});
document.addEventListener('keyup',e=>{state.keys[e.code]=false;});
canvas.addEventListener('click',()=>{
  if(state.phase==='playing'&&state.pointerLocked)tryInteract();
  if(state.phase==='playing'&&!state.pointerLocked&&!state.isMobile&&!state.chatOpen)requestPointerLock();
});
plOverlay.addEventListener('click',()=>{
  if(!state.chatOpen)requestPointerLock();
});

function openChat(){
  state.chatOpen=true;
  // Exit pointer lock so mouse is free
  if(document.pointerLockElement)document.exitPointerLock();
  // Hide the pointer lock overlay — we don't want it showing while chatting
  plOverlay.classList.add('hidden');
  const ci=$('chat-input');
  if(ci){
    showChatPanel();
    setTimeout(()=>ci.focus(),50);
  }
}

function closeChat(){
  state.chatOpen=false;
  plOverlay.classList.add('hidden');
  if(state.phase==='playing')requestPointerLock();
}

function toggleFlash(){state.flashOn=!state.flashOn;flashlight.intensity=state.flashOn?4.5:0;flStatus.textContent=state.flashOn?'ON':'OFF';}
function toggleCrouch(){state.crouching=!state.crouching;crouchIcon.classList.toggle('hidden',!state.crouching);}

// ── INTERACT ──
const _ray=new THREE.Raycaster(),_cd=new THREE.Vector3();
function tryInteract(){
  camera.getWorldDirection(_cd);_ray.set(camera.position,_cd);_ray.far=3.2;
  const ms=[];scene.traverse(o=>{if(o.isMesh)ms.push(o);});
  const hits=_ray.intersectObjects(ms);
  for(const h of hits){
    const o=h.object;
    if(o.userData.isDoor){tryDoor(o);return;}
    const cg=findUp(o,'isCloset');if(cg){enterCloset(cg);return;}
    const dr=findUp(o,'isDrawer');if(dr){openDrawer(dr);return;}
    if(o.userData.isKey){collectKey(o);return;}
    if(o.userData.isCrystal){collectCrystal(o);return;}
  }
}
function findUp(o,flag){let c=o;for(let i=0;i<6;i++){if(!c)return null;if(c.userData&&c.userData[flag])return c;c=c.parent;}return null;}

// ── DOOR INTERACTION — synced in multiplayer ──
function tryDoor(d){
  if(d.userData.open||d.userData.opening)return;
  if(d.userData.locked){if(!state.hasKey){SFX.doorLocked();showToast('🔒 Locked — find a Golden Key!');return;}state.hasKey=false;keyIcon.classList.add('hidden');showToast('🔓 Unlocked!');}
  if(mp.active&&mp.roomRef){
    mp.roomRef.child('game/vaultAdvance').set({fromVault:d.userData.vaultIdx,ts:Date.now()});
  }else{
    openDoorLocally(d);
    advanceVault(d.userData.vaultIdx);
  }
}

function openDoorLocally(d){
  if(!d||d.userData.open)return;
  d.userData.opening=true;
  d.userData.open=true;
  if(d.userData.wallBox)removeBox(d.userData.wallBox);
}

function openDrawer(dr){
  dr.userData.open=!dr.userData.open;SFX.drawerOpen();
  if(dr.userData.open&&dr.userData.hasItem&&!dr.userData.taken){
    dr.userData.taken=true;
    if(dr.userData.forceKeyItem||Math.random()<.6){state.hasKey=true;keyIcon.classList.remove('hidden');SFX.pickup();showToast('✦ Found a Golden Key in the drawer!');}
    else{state.hp=Math.min(100,state.hp+20);updateHUD();SFX.heal();showToast('✦ Found bandages (+20 HP)!');}
  }else if(dr.userData.open&&!dr.userData.hasItem){showToast('The drawer is empty.');}
  if(monsters.warden&&monsters.warden.active)addWardenNoise(4);
}
function enterCloset(cg){
  state.inCloset=true;state.phase='closet';SFX.creak();
  let ls=$('locker-screen');
  if(!ls){ls=document.createElement('div');ls.id='locker-screen';const bars=document.createElement('div');bars.id='locker-bars';for(let i=0;i<7;i++){const b=document.createElement('div');b.className='locker-bar';bars.appendChild(b);}ls.appendChild(bars);const eye=document.createElement('div');eye.className='locker-eye';eye.textContent='👁';ls.appendChild(eye);const p=document.createElement('p');p.className='locker-hint';p.textContent='Hold still... Press E or ESC to exit';ls.appendChild(p);document.body.appendChild(ls);}
  ls.style.display='flex';
}
function exitCloset(){state.inCloset=false;state.phase='playing';const ls=$('locker-screen');if(ls)ls.style.display='none';wardenAlert.classList.remove('active');}
function collectKey(o){o.visible=false;SFX.pickup();state.hasKey=true;keyIcon.classList.remove('hidden');showToast('✦ Golden Key collected!');}
function collectCrystal(o){o.visible=false;SFX.heal();state.hp=Math.min(100,state.hp+40);updateHUD();showToast('✦ Healing Crystal +40 HP');}

// ── MOVEMENT ──
const _fwd=new THREE.Vector3(),_rgt=new THREE.Vector3(),_eul=new THREE.Euler(0,0,0,'YXZ');
let stepTimer=0;
function updateMovement(dt){
  if(state.phase!=='playing')return;
  if(monsters.twist&&monsters.twist.frozen)return;
  const spr=(state.keys['ShiftLeft']||state.keys['ShiftRight']||state.mobileSprint)&&state.sprint>0&&!state.crouching;
  const spd=state.crouching?CFG.PLAYER_CROUCH_SPEED:(spr?CFG.PLAYER_SPRINT:CFG.PLAYER_SPEED);
  if(spr)state.sprint=Math.max(0,state.sprint-CFG.SPRINT_DRAIN*dt);
  else state.sprint=Math.min(CFG.SPRINT_MAX,state.sprint+CFG.SPRINT_REGEN*dt);
  _eul.set(0,state.yaw,0);_fwd.set(0,0,-1).applyEuler(_eul);_fwd.y=0;_fwd.normalize();_rgt.set(1,0,0).applyEuler(_eul);_rgt.y=0;_rgt.normalize();
  let mx=0,mz=0;
  if(state.keys['KeyW']||state.keys['ArrowUp']){mx+=_fwd.x;mz+=_fwd.z;}
  if(state.keys['KeyS']||state.keys['ArrowDown']){mx-=_fwd.x;mz-=_fwd.z;}
  if(state.keys['KeyA']||state.keys['ArrowLeft']){mx-=_rgt.x;mz-=_rgt.z;}
  if(state.keys['KeyD']||state.keys['ArrowRight']){mx+=_rgt.x;mz+=_rgt.z;}
  if(state.isMobile){mx+=_fwd.x*(-state.joystick.dy)+_rgt.x*state.joystick.dx;mz+=_fwd.z*(-state.joystick.dy)+_rgt.z*state.joystick.dx;}
  const len=Math.sqrt(mx*mx+mz*mz);if(len>0){mx/=len;mz/=len;}
  const nx=playerObj.position.x+mx*spd*dt,nz=playerObj.position.z+mz*spd*dt;
  const r=resolve(nx,nz);playerObj.position.x=r.x;playerObj.position.z=r.z;
  if(len>.1){
    stepTimer-=dt;
    if(stepTimer<=0){
      SFX.footstep();stepTimer=state.crouching?.6:(spr?.28:.42);
      if(monsters.warden&&monsters.warden.active)addWardenNoise(spr?7:(state.crouching?0.5:2));
    }
  }
  const tH=state.crouching?CFG.PLAYER_CROUCH_HEIGHT:CFG.PLAYER_HEIGHT;
  state.crouchY=THREE.MathUtils.lerp(state.crouchY,tH,dt*8);
  if(len>.1){const freq=spr?11:(state.crouching?5:7),amp=spr?.055:(state.crouching?.015:.03);camera.position.y=state.crouchY+Math.sin(Date.now()*.001*freq)*amp;}
  else camera.position.y=THREE.MathUtils.lerp(camera.position.y,state.crouchY,dt*8);
  sprintBar.style.width=state.sprint+'%';
  updateHints();checkItemProx();
}
function updateHints(){
  let hint=null;
  for(const room of state.roomsBuilt){const d=room.userData.door;if(d&&!d.userData.open&&playerObj.position.distanceTo(d.position)<2.8){hint=d.userData.locked?(state.hasKey?'Press <kbd>E</kbd> to unlock':'Press <kbd>E</kbd> — 🔒 Locked (need key)'):'Press <kbd>E</kbd> to open door';break;}}
  if(!hint){outer:for(const room of state.roomsBuilt){for(const child of room.children){if(child.userData.isCloset&&playerObj.position.distanceTo(child.position)<2.5){hint='Press <kbd>E</kbd> to hide in closet';break outer;}if(child.userData.isDrawerUnit&&playerObj.position.distanceTo(child.position)<1.9){hint='Press <kbd>E</kbd> to open drawer';break outer;}}}}
  if(hint){interactHint.classList.remove('hidden');interactHint.innerHTML=hint;}
  else interactHint.classList.add('hidden');
}
function checkItemProx(){state.items.forEach(it=>{if(!it.visible)return;if(playerObj.position.distanceTo(it.position)<1.3){if(it.userData.isKey)collectKey(it);if(it.userData.isCrystal)collectCrystal(it);}});}

// ── CAMERA ──
function updateCamera(){
  camera.position.x=playerObj.position.x;camera.position.z=playerObj.position.z;
  camera.rotation.order='YXZ';camera.rotation.y=state.yaw;camera.rotation.x=state.pitch;
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  flashlight.position.copy(camera.position);
  const tgt=camera.position.clone().addScaledVector(dir,8);
  flashlight.target.position.copy(tgt);
  flashlight.target.updateMatrixWorld();
}

// ── DOORS / DRAWERS ANIM ──
function updateDoors(dt){state.roomsBuilt.forEach(room=>{const d=room.userData.door;if(!d||!d.userData.opening)return;d.position.y+=dt*3.5;if(d.position.y>=d.userData.openY){d.position.y=d.userData.openY;d.userData.opening=false;}});}
function updateDrawers(dt){state.roomsBuilt.forEach(room=>{room.traverse(o=>{if(!o.userData.isDrawer)return;const tgt=o.userData.open?.26:0;o.position.z=THREE.MathUtils.lerp(o.position.z,tgt,dt*7);});});}
function updateLights(t){scene.traverse(o=>{if(o.isLight&&o.userData.flicker){o.intensity=.45+Math.abs(Math.sin(t*2.8+o.userData.phase))*.85;if(Math.random()<.003)o.intensity=.05;}});}
function updateItems(t){state.items.forEach(it=>{if(!it.visible)return;it.rotation.y+=(it.userData.rotSpeed||1)*.016;it.position.y=.65+Math.sin(t*2+(it.userData.bobOffset||0))*.1;});}

// ── MONSTER ANIMATIONS ──
function animateWarden(dt,t){
  const w=monsters.warden;if(!w||!w.active)return;
  if(w.armL)w.armL.rotation.x=Math.sin(t*5)*.45;
  if(w.armR)w.armR.rotation.x=-Math.sin(t*5)*.45;
  if(w.headGroup)w.headGroup.rotation.x=Math.sin(t*3)*.05;
  if(w.gw)w.gw.intensity=1.6+Math.sin(t*8)*.5;
}
function animateSurge(dt,t){
  const s=monsters.surge;if(!s||!s.active)return;
  if(s.pw)s.pw.intensity=2+Math.sin(t*15)*.8;
  if(s.co1)s.co1.scale.setScalar(.9+Math.sin(t*12)*.2);
  if(s.co2)s.co2.scale.setScalar(.9+Math.sin(t*12+1)*.2);
  if(s.core)s.core.scale.setScalar(1+Math.sin(t*20)*.3);
}
function animateGaze(t){
  const g=monsters.gaze;if(!g||!g.active)return;
  g.mesh.traverse(o=>{
    if(o.userData.gazeEye){
      o.scale.setScalar(.9+Math.sin(t*2+o.position.x*3)*.15);
      if(Math.random()<.003)o.scale.y=0.05;
    }
  });
}

// ── MONSTER AI ──
function addWardenNoise(amt){const w=monsters.warden;if(!w||!w.active)return;w.noiseLevel+=amt;if(!w.alerted&&w.noiseLevel>10){w.alerted=true;w.lastKnownPos.copy(playerObj.position);wardenAlert.classList.add('active');}}
const _wtp=new THREE.Vector3();
function updateWarden(dt){
  const w=monsters.warden;if(!w||!w.active||state.phase!=='playing')return;
  const spd=CFG.WARDEN_SPEED_BASE+state.vault*.012;
  const dist=w.mesh.position.distanceTo(playerObj.position);
  w.noiseLevel=Math.max(0,w.noiseLevel-dt*2);
  if(w.noiseLevel<2&&w.alerted){w.alerted=false;wardenAlert.classList.remove('active');}
  if(w.alerted){w.lastKnownPos.copy(playerObj.position);w.heartbeatTimer-=dt;if(w.heartbeatTimer<=0){SFX.heartbeat();w.heartbeatTimer=Math.max(.3,1-(1-dist/CFG.WARDEN_SIGHT)*.7);}}
  if(state.inCloset){w.mesh.position.x+=Math.sin(Date.now()*.001)*.04;w.pacingTimer=(w.pacingTimer||0)+dt;if(w.pacingTimer>6){despawnWarden();w.pacingTimer=0;}return;}
  if(w.alerted){
    _wtp.subVectors(w.lastKnownPos,w.mesh.position);_wtp.y=0;
    const d=_wtp.length();if(d>.5){_wtp.normalize();w.mesh.position.addScaledVector(_wtp,spd*dt);}
    w.mesh.lookAt(w.lastKnownPos.x,w.mesh.position.y,w.lastKnownPos.z);
    if(dist<7)dealDamage(CFG.HP_DRAIN_RATE*dt*(1-dist/7),'aura');
    if(dist<1.0)triggerCatchByMonster('warden');
  }else{
    _wtp.subVectors(w.lastKnownPos,w.mesh.position);_wtp.y=0;
    const d=_wtp.length();if(d>.5){_wtp.normalize();w.mesh.position.addScaledVector(_wtp,spd*.5*dt);}
    else{w.giveUpTimer=(w.giveUpTimer||0)+dt;if(w.giveUpTimer>4){despawnWarden();w.giveUpTimer=0;}}
  }
  if(w.mesh.position.z>playerObj.position.z+RD*5)despawnWarden();
}
function despawnWarden(){const w=monsters.warden;if(!w)return;w.active=false;w.alerted=false;w.noiseLevel=0;w.mesh.visible=false;wardenAlert.classList.remove('active');}
function spawnWarden(){const w=monsters.warden;if(!w)return;w.active=true;w.alerted=false;w.noiseLevel=0;w.giveUpTimer=0;w.pacingTimer=0;w.lastKnownPos.copy(playerObj.position);w.mesh.position.set((Math.random()-.5)*2,0,playerObj.position.z-RD*3.5);w.mesh.visible=true;SFX.wardenRoar();}

function spawnSurge(){const s=monsters.surge;if(!s)return;s.active=true;s.dir=1;s.mesh.position.set((Math.random()-.5)*1.5,0,playerObj.position.z-RD*4);s.mesh.visible=true;playSound('surgeRoar',1.0);showToast('⚡ Something is RUSHING through!');}
function updateSurge(dt){const s=monsters.surge;if(!s||!s.active||state.phase!=='playing')return;s.mesh.position.z+=s.speed*dt;s.mesh.lookAt(s.mesh.position.x,s.mesh.position.y,s.mesh.position.z+1);const dist=s.mesh.position.distanceTo(playerObj.position);if(dist<0.9)triggerCatchByMonster('surge');if(s.mesh.position.z>playerObj.position.z+RD*5){s.active=false;s.mesh.visible=false;}}

function spawnEcho(){const e=monsters.echo;if(!e)return;e.active=true;e.bounces=0;e.maxBounces=3+Math.floor(Math.random()*4);e.dir=-1;e.startZ=playerObj.position.z+RD*3;e.endZ=playerObj.position.z-RD*2;e.mesh.position.set(0,0,e.startZ);e.mesh.visible=true;SFX.echoRoar();showToast('👁 Something AMBUSHES from ahead!');}
function updateEcho(dt){const e=monsters.echo;if(!e||!e.active||state.phase!=='playing')return;e.mesh.position.z+=e.dir*e.speed*dt;e.mesh.lookAt(e.mesh.position.x,e.mesh.position.y,e.mesh.position.z+e.dir);const dist=e.mesh.position.distanceTo(playerObj.position);if(dist<0.9)triggerCatchByMonster('echo');if(e.dir===-1&&e.mesh.position.z<e.endZ){e.dir=1;e.bounces++;SFX.echoRoar();}if(e.dir===1&&e.mesh.position.z>e.startZ){e.dir=-1;e.bounces++;SFX.echoRoar();}if(e.bounces>=e.maxBounces){e.active=false;e.mesh.visible=false;}}

function spawnGaze(){const g=monsters.gaze;if(!g)return;g.active=true;g.damageTimer=0;const side=Math.random()<.5?-RW/2+.5:RW/2-.5;g.mesh.position.set(side,1.2,playerObj.position.z+RD*1.5);g.mesh.visible=true;gazeAudio=SFX.gazeStart();showToast('👀 Something watches from the dark...');}
function updateGaze(dt){
  const g=monsters.gaze;if(!g||!g.active||state.phase!=='playing')return;
  const dist=g.mesh.position.distanceTo(playerObj.position);
  if(gazeAudio){const vol=Math.max(0,Math.min(1,1-(dist/18)));gazeAudio.volume=vol;if(vol<.01&&dist>16){g.active=false;g.mesh.visible=false;stopSound(gazeAudio);gazeAudio=null;return;}}
  if(g.pw)g.pw.intensity=Math.max(0,1.5*(1-dist/16))+Math.sin(Date.now()*.003)*.3;
  animateGaze(clock.elapsedTime);
  if(dist<10){
    const toGaze=new THREE.Vector3().subVectors(g.mesh.position,camera.position).normalize();
    const camDir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    const dot=toGaze.dot(camDir);
    if(dot>.85){g.damageTimer+=dt;if(g.damageTimer>.3){dealDamage(25*dt,'gaze');flashDmg();}}else{g.damageTimer=0;}
  }
}

function spawnTwist(){const t=monsters.twist;if(!t)return;t.active=true;t.frozen=false;t.freezeTimer=0;t.teleTimer=3;t.mesh.position.set((Math.random()-.5)*RW*.6,0,playerObj.position.z+RD*2);t.mesh.visible=true;SFX.twistSound();showToast('🌀 Something is WATCHING. Hold still...');}
function updateTwist(dt){
  const t=monsters.twist;if(!t||!t.active||state.phase!=='playing')return;
  t.teleTimer-=dt;
  if(t.teleTimer<=0){t.mesh.position.set((Math.random()-.5)*RW*.7,0,playerObj.position.z+(Math.random()*RD*3-RD));SFX.twistSound();t.teleTimer=2.5+Math.random()*3;}
  t.mesh.lookAt(playerObj.position.x,t.mesh.position.y,playerObj.position.z);
  if(t.pw)t.pw.intensity=1.5+Math.sin(Date.now()*.005)*.5;
  const dist=t.mesh.position.distanceTo(playerObj.position);
  const toPlayer=new THREE.Vector3().subVectors(playerObj.position,t.mesh.position).normalize();
  const twistFwd=new THREE.Vector3(0,0,-1).applyQuaternion(t.mesh.quaternion);
  const sees=dist<14&&twistFwd.dot(toPlayer)>.5;
  const moving=(state.keys['KeyW']||state.keys['KeyS']||state.keys['KeyA']||state.keys['KeyD']||state.keys['ArrowUp']||state.keys['ArrowDown']||state.keys['ArrowLeft']||state.keys['ArrowRight']||(Math.abs(state.joystick.dx)>.1||Math.abs(state.joystick.dy)>.1));
  if(sees&&moving&&!t.frozen){t.frozen=true;t.freezeTimer=1.8;showToast('❌ FROZEN — stop moving!');dealDamage(15,'twist');flashDmg();}
  if(t.frozen){t.freezeTimer-=dt;if(t.freezeTimer<=0)t.frozen=false;}
  if(playerObj.position.z>t.mesh.position.z+RD*6){t.active=false;t.mesh.visible=false;}
}

function roarThenJumpscare(roarKey,cb){if(roarKey)playSound(roarKey,1.0);setTimeout(()=>{if(SETTINGS.jumpscares)SFX.jumpscare();doJumpscare(cb);},500);}
function triggerCatchByMonster(type){
  if(state.phase==='dead')return;
  if(type==='warden')roarThenJumpscare('wardenRoar',()=>{state.hp=0;updateHUD();triggerDeath();});
  else if(type==='surge')roarThenJumpscare('surgeRoar',()=>{state.hp=0;updateHUD();triggerDeath();});
  else if(type==='echo')roarThenJumpscare('echoRoar',()=>{state.hp=0;updateHUD();triggerDeath();});
  else{if(SETTINGS.jumpscares)doJumpscare(()=>{state.hp=0;updateHUD();triggerDeath();});else{state.hp=0;updateHUD();triggerDeath();}}
}
function doJumpscare(cb){
  if(!SETTINGS.jumpscares){cb();return;}
  const el=$('jumpscare'),cv=$('jumpscare-canvas');
  el.classList.remove('hidden');
  cv.width=window.innerWidth;cv.height=window.innerHeight;
  drawFace(cv.getContext('2d'),cv.width,cv.height);
  let sc=0;const si=setInterval(()=>{document.body.style.transform=`translate(${(Math.random()-.5)*18}px,${(Math.random()-.5)*18}px)`;if(++sc>16){clearInterval(si);document.body.style.transform='';}},40);
  setTimeout(()=>{el.classList.add('hidden');cb();},1200);
}
function drawFace(ctx,w,h){ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.save();ctx.translate(w/2,h/2);const r=Math.min(w,h)*.4;ctx.beginPath();ctx.ellipse(0,0,r*.75,r,0,0,Math.PI*2);ctx.fillStyle='#0a0a0a';ctx.fill();ctx.strokeStyle='#cc0000';ctx.lineWidth=3;ctx.stroke();[-r*.28,r*.28].forEach(ex=>{ctx.beginPath();ctx.ellipse(ex,-r*.15,r*.2,r*.25,0,0,Math.PI*2);ctx.fillStyle='#cc0000';ctx.fill();ctx.beginPath();ctx.ellipse(ex,-r*.15,r*.07,r*.09,0,0,Math.PI*2);ctx.fillStyle='#000';ctx.fill();ctx.shadowColor='#ff0000';ctx.shadowBlur=30;ctx.beginPath();ctx.ellipse(ex,-r*.15,r*.04,r*.05,0,0,Math.PI*2);ctx.fillStyle='#ff4400';ctx.fill();ctx.shadowBlur=0;});ctx.beginPath();ctx.moveTo(-r*.42,r*.25);ctx.bezierCurveTo(-r*.3,r*.55,r*.3,r*.55,r*.42,r*.25);ctx.bezierCurveTo(r*.52,r*.62,-r*.52,r*.62,-r*.42,r*.25);ctx.fillStyle='#1a0000';ctx.fill();ctx.strokeStyle='#550000';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#ddd';for(let i=-3;i<=3;i++){ctx.fillRect(i*r*.1-r*.04,r*.28,r*.08,r*.14);}ctx.strokeStyle='#330000';ctx.lineWidth=1.5;for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*r*.9,Math.sin(a)*r*.9);ctx.stroke();}ctx.restore();const grd=ctx.createRadialGradient(w/2,h/2,r*.3,w/2,h/2,Math.max(w,h)*.7);grd.addColorStop(0,'rgba(180,0,0,0)');grd.addColorStop(1,'rgba(180,0,0,.85)');ctx.fillStyle=grd;ctx.fillRect(0,0,w,h);}

// ── DAMAGE / DEATH / WIN ──
function dealDamage(amt,src){if(state.phase==='dead'||state.inCloset)return;state.hp=Math.max(0,state.hp-amt);updateHUD();if(amt>3)flashDmg();if(state.hp<=0)triggerDeath();}
function flashDmg(){const el=document.createElement('div');el.className='damage-flash';document.body.appendChild(el);setTimeout(()=>el.remove(),450);}
function triggerDeath(){
  state.phase='dead';
  Object.values(monsters).forEach(m=>{if(m){m.active=false;m.mesh.visible=false;}});
  if(gazeAudio){stopSound(gazeAudio);gazeAudio=null;}
  wardenAlert.classList.remove('active');
  document.exitPointerLock();
  if(mp.active&&mp.playerRef)mp.playerRef.update({alive:false,hp:0});
  setTimeout(()=>{canvas.style.display='none';hudEl.classList.add('hidden');deathEl.classList.remove('hidden');$('death-vault').textContent=`Fell on Vault ${state.vault+1}`;},900);
}
function triggerWin(){state.phase='win';document.exitPointerLock();if(mp.active&&mp.playerRef)mp.playerRef.update({vault:CFG.VAULTS_TOTAL,alive:true});setTimeout(()=>{canvas.style.display='none';hudEl.classList.add('hidden');winEl.classList.remove('hidden');},500);}
function updateHUD(){healthBar.style.setProperty('--hp',Math.max(0,state.hp)+'%');healthTxt.textContent=Math.round(Math.max(0,state.hp));vaultNum.textContent=String(state.vault+1).padStart(3,'0');}
let toastTO=null;
function showToast(msg){let el=$('item-pickup');if(el)el.remove();el=document.createElement('div');el.id='item-pickup';el.innerHTML=msg;document.body.appendChild(el);clearTimeout(toastTO);toastTO=setTimeout(()=>el&&el.remove(),2600);}

// ══════════════════════════════════════════════════
// ── MULTIPLAYER / FIREBASE ──
// ══════════════════════════════════════════════════
function initFirebase(){
  if(mp.db)return;
  try{
    firebase.initializeApp(firebaseConfig);
    mp.db=firebase.database();
  }catch(e){console.error('Firebase init failed:',e);}
}

function genRoomCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='';
  for(let i=0;i<4;i++)code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}

function createRoom(){
  initFirebase();
  if(!mp.db){alert('Multiplayer unavailable — check your connection.');return;}
  const code=genRoomCode();
  try{
    const roomRef=mp.db.ref('rooms/'+code);
    mp.playerId='P'+Date.now();
    mp.roomCode=code;
    mp.roomRef=roomRef;
    mp.isHost=true;
    mp.playerRef=roomRef.child('players/'+mp.playerId);
    mp.playerRef.set({username:SETTINGS.username,x:0,z:2,yaw:0,vault:0,hp:100,alive:true,isHost:true,ts:Date.now(),skin:JSON.stringify(SKINS)});
    mp.playerRef.onDisconnect().remove();
    roomRef.child('game/state').set('lobby');
    roomRef.child('game/hostId').set(mp.playerId);
    setupRoomListeners();
    mp.active=true;
    $('mp-status').textContent='Room: '+code+' | Players: 1';
    showMPLobby(code);
  }catch(e){
    console.error('Room creation failed:',e);
    alert('Failed to create room: '+e.message);
  }
}

function joinRoom(code){
  initFirebase();
  if(!mp.db){alert('Multiplayer unavailable — check your connection.');return;}
  code=code.toUpperCase().trim();
  try{
    const roomRef=mp.db.ref('rooms/'+code);
    mp.playerId='P'+Date.now();
    mp.roomCode=code;
    mp.roomRef=roomRef;
    mp.isHost=false;
    mp.playerRef=roomRef.child('players/'+mp.playerId);
    mp.playerRef.set({username:SETTINGS.username,x:0,z:2,yaw:0,vault:0,hp:100,alive:true,isHost:false,ts:Date.now(),skin:JSON.stringify(SKINS)});
    mp.playerRef.onDisconnect().remove();
    setupRoomListeners();
    mp.active=true;
    $('mp-status').textContent='Room: '+code;
    showMPLobby(code);
  }catch(e){
    console.error('Join room failed:',e);
    alert('Failed to join room: '+e.message);
  }
}

function setupRoomListeners(){
  const playersRef=mp.roomRef.child('players');
  playersRef.on('value',snap=>{
    const data=snap.val()||{};
    mp.players=data;
    updateRemotePlayers(data);
    const count=Object.keys(data).length;
    if($('mp-status'))$('mp-status').textContent='Room: '+mp.roomCode+' | Players: '+count;
    if(!$('mp-lobby').classList.contains('hidden')){
      updateLobbyPlayerList(data);
    }
  });

  mp.roomRef.child('game').on('value',snap=>{
    const g=snap.val();
    if(!g)return;
    if(g.state==='playing'&&state.phase==='menu'){
      $('mp-lobby').classList.add('hidden');
      $('mp-status').classList.remove('hidden');
      startGame();
    }
    if(g.vaultAdvance){
      const va=g.vaultAdvance;
      if(va.fromVault!==undefined&&state.phase==='playing'){
        for(const room of state.roomsBuilt){
          const d=room.userData.door;
          if(d&&d.userData.vaultIdx===va.fromVault&&!d.userData.open){
            openDoorLocally(d);
            advanceVault(va.fromVault);
            break;
          }
        }
      }
    }
  });

  mp.chatRef=mp.roomRef.child('chat');
  mp.chatRef.limitToLast(50).on('child_added',snap=>{
    const msg=snap.val();
    appendChatMessage(msg.username,msg.text,msg.ts);
  });

  showChatPanel();
}

// ── LOBBY PLAYER LIST ──
function updateLobbyPlayerList(players){
  const container=$('mp-lobby-players');
  if(!container)return;
  container.innerHTML='';
  const entries=Object.entries(players);
  const count=entries.length;
  const waitMsg=$('mp-lobby-waiting-msg');
  const startBtn=$('btn-lobby-start');
  const hostHint=$('mp-lobby-host-hint');
  if(count<2){if(waitMsg)waitMsg.textContent='2 OR MORE PLAYERS NEEDED TO START';}
  else{if(waitMsg)waitMsg.textContent=count+' PLAYERS READY';}
  if(mp.isHost){if(startBtn)startBtn.classList.toggle('hidden',count<2);if(hostHint)hostHint.classList.add('hidden');}
  else{if(startBtn)startBtn.classList.add('hidden');if(hostHint)hostHint.classList.remove('hidden');}
  entries.forEach(([id,p])=>{
    const row=document.createElement('div');
    row.className='lobby-player-row'+(p.isHost?' is-host':'');
    const name=document.createElement('span');
    name.className='lobby-player-name';
    name.textContent=p.username||'???';
    row.appendChild(name);
    if(p.isHost){const b=document.createElement('span');b.className='lobby-player-badge host';b.textContent='HOST';row.appendChild(b);}
    if(id===mp.playerId){const b=document.createElement('span');b.className='lobby-player-badge you';b.textContent='YOU';row.appendChild(b);}
    container.appendChild(row);
  });
}

function updateRemotePlayers(data){
  if(!scene)return;
  const activeIds=new Set(Object.keys(data));
  for(const id in remotePlayerMeshes){
    if(!activeIds.has(id)||id===mp.playerId){
      scene.remove(remotePlayerMeshes[id]);
      delete remotePlayerMeshes[id];
    }
  }
  for(const id in data){
    if(id===mp.playerId)continue;
    const p=data[id];
    // Parse remote player skin
    let remoteSkin=null;
    try{if(p.skin)remoteSkin=JSON.parse(p.skin);}catch(e){}
    if(!remotePlayerMeshes[id]){
      const mesh=buildPlayerModel(p.username||'???',remoteSkin);
      scene.add(mesh);
      remotePlayerMeshes[id]=mesh;
    }else{
      // Update skin if changed
      const existingSkin=remotePlayerMeshes[id].userData.skinData;
      if(remoteSkin&&JSON.stringify(remoteSkin)!==JSON.stringify(existingSkin)){
        scene.remove(remotePlayerMeshes[id]);
        const mesh=buildPlayerModel(p.username||'???',remoteSkin);
        scene.add(mesh);
        remotePlayerMeshes[id]=mesh;
      }
    }
    const mesh=remotePlayerMeshes[id];
    mesh.position.set(p.x||0,0,p.z||2);
    // Face direction: camera -Z is forward, model +Z is face forward → rotation.y = yaw + PI
    mesh.rotation.y=(p.yaw||0)+Math.PI;
    mesh.visible=p.alive!==false;
    if(mesh.userData.label&&camera){
      mesh.userData.label.quaternion.copy(camera.quaternion);
    }
  }
}

function sendMPUpdate(){
  if(!mp.active||!mp.playerRef||state.phase==='menu')return;
  mp.playerRef.update({x:parseFloat(playerObj.position.x.toFixed(2)),z:parseFloat(playerObj.position.z.toFixed(2)),yaw:parseFloat(state.yaw.toFixed(3)),vault:state.vault,hp:Math.round(state.hp),alive:state.phase!=='dead',ts:Date.now()});
}

function sendChat(text){
  if(!mp.active||!mp.chatRef||!text.trim())return;
  mp.chatRef.push({username:SETTINGS.username,text:text.trim().slice(0,120),ts:Date.now()});
}

function appendChatMessage(username,text,ts){
  const log=$('chat-log');if(!log)return;
  const el=document.createElement('div');el.className='chat-msg';
  const isMine=username===SETTINGS.username;
  el.innerHTML=`<span class="chat-name${isMine?' chat-name-me':''}">${escapeHtml(username)}</span><span class="chat-text">${escapeHtml(text)}</span>`;
  log.appendChild(el);
  while(log.children.length>40)log.removeChild(log.firstChild);
  log.scrollTop=log.scrollHeight;
}
function escapeHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function showMPLobby(code){
  $('mp-lobby').classList.remove('hidden');
  $('mp-lobby-code').textContent=code;
  updateLobbyPlayerList(mp.players);
}

// ── REMOTE PLAYER LABEL BILLBOARDING ──
function updateRemoteLabels(){
  if(!camera)return;
  for(const id in remotePlayerMeshes){
    const mesh=remotePlayerMeshes[id];
    if(mesh.userData.label)mesh.userData.label.quaternion.copy(camera.quaternion);
  }
}

// ── MOBILE ──
function detectMobile(){
  const fv=SETTINGS.mobileForce;let auto=false;
  if(fv===true)auto=true;else if(fv===false)auto=false;
  else{const hasTouch='ontouchstart' in window||navigator.maxTouchPoints>0;const hasFinePointer=window.matchMedia('(pointer:fine)').matches;auto=hasTouch&&!hasFinePointer;}
  state.isMobile=auto;mobileControls.classList.toggle('hidden',!state.isMobile);
  if(state.isMobile)setupMobile();
}
function setupMobile(){
  const zone=$('joystick-zone'),base=$('joystick-base'),thumb=$('joystick-thumb');
  let jId=-1,jOx=0,jOy=0;const MAX=45;
  zone.addEventListener('touchstart',e=>{e.preventDefault();const t=e.changedTouches[0];jId=t.identifier;jOx=t.clientX;jOy=t.clientY;},{passive:false});
  document.addEventListener('touchmove',e=>{for(const t of e.changedTouches){if(t.identifier!==jId)continue;const dx=t.clientX-jOx,dy=t.clientY-jOy,dist=Math.sqrt(dx*dx+dy*dy),cl=Math.min(dist,MAX),nx=dist>0?(dx/dist)*cl:0,ny=dist>0?(dy/dist)*cl:0;thumb.style.transform=`translate(calc(-50% + ${nx}px),calc(-50% + ${ny}px))`;state.joystick.dx=nx/MAX;state.joystick.dy=ny/MAX;}},{passive:false});
  document.addEventListener('touchend',e=>{for(const t of e.changedTouches){if(t.identifier===jId){jId=-1;state.joystick.dx=0;state.joystick.dy=0;thumb.style.transform='translate(-50%,-50%)';}}});
  const lz=$('look-zone');let lId=-1,lx=0,ly=0;const LS=.004*SETTINGS.sensMult;
  lz.addEventListener('touchstart',e=>{e.preventDefault();const t=e.changedTouches[0];lId=t.identifier;lx=t.clientX;ly=t.clientY;},{passive:false});
  document.addEventListener('touchmove',e=>{for(const t of e.changedTouches){if(t.identifier!==lId)continue;const dx=t.clientX-lx,dy=t.clientY-ly;state.yaw-=dx*LS;state.pitch-=dy*LS;state.pitch=Math.max(-1.1,Math.min(1.1,state.pitch));lx=t.clientX;ly=t.clientY;}},{passive:false});
  document.addEventListener('touchend',e=>{for(const t of e.changedTouches){if(t.identifier===lId)lId=-1;}});
  $('mb-interact').addEventListener('touchstart',e=>{e.preventDefault();tryInteract();});
  $('mb-flash').addEventListener('touchstart',e=>{e.preventDefault();toggleFlash();});
  $('mb-crouch').addEventListener('touchstart',e=>{e.preventDefault();toggleCrouch();});
  $('mb-sprint').addEventListener('touchstart',e=>{e.preventDefault();state.mobileSprint=true;});
  $('mb-sprint').addEventListener('touchend',e=>{e.preventDefault();state.mobileSprint=false;});
}

// ── SETTINGS ──
function openSettings(){$('settings-panel').classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock();}
function closeSettings(){$('settings-panel').classList.add('hidden');if(state.phase==='playing')requestPointerLock();}
$('btn-settings-menu').addEventListener('click',openSettings);
$('btn-settings-hud').addEventListener('click',openSettings);
$('btn-close-settings').addEventListener('click',closeSettings);
document.querySelectorAll('.q-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.q-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');SETTINGS.quality=btn.dataset.q;applyQuality();}));
const soundBtn=$('toggle-sound');soundBtn.addEventListener('click',()=>{SETTINGS.sound=!SETTINGS.sound;soundBtn.textContent=SETTINGS.sound?'ON':'OFF';soundBtn.classList.toggle('on',SETTINGS.sound);});
const jsBtn=$('toggle-jumpscares');jsBtn.addEventListener('click',()=>{SETTINGS.jumpscares=!SETTINGS.jumpscares;jsBtn.textContent=SETTINGS.jumpscares?'ON':'OFF';jsBtn.classList.toggle('on',SETTINGS.jumpscares);});
const sl=$('sens-slider'),sv=$('sens-val');sl.addEventListener('input',()=>{SETTINGS.sensMult=parseFloat(sl.value);sv.textContent=SETTINGS.sensMult.toFixed(1)+'×';});
const mobBtn=$('toggle-mobile-btn');mobBtn.addEventListener('click',()=>{if(SETTINGS.mobileForce===null){SETTINGS.mobileForce=true;mobBtn.textContent='ALWAYS ON';}else if(SETTINGS.mobileForce===true){SETTINGS.mobileForce=false;mobBtn.textContent='ALWAYS OFF';}else{SETTINGS.mobileForce=null;mobBtn.textContent='AUTO';}});
const unInput=$('username-input');
if(unInput){
  unInput.value=SETTINGS.username;
  unInput.addEventListener('input',()=>{const v=unInput.value.trim();if(v.length>0&&v.length<=20)SETTINGS.username=v;});
}

// ── MENU WIRING ──
$('btn-play').addEventListener('click',()=>{$('mode-select').classList.remove('hidden');$('menu-buttons').classList.add('hidden');});
$('btn-singleplayer').addEventListener('click',()=>{initThree();$('mode-select').classList.add('hidden');$('menu-buttons').classList.remove('hidden');startGame();});
$('btn-multiplayer').addEventListener('click',()=>{$('mode-select').classList.add('hidden');$('mp-panel').classList.remove('hidden');});
$('btn-mp-create').addEventListener('click',()=>{
  initThree();
  createRoom();
  $('mp-panel').classList.add('hidden');
});
$('btn-mp-join').addEventListener('click',()=>{
  const code=$('mp-code-input').value.trim().toUpperCase();
  if(code.length!==4){alert('Enter a 4-character room code');return;}
  initThree();
  joinRoom(code);
  $('mp-panel').classList.add('hidden');
});
$('btn-mp-back').addEventListener('click',()=>{$('mp-panel').classList.add('hidden');$('menu-buttons').classList.remove('hidden');});
$('btn-mode-back').addEventListener('click',()=>{$('mode-select').classList.add('hidden');$('menu-buttons').classList.remove('hidden');});
$('btn-how').addEventListener('click',()=>$('how-to-play').classList.toggle('hidden'));

// HOST START BUTTON
$('btn-lobby-start').addEventListener('click',()=>{
  if(!mp.isHost)return;
  const count=Object.keys(mp.players).length;
  if(count<2){showToast('Need at least 2 players to start!');return;}
  mp.roomRef.child('game/state').set('playing');
  $('mp-lobby').classList.add('hidden');
  $('mp-status').classList.remove('hidden');
  startGame();
});

$('btn-retry').addEventListener('click',()=>{deathEl.classList.add('hidden');canvas.style.display='block';hudEl.classList.remove('hidden');startGame();});
$('btn-menu-death').addEventListener('click',()=>{
  if(mp.active&&mp.playerRef){mp.playerRef.remove();mp.active=false;mp.isHost=false;}
  deathEl.classList.add('hidden');menuEl.classList.remove('hidden');
  $('menu-buttons').classList.remove('hidden');$('mode-select').classList.add('hidden');state.phase='menu';
});
$('btn-play-again').addEventListener('click',()=>{winEl.classList.add('hidden');canvas.style.display='block';hudEl.classList.remove('hidden');startGame();});

// Chat input — fixed T key behavior
const chatInput=$('chat-input');
if(chatInput){
  chatInput.addEventListener('keydown',e=>{
    if(e.code==='Enter'){
      e.preventDefault();
      sendChat(chatInput.value);
      chatInput.value='';
      chatInput.blur();
      closeChat();
    }
    if(e.code==='Escape'){
      e.preventDefault();
      chatInput.blur();
      closeChat();
    }
    e.stopPropagation();
  });
  chatInput.addEventListener('keyup',e=>e.stopPropagation());
  chatInput.addEventListener('focus',()=>{
    state.chatOpen=true;
    if(document.pointerLockElement)document.exitPointerLock();
    plOverlay.classList.add('hidden');
  });
  chatInput.addEventListener('blur',()=>{
    // Delay so closeChat() can run first
    setTimeout(()=>{
      if(state.chatOpen){state.chatOpen=false;}
    },100);
  });
}

document.addEventListener('contextmenu',e=>e.preventDefault());

// Add Customize button to settings panel
(function addCustomizeBtn(){
  const si=$('settings-inner');
  if(!si)return;
  const btn=document.createElement('button');
  btn.id='btn-open-skin';
  btn.className='menu-btn';
  btn.style.marginTop='12px';
  btn.textContent='🎨 CUSTOMIZE SKIN';
  btn.addEventListener('click',()=>{
    closeSettings();
    openSkinEditor();
  });
  // Insert before close button
  const closeBtn=$('btn-close-settings');
  si.insertBefore(btn,closeBtn);
})();

// ── MAIN LOOP ──
let mpUpdateTimer=0;
function loop(){
  requestAnimationFrame(loop);
  if(state.phase!=='playing'&&state.phase!=='closet')return;
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  updateMovement(dt);
  updateCamera();
  updateDoors(dt);
  updateDrawers(dt);
  updateWarden(dt);animateWarden(dt,t);
  updateSurge(dt);animateSurge(dt,t);
  updateEcho(dt);
  updateGaze(dt);
  updateTwist(dt);
  updateLights(t);
  updateItems(t);
  updateRemoteLabels();
  mpUpdateTimer+=dt;
  if(mpUpdateTimer>0.1){mpUpdateTimer=0;sendMPUpdate();}
  renderer.render(scene,camera);
}