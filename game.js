'use strict';

// ── CONFIG ──
const SETTINGS={quality:'medium',sound:true,jumpscares:true,sensMult:1.0,mobileForce:null,username:'Player'+Math.floor(Math.random()*9000+1000)};
const QUALITY={low:{px:.6,fog:.14,shadows:false,rooms:3},medium:{px:1.0,fog:.09,shadows:false,rooms:5},high:{px:1.5,fog:.07,shadows:true,rooms:7}};
const CFG={VAULTS_TOTAL:100,ROOM_W:8,ROOM_H:4,ROOM_D:14,PLAYER_SPEED:4.5,PLAYER_SPRINT:8.5,PLAYER_CROUCH_SPEED:2.5,PLAYER_HEIGHT:1.65,PLAYER_CROUCH_HEIGHT:0.95,PLAYER_RADIUS:0.32,SPRINT_MAX:100,SPRINT_DRAIN:22,SPRINT_REGEN:9,FOV:75,MOUSE_SENS_BASE:.0022,WARDEN_SPEED_BASE:3.4,WARDEN_SIGHT:20,HP_DRAIN_RATE:30};

// ── SEEDED RNG (Mulberry32) ──
let _rngState=12345;
function seedRng(seed){_rngState=(seed>>>0)||1;}
function rng(){_rngState|=0;_rngState=_rngState+0x6D2B79F5|0;let z=Math.imul(_rngState^(_rngState>>>15),1|_rngState);z^=z+Math.imul(z^(z>>>7),61|z);return((z^(z>>>14))>>>0)/4294967296;}
let WORLD_SEED=0;

// ── SKIN SYSTEM ──
const SKINS={bodyColor:'#2a4a6a',jacketColor:'#1a3a5a',hatType:'none',hatColor:'#8b0000'};
const HATS={none:{label:'None'},cap:{label:'Baseball Cap'},tophat:{label:'Top Hat'},crown:{label:'Crown'},beanie:{label:'Beanie'},cowboy:{label:'Cowboy Hat'}};

// ── DANCE EMOTES ──
const DANCE_EMOTES={dance1:{name:'ROBOT',duration:4.0},dance2:{name:'SPIN',duration:3.0},dance3:{name:'FLOSS',duration:5.0}};
const localAnim=createAnimState();

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
let state={phase:'menu',vault:0,hp:100,flashOn:true,sprint:100,crouching:false,inCloset:false,wardenActive:false,wardenAlerted:false,keys:{},yaw:0,pitch:0,pointerLocked:false,roomsBuilt:[],items:[],hasKey:false,loopStarted:false,isMobile:false,joystick:{dx:0,dy:0},mobileSprint:false,crouchY:CFG.PLAYER_HEIGHT,chatOpen:false,closetTimer:0,chaseActive:false,chaseTimer:0,chaseObstacles:[],lurk:null,invertControls:false,invertTimer:0,gazePulling:false,gazePullStrength:0};
let collisionBoxes=[];
let renderer,scene,camera,clock,flashlight,ambientLight,playerObj,threeInited=false;
let monsters={warden:null,surge:null,echo:null,gaze:null,twist:null,push:null,lurk:null};
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
  pushBody:new THREE.MeshLambertMaterial({color:0x1a0030,emissive:0x0d001a}),
  pushEye:new THREE.MeshBasicMaterial({color:0xff00ff}),
  pushSpike:new THREE.MeshLambertMaterial({color:0x3d0060,emissive:0x1a0030}),
  lurkBody:new THREE.MeshLambertMaterial({color:0x020508,emissive:0x010204}),
  lurkEye:new THREE.MeshBasicMaterial({color:0xff4400}),
  lurkTendon:new THREE.MeshBasicMaterial({color:0x330800,transparent:true,opacity:.7}),
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

function aType(i){
  if(i===0)return'normal';
  const r=rng();
  if(r<.09)return'trap';
  if(r<.20)return'closet';
  if(r<.28)return'key_room';
  if(r<.35)return'crystal_room';
  if(r<.40)return'dark';
  return'normal';
}

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
  const wantLock=idx>0&&rng()<.28;
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
  const pl=new THREE.PointLight(col,1.8,18);
  pl.position.set(0,RH-.25,z);
  pl.userData.flicker=true;
  pl.userData.phase=rng()*Math.PI*2;
  grp.add(pl);
}

function addFeatures(grp,z,idx,type,wantLock,door){
  let forceKey=false;
  if(wantLock&&!keyIsAvailable()){door.userData.locked=true;forceKey=true;const lockLight=new THREE.PointLight(0xff2200,.6,3);lockLight.position.set(0,DH*.6,z+RD/2-.2);grp.add(lockLight);}
  const hasDrawer=rng()<.7||forceKey;
  if(hasDrawer){const sx=rng()<.5?-1:1;addDrawerUnit(grp,sx*(RW/2-.55),z-RD/4,forceKey);}
  if(forceKey&&!hasDrawer){const k=mkKey((rng()-.5)*3,z-2);grp.add(k);state.items.push(k);const gl=new THREE.PointLight(0xffd700,2,5);gl.position.set(0,1,z-2);grp.add(gl);}
  const mpPlayers=Object.keys(mp.players||{}).length;
  const minClosets=mpPlayers>=2?(rng()<.5?2:3):1;
  const extraCloset=type==='closet'||(idx>2&&rng()<.45);
  const closetCount=extraCloset?Math.max(minClosets,2):minClosets;
  const closetSides=[-1,1,-.7,.7];
  for(let ci=0;ci<closetCount;ci++){
    const side=closetSides[ci%2]*(RW/2-.75);
    const zOff=-1.5-ci*2.2;
    if(ci<2)addCloset(grp,side,z+zOff);
  }
  if(rng()<.28){const n=Math.floor(rng()*3)+1;for(let i=0;i<n;i++){const bx=(rng()-.5)*(RW-2.5),bz=z+(rng()-.5)*(RD-5);grp.add(mk(GEO.cyl(.28,.28,.9,7),MAT.barrel,bx,.45,bz));addBox(bx-.36,bx+.36,bz-.36,bz+.36);}}
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
    dr.userData.hasItem=(i===1)?(forceKey||rng()<.55):false;
    if(forceKey&&i===1)dr.userData.forceKeyItem=true;
    dg.add(dr,sep);
  }
  [[-W/2+.08,.08,-D/2+.07],[W/2-.08,.08,-D/2+.07],[-W/2+.08,.08,D/2-.07],[W/2-.08,.08,D/2-.07]].forEach(([lx,ly,lz])=>dg.add(mk(GEO.box(.07,.15,.07),MAT.closetFrm,lx,ly,lz)));
  dg.add(mk(GEO.box(W+.02,.04,D+.02),MAT.closetFrm,0,H+.02,0));
  dg.position.set(x,0,z);dg.rotation.y=x<0?Math.PI/2:-Math.PI/2;
  dg.userData.isDrawerUnit=true;grp.add(dg);
  addBox(x-.46,x+.46,z-.32,z+.32);
}

function mkKey(x,z){const g=new THREE.TorusGeometry(.12,.025,6,12),m=new THREE.Mesh(g,MAT.key);m.position.set(x,.7,z);m.userData.isKey=true;m.userData.rotSpeed=1.2;m.userData.bobOffset=rng()*Math.PI*2;return m;}
function mkCrystal(x,z){const g=new THREE.OctahedronGeometry(.2,0),m=new THREE.Mesh(g,MAT.crystal);m.position.set(x,.65,z);m.userData.isCrystal=true;m.userData.rotSpeed=.9;m.userData.bobOffset=rng()*Math.PI*2;return m;}
function mkDoorNum(n,z){const cv=document.createElement('canvas');cv.width=128;cv.height=64;const cx=cv.getContext('2d');cx.fillStyle='#1a0800';cx.fillRect(0,0,128,64);cx.fillStyle='#d4a017';cx.font='bold 34px monospace';cx.textAlign='center';cx.fillText(String(n).padStart(3,'0'),64,44);const m=new THREE.Mesh(new THREE.PlaneGeometry(.5,.25),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true}));m.position.set(0,DH-.32,z);return m;}

// ── SPAWN ROOM (seeded per vault) ──
function spawnRoom(i){
  if(i>=CFG.VAULTS_TOTAL)return;
  if(state.roomsBuilt.find(r=>r.userData.vaultIdx===i))return;
  seedRng(WORLD_SEED+i*1000);
  const r=buildRoom(i);
  scene.add(r);
  state.roomsBuilt.push(r);
}

// ── MONSTER BUILDERS ──
function buildPush(){
  const grp=new THREE.Group();const root=new THREE.Group();grp.add(root);
  root.add(mk(GEO.box(.9,1.1,.7),MAT.pushBody,0,.7,0));
  root.add(mk(GEO.box(.18,.36,.6),MAT.pushBody,-.58,1.1,0));
  root.add(mk(GEO.box(.18,.36,.6),MAT.pushBody,.58,1.1,0));
  const aLg=new THREE.Group();aLg.position.set(-.7,.9,0);
  aLg.add(mk(GEO.box(.2,.85,.22),MAT.pushBody,0,-.42,0));
  aLg.add(mk(GEO.box(.38,.08,.42),MAT.pushBody,0,-.9,.05));
  root.add(aLg);
  const aRg=new THREE.Group();aRg.position.set(.7,.9,0);
  aRg.add(mk(GEO.box(.2,.85,.22),MAT.pushBody,0,-.42,0));
  aRg.add(mk(GEO.box(.38,.08,.42),MAT.pushBody,0,-.9,.05));
  root.add(aRg);
  const head=new THREE.Group();head.position.set(0,1.38,0);root.add(head);
  head.add(mk(GEO.box(.58,.44,.5),MAT.pushBody,0,.22,0));
  const eye=new THREE.Mesh(GEO.sph(.14,10,10),MAT.pushEye);eye.position.set(0,.22,.26);head.add(eye);
  const pupil=new THREE.Mesh(GEO.sph(.06,8,8),MAT.gazePupil);pupil.position.set(0,.22,.38);head.add(pupil);
  const pw=new THREE.PointLight(0xff00ff,1.8,5);pw.position.set(0,.22,.35);head.add(pw);
  for(let i=0;i<5;i++){const sp=mk(GEO.cyl(.04,.0,.35,5),MAT.pushSpike,-.3+i*.15,1.5,-.36);sp.rotation.x=.4;root.add(sp);}
  root.add(mk(GEO.box(.28,.55,.32),MAT.pushBody,-.22,-.05,0));
  root.add(mk(GEO.box(.28,.55,.32),MAT.pushBody,.22,-.05,0));
  return{mesh:grp,active:false,timer:0,maxTime:7,pw,aL:aLg,aR:aRg,type:'push'};
}

function buildLurk(){
  const grp=new THREE.Group();const root=new THREE.Group();grp.add(root);
  root.add(mk(GEO.box(.38,2.2,.3),MAT.lurkBody,0,1.1,0));
  for(let i=0;i<6;i++){const rib=mk(GEO.box(.5,.04,.05),MAT.lurkTendon,0,.5+i*.25,0);rib.scale.x=.7+i*.04;root.add(rib);}
  const head=new THREE.Group();head.position.set(0,2.5,0);root.add(head);
  head.add(mk(GEO.box(.36,.7,.3),MAT.lurkBody,0,.35,0));
  const eL=mk(GEO.box(.13,.05,.04),MAT.lurkEye,-.12,.42,.16);head.add(eL);
  const eR=mk(GEO.box(.13,.05,.04),MAT.lurkEye,.12,.42,.16);head.add(eR);
  const pw=new THREE.PointLight(0xff4400,2.5,8);pw.position.set(0,.42,.2);head.add(pw);
  const armL=new THREE.Group();armL.position.set(-.26,1.8,0);armL.rotation.z=.45;
  armL.add(mk(GEO.box(.12,1.3,.14),MAT.lurkBody,0,-.65,0));
  armL.add(mk(GEO.box(.08,.9,.1),MAT.lurkBody,.04,-1.35,.04));
  for(let i=0;i<4;i++){const claw=mk(GEO.cyl(.015,.0,.28,4),MAT.lurkEye,-.06+i*.04,-1.96,.04);claw.rotation.z=-.3+i*.2;armL.add(claw);}
  root.add(armL);
  const armR=new THREE.Group();armR.position.set(.26,1.8,0);armR.rotation.z=-.45;
  armR.add(mk(GEO.box(.12,1.3,.14),MAT.lurkBody,0,-.65,0));
  armR.add(mk(GEO.box(.08,.9,.1),MAT.lurkBody,-.04,-1.35,.04));
  for(let i=0;i<4;i++){const claw=mk(GEO.cyl(.015,.0,.28,4),MAT.lurkEye,-.06+i*.04,-1.96,.04);claw.rotation.z=.3-i*.2;armR.add(claw);}
  root.add(armR);
  root.add(mk(GEO.box(.15,1.0,.18),MAT.lurkBody,-.14,-.1,0));
  root.add(mk(GEO.box(.15,1.0,.18),MAT.lurkBody,.14,-.1,0));
  return{mesh:grp,active:false,speed:6,pw,type:'lurk',chasePhase:false};
}

function buildAllMonsters(){
  monsters.warden=buildWarden();
  monsters.surge=buildSurge();
  monsters.echo=buildEcho();
  monsters.gaze=buildGaze();
  monsters.twist=buildTwist();
  monsters.push=buildPush();
  monsters.lurk=buildLurk();
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
  return{mesh:grp,active:false,dir:1,speed:16,pw,co1,co2,core,type:'surge'};
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

// ── PLAYER MODEL ──
function hexToThreeColor(hex){const n=parseInt(hex.replace('#',''),16);return new THREE.Color(n>>16&255,n>>8&255,n&255).multiplyScalar(1/255);}

function buildHatMesh(hatType,hatColor){
  const grp=new THREE.Group();
  const col=new THREE.MeshLambertMaterial({color:new THREE.Color(hatColor)});
  const colDark=new THREE.MeshLambertMaterial({color:new THREE.Color(hatColor).multiplyScalar(.6)});
  switch(hatType){
    case'cap':{
      const bill=mk(GEO.box(.28,.04,.22),col,0,.005,.13);grp.add(bill);
      const dome=new THREE.Mesh(new THREE.SphereGeometry(.185,10,8,0,Math.PI*2,0,Math.PI*.55),col);
      dome.position.set(0,0,0);grp.add(dome);
      grp.add(mk(GEO.cyl(.025,.025,.04,6),colDark,0,.18,0));
      break;}
    case'tophat':{
      grp.add(mk(GEO.cyl(.28,.28,.03,12),col,0,.01,0));
      grp.add(mk(GEO.cyl(.16,.16,.38,12),col,0,.22,0));
      grp.add(mk(GEO.cyl(.17,.17,.03,12),colDark,0,.42,0));
      grp.add(mk(GEO.cyl(.165,.165,.04,12),colDark,0,.08,0));
      break;}
    case'crown':{
      const goldMat=new THREE.MeshLambertMaterial({color:0xffd700,emissive:0x332200});
      const gemMat=new THREE.MeshBasicMaterial({color:0xff2244});
      grp.add(mk(GEO.cyl(.18,.18,.06,12),goldMat,0,.03,0));
      for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const pt=mk(GEO.box(.06,.18,.06),goldMat,Math.cos(a)*.13,.12,Math.sin(a)*.13);grp.add(pt);}
      for(let i=0;i<5;i++){const a=(i+.5)/5*Math.PI*2;const gem=new THREE.Mesh(GEO.sph(.03,6,6),gemMat);gem.position.set(Math.cos(a)*.13,.07,Math.sin(a)*.13);grp.add(gem);}
      break;}
    case'beanie':{
      const bDome=new THREE.Mesh(new THREE.SphereGeometry(.195,10,8),col);
      bDome.scale.y=.78;bDome.position.set(0,.04,0);grp.add(bDome);
      grp.add(mk(GEO.cyl(.2,.2,.06,14),colDark,0,-.02,0));
      grp.add(new THREE.Mesh(GEO.sph(.055,8,8),col));
      grp.children[grp.children.length-1].position.set(0,.19,0);
      break;}
    case'cowboy':{
      const brimGeo=new THREE.CylinderGeometry(.35,.35,.03,16);
      grp.add(new THREE.Mesh(brimGeo,col));
      grp.add(mk(GEO.cyl(.17,.17,.24,12),col,0,.14,0));
      grp.add(mk(GEO.cyl(.14,.14,.02,12),colDark,0,.27,0));
      grp.add(mk(GEO.cyl(.175,.175,.04,12),colDark,0,.06,0));
      break;}
    default:break;
  }
  return grp;
}

function buildPlayerModel(username,skinData){
  const skin=skinData||{bodyColor:SKINS.bodyColor,jacketColor:SKINS.jacketColor,hatType:SKINS.hatType,hatColor:SKINS.hatColor};
  const bodyMat=new THREE.MeshLambertMaterial({color:new THREE.Color(skin.bodyColor)});
  const jacketMat=new THREE.MeshLambertMaterial({color:new THREE.Color(skin.jacketColor)});
  const skinMat=new THREE.MeshLambertMaterial({color:0xc8a882});
  const hairMat=new THREE.MeshLambertMaterial({color:0x1a1008});
  const bootsMat=new THREE.MeshLambertMaterial({color:0x1a1008});
  const flashMat=new THREE.MeshBasicMaterial({color:0xffcc44});
  const eyeMat=new THREE.MeshBasicMaterial({color:0x111111});
  const eyeWhiteMat=new THREE.MeshLambertMaterial({color:0xfff8f0});

  const grp=new THREE.Group();

  grp.add(mk(GEO.box(.2,.14,.28),bootsMat,-.12,.07,.04));
  grp.add(mk(GEO.box(.2,.14,.28),bootsMat,.12,.07,.04));
  grp.add(mk(GEO.box(.17,.48,.19),bodyMat,-.12,.38,0));
  grp.add(mk(GEO.box(.17,.48,.19),bodyMat,.12,.38,0));
  grp.add(mk(GEO.box(.19,.43,.2),bodyMat,-.11,.84,0));
  grp.add(mk(GEO.box(.19,.43,.2),bodyMat,.11,.84,0));
  grp.add(mk(GEO.box(.38,.18,.26),jacketMat,0,1.04,0));
  grp.add(mk(GEO.box(.46,.62,.3),jacketMat,0,1.38,0));
  grp.add(mk(GEO.box(.08,.48,.32),bodyMat,0,1.38,0));
  grp.add(mk(GEO.box(.16,.12,.16),skinMat,0,1.78,0));

  const headGrp=new THREE.Group();
  headGrp.position.set(0,1.84,0);
  const skull=new THREE.Mesh(GEO.box(.38,.38,.32),skinMat);
  skull.position.set(0,.19,0);
  headGrp.add(skull);
  headGrp.add(mk(GEO.box(.34,.06,.06),skinMat,0,.36,.14));
  headGrp.add(mk(GEO.box(.4,.1,.34),hairMat,0,.4,-.01));
  headGrp.add(mk(GEO.box(.38,.3,.08),hairMat,0,.24,-.14));
  headGrp.add(mk(GEO.box(.12,.09,.04),eyeWhiteMat,-.11,.2,.15));
  headGrp.add(mk(GEO.box(.12,.09,.04),eyeWhiteMat,.11,.2,.15));
  const pupilL=new THREE.Mesh(GEO.box(.07,.06,.02),eyeMat);pupilL.position.set(-.11,.2,.18);headGrp.add(pupilL);
  const pupilR=new THREE.Mesh(GEO.box(.07,.06,.02),eyeMat);pupilR.position.set(.11,.2,.18);headGrp.add(pupilR);
  headGrp.add(mk(GEO.box(.07,.08,.07),skinMat,0,.12,.16));
  headGrp.add(mk(GEO.box(.14,.02,.02),eyeMat,0,.05,.16));
  grp.add(headGrp);

  grp.add(mk(GEO.box(.12,.14,.28),jacketMat,-.29,1.66,0));
  grp.add(mk(GEO.box(.12,.14,.28),jacketMat,.29,1.66,0));

  const armL=new THREE.Group();armL.position.set(-.34,1.55,0);
  armL.add(mk(GEO.box(.14,.42,.16),jacketMat,0,-.21,0));
  armL.rotation.z=.1;grp.add(armL);

  const armR=new THREE.Group();armR.position.set(.34,1.55,0);
  armR.add(mk(GEO.box(.14,.42,.16),jacketMat,0,-.21,0));
  armR.rotation.z=-.1;grp.add(armR);

  grp.add(mk(GEO.box(.12,.38,.14),skinMat,-.34,1.04,0));
  grp.add(mk(GEO.box(.12,.38,.14),skinMat,.34,1.04,0));
  grp.add(mk(GEO.box(.14,.16,.14),skinMat,-.34,.78,0));
  grp.add(mk(GEO.box(.14,.16,.14),skinMat,.34,.78,0));

  const flashGrp=new THREE.Group();
  flashGrp.position.set(.34,.8,.1);
  flashGrp.add(mk(GEO.cyl(.028,.028,.2,7),new THREE.MeshLambertMaterial({color:0x222222}),0,0,0));
  flashGrp.rotation.x=Math.PI/2;
  const bulb=new THREE.Mesh(GEO.sph(.04,7,7),flashMat);bulb.position.set(0,.12,0);flashGrp.add(bulb);
  grp.add(flashGrp);

  const labelCanvas=document.createElement('canvas');
  labelCanvas.width=256;labelCanvas.height=48;
  const lctx=labelCanvas.getContext('2d');
  lctx.fillStyle='rgba(0,0,0,0.78)';lctx.fillRect(4,4,248,40);
  lctx.strokeStyle='rgba(212,160,23,0.6)';lctx.lineWidth=1.5;lctx.strokeRect(4,4,248,40);
  lctx.fillStyle='#d4a017';lctx.font='bold 20px monospace';lctx.textAlign='center';
  lctx.fillText(username.slice(0,16),128,28);
  const labelTex=new THREE.CanvasTexture(labelCanvas);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.21),new THREE.MeshBasicMaterial({map:labelTex,transparent:true,depthTest:false}));
  label.position.set(0,2.28,0);
  grp.add(label);

  if(skin.hatType&&skin.hatType!=='none'){
    const hatMesh=buildHatMesh(skin.hatType,skin.hatColor);
    hatMesh.position.set(0,2.22,0);
    grp.add(hatMesh);
  }

  grp.userData.isPlayerModel=true;
  grp.userData.username=username;
  grp.userData.label=label;
  grp.userData.headGroup=headGrp;
  grp.userData.skinData=skin;
  grp.userData.armL=armL;
  grp.userData.armR=armR;
  grp.userData.headGrp=headGrp;
  return grp;
}

// ══════════════════════════════════════════════════
// ── ANIMATION SYSTEM ──
// ══════════════════════════════════════════════════
function createAnimState(){return{mode:'idle',timer:0,prevMode:'idle',blendAlpha:1,danceLoop:0};}

function applyPlayerAnimation(model,anim,dt,t,moving){
  if(!model)return;
  if(!model.userData.animTagged)tagAnimBones(model);
  const bones=model.userData.bones;
  if(!bones)return;
  const wantMode=anim.mode.startsWith('dance')?anim.mode:(moving?'walk':'idle');
  if(!anim.mode.startsWith('dance')&&wantMode!==anim.mode){anim.prevMode=anim.mode;anim.mode=wantMode;anim.blendAlpha=0;}
  anim.blendAlpha=Math.min(1,anim.blendAlpha+dt*8);
  anim.timer+=dt;
  resetPose(bones);
  const pose={};
  if(anim.mode==='idle')poseIdle(pose,t);
  else if(anim.mode==='walk')poseWalk(pose,anim.timer);
  else if(anim.mode==='dance1')poseDance1Robot(pose,anim.timer);
  else if(anim.mode==='dance2')poseDance2Spin(pose,anim.timer,model);
  else if(anim.mode==='dance3')poseDance3Floss(pose,anim.timer);
  applyPose(bones,pose,anim.blendAlpha);
  if(anim.mode.startsWith('dance')){
    const cfg=DANCE_EMOTES[anim.mode];
    if(cfg&&anim.timer>cfg.duration){
      anim.danceLoop++;
      const maxLoops=anim.mode==='dance3'?3:(anim.mode==='dance2'?2:3);
      if(anim.danceLoop>=maxLoops){anim.mode='idle';anim.timer=0;anim.danceLoop=0;}
      else anim.timer=0;
    }
  }
}

function tagAnimBones(model){
  model.userData.animTagged=true;
  const bones={};
  model.children.forEach(child=>{
    if(child.isGroup){
      const px=child.position.x,py=child.position.y,pz=child.position.z;
      if(Math.abs(py-1.84)<0.05&&Math.abs(px)<0.05)bones.head=child;
      else if(Math.abs(px+0.34)<0.05&&Math.abs(py-1.55)<0.05)bones.armL=child;
      else if(Math.abs(px-0.34)<0.05&&Math.abs(py-1.55)<0.05)bones.armR=child;
      else if(Math.abs(pz-0.1)<0.05&&px>0.3)bones.flashGrp=child;
    }
  });
  const forearms=[],lowerLegs=[],boots=[];
  model.children.forEach(child=>{
    if(!child.isMesh)return;
    const px=child.position.x,py=child.position.y;
    if(Math.abs(py-0.38)<0.06&&Math.abs(Math.abs(px)-0.12)<0.04)lowerLegs.push(child);
    if(Math.abs(py-1.04)<0.06&&Math.abs(Math.abs(px)-0.34)<0.04)forearms.push(child);
    if(Math.abs(py-0.07)<0.04)boots.push(child);
  });
  lowerLegs.sort((a,b)=>a.position.x-b.position.x);
  forearms.sort((a,b)=>a.position.x-b.position.x);
  boots.sort((a,b)=>a.position.x-b.position.x);
  bones.legL=lowerLegs[0];bones.legR=lowerLegs[1];
  bones.forearmL=forearms[0];bones.forearmR=forearms[1];
  bones.bootL=boots[0];bones.bootR=boots[1];
  model.children.forEach(child=>{
    child._bindRotX=child.rotation.x;child._bindRotY=child.rotation.y;
    child._bindRotZ=child.rotation.z;child._bindPosY=child.position.y;child._bindPosX=child.position.x;
  });
  model.userData.bones=bones;
}

function resetPose(bones){
  if(!bones)return;
  [bones.head,bones.armL,bones.armR,bones.legL,bones.legR,bones.forearmL,bones.forearmR,bones.bootL,bones.bootR,bones.flashGrp].forEach(b=>{
    if(!b)return;
    b.rotation.x=b._bindRotX||0;b.rotation.y=b._bindRotY||0;b.rotation.z=b._bindRotZ||0;
  });
}

function poseIdle(pose,t){
  pose.headRotX=Math.sin(t*0.8)*0.02;pose.headRotZ=Math.sin(t*0.6)*0.015;
  pose.armLRotZ=0.1+Math.sin(t*0.9)*0.015;pose.armRRotZ=-0.1-Math.sin(t*0.9)*0.015;
  pose.bodyBob=Math.sin(t*1.6)*0.004;
}

function poseWalk(pose,timer){
  const freq=6.5,swing=Math.sin(timer*freq),swingOff=Math.sin(timer*freq+Math.PI);
  pose.armLRotX=swing*0.55;pose.armRRotX=swingOff*0.55;
  pose.forearmLRotX=Math.max(0,swing)*0.3;pose.forearmRRotX=Math.max(0,swingOff)*0.3;
  pose.armLRotZ=0.1;pose.armRRotZ=-0.1;
  pose.headRotX=0.04;pose.headRotZ=Math.sin(timer*freq*0.5)*0.02;
  pose.bodyBob=Math.abs(Math.sin(timer*freq))*0.018;
}

function poseDance1Robot(pose,t){
  const beat=1.8;
  const jerk=(v)=>Math.round(v*4)/4;
  pose.armLRotX=jerk(Math.sin(t*beat*Math.PI)*0.9);
  pose.armRRotX=jerk(-Math.sin(t*beat*Math.PI)*0.9);
  pose.armLRotZ=0.1+jerk(Math.cos(t*beat*Math.PI*0.5)*0.6);
  pose.armRRotZ=-0.1-jerk(Math.cos(t*beat*Math.PI*0.5)*0.6);
  pose.headRotY=jerk(Math.sin(t*beat*Math.PI*0.5)*0.5);
  pose.headRotX=Math.floor(t*beat*4)%4<2?-0.1:0.1;
  pose.forearmLRotX=jerk(Math.cos(t*beat*Math.PI)*0.5+0.3);
  pose.forearmRRotX=jerk(-Math.cos(t*beat*Math.PI)*0.5+0.3);
  pose.bodyBob=Math.floor(t*beat*4)%2===0?0.04:0;
}

function poseDance2Spin(pose,t,model){
  if(model)model.rotation.y=t*Math.PI*2*1.2;
  pose.armLRotZ=0.1+Math.sin(t*4)*0.8+0.9;
  pose.armRRotZ=-0.1-Math.sin(t*4)*0.8-0.9;
  pose.armLRotX=Math.sin(t*6)*0.4;pose.armRRotX=Math.sin(t*6+Math.PI)*0.4;
  pose.headRotX=-0.2+Math.sin(t*3)*0.1;pose.headRotZ=Math.sin(t*5)*0.08;
  pose.forearmLRotX=Math.sin(t*8)*0.5+0.4;pose.forearmRRotX=Math.sin(t*8+1)*0.5+0.4;
  pose.bodyBob=0.05+Math.abs(Math.sin(t*4))*0.03;
}

function poseDance3Floss(pose,t){
  const beat=2.5,phase=(t*beat)%2;
  if(phase<1){
    const p=Math.sin(phase*Math.PI);
    pose.armLRotX=-0.6*p;pose.armLRotZ=0.1+1.2*p;
    pose.armRRotX=0.8*p;pose.armRRotZ=-0.1-0.3*p;
    pose.forearmLRotX=-0.4*p;pose.forearmRRotX=0.6*p;
  }else{
    const p=Math.sin((phase-1)*Math.PI);
    pose.armLRotX=0.8*p;pose.armLRotZ=0.1+0.3*p;
    pose.armRRotX=-0.6*p;pose.armRRotZ=-0.1-1.2*p;
    pose.forearmLRotX=0.6*p;pose.forearmRRotX=-0.4*p;
  }
  pose.headRotZ=Math.sin(t*beat*Math.PI)*0.12;pose.headRotX=0.05;
  pose.bodyBob=Math.abs(Math.sin(t*beat*Math.PI))*0.03;
}

function applyPose(bones,pose,alpha){
  const lerp=(a,b,t)=>a+(b-a)*t;
  if(bones.armL){
    if(pose.armLRotX!==undefined)bones.armL.rotation.x=lerp(bones.armL.rotation.x,(bones.armL._bindRotX||0)+pose.armLRotX,alpha);
    if(pose.armLRotZ!==undefined)bones.armL.rotation.z=lerp(bones.armL.rotation.z,(bones.armL._bindRotZ||0.1)+(pose.armLRotZ-0.1),alpha);
  }
  if(bones.armR){
    if(pose.armRRotX!==undefined)bones.armR.rotation.x=lerp(bones.armR.rotation.x,(bones.armR._bindRotX||0)+pose.armRRotX,alpha);
    if(pose.armRRotZ!==undefined)bones.armR.rotation.z=lerp(bones.armR.rotation.z,(bones.armR._bindRotZ||-0.1)+(pose.armRRotZ+0.1),alpha);
  }
  if(bones.forearmL&&pose.forearmLRotX!==undefined)bones.forearmL.rotation.x=lerp(bones.forearmL.rotation.x,(bones.forearmL._bindRotX||0)+pose.forearmLRotX,alpha);
  if(bones.forearmR&&pose.forearmRRotX!==undefined)bones.forearmR.rotation.x=lerp(bones.forearmR.rotation.x,(bones.forearmR._bindRotX||0)+pose.forearmRRotX,alpha);
  if(bones.head){
    if(pose.headRotX!==undefined)bones.head.rotation.x=lerp(bones.head.rotation.x,(bones.head._bindRotX||0)+pose.headRotX,alpha);
    if(pose.headRotY!==undefined)bones.head.rotation.y=lerp(bones.head.rotation.y,(bones.head._bindRotY||0)+pose.headRotY,alpha);
    if(pose.headRotZ!==undefined)bones.head.rotation.z=lerp(bones.head.rotation.z,(bones.head._bindRotZ||0)+pose.headRotZ,alpha);
  }
}

function showDanceEmoteLabel(model,danceName){
  if(!model||!model.userData.label)return;
  const cv=document.createElement('canvas');cv.width=256;cv.height=48;
  const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,256,48);ctx.fillStyle='rgba(0,0,0,0.85)';ctx.fillRect(2,2,252,44);
  ctx.strokeStyle='rgba(212,160,23,0.9)';ctx.lineWidth=1.5;ctx.strokeRect(2,2,252,44);
  ctx.fillStyle='#d4a017';ctx.font='bold 18px monospace';ctx.textAlign='center';
  ctx.fillText('💃 '+danceName,128,30);
  const tex=new THREE.CanvasTexture(cv);
  const geo=new THREE.PlaneGeometry(1.2,.22);
  const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(0,2.65,0);
  model.add(mesh);
  setTimeout(()=>{model.remove(mesh);mesh.geometry.dispose();mat.dispose();},2500);
}

function triggerLocalDance(danceKey){
  if(!DANCE_EMOTES[danceKey])return;
  localAnim.mode=danceKey;localAnim.timer=0;localAnim.danceLoop=0;localAnim.blendAlpha=0;
  const names={dance1:'🤖 ROBOT',dance2:'🌀 SPIN',dance3:'🕺 FLOSS'};
  showToast(names[danceKey]||'DANCE');
  if(mp.active&&mp.playerRef){mp.playerRef.update({dance:danceKey,danceTs:Date.now()});}
  const cfg=DANCE_EMOTES[danceKey];
  const maxLoops=danceKey==='dance3'?3:(danceKey==='dance2'?2:3);
  setTimeout(()=>{if(mp.active&&mp.playerRef)mp.playerRef.update({dance:null});},cfg.duration*maxLoops*1000+500);
}

// ── SKIN EDITOR ──
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
  $('skin-body-color').addEventListener('input',e=>{SKINS.bodyColor=e.target.value;$('skin-body-label').textContent=e.target.value.toUpperCase();updateSkinPreview();});
  $('skin-jacket-color').addEventListener('input',e=>{SKINS.jacketColor=e.target.value;$('skin-jacket-label').textContent=e.target.value.toUpperCase();updateSkinPreview();});
  $('skin-hat-color').addEventListener('input',e=>{SKINS.hatColor=e.target.value;$('skin-hat-label').textContent=e.target.value.toUpperCase();updateSkinPreview();});
  $('skin-hat-grid').addEventListener('click',e=>{
    const btn=e.target.closest('.hat-btn');if(!btn)return;
    document.querySelectorAll('.hat-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');SKINS.hatType=btn.dataset.hat;
    $('skin-hat-color-row').style.display=SKINS.hatType==='none'?'none':'';
    updateSkinPreview();
  });
  $('btn-close-skin').addEventListener('click',()=>{$('skin-editor').classList.add('hidden');if(state.phase==='playing')requestPointerLock();});
  updateSkinPreview();
}

function updateSkinPreview(){
  const cv=$('skin-preview-canvas');if(!cv)return;
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
  ctx.fillStyle='#0a0a0a';ctx.fillRect(0,0,cv.width,cv.height);
  const W=cv.width,H=cv.height,cx=W/2,sc=2.8;
  function rect(x,y,w,h,col,stroke){ctx.fillStyle=col;ctx.fillRect(cx+x*sc,H-y*sc-h*sc,w*sc,h*sc);if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.strokeRect(cx+x*sc,H-y*sc-h*sc,w*sc,h*sc);}}
  function circle(x,y,r,col){ctx.beginPath();ctx.arc(cx+x*sc,H-y*sc,r*sc,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();}
  rect(-.12-.1,.0,.2,.14,SKINS.jacketColor);rect(.12-.1,.0,.2,.14,SKINS.jacketColor);
  rect(-.12-.085,.14,.17,.48,SKINS.bodyColor);rect(.12-.085,.14,.17,.48,SKINS.bodyColor);
  rect(-.19,.97,.38,.12,SKINS.jacketColor);
  rect(-.23,1.09,.46,.63,SKINS.jacketColor);rect(-.04,1.09,.08,.63,SKINS.bodyColor);
  rect(-.37,1.1,.14,.6,SKINS.jacketColor);rect(.23,1.1,.14,.6,SKINS.jacketColor);
  rect(-.38,.78,.15,.2,'#c8a882');rect(.23,.78,.15,.2,'#c8a882');
  rect(-.08,1.72,.16,.12,'#c8a882');
  rect(-.19,1.84,.38,.38,'#c8a882','#555');
  rect(-.2,2.17,.4,.08,'#1a1008');
  rect(-.16,2.0,.11,.09,'#fff8f0','#888');rect(.05,2.0,.11,.09,'#fff8f0','#888');
  rect(-.14,2.02,.07,.06,'#111');rect(.07,2.02,.07,.06,'#111');
  rect(-.035,1.92,.07,.08,'#b89070');
  if(SKINS.hatType!=='none'){
    const hc=SKINS.hatColor,hcDark=darkenHex(hc,.6);
    switch(SKINS.hatType){
      case'cap':rect(-.19,2.22,.38,.14,hc);rect(-.05,2.22,.28,.05,hcDark);break;
      case'tophat':rect(-.24,2.22,.48,.04,hcDark);rect(-.16,2.26,.32,.32,hc);rect(-.17,2.57,.34,.04,hcDark);break;
      case'crown':rect(-.19,2.22,.38,.06,'#d4a017');for(let i=0;i<5;i++){rect(-.18+i*.09,2.28,.07,.16,'#d4a017');}break;
      case'beanie':rect(-.21,2.22,.42,.22,hc);rect(-.22,2.22,.44,.06,hcDark);circle(0,2.46,.055,hc);break;
      case'cowboy':rect(-.27,2.22,.54,.04,hc);rect(-.17,2.26,.34,.2,hc);rect(-.15,2.45,.3,.03,hcDark);break;
    }
  }
  ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(10,6,W-20,22);
  ctx.strokeStyle='rgba(212,160,23,0.5)';ctx.lineWidth=1;ctx.strokeRect(10,6,W-20,22);
  ctx.fillStyle='#d4a017';ctx.font='bold 12px monospace';ctx.textAlign='center';
  ctx.fillText(SETTINGS.username.slice(0,14),W/2,22);
}

function darkenHex(hex,f){let c=parseInt(hex.replace('#',''),16);const r=Math.round((c>>16&255)*f),g=Math.round((c>>8&255)*f),b=Math.round((c&255)*f);return'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');}
function openSkinEditor(){buildSkinEditorUI();$('skin-editor').classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock();}

// ── GAME START ──
function startGame(){
  if(!mp.active){
    WORLD_SEED=Math.floor(Math.random()*1e9);
  }else if(mp.isHost){
    WORLD_SEED=Math.floor(Math.random()*1e9);
    mp.roomRef.child('game/worldSeed').set(WORLD_SEED);
  }
  state.vault=0;state.hp=100;state.flashOn=true;state.sprint=100;state.crouching=false;state.inCloset=false;state.wardenAlerted=false;state.yaw=0;state.pitch=0;state.items=[];state.hasKey=false;state.keys={};state.phase='playing';state.crouchY=CFG.PLAYER_HEIGHT;state.chatOpen=false;
  collisionBoxes=[];
  state.roomsBuilt.forEach(r=>scene.remove(r));state.roomsBuilt=[];
  playerObj.position.set(0,0,2);
  Object.values(monsters).forEach(m=>{if(m){m.active=false;m.mesh.visible=false;m.mesh.position.set(0,0,-200);}});
  if(monsters.warden)monsters.warden.noiseLevel=0;
  if(monsters.echo)monsters.echo.bounces=0;
  if(monsters.twist){monsters.twist.frozen=false;monsters.twist.teleTimer=0;}
  if(monsters.push){monsters.push.active=false;monsters.push.timer=0;}
  if(monsters.lurk){monsters.lurk.active=false;monsters.lurk.chasePhase=false;}
  state.chaseActive=false;state.chaseTimer=0;
  state.chaseObstacles.forEach(o=>{if(o.mesh&&scene)scene.remove(o.mesh);});
  state.chaseObstacles=[];state.closetTimer=0;
  if(gazeAudio){stopSound(gazeAudio);gazeAudio=null;}
  if(monsters.surge)clearMonsterRoar(monsters.surge);
  if(monsters.echo)clearMonsterRoar(monsters.echo);
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
  if(mp.active&&mp.playerRef){mp.playerRef.update({username:SETTINGS.username,vault:0,hp:100,alive:true,x:0,z:2,yaw:0,skin:JSON.stringify(SKINS)});}
}

// ── POINTER LOCK ──
function requestPointerLock(){
  if(state.isMobile){plOverlay.classList.add('hidden');return;}
  if(state.chatOpen)return;
  if(!$('settings-panel').classList.contains('hidden'))return;
  if($('skin-editor')&&!$('skin-editor').classList.contains('hidden'))return;
  const fn=canvas.requestPointerLock||canvas.mozRequestPointerLock;
  if(fn)fn.call(canvas);
  else plOverlay.classList.remove('hidden');
}
document.addEventListener('pointerlockchange',()=>{
  state.pointerLocked=(document.pointerLockElement===canvas);
  if(!state.isMobile){const showOverlay=!state.pointerLocked&&state.phase==='playing'&&!state.chatOpen;plOverlay.classList.toggle('hidden',!showOverlay);}
});
document.addEventListener('mousemove',e=>{if(!state.pointerLocked||state.phase!=='playing'||state.inCloset)return;const s=CFG.MOUSE_SENS_BASE*SETTINGS.sensMult;const inv=state.invertControls?-1:1;state.yaw-=e.movementX*s*inv;state.pitch-=e.movementY*s*inv;state.pitch=Math.max(-1.1,Math.min(1.1,state.pitch));});

// ── INPUT ──
document.addEventListener('keydown',e=>{
  if(state.chatOpen&&e.target&&e.target.id==='chat-input'){return;}
  state.keys[e.code]=true;
  if(state.phase!=='playing'&&!state.inCloset)return;
  if(e.code==='KeyF')toggleFlash();
  if(e.code==='KeyC')toggleCrouch();
  if(e.code==='KeyE'&&!state.inCloset)tryInteract();
  if((e.code==='KeyE'||e.code==='Escape')&&state.inCloset)exitCloset();
  if(e.code==='Escape'&&!state.inCloset&&state.phase==='playing'){if(!state.chatOpen)openSettings();}
  if(e.code==='KeyT'&&mp.active&&state.phase==='playing'){e.preventDefault();openChat();}
});
document.addEventListener('keyup',e=>{state.keys[e.code]=false;});
canvas.addEventListener('click',()=>{
  if(state.phase==='playing'&&state.pointerLocked)tryInteract();
  if(state.phase==='playing'&&!state.pointerLocked&&!state.isMobile&&!state.chatOpen)requestPointerLock();
});
plOverlay.addEventListener('click',()=>{if(!state.chatOpen)requestPointerLock();});

function openChat(){
  state.chatOpen=true;
  if(document.pointerLockElement)document.exitPointerLock();
  plOverlay.classList.add('hidden');
  const ci=$('chat-input');
  if(ci){showChatPanel();setTimeout(()=>ci.focus(),50);}
}
function closeChat(){state.chatOpen=false;plOverlay.classList.add('hidden');if(state.phase==='playing')requestPointerLock();}
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
function openDoorLocally(d){if(!d||d.userData.open)return;d.userData.opening=true;d.userData.open=true;if(d.userData.wallBox)removeBox(d.userData.wallBox);}
function openDrawer(dr){
  dr.userData.open=!dr.userData.open;SFX.drawerOpen();
  if(dr.userData.open&&dr.userData.hasItem&&!dr.userData.taken){
    dr.userData.taken=true;
    if(dr.userData.forceKeyItem||rng()<.6){state.hasKey=true;keyIcon.classList.remove('hidden');SFX.pickup();showToast('✦ Found a Golden Key in the drawer!');}
    else{state.hp=Math.min(100,state.hp+20);updateHUD();SFX.heal();showToast('✦ Found bandages (+20 HP)!');}
  }else if(dr.userData.open&&!dr.userData.hasItem){showToast('The drawer is empty.');}
  if(monsters.warden&&monsters.warden.active)addWardenNoise(4);
}
function enterCloset(cg){
  state.inCloset=true;state.phase='closet';state.closetTimer=0;SFX.creak();
  let ls=$('locker-screen');
  if(!ls){
    ls=document.createElement('div');ls.id='locker-screen';
    const bars=document.createElement('div');bars.id='locker-bars';
    for(let i=0;i<9;i++){const b=document.createElement('div');b.className='locker-bar';bars.appendChild(b);}
    ls.appendChild(bars);
    const peek=document.createElement('div');peek.id='locker-peek';ls.appendChild(peek);
    const eye=document.createElement('div');eye.className='locker-eye';eye.textContent='👁';ls.appendChild(eye);
    const p=document.createElement('p');p.className='locker-hint';p.textContent='Hold still... Press E or ESC to exit';ls.appendChild(p);
    document.body.appendChild(ls);
  }
  ls.style.display='flex';
}
function exitCloset(){
  state.inCloset=false;state.phase='playing';state.closetTimer=0;
  const ls=$('locker-screen');if(ls)ls.style.display='none';
  wardenAlert.classList.remove('active');
  if(monsters.push){monsters.push.active=false;monsters.push.mesh.visible=false;}
}
function collectKey(o){o.visible=false;SFX.pickup();state.hasKey=true;keyIcon.classList.remove('hidden');showToast('✦ Golden Key collected!');}
function collectCrystal(o){o.visible=false;SFX.heal();state.hp=Math.min(100,state.hp+40);updateHUD();showToast('✦ Healing Crystal +40 HP');}

// ── MOVEMENT ──
const _fwd=new THREE.Vector3(),_rgt=new THREE.Vector3(),_eul=new THREE.Euler(0,0,0,'YXZ');
let stepTimer=0;
function updateClosetTimer(dt){if(!state.inCloset)return;state.closetTimer+=dt;}

function updateMovement(dt){
  if(state.phase!=='playing')return;
  if(monsters.twist&&monsters.twist.frozen)return;
  const spr=(state.keys['ShiftLeft']||state.keys['ShiftRight']||state.mobileSprint)&&state.sprint>0&&!state.crouching;
  const spd=state.crouching?CFG.PLAYER_CROUCH_SPEED:(spr?CFG.PLAYER_SPRINT:CFG.PLAYER_SPEED);
  if(spr)state.sprint=Math.max(0,state.sprint-CFG.SPRINT_DRAIN*dt);
  else state.sprint=Math.min(CFG.SPRINT_MAX,state.sprint+CFG.SPRINT_REGEN*dt);
  _eul.set(0,state.yaw,0);_fwd.set(0,0,-1).applyEuler(_eul);_fwd.y=0;_fwd.normalize();_rgt.set(1,0,0).applyEuler(_eul);_rgt.y=0;_rgt.normalize();
  let mx=0,mz=0;
  const inv=state.invertControls?-1:1;
  if(state.keys['KeyW']||state.keys['ArrowUp']){mx+=_fwd.x*inv;mz+=_fwd.z*inv;}
  if(state.keys['KeyS']||state.keys['ArrowDown']){mx-=_fwd.x*inv;mz-=_fwd.z*inv;}
  if(state.keys['KeyA']||state.keys['ArrowLeft']){mx-=_rgt.x*inv;mz-=_rgt.z*inv;}
  if(state.keys['KeyD']||state.keys['ArrowRight']){mx+=_rgt.x*inv;mz+=_rgt.z*inv;}
  if(state.isMobile){mx+=_fwd.x*(-state.joystick.dy)+_rgt.x*state.joystick.dx;mz+=_fwd.z*(-state.joystick.dy)+_rgt.z*state.joystick.dx;}
  const len=Math.sqrt(mx*mx+mz*mz);if(len>0){mx/=len;mz/=len;}
  const nx=playerObj.position.x+mx*spd*dt,nz=playerObj.position.z+mz*spd*dt;
  const r=resolve(nx,nz);playerObj.position.x=r.x;playerObj.position.z=r.z;
  if(len>.1){
    stepTimer-=dt;
    if(stepTimer<=0){SFX.footstep();stepTimer=state.crouching?.6:(spr?.28:.42);if(monsters.warden&&monsters.warden.active)addWardenNoise(spr?7:(state.crouching?0.5:2));}
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
  flashlight.target.position.copy(tgt);flashlight.target.updateMatrixWorld();
}

// ── DOORS / DRAWERS ANIM ──
function updateDoors(dt){state.roomsBuilt.forEach(room=>{const d=room.userData.door;if(!d||!d.userData.opening)return;d.position.y+=dt*3.5;if(d.position.y>=d.userData.openY){d.position.y=d.userData.openY;d.userData.opening=false;}});}
function updateDrawers(dt){state.roomsBuilt.forEach(room=>{room.traverse(o=>{if(!o.userData.isDrawer)return;const tgt=o.userData.open?.26:0;o.position.z=THREE.MathUtils.lerp(o.position.z,tgt,dt*7);});});}
function updateLights(t){scene.traverse(o=>{if(o.isLight&&o.userData.flicker){o.intensity=.45+Math.abs(Math.sin(t*2.8+o.userData.phase))*.85;if(Math.random()<.003)o.intensity=.05;}});}
function updateItems(t){state.items.forEach(it=>{if(!it.visible)return;it.rotation.y+=(it.userData.rotSpeed||1)*.016;it.position.y=.65+Math.sin(t*2+(it.userData.bobOffset||0))*.1;});}

// ── MONSTER ANIMATIONS ──
function animateWarden(dt,t){const w=monsters.warden;if(!w||!w.active)return;if(w.armL)w.armL.rotation.x=Math.sin(t*5)*.45;if(w.armR)w.armR.rotation.x=-Math.sin(t*5)*.45;if(w.headGroup)w.headGroup.rotation.x=Math.sin(t*3)*.05;if(w.gw)w.gw.intensity=1.6+Math.sin(t*8)*.5;}
function animateSurge(dt,t){const s=monsters.surge;if(!s||!s.active)return;if(s.pw)s.pw.intensity=2+Math.sin(t*15)*.8;if(s.co1)s.co1.scale.setScalar(.9+Math.sin(t*12)*.2);if(s.co2)s.co2.scale.setScalar(.9+Math.sin(t*12+1)*.2);if(s.core)s.core.scale.setScalar(1+Math.sin(t*20)*.3);}
function animateGaze(t){const g=monsters.gaze;if(!g||!g.active)return;g.mesh.traverse(o=>{if(o.userData.gazeEye){o.scale.setScalar(.9+Math.sin(t*2+o.position.x*3)*.15);if(Math.random()<.003)o.scale.y=0.05;}});}

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

function spawnSurge(){const s=monsters.surge;if(!s)return;s.active=true;s.dir=1;s.speed=16+state.vault*.08;s.mesh.position.set((Math.random()-.5)*2,0,playerObj.position.z-RD*2.5);s.mesh.visible=true;playSound('surgeRoar',1.0);const msgs=['💨 IT\'S COMING—','⚡ MOVE. NOW.','💀 SOMETHING CHARGES','⚡ RUN.'];showToast(msgs[Math.floor(Math.random()*msgs.length)]);}
function updateSurge(dt){
  const s=monsters.surge;if(!s||state.phase!=='playing')return;
  if(s.waiting){s.waitTimer+=dt;if(s.waitTimer>=s.waitDuration){s.waiting=false;s.active=true;clearMonsterRoar(s);}return;}
  if(!s.active)return;
  s.mesh.position.z+=s.speed*dt;
  s.mesh.lookAt(s.mesh.position.x,s.mesh.position.y,s.mesh.position.z+1);
  const sameRoom=Math.abs(s.mesh.position.z-playerObj.position.z)<RD*.5+1.5&&Math.abs(s.mesh.position.x-playerObj.position.x)<RW*.6;
  if(sameRoom&&!state.inCloset)triggerCatchByMonster('surge');
  if(s.mesh.position.z>playerObj.position.z+RD*5){clearMonsterRoar(s);s.active=false;s.mesh.visible=false;}
}

function spawnEcho(){const e=monsters.echo;if(!e)return;e.active=true;e.bounces=0;e.maxBounces=4+Math.floor(Math.random()*5);e.speed=11+state.vault*.05;e.dir=-1;e.startZ=playerObj.position.z+RD*2;e.endZ=playerObj.position.z-RD*3;e.mesh.position.set((Math.random()-.5)*RW*.5,0,e.startZ);e.mesh.visible=true;SFX.echoRoar();const msgs=['👁 IT KNOWS WHERE YOU ARE','👁 IT\'S ALREADY AHEAD OF YOU','👁 NO ESCAPE','👁 IT SEES YOU'];showToast(msgs[Math.floor(Math.random()*msgs.length)]);}
function updateEcho(dt){
  const e=monsters.echo;if(!e||state.phase!=='playing')return;
  if(e.waiting){e.waitTimer+=dt;if(e.waitTimer>=e.waitDuration){e.waiting=false;e.active=true;clearMonsterRoar(e);}return;}
  if(!e.active)return;
  e.mesh.position.z+=e.dir*e.speed*dt;
  e.mesh.lookAt(e.mesh.position.x,e.mesh.position.y,e.mesh.position.z+e.dir);
  const eRoom=Math.abs(e.mesh.position.z-playerObj.position.z)<RD*.5+1.5&&Math.abs(e.mesh.position.x-playerObj.position.x)<RW*.6;
  if(eRoom&&!state.inCloset)triggerCatchByMonster('echo');
  if(e.dir===-1&&e.mesh.position.z<e.endZ){e.dir=1;e.bounces++;SFX.echoRoar();}
  if(e.dir===1&&e.mesh.position.z>e.startZ){e.dir=-1;e.bounces++;SFX.echoRoar();}
  if(e.bounces>=e.maxBounces){clearMonsterRoar(e);e.active=false;e.mesh.visible=false;}
}

function spawnGaze(){const g=monsters.gaze;if(!g)return;g.active=true;g.damageTimer=0;const side=Math.random()<.5?-RW/2+.5:RW/2-.5;const dist=RD*(0.8+Math.random()*1.5);g.mesh.position.set(side,1.0+Math.random()*.5,playerObj.position.z+dist);g.mesh.visible=true;gazeAudio=SFX.gazeStart();if(Math.random()<.5)showToast('👁 ......');}
function updateGaze(dt){
  const g=monsters.gaze;if(!g||!g.active||state.phase!=='playing')return;
  const dist=g.mesh.position.distanceTo(playerObj.position);
  if(gazeAudio){const vol=Math.max(0,Math.min(1,1-(dist/18)));gazeAudio.volume=vol;if(vol<.01&&dist>16){g.active=false;g.mesh.visible=false;stopSound(gazeAudio);gazeAudio=null;state.gazePulling=false;state.gazePullStrength=0;return;}}
  if(g.pw)g.pw.intensity=Math.max(0,1.5*(1-dist/16))+Math.sin(Date.now()*.003)*.3;
  animateGaze(clock.elapsedTime);
  if(dist<12){
    const toGaze=new THREE.Vector3().subVectors(g.mesh.position,camera.position);toGaze.y=0;toGaze.normalize();
    const camDir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);camDir.y=0;camDir.normalize();
    const dot=toGaze.dot(camDir);
    const lookingAt=dot>.6;
    if(lookingAt){
      g.damageTimer+=dt;state.gazePullStrength=Math.min(1,state.gazePullStrength+dt*0.4);state.gazePulling=true;
      if(g.damageTimer>.4)dealDamage(22*dt,'gaze');
    }else{
      g.damageTimer=Math.max(0,g.damageTimer-dt*2);state.gazePullStrength=Math.max(0,state.gazePullStrength-dt*0.8);
      if(state.gazePullStrength<=0)state.gazePulling=false;
    }
    if(state.gazePullStrength>0){
      const targetYaw=Math.atan2(-toGaze.x,-toGaze.z);
      const toPitch=new THREE.Vector3().subVectors(g.mesh.position,camera.position);
      const targetPitch=-Math.atan2(toPitch.y,Math.sqrt(toPitch.x*toPitch.x+toPitch.z*toPitch.z));
      const pull=state.gazePullStrength*dt*1.4;
      let yawDiff=targetYaw-state.yaw;
      while(yawDiff>Math.PI)yawDiff-=Math.PI*2;while(yawDiff<-Math.PI)yawDiff+=Math.PI*2;
      state.yaw+=yawDiff*pull;state.pitch+=(targetPitch-state.pitch)*pull;state.pitch=Math.max(-1.1,Math.min(1.1,state.pitch));
      const intensity=Math.round(state.gazePullStrength*180);
      document.body.style.boxShadow=`inset 0 0 ${120+intensity}px rgba(${intensity},${Math.max(0,80-intensity)},0,${state.gazePullStrength*.65})`;
    }else document.body.style.boxShadow='';
  }else{state.gazePulling=false;state.gazePullStrength=0;document.body.style.boxShadow='';}
}

function spawnTwist(){
  const t=monsters.twist;if(!t)return;
  t.active=true;t.frozen=false;t.freezeTimer=0;t.teleTimer=1.5;t.invertTimer=0;
  t.mesh.position.set((Math.random()-.5)*RW*.7,0,playerObj.position.z+RD*(1+Math.random()));
  t.mesh.visible=true;SFX.twistSound();
  const msgs=['🌀 SOMETHING IS WRONG WITH YOUR CONTROLS','🌀 LEFT IS RIGHT. RIGHT IS LEFT.','🌀 YOU FEEL DISORIENTED','🌀 YOUR MIND IS NOT YOUR OWN'];
  showToast(msgs[Math.floor(Math.random()*msgs.length)]);
}
function updateTwist(dt){
  const t=monsters.twist;if(!t||!t.active||state.phase!=='playing')return;
  t.teleTimer-=dt;
  if(t.teleTimer<=0){t.mesh.position.set((Math.random()-.5)*RW*.8,0,playerObj.position.z+(Math.random()*RD*2.5-RD*.5));SFX.twistSound();t.teleTimer=1.2+Math.random()*2;}
  t.mesh.lookAt(playerObj.position.x,t.mesh.position.y,playerObj.position.z);
  if(t.pw)t.pw.intensity=1.5+Math.sin(Date.now()*.005)*.5;
  const dist=t.mesh.position.distanceTo(playerObj.position);
  const toPlayer=new THREE.Vector3().subVectors(playerObj.position,t.mesh.position).normalize();
  const twistFwd=new THREE.Vector3(0,0,-1).applyQuaternion(t.mesh.quaternion);
  const sees=dist<16&&twistFwd.dot(toPlayer)>.45;
  if(sees){
    t.invertTimer=Math.min(t.invertTimer+dt,3.5);
    if(t.invertTimer>0.6&&!state.invertControls){state.invertControls=true;showToast('🌀 CONTROLS INVERTED');document.body.style.filter='hue-rotate(180deg) saturate(1.4)';setTimeout(()=>{document.body.style.filter='';},300);}
  }else{
    t.invertTimer=Math.max(0,t.invertTimer-dt*1.5);
    if(t.invertTimer<=0&&state.invertControls){state.invertControls=false;showToast('🌀 Controls restored');}
  }
  if(dist<2.5)dealDamage(18*dt,'twist');
  if(dist<1.0)triggerCatchByMonster('twist');
  if(playerObj.position.z>t.mesh.position.z+RD*6){t.active=false;t.mesh.visible=false;state.invertControls=false;document.body.style.filter='';}
}

function roarThenJumpscare(roarKey,cb){if(roarKey)playSound(roarKey,1.0);if(SETTINGS.jumpscares){SFX.jumpscare();}doJumpscare(cb);}
function triggerCatchByMonster(type){
  if(state.phase==='dead')return;
  if(type==='warden')roarThenJumpscare('wardenRoar',()=>{state.hp=0;updateHUD();triggerDeath();});
  else if(type==='surge')roarThenJumpscare('surgeRoar',()=>{state.hp=0;updateHUD();triggerDeath();});
  else if(type==='echo')roarThenJumpscare('echoRoar',()=>{state.hp=0;updateHUD();triggerDeath();});
  else if(type==='lurk')roarThenJumpscare('wardenRoar',()=>{state.hp=0;updateHUD();triggerDeath();});
  else{if(SETTINGS.jumpscares)doJumpscare(()=>{state.hp=0;updateHUD();triggerDeath();});else{state.hp=0;updateHUD();triggerDeath();}}
}
function doJumpscare(cb){
  if(!SETTINGS.jumpscares){cb();return;}
  const el=$('jumpscare'),cv=$('jumpscare-canvas');
  el.classList.remove('hidden');
  cv.width=window.innerWidth;cv.height=window.innerHeight;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#000';ctx.fillRect(0,0,cv.width,cv.height);
  let phase=0,frameTimer=0,shakeX=0,shakeY=0,scaleVal=0.3;
  let glitchLines=[];for(let i=0;i<12;i++)glitchLines.push({y:Math.random()*cv.height,h:Math.random()*18+3,off:Math.random()*80-40});
  try{const ac=new(window.AudioContext||window.webkitAudioContext)();const osc=ac.createOscillator();const gain=ac.createGain();osc.connect(gain);gain.connect(ac.destination);osc.type='sawtooth';osc.frequency.setValueAtTime(80,ac.currentTime);osc.frequency.exponentialRampToValueAtTime(40,ac.currentTime+0.5);gain.gain.setValueAtTime(0.7,ac.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.6);osc.start();osc.stop(ac.currentTime+0.6);}catch(e){}
  const animate=()=>{
    frameTimer++;shakeX=(Math.random()-.5)*(phase<2?40:18);shakeY=(Math.random()-.5)*(phase<2?40:18);
    document.body.style.transform=`translate(${shakeX}px,${shakeY}px)`;
    if(phase===0){
      scaleVal=Math.min(1,scaleVal+0.18);ctx.fillStyle='#000';ctx.fillRect(0,0,cv.width,cv.height);
      ctx.save();ctx.translate(cv.width/2,cv.height/2);ctx.scale(scaleVal,scaleVal);ctx.translate(-cv.width/2,-cv.height/2);
      drawFaceDetailed(ctx,cv.width,cv.height);ctx.restore();
      const grd=ctx.createRadialGradient(cv.width/2,cv.height/2,cv.width*.1,cv.width/2,cv.height/2,cv.width*.8);
      grd.addColorStop(0,'rgba(0,0,0,0)');grd.addColorStop(1,`rgba(200,0,0,${0.3+Math.random()*.4})`);
      ctx.fillStyle=grd;ctx.fillRect(0,0,cv.width,cv.height);
      if(scaleVal>=1)phase=1;
    }else if(phase===1){
      ctx.fillStyle='#000';ctx.fillRect(0,0,cv.width,cv.height);drawFaceDetailed(ctx,cv.width,cv.height);
      glitchLines.forEach(l=>{l.off=(Math.random()-.5)*120;const imgData=ctx.getImageData(0,l.y,cv.width,l.h);ctx.putImageData(imgData,l.off,l.y);});
      if(Math.random()<0.25){ctx.fillStyle=`rgba(200,0,0,${Math.random()*.5})`;ctx.fillRect(0,0,cv.width,cv.height);}
      if(Math.random()<0.12){ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(0,0,cv.width,cv.height);}
      if(frameTimer>22)phase=2;
    }else if(phase===2){
      scaleVal=Math.max(0,scaleVal-0.12);const fade=1-scaleVal;
      ctx.fillStyle='#000';ctx.fillRect(0,0,cv.width,cv.height);
      ctx.save();ctx.globalAlpha=scaleVal;ctx.translate(cv.width/2,cv.height/2);ctx.scale(scaleVal+0.5,scaleVal+0.5);ctx.translate(-cv.width/2,-cv.height/2);
      drawFaceDetailed(ctx,cv.width,cv.height);ctx.restore();
      ctx.fillStyle=`rgba(255,255,255,${fade*.6})`;ctx.fillRect(0,0,cv.width,cv.height);
      if(scaleVal<=0){document.body.style.transform='';el.classList.add('hidden');document.body.style.boxShadow='';cb();return;}
    }
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
function drawFaceDetailed(ctx,w,h){
  ctx.save();ctx.translate(w/2,h/2);
  const r=Math.min(w,h)*.46;
  ctx.fillStyle='#050505';ctx.fillRect(-r*.25,r*.7,r*.5,r*.5);
  ctx.beginPath();ctx.ellipse(r*.02,0,r*.68,r,0,0,Math.PI*2);ctx.fillStyle='#060002';ctx.fill();ctx.strokeStyle='#1a0000';ctx.lineWidth=4;ctx.stroke();
  for(let i=0;i<80;i++){const nx=(Math.random()-.5)*r*1.3,ny=(Math.random()-.5)*r*1.8;const gr=Math.random()*.04;ctx.fillStyle=`rgba(${Math.floor(40+Math.random()*20)},0,0,${gr})`;ctx.fillRect(w/2+nx-2,h/2+ny-2,5,5);}
  [-r*.27,r*.27].forEach((ex,i)=>{
    ctx.save();ctx.translate(ex,-r*.12);
    ctx.beginPath();ctx.ellipse(0,0,r*.22,r*.26,i===0?-.12:.12,0,Math.PI*2);ctx.fillStyle='#000';ctx.fill();
    ctx.beginPath();ctx.ellipse(0,0,r*.15,r*.18,0,0,Math.PI*2);ctx.fillStyle='#0a0005';ctx.fill();
    ctx.strokeStyle='rgba(180,0,0,0.7)';ctx.lineWidth=1;
    for(let v=0;v<6;v++){const va=v/6*Math.PI*2;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(Math.cos(va+.4)*r*.08,Math.sin(va+.4)*r*.08,Math.cos(va)*r*.14,Math.sin(va)*r*.14);ctx.stroke();}
    ctx.beginPath();ctx.ellipse((Math.random()-.5)*r*.04,(Math.random()-.5)*r*.04,r*.072,r*.088,0,0,Math.PI*2);ctx.fillStyle='#7a0000';ctx.fill();
    ctx.beginPath();ctx.ellipse(0,0,r*.055,r*.07,0,0,Math.PI*2);ctx.fillStyle='#000';ctx.fill();
    ctx.shadowColor='#ff0000';ctx.shadowBlur=22;ctx.beginPath();ctx.ellipse(0,0,r*.02,r*.025,0,0,Math.PI*2);ctx.fillStyle='#ff2200';ctx.fill();ctx.shadowBlur=0;
    ctx.restore();
  });
  ctx.beginPath();ctx.ellipse(r*.02,r*.2,r*.07,r*.1,0,0,Math.PI*2);ctx.fillStyle='#020000';ctx.fill();
  ctx.beginPath();ctx.ellipse(-r*.03,r*.22,r*.025,r*.04,-.3,0,Math.PI*2);ctx.fillStyle='#000';ctx.fill();
  ctx.beginPath();ctx.ellipse(r*.07,r*.22,r*.025,r*.04,.3,0,Math.PI*2);ctx.fillStyle='#000';ctx.fill();
  ctx.beginPath();ctx.moveTo(-r*.38,r*.5);ctx.lineTo(-r*.22,r*.44);ctx.lineTo(-r*.1,r*.56);ctx.lineTo(r*.0,r*.43);ctx.lineTo(r*.12,r*.57);ctx.lineTo(r*.24,r*.44);ctx.lineTo(r*.38,r*.5);ctx.lineTo(r*.42,r*.65);ctx.lineTo(r*.28,r*.58);ctx.lineTo(r*.15,r*.72);ctx.lineTo(r*.0,r*.6);ctx.lineTo(-r*.15,r*.72);ctx.lineTo(-r*.3,r*.6);ctx.lineTo(-r*.42,r*.65);ctx.closePath();ctx.fillStyle='#020000';ctx.fill();ctx.strokeStyle='#1a0000';ctx.lineWidth=1.5;ctx.stroke();
  const tPositions=[-.28,-.16,-.05,.06,.17,.27];
  tPositions.forEach((tx,i)=>{ctx.fillStyle=i%3===0?'#c0b090':'#e0d0b0';ctx.fillRect(tx*r,r*.5,r*.08+Math.random()*r*.04,r*.12+Math.random()*r*.08);});
  ctx.strokeStyle='rgba(80,0,0,0.55)';ctx.lineWidth=1.2;
  [[-.5,-r*.6,.1,-r*.2],[.4,-r*.5,.7,-r*.1],[-.2,r*.3,-.5,r*.7]].forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1*r,y1);ctx.lineTo(x2*r,y2);ctx.stroke();});
  const grd=ctx.createRadialGradient(0,0,r*.2,0,0,r*1.4);grd.addColorStop(0,'rgba(0,0,0,0)');grd.addColorStop(0.6,'rgba(0,0,0,0)');grd.addColorStop(1,'rgba(0,0,0,0.95)');ctx.fillStyle=grd;ctx.fillRect(-w/2,-h/2,w,h);
  [[0,0],[w,0],[0,h],[w,h]].forEach(([cx,cy])=>{const cg=ctx.createRadialGradient(cx,cy,0,cx,cy,w*.45);cg.addColorStop(0,`rgba(160,0,0,${0.4+Math.random()*.3})`);cg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=cg;ctx.fillRect(0,0,w,h);});
  ctx.restore();
}

// ── DAMAGE / DEATH / WIN ──
function dealDamage(amt,src){if(state.phase==='dead'||state.inCloset)return;state.hp=Math.max(0,state.hp-amt);updateHUD();if(amt>3)flashDmg();if(state.hp<=0)triggerDeath();}
function flashDmg(){const el=document.createElement('div');el.className='damage-flash';document.body.appendChild(el);setTimeout(()=>el.remove(),450);}
function triggerDeath(){
  state.phase='dead';
  if(state.chaseActive){state.chaseActive=false;state.chaseObstacles.forEach(o=>{if(o.mesh&&scene)scene.remove(o.mesh);});state.chaseObstacles=[];const co=$('chase-overlay');if(co)co.classList.remove('active');}
  Object.values(monsters).forEach(m=>{if(m){m.active=false;m.mesh.visible=false;}});
  if(gazeAudio){stopSound(gazeAudio);gazeAudio=null;}
  state.invertControls=false;state.gazePulling=false;state.gazePullStrength=0;
  document.body.style.filter='';document.body.style.boxShadow='';
  wardenAlert.classList.remove('active');
  document.exitPointerLock();
  if(mp.active&&mp.playerRef)mp.playerRef.update({alive:false,hp:0});
  setTimeout(()=>{canvas.style.display='none';hudEl.classList.add('hidden');deathEl.classList.remove('hidden');$('death-vault').textContent=`Fell on Vault ${state.vault+1}`;},900);
}
function triggerWin(){state.phase='win';document.exitPointerLock();if(mp.active&&mp.playerRef)mp.playerRef.update({vault:CFG.VAULTS_TOTAL,alive:true});setTimeout(()=>{canvas.style.display='none';hudEl.classList.add('hidden');winEl.classList.remove('hidden');},500);}
function updateHUD(){healthBar.style.setProperty('--hp',Math.max(0,state.hp)+'%');healthTxt.textContent=Math.round(Math.max(0,state.hp));vaultNum.textContent=String(state.vault+1).padStart(3,'0');}
let toastTO=null;
function showToast(msg){let el=$('item-pickup');if(el)el.remove();el=document.createElement('div');el.id='item-pickup';el.innerHTML=msg;document.body.appendChild(el);clearTimeout(toastTO);toastTO=setTimeout(()=>el&&el.remove(),2600);}

// ── ADVANCE VAULT ──
function advanceVault(from){
  SFX.doorOpen();state.vault=from+1;
  if(state.vault>=CFG.VAULTS_TOTAL){triggerWin();return;}
  const vis=QUALITY[SETTINGS.quality].rooms;
  for(let i=state.vault;i<=Math.min(state.vault+vis,CFG.VAULTS_TOTAL-1);i++)spawnRoom(i);
  state.roomsBuilt=state.roomsBuilt.filter(r=>{if(r.userData.vaultIdx<state.vault-2){scene.remove(r);return false;}return true;});
  state.items=state.items.filter(it=>it.visible);
  updateHUD();
  if(state.vault>=5){
    if(state.vault>=43&&state.vault<=46){if(!state.chaseActive)startLurkChase();return;}
    if(Math.random()<.60)spawnSurgeDelayed();
    if(Math.random()<.30)spawnEchoDelayed();
    if(Math.random()<.20)spawnTwist();
    if(Math.random()<.20)spawnGaze();
    if(state.vault>=10&&Math.random()<.07)spawnWarden();
    if(state.vault>=5)spawnPush();
  }
}

// ══════════════════════════════════════════════════
// ── MULTIPLAYER / FIREBASE ──
// ══════════════════════════════════════════════════
function initFirebase(){
  if(mp.db)return;
  try{firebase.initializeApp(firebaseConfig);mp.db=firebase.database();}catch(e){console.error('Firebase init failed:',e);}
}
function genRoomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code='';for(let i=0;i<4;i++)code+=chars[Math.floor(Math.random()*chars.length)];return code;}

function createRoom(){
  initFirebase();
  if(!mp.db){alert('Multiplayer unavailable — check your connection.');return;}
  const code=genRoomCode();
  try{
    const roomRef=mp.db.ref('rooms/'+code);
    mp.playerId='P'+Date.now();mp.roomCode=code;mp.roomRef=roomRef;mp.isHost=true;
    mp.playerRef=roomRef.child('players/'+mp.playerId);
    mp.playerRef.set({username:SETTINGS.username,x:0,z:2,yaw:0,vault:0,hp:100,alive:true,isHost:true,ts:Date.now(),skin:JSON.stringify(SKINS)});
    mp.playerRef.onDisconnect().remove();
    roomRef.child('game/state').set('lobby');
    roomRef.child('game/hostId').set(mp.playerId);
    setupRoomListeners();mp.active=true;
    $('mp-status').textContent='Room: '+code+' | Players: 1';
    showMPLobby(code);
  }catch(e){console.error('Room creation failed:',e);alert('Failed to create room: '+e.message);}
}

function joinRoom(code){
  initFirebase();
  if(!mp.db){alert('Multiplayer unavailable — check your connection.');return;}
  code=code.toUpperCase().trim();
  try{
    const roomRef=mp.db.ref('rooms/'+code);
    mp.playerId='P'+Date.now();mp.roomCode=code;mp.roomRef=roomRef;mp.isHost=false;
    mp.playerRef=roomRef.child('players/'+mp.playerId);
    mp.playerRef.set({username:SETTINGS.username,x:0,z:2,yaw:0,vault:0,hp:100,alive:true,isHost:false,ts:Date.now(),skin:JSON.stringify(SKINS)});
    mp.playerRef.onDisconnect().remove();
    setupRoomListeners();mp.active=true;
    $('mp-status').textContent='Room: '+code;
    showMPLobby(code);
  }catch(e){console.error('Join room failed:',e);alert('Failed to join room: '+e.message);}
}

function setupRoomListeners(){
  const playersRef=mp.roomRef.child('players');
  playersRef.on('value',snap=>{
    const data=snap.val()||{};mp.players=data;
    updateRemotePlayers(data);
    const count=Object.keys(data).length;
    if($('mp-status'))$('mp-status').textContent='Room: '+mp.roomCode+' | Players: '+count;
    if(!$('mp-lobby').classList.contains('hidden'))updateLobbyPlayerList(data);
  });

  mp.roomRef.child('game').on('value',snap=>{
    const g=snap.val();if(!g)return;
    // Sync world seed before starting
    if(g.worldSeed!==undefined&&g.worldSeed!==null)WORLD_SEED=g.worldSeed;
    if(g.state==='playing'&&state.phase==='menu'){
      $('mp-lobby').classList.add('hidden');$('mp-status').classList.remove('hidden');startGame();
    }
    if(g.vaultAdvance){
      const va=g.vaultAdvance;
      if(va.fromVault!==undefined&&state.phase==='playing'){
        for(const room of state.roomsBuilt){
          const d=room.userData.door;
          if(d&&d.userData.vaultIdx===va.fromVault&&!d.userData.open){openDoorLocally(d);advanceVault(va.fromVault);break;}
        }
      }
    }
  });

  mp.chatRef=mp.roomRef.child('chat');
  mp.chatRef.limitToLast(50).on('child_added',snap=>{const msg=snap.val();appendChatMessage(msg.username,msg.text,msg.ts);});
  showChatPanel();
}

function updateLobbyPlayerList(players){
  const container=$('mp-lobby-players');if(!container)return;
  container.innerHTML='';
  const entries=Object.entries(players);const count=entries.length;
  const waitMsg=$('mp-lobby-waiting-msg');const startBtn=$('btn-lobby-start');const hostHint=$('mp-lobby-host-hint');
  if(count<2){if(waitMsg)waitMsg.textContent='2 OR MORE PLAYERS NEEDED TO START';}
  else{if(waitMsg)waitMsg.textContent=count+' PLAYERS READY';}
  if(mp.isHost){if(startBtn)startBtn.classList.toggle('hidden',count<2);if(hostHint)hostHint.classList.add('hidden');}
  else{if(startBtn)startBtn.classList.add('hidden');if(hostHint)hostHint.classList.remove('hidden');}
  entries.forEach(([id,p])=>{
    const row=document.createElement('div');row.className='lobby-player-row'+(p.isHost?' is-host':'');
    const name=document.createElement('span');name.className='lobby-player-name';name.textContent=p.username||'???';row.appendChild(name);
    if(p.isHost){const b=document.createElement('span');b.className='lobby-player-badge host';b.textContent='HOST';row.appendChild(b);}
    if(id===mp.playerId){const b=document.createElement('span');b.className='lobby-player-badge you';b.textContent='YOU';row.appendChild(b);}
    container.appendChild(row);
  });
}

function updateRemotePlayers(data){
  if(!scene)return;
  const activeIds=new Set(Object.keys(data));
  for(const id in remotePlayerMeshes){
    if(!activeIds.has(id)||id===mp.playerId){scene.remove(remotePlayerMeshes[id]);delete remotePlayerMeshes[id];}
  }
  for(const id in data){
    if(id===mp.playerId)continue;
    const p=data[id];
    let remoteSkin=null;
    try{if(p.skin)remoteSkin=JSON.parse(p.skin);}catch(e){}
    if(!remotePlayerMeshes[id]){
      const mesh=buildPlayerModel(p.username||'???',remoteSkin);
      mesh.userData.anim=createAnimState();
      mesh.userData.prevX=p.x||0;mesh.userData.prevZ=p.z||2;
      scene.add(mesh);remotePlayerMeshes[id]=mesh;
    }else{
      const existingSkin=remotePlayerMeshes[id].userData.skinData;
      if(remoteSkin&&JSON.stringify(remoteSkin)!==JSON.stringify(existingSkin)){
        const oldAnim=remotePlayerMeshes[id].userData.anim;
        scene.remove(remotePlayerMeshes[id]);
        const mesh=buildPlayerModel(p.username||'???',remoteSkin);
        mesh.userData.anim=oldAnim||createAnimState();
        mesh.userData.prevX=p.x||0;mesh.userData.prevZ=p.z||2;
        scene.add(mesh);remotePlayerMeshes[id]=mesh;
      }
    }
    const mesh=remotePlayerMeshes[id];
    const dx=(p.x||0)-(mesh.userData.prevX||0);const dz=(p.z||0)-(mesh.userData.prevZ||0);
    const isMoving=Math.sqrt(dx*dx+dz*dz)>0.01;
    mesh.userData.prevX=p.x||0;mesh.userData.prevZ=p.z||2;
    const anim=mesh.userData.anim;
    if(p.dance&&p.dance!==anim.mode&&DANCE_EMOTES[p.dance]){
      anim.mode=p.dance;anim.timer=0;anim.danceLoop=0;anim.blendAlpha=0;
      showDanceEmoteLabel(mesh,DANCE_EMOTES[p.dance].name);
    }else if(!p.dance&&anim.mode.startsWith('dance')){anim.mode='idle';anim.timer=0;}
    mesh.userData.isMoving=isMoving;
    mesh.position.set(p.x||0,0,p.z||2);
    if(!anim.mode.startsWith('dance2'))mesh.rotation.y=(p.yaw||0)+Math.PI;
    mesh.visible=p.alive!==false;
    if(mesh.userData.label&&camera)mesh.userData.label.quaternion.copy(camera.quaternion);
  }
}

function sendMPUpdate(){
  if(!mp.active||!mp.playerRef||state.phase==='menu')return;
  mp.playerRef.update({x:parseFloat(playerObj.position.x.toFixed(2)),z:parseFloat(playerObj.position.z.toFixed(2)),yaw:parseFloat(state.yaw.toFixed(3)),vault:state.vault,hp:Math.round(state.hp),alive:state.phase!=='dead',ts:Date.now()});
}

function sendChat(text){
  const trimmed=text.trim();
  const danceMatch=trimmed.match(/^\/dance([123])$/i);
  if(danceMatch){triggerLocalDance('dance'+danceMatch[1]);return;}
  if(!mp.active||!mp.chatRef||!trimmed)return;
  mp.chatRef.push({username:SETTINGS.username,text:trimmed.slice(0,120),ts:Date.now()});
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
function showMPLobby(code){$('mp-lobby').classList.remove('hidden');$('mp-lobby-code').textContent=code;updateLobbyPlayerList(mp.players);}

// ── REMOTE PLAYER LABELS + ANIMATIONS ──
function updateRemoteLabels(){
  if(!camera)return;
  const t=clock?clock.elapsedTime:0;
  for(const id in remotePlayerMeshes){
    const mesh=remotePlayerMeshes[id];if(!mesh)continue;
    if(mesh.userData.label)mesh.userData.label.quaternion.copy(camera.quaternion);
    if(mesh.userData.anim)applyPlayerAnimation(mesh,mesh.userData.anim,0.016,t,mesh.userData.isMoving||false);
  }
  // Tick local dance state
  if(localAnim.mode.startsWith('dance')){
    localAnim.timer+=0.016;
    const cfg=DANCE_EMOTES[localAnim.mode];
    const maxLoops=localAnim.mode==='dance3'?3:(localAnim.mode==='dance2'?2:3);
    if(cfg&&localAnim.timer>cfg.duration){
      localAnim.danceLoop++;
      if(localAnim.danceLoop>=maxLoops){localAnim.mode='idle';localAnim.timer=0;localAnim.danceLoop=0;}
      else localAnim.timer=0;
    }
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
if(unInput){unInput.value=SETTINGS.username;unInput.addEventListener('input',()=>{const v=unInput.value.trim();if(v.length>0&&v.length<=20)SETTINGS.username=v;});}

// ── MENU WIRING ──
$('btn-play').addEventListener('click',()=>{$('mode-select').classList.remove('hidden');$('menu-buttons').classList.add('hidden');});
$('btn-singleplayer').addEventListener('click',()=>{initThree();$('mode-select').classList.add('hidden');$('menu-buttons').classList.remove('hidden');startGame();});
$('btn-multiplayer').addEventListener('click',()=>{$('mode-select').classList.add('hidden');$('mp-panel').classList.remove('hidden');});
$('btn-mp-create').addEventListener('click',()=>{initThree();createRoom();$('mp-panel').classList.add('hidden');});
$('btn-mp-join').addEventListener('click',()=>{const code=$('mp-code-input').value.trim().toUpperCase();if(code.length!==4){alert('Enter a 4-character room code');return;}initThree();joinRoom(code);$('mp-panel').classList.add('hidden');});
$('btn-mp-back').addEventListener('click',()=>{$('mp-panel').classList.add('hidden');$('menu-buttons').classList.remove('hidden');});
$('btn-mode-back').addEventListener('click',()=>{$('mode-select').classList.add('hidden');$('menu-buttons').classList.remove('hidden');});
$('btn-how').addEventListener('click',()=>$('how-to-play').classList.toggle('hidden'));

$('btn-lobby-start').addEventListener('click',()=>{
  if(!mp.isHost)return;
  const count=Object.keys(mp.players).length;
  if(count<2){showToast('Need at least 2 players to start!');return;}
  mp.roomRef.child('game/state').set('playing');
  $('mp-lobby').classList.add('hidden');$('mp-status').classList.remove('hidden');startGame();
});

$('btn-retry').addEventListener('click',()=>{deathEl.classList.add('hidden');canvas.style.display='block';hudEl.classList.remove('hidden');startGame();});
$('btn-menu-death').addEventListener('click',()=>{
  if(mp.active&&mp.playerRef){mp.playerRef.remove();mp.active=false;mp.isHost=false;}
  deathEl.classList.add('hidden');menuEl.classList.remove('hidden');
  $('menu-buttons').classList.remove('hidden');$('mode-select').classList.add('hidden');state.phase='menu';
});
$('btn-play-again').addEventListener('click',()=>{winEl.classList.add('hidden');canvas.style.display='block';hudEl.classList.remove('hidden');startGame();});

const chatInput=$('chat-input');
if(chatInput){
  chatInput.addEventListener('keydown',e=>{
    if(e.code==='Enter'){e.preventDefault();sendChat(chatInput.value);chatInput.value='';chatInput.blur();closeChat();}
    if(e.code==='Escape'){e.preventDefault();chatInput.blur();closeChat();}
    e.stopPropagation();
  });
  chatInput.addEventListener('keyup',e=>e.stopPropagation());
  chatInput.addEventListener('focus',()=>{state.chatOpen=true;if(document.pointerLockElement)document.exitPointerLock();plOverlay.classList.add('hidden');});
  chatInput.addEventListener('blur',()=>{setTimeout(()=>{if(state.chatOpen)state.chatOpen=false;},100);});
}

document.addEventListener('contextmenu',e=>e.preventDefault());

(function addCustomizeBtn(){
  const si=$('settings-inner');if(!si)return;
  const btn=document.createElement('button');
  btn.id='btn-open-skin';btn.className='menu-btn';btn.style.marginTop='12px';btn.textContent='🎨 CUSTOMIZE SKIN';
  btn.addEventListener('click',()=>{closeSettings();openSkinEditor();});
  const closeBtn=$('btn-close-settings');si.insertBefore(btn,closeBtn);
})();

// ── SURGE / ECHO DELAYED SPAWNS ──
function spawnSurgeDelayed(){
  const s=monsters.surge;if(!s)return;
  s.active=false;s.waiting=true;s.waitTimer=0;s.waitDuration=2.0;
  s.speed=16+state.vault*.08;
  s.mesh.position.set((Math.random()-.5)*2,0,playerObj.position.z-RD*2.5);s.mesh.visible=true;
  const msgs=['💨 IT\'S COMING—','⚡ MOVE. NOW.','💀 SOMETHING CHARGES','⚡ RUN.'];
  showToast(msgs[Math.floor(Math.random()*msgs.length)]);
  let vol=0;const roarAudio=new Audio(SOUND_FILES['surgeRoar']);roarAudio.volume=0;roarAudio.loop=true;
  try{roarAudio.play().catch(()=>{});}catch(e){}
  s.roarAudio=roarAudio;
  s.roarFadeInterval=setInterval(()=>{vol=Math.min(1,vol+.08);roarAudio.volume=vol;if(vol>=1){clearInterval(s.roarFadeInterval);s.roarFadeInterval=null;}},100);
}
function spawnEchoDelayed(){
  const e=monsters.echo;if(!e)return;
  e.active=false;e.waiting=true;e.waitTimer=0;e.waitDuration=2.0;
  e.bounces=0;e.maxBounces=4+Math.floor(Math.random()*5);e.speed=11+state.vault*.05;
  e.dir=-1;e.startZ=playerObj.position.z+RD*2;e.endZ=playerObj.position.z-RD*3;
  e.mesh.position.set((Math.random()-.5)*RW*.5,0,e.startZ);e.mesh.visible=true;
  const msgs=['👁 IT KNOWS WHERE YOU ARE','👁 IT\'S ALREADY AHEAD OF YOU','👁 NO ESCAPE','👁 IT SEES YOU'];
  showToast(msgs[Math.floor(Math.random()*msgs.length)]);
  let vol=0;const roarAudio=new Audio(SOUND_FILES['echoRoar']);roarAudio.volume=0;roarAudio.loop=true;
  try{roarAudio.play().catch(()=>{});}catch(e2){}
  e.roarAudio=roarAudio;
  e.roarFadeInterval=setInterval(()=>{vol=Math.min(1,vol+.08);roarAudio.volume=vol;if(vol>=1){clearInterval(e.roarFadeInterval);e.roarFadeInterval=null;}},100);
}
function clearMonsterRoar(m){
  if(m.roarAudio){try{m.roarAudio.pause();m.roarAudio.currentTime=0;}catch(e){}m.roarAudio=null;}
  if(m.roarFadeInterval){clearInterval(m.roarFadeInterval);m.roarFadeInterval=null;}
}

// ── PUSH MONSTER ──
function spawnPush(){
  const p=monsters.push;if(!p)return;
  p.active=true;p.timer=0;p.maxTime=6+Math.random()*4;
  p.mesh.position.set((Math.random()-.5)*RW*.6,0,playerObj.position.z-1);
  p.mesh.visible=false;
}
function updatePush(dt){
  const p=monsters.push;if(!p||!p.active)return;
  if(!state.inCloset){p.timer=0;p.mesh.visible=false;return;}
  p.mesh.visible=true;p.timer+=dt;
  if(p.aL)p.aL.rotation.z=-0.45+Math.sin(p.timer*3)*.2;
  if(p.aR)p.aR.rotation.z=0.45-Math.sin(p.timer*3)*.2;
  if(p.pw)p.pw.intensity=1.8+Math.sin(p.timer*8)*.6;
  const warn=p.maxTime*.7;
  if(p.timer>warn&&p.timer<warn+dt*2)showToast('👁 Something is pushing the door...');
  if(p.timer>=p.maxTime){showToast('💀 PUSHED OUT!');exitCloset();dealDamage(20,'push');flashDmg();p.active=false;p.mesh.visible=false;SFX.creak();}
}

// ── LURK CHASE SEQUENCE ──
function startLurkChase(){
  if(state.chaseActive)return;
  state.chaseActive=true;state.chaseTimer=0;
  const lk=monsters.lurk;if(!lk)return;
  lk.active=true;lk.chasePhase=true;lk.speed=4.5;
  lk.mesh.position.set(0,0,playerObj.position.z-RD*4);lk.mesh.visible=true;
  spawnChaseObstacles();
  showToast('🩸 IT\'S BEHIND YOU. DON\'T STOP.');
  playSound('wardenRoar',1.0);
  if(scene)scene.fog=new THREE.FogExp2(0x1a0000,.14);
}
function spawnChaseObstacles(){
  state.chaseObstacles.forEach(o=>{if(o.mesh)scene.remove(o.mesh);});state.chaseObstacles=[];
  const startZ=playerObj.position.z+RD;
  for(let i=0;i<18;i++){
    const z=startZ+i*RD*.25+Math.random()*4;const x=(Math.random()-.5)*(RW-2.2);
    const doorGeo=GEO.box(1.5,2.6,.12);const doorMesh=new THREE.Mesh(doorGeo,MAT.door);
    doorMesh.position.set(x,1.3,z);
    const pivot=new THREE.Group();pivot.position.set(x-.75,0,z);
    doorMesh.position.set(.75,1.3,0);pivot.add(doorMesh);
    pivot.userData.isChaseObstacle=true;pivot.userData.swingSpeed=1.5+Math.random()*2;
    pivot.userData.swingAmp=Math.PI*.55+Math.random()*.3;pivot.userData.phase=Math.random()*Math.PI*2;
    pivot.userData.obstacleZ=z;pivot.userData.obstacleX=x;
    scene.add(pivot);state.chaseObstacles.push({mesh:pivot,z,x});
  }
}
function updateLurkChase(dt){
  if(!state.chaseActive)return;
  state.chaseTimer+=dt;
  const lk=monsters.lurk;if(!lk||!lk.active)return;
  if(state.vault>=46){endLurkChase();return;}
  const toPlayer=new THREE.Vector3().subVectors(playerObj.position,lk.mesh.position);toPlayer.y=0;
  const dist=toPlayer.length();
  if(dist>.5){toPlayer.normalize();lk.mesh.position.addScaledVector(toPlayer,lk.speed*dt);}
  lk.mesh.lookAt(playerObj.position.x,lk.mesh.position.y,playerObj.position.z);
  if(lk.pw)lk.pw.intensity=2.5+Math.sin(state.chaseTimer*6)*.8;
  lk.speed=4.5+state.chaseTimer*.12;
  if(dist<1.1)triggerCatchByMonster('lurk');
  const t=clock.elapsedTime;
  state.chaseObstacles.forEach(ob=>{
    if(!ob.mesh)return;
    ob.mesh.rotation.y=Math.sin(t*ob.mesh.userData.swingSpeed+ob.mesh.userData.phase)*ob.mesh.userData.swingAmp;
    const dx=playerObj.position.x-ob.mesh.userData.obstacleX;const dz=playerObj.position.z-ob.mesh.userData.obstacleZ;
    if(Math.abs(dz)<1.0&&Math.abs(dx)<1.1){dealDamage(12,'obstacle');flashDmg();showToast('💥 DODGE!');playerObj.position.x+=dx>0?0.8:-0.8;}
  });
  wardenAlert.classList.add('active');
  const co=$('chase-overlay');if(co)co.classList.add('active');
}
function endLurkChase(){
  state.chaseActive=false;
  const lk=monsters.lurk;if(lk){lk.active=false;lk.mesh.visible=false;lk.chasePhase=false;}
  state.chaseObstacles.forEach(o=>{if(o.mesh)scene.remove(o.mesh);});state.chaseObstacles=[];
  if(scene){const q=QUALITY[SETTINGS.quality];scene.fog=new THREE.FogExp2(0x080002,q.fog);}
  wardenAlert.classList.remove('active');
  const co=$('chase-overlay');if(co)co.classList.remove('active');
  showToast('✦ You escaped the dark...');
}

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
  updateClosetTimer(dt);
  updatePush(dt);
  updateLurkChase(dt);
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
