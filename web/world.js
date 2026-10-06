import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createOffice } from './offices.js';
import { createHoverFrame } from './hover-frame.js';

export const ROLES = ['ARCHITECT', 'CODER', 'TESTER', 'MANAGER'];
export const COLORS = ['#688fae', '#cf925c', '#a17da2', '#719568'];
const HOMES = [[-4,-3.8],[4,-3.8],[-4,3.6],[4,3.6]];
const mat = (color, extra={}) => new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true,...extra});
const box = (x,y,z) => new THREE.BoxGeometry(x,y,z);

export function createWorld(onSelect) {
  const canvas = document.querySelector('#cv'), stage = document.querySelector('#stage');
  const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.8));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor('#e5eadb'); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  
  const POIs = [
    {name: 'visiting the pond', pos: new THREE.Vector3(4.5, 0, 1.7)},
    {name: 'checking the windmill', pos: new THREE.Vector3(-1.8, 0, -3.2)},
    {name: 'relaxing at the plaza', pos: new THREE.Vector3(0, 0, 1.3)},
    {name: 'taking a walk', pos: new THREE.Vector3(-4, 0, 2)},
    {name: 'enjoying the view', pos: new THREE.Vector3(4, 0, -2)},
    {name: 'stretching legs', pos: new THREE.Vector3(2, 0, -1)}
  ];
  let audioCtx = null;
  let audioEnabled = localStorage.getItem('village-audio') === 'true';
  let hintsEnabled = localStorage.getItem('village-hints') === 'true';
  const tools = document.querySelector('.world-tools');
  if(tools && !document.getElementById('toggle-audio')) {
    const btnAudio = document.createElement('button');
    btnAudio.id = 'toggle-audio';
    btnAudio.textContent = audioEnabled ? '🔊 Audio on' : '🔇 Audio off';
    btnAudio.onclick = () => {
      audioEnabled = !audioEnabled;
      localStorage.setItem('village-audio', audioEnabled);
      btnAudio.textContent = audioEnabled ? '🔊 Audio on' : '🔇 Audio off';
      if(audioEnabled && !audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      if(audioEnabled && audioCtx.state === 'suspended') { audioCtx.resume(); }
    };
    tools.append(btnAudio);
    const btnHints = document.createElement('button');
    btnHints.id = 'toggle-hints';
    btnHints.textContent = hintsEnabled ? '💬 Hints on' : '💬 Hints off';
    btnHints.onclick = () => {
      hintsEnabled = !hintsEnabled;
      localStorage.setItem('village-hints', hintsEnabled);
      btnHints.textContent = hintsEnabled ? '💬 Hints on' : '💬 Hints off';
    };
    tools.append(btnHints);
  }
  function playTone(type) {
    if(!audioEnabled) return;
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    if (type === 'door-enter' || type === 'door-exit') {
      osc.type = type === 'door-enter' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(type === 'door-enter' ? 150 : 200, t);
      osc.frequency.exponentialRampToValueAtTime(type === 'door-enter' ? 100 : 240, t + 0.2);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
    } else if (type === 'work-start') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.1); // E5
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
    } else if (type === 'work-end') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, t); // E5
      osc.frequency.setValueAtTime(523.25, t + 0.15); // C5
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      osc.start(t); osc.stop(t + 0.5);
    }
  }

  const camera = new THREE.OrthographicCamera(-12,12,10,-10,.1,120);
  const controls = new OrbitControls(camera,canvas);
  controls.enableDamping = true; controls.dampingFactor=.08; controls.minZoom=.65; controls.maxZoom=2.8;
  controls.maxPolarAngle=Math.PI/2.3; controls.minPolarAngle=.3; controls.target.set(0,0,0);
  const reset = () => {if(typeof view!=='undefined'&&view.role){camera.position.set(9,10,12);camera.zoom=officeZoom();controls.target.set(0,.6,0);}else{camera.position.set(18,19,22);camera.zoom=1;controls.target.set(0,0,0);}camera.updateProjectionMatrix();controls.update();};
  camera.position.set(18,19,22);controls.update();
  const hemi = new THREE.HemisphereLight('#fff8dd','#9fa782',2.7);scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d1',3.3);sun.position.set(-7,16,9);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13});sun.shadow.normalBias=.03;scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200,200),mat('#e5eadb'));ground.rotation.x=-Math.PI/2;ground.position.y=-.9;ground.receiveShadow=true;scene.add(ground);
  const shared = {wood:mat('#8e6948'),cream:mat('#f5e9cc'),dark:mat('#4f645e'),skin:mat('#e5b98e'),roof:mat('#628781'),stone:mat('#a49884'),brick:mat('#b5795d')};
  function mesh(geo,material,parent,x=0,y=0,z=0) {const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}

  // 1. Layered floating island bedrock and soil strata
  mesh(box(15.2,.6,13.2),mat('#a49577'),scene,0,-.48,0); // upper soil
  mesh(box(14.4,.7,12.4),mat('#7d6e56'),scene,0,-1.02,0); // sub-stratum
  const rock1=mesh(new THREE.ConeGeometry(4.2,2.6,5),mat('#5d5240'),scene,-1.5,-2.2,-0.5);
  rock1.rotation.x=Math.PI;rock1.scale.set(1.4,1,1.1);
  const rock2=mesh(new THREE.ConeGeometry(3.6,2.1,5),mat('#544a3a'),scene,2.5,-1.9,1.2);
  rock2.rotation.x=Math.PI;rock2.scale.set(1.1,1,1.3);

  // 2. Instanced meadow lawn with natural shade variations
  const tiles=new THREE.InstancedMesh(box(.98,.16,.98),mat('#91aa73'),15*13), matrix=new THREE.Matrix4();let n=0;
  for(let x=-7;x<=7;x++)for(let z=-6;z<=6;z++) {
    matrix.makeTranslation(x,-.09,z);tiles.setMatrixAt(n,matrix);
    tiles.setColorAt(n,new THREE.Color((x*3+z*7)%5===0?'#a3b782':(x+z)%2===0?'#98ad79':'#8ea370'));
    n++;
  }
  tiles.receiveShadow=true;scene.add(tiles);

  // 3. Complete cobblestone path network via InstancedMesh (1 draw call)
  const pathMat=mat('#d8c7a5');
  const pathPoints=[];
  // Central ring & cross
  for(let i=-2;i<=2;i++) pathPoints.push([i,0,.9,.92]);
  for(let j=-2;j<=2;j++) if(Math.abs(j)>1) pathPoints.push([0,j,.92,.9]);
  
  // Connect each home dynamically to plaza
  HOMES.forEach(([x,z]) => {
    const angle = Math.atan2(-x, -z);
    const startX = x + Math.sin(angle) * 1.5, startZ = z + Math.cos(angle) * 1.5;
    const dist = Math.hypot(startX, startZ);
    const steps = Math.floor(dist / 0.8);
    for(let s=0; s<=steps; s++) {
      const u = s/steps;
      pathPoints.push([startX * (1-u), startZ * (1-u), .86, .86]);
    }
  });
  
  // Extra scenic paths
  for(let i=-6; i<= -3; i++) pathPoints.push([i,0,.7,.7]); 
  for(let i=3; i<= 6; i++) pathPoints.push([i,0,.7,.7]);
  [[-0.9,-1.8],[-1.4,-2.8],[-1.9,-3.8],[2.2,0.8],[3.1,1.2],[4.0,1.7]].forEach(([px,pz])=>pathPoints.push([px,pz,.72,.72]));

  const pathMesh=new THREE.InstancedMesh(box(1,.08,1),pathMat,pathPoints.length), pMat=new THREE.Matrix4();
  pathPoints.forEach(([px,pz,pw,pd],idx)=>{
    pMat.makeScale(pw,1,pd).setPosition(px,.04,pz);
    pathMesh.setMatrixAt(idx,pMat);
  });
  pathMesh.receiveShadow=true;scene.add(pathMesh);

  // 4. Central circular gathering plaza
  const plaza=mesh(new THREE.CylinderGeometry(2.05,2.05,.12,16),mat('#d5c4a2'),scene,0,.1,0);
  mesh(new THREE.TorusGeometry(2.06,.045,4,24),mat('#b8a88a'),scene,0,.15,0).rotation.x=Math.PI/2;
  const table=mesh(new THREE.CylinderGeometry(.68,.68,.13,8),shared.wood,scene,0,.65,0);
  mesh(box(.24,.55,.24),shared.wood,scene,0,.32,0);
  for(let i=0;i<4;i++){
    let a=i*Math.PI/2;
    const b=mesh(box(.58,.13,.3),shared.wood,scene,Math.cos(a)*1.18,.35,Math.sin(a)*1.18);
    b.rotation.y=-a;
  }
  // Plaza central lantern post
  mesh(new THREE.CylinderGeometry(.04,.06,1.4,6),shared.dark,scene,-1.15,.7,-1.15);
  mesh(box(.16,.2,.16),shared.wood,scene,-1.15,1.45,-1.15);
  mesh(new THREE.SphereGeometry(.07,6,4),mat('#fff3b0',{emissive:'#ffdf6e',emissiveIntensity:.6}),scene,-1.15,1.45,-1.15);

  const wind=[],smoke=[],lamps=[],beacons=[],pickables=[],villagers=[],houses=[],offices=new Map();
  const glassMat=mat('#829d9c');

  function windowUnit(g,wx,wy,wz,ww,wh){
    mesh(box(ww,wh,.07),glassMat,g,wx,wy,wz);
    mesh(box(ww+.08,wh+.08,.05),shared.cream,g,wx,wy,wz-.01);
    mesh(box(ww+.1,.06,.11),shared.wood,g,wx,wy-wh/2,wz+.03);
  }

  // 5. Four distinct architectural structures with zero overlaps and clean clearances
  function building(i){
    const [x,z]=HOMES[i],g=new THREE.Group();g.position.set(x,0,z);
    const angle = Math.atan2(-x, -z);
    g.rotation.y = angle;
    g.userData={role:ROLES[i],kind:'building',name:['Architect’s studio','Coder’s workshop','Tester’s lab','Manager’s hall'][i]};
    scene.add(g);pickables.push(g);
    const roofMaterial=mat(COLORS[i]);
    const pathTop=0.08, plinthH=0.14, plinthY=pathTop+plinthH/2;
    mesh(box(2.3,plinthH,2.0),mat('#bbb298'),g,0,plinthY,0);
    const baseY=pathTop+plinthH, structure=new THREE.Group();g.add(structure);
    const hinge=new THREE.Group();g.add(hinge);

    const doorway=(w,h,dz)=>{
      mesh(box(w+.12,h+.12,.06),shared.wood,structure,0,h/2+baseY,dz+.03);
      mesh(box(w,h,.04),shared.dark,structure,0,h/2+baseY,dz+.01);
    };
    const doorLeaf=(w,h,dx,dz)=>{
      hinge.position.set(dx,baseY,dz);
      mesh(box(w,h,.06),shared.wood,hinge,w/2,h/2,0);
      mesh(new THREE.SphereGeometry(.035,5,4),mat('#d9be71'),hinge,w-.1,.55,.045);
    };
    const pyramid=(r,h,y,sz=0.88)=>{
      const roof=mesh(new THREE.ConeGeometry(r,h,4),roofMaterial,structure,0,y,0);
      roof.rotation.y=Math.PI/4;roof.scale.z=sz;return roof;
    };
    const pole=(px,py,pz,ph)=>{mesh(new THREE.CylinderGeometry(.025,.025,ph,6),shared.wood,g,px,ph/2,pz);};
    let lampPos,chimney=null;

    if(i===0){
      // ARCHITECT: Tall narrow drafting tower with steep spire & timber framing
      const baseH=0.16, wallY=baseY+baseH, wallH=2.1, wallTop=wallY+wallH;
      mesh(box(1.62,baseH,1.62),shared.wood,structure,0,baseY+baseH/2,0);
      mesh(box(1.5,wallH,1.4),shared.cream,structure,0,wallY+wallH/2,0);
      // Half-timbering corner posts
      for(const sx of [-.73,.73]) for(const sz of [-.68,.68]) mesh(box(.06,wallH,.06),shared.wood,structure,sx,wallY+wallH/2,sz);
      doorway(.5,1.0,.7);doorLeaf(.48,.96,-.24,.72);
      mesh(box(.62,.07,.24),mat('#9e9484'),g,0,.14,.82); // stone entry step
      const roofH=1.5;pyramid(1.3,roofH,wallTop+roofH/2);
      mesh(box(1.62,.06,1.52),shared.wood,structure,0,wallTop,0); // eave fascia
      // Brick chimney piercing roof with stone rain cap
      mesh(box(.24,1.1,.24),mat('#ab8872'),structure,.45,3.05,-.35);
      mesh(box(.32,.05,.32),mat('#8c7768'),structure,.45,3.62,-.35);
      chimney={x:x+.45,y:3.68,z:z-.35};
      // Side lancet windows
      for(const sx of [-1,1]){
        mesh(box(.04,.9,.34),glassMat,g,sx*.77,wallY+1.0,0);
        mesh(box(.06,.96,.04),shared.wood,g,sx*.77,wallY+1.0,.18);
        mesh(box(.06,.96,.04),shared.wood,g,sx*.77,wallY+1.0,-.18);
        mesh(box(.06,.04,.4),shared.wood,g,sx*.77,wallY+.53,0);
      }
      windowUnit(g,0,wallY+1.4,.72,.4,.4);
      // Window flower box
      mesh(box(.48,.09,.12),shared.wood,g,0,wallY+1.14,.76);
      mesh(box(.44,.05,.08),mat('#5c8552'),g,0,wallY+1.19,.76);
      // Sturdy yard drafting easel (A-frame trestle, angled tabletop, blueprints, stool)
      mesh(box(.06,.46,.48),shared.wood,g,-1.35,.27,.9);
      mesh(box(.75,.05,.05),shared.wood,g,-1.35,.15,.9);
      const board=mesh(box(.92,.05,.58),shared.wood,g,-1.35,.56,.9);board.rotation.x=-.22;
      mesh(box(.65,.02,.42),mat('#c8dde1'),board,0,.035,0);
      mesh(new THREE.CylinderGeometry(.16,.18,.3,6),shared.wood,g,-1.35,.19,1.35); // drafting stool
      lampPos=[.42,baseY+.85,.75];
      pole(-1.0,1.6,-.3,1.6);
      mesh(box(.14,.18,.14),mat('#9e9484'),g,-1.0,.09,-.3); // stone base
      const flag=mesh(box(.46,.26,.025),roofMaterial,g,-.75,wallY+1.4,-.3);wind.push({node:flag,phase:i,flag:true});
    }else if(i===1){
      // CODER: Wide workshop with hipped roof fully covering walls (zero wall poke-through)
      const baseH=0.14, wallY=baseY+baseH, wallH=1.15, wallTop=wallY+wallH;
      mesh(box(2.45,baseH,1.85),shared.wood,structure,0,baseY+baseH/2,0);
      mesh(box(2.3,wallH,1.65),shared.cream,structure,0,wallY+wallH/2,0);
      doorway(.52,1.0,.825);doorLeaf(.5,.96,-.25,.845);
      mesh(box(.64,.07,.24),mat('#9e9484'),g,0,.14,.95);
      // Hipped roof matching 2.3x1.65 with uniform eaves
      const rCone=mesh(new THREE.ConeGeometry(1.5,.82,4),roofMaterial,structure,0,wallTop+.41,0);
      rCone.rotation.y=Math.PI/4;rCone.scale.set(1.20,1,0.94);
      // Forge smokestack with terracotta flue pot
      mesh(box(.3,.85,.3),mat('#ab6d51'),structure,.75,1.75,-.35);
      mesh(new THREE.CylinderGeometry(.09,.11,.25,6),mat('#b56345'),structure,.75,2.22,-.35);
      chimney={x:x+.75,y:2.38,z:z-.35};
      windowUnit(g,-.75,wallY+.58,.85,.44,.44);
      windowUnit(g,.75,wallY+.58,.85,.44,.44);
      mesh(box(.05,.5,.3),glassMat,g,1.17,wallY+.5,0);
      // Outdoor tech workbench with legs, CRT screen & component crate
      mesh(box(.8,.06,.5),shared.wood,g,1.75,.42,.6);
      for(const lx of [-.34,.34]) for(const lz of [-.19,.19]) mesh(box(.06,.4,.06),shared.wood,g,1.75+lx,.22,.6+lz);
      mesh(box(.42,.3,.12),shared.dark,g,1.75,.62,.6);
      mesh(box(.36,.24,.02),mat('#6ed197',{emissive:'#368056',emissiveIntensity:.4}),g,1.75,.62,.66);
      mesh(box(.36,.26,.3),mat('#a8845b'),g,1.75,.15,1.05); // component crate
      lampPos=[.5,baseY+.85,.97];
      pole(-1.35,1.6,-.4,1.6);
      mesh(box(.14,.18,.14),mat('#9e9484'),g,-1.35,.09,-.4);
      const flag=mesh(box(.5,.28,.025),roofMaterial,g,-1.08,wallY+1.1,-.4);wind.push({node:flag,phase:i,flag:true});
    }else if(i===2){
      // TESTER: Decagonal observatory tower with matching 10-sided conical roof & brass telescope
      const baseH=0.14, wallY=baseY+baseH, wallH=1.7, wallTop=wallY+wallH;
      mesh(new THREE.CylinderGeometry(1.12,1.16,baseH,10),shared.wood,structure,0,baseY+baseH/2,0);
      mesh(new THREE.CylinderGeometry(1.02,1.08,wallH,10),shared.cream,structure,0,wallY+wallH/2,0);
      doorway(.5,1.0,1.06);doorLeaf(.48,.96,-.24,1.08);
      mesh(box(.6,.06,.2),mat('#9e9484'),g,0,.15,1.15); // threshold
      // 10-sided cone matching the 10-sided cylinder (zero facet clipping!)
      const roofH=0.95;mesh(new THREE.ConeGeometry(1.24,roofH,10),roofMaterial,structure,0,wallTop+roofH/2,0);
      // Observation cupola & glowing testing beacon
      mesh(new THREE.CylinderGeometry(.22,.26,.14,8),mat('#baa570'),structure,0,wallTop+roofH+.07,0);
      const beacon=mesh(new THREE.SphereGeometry(.1,8,6),mat('#ffd166',{emissive:'#ffb347',emissiveIntensity:.4}),structure,0,wallTop+roofH+.20,0);
      beacons.push(beacon);
      mesh(new THREE.CylinderGeometry(.015,.02,.35,4),mat('#baa570'),structure,0,wallTop+roofH+.42,0); // antenna
      // Brass portholes
      for(const sx of [-.55,.55]){
        mesh(new THREE.TorusGeometry(.17,.035,6,10),shared.cream,g,sx,wallY+1.0,.92);
        mesh(new THREE.CylinderGeometry(.15,.15,.04,8),glassMat,g,sx,wallY+1.0,.90).rotation.x=Math.PI/2;
      }
      // Brass Astronomical Telescope on sturdy wooden tripod
      const tele=new THREE.Group();tele.position.set(-1.55,0,.3);g.add(tele);
      for(let k=0;k<3;k++){
        const ang=k*Math.PI*2/3;
        const leg=mesh(new THREE.CylinderGeometry(.025,.02,.75,4),shared.wood,tele,Math.cos(ang)*.18,.36,Math.sin(ang)*.18);
        leg.rotation.z=-Math.cos(ang)*.25;leg.rotation.x=Math.sin(ang)*.25;
      }
      mesh(new THREE.CylinderGeometry(.08,.08,.12,6),mat('#baa570'),tele,0,.72,0);
      const tube=mesh(new THREE.CylinderGeometry(.06,.08,.85,8),mat('#c9b78b'),tele,0,.82,0);
      tube.rotation.x=-Math.PI/3;
      mesh(new THREE.CylinderGeometry(.02,.02,.35,6),mat('#5a5242'),tube,0,0,.09);
      lampPos=[.45,baseY+.85,1.02];
      pole(1.25,1.4,-.5,1.4);
      mesh(box(.14,.18,.14),mat('#9e9484'),g,1.25,.09,-.5);
      const flag=mesh(box(.44,.25,.025),roofMaterial,g,1.5,wallY+1.1,-.5);wind.push({node:flag,phase:i,flag:true});
    }else{
      // MANAGER: Double-height civic hall, watertight two-tier clerestory & clock tower
      const baseH=0.16, wallY=baseY+baseH, wallH=1.75, wallTop=wallY+wallH;
      mesh(box(2.42,baseH,1.94),shared.wood,structure,0,baseY+baseH/2,0);
      mesh(box(2.3,wallH,1.85),shared.cream,structure,0,wallY+wallH/2,0);
      doorway(.56,1.1,.925);doorLeaf(.54,1.06,-.27,.945);
      mesh(box(.7,.06,.35),mat('#9e9484'),g,0,.07,1.25); // stone entry steps
      // Columned portico
      for(const sx of [-.92,.92]) mesh(box(.14,1.05,.14),shared.wood,structure,sx,.76,1.15);
      mesh(box(2.25,.12,.55),shared.wood,structure,0,1.33,1.15);
      // Lower hip roof
      const roof1H=0.85;pyramid(1.62,roof1H,wallTop+roof1H/2,.95);
      // Watertight clerestory walls extending down into lower roof (zero daylight gap)
      mesh(box(1.05,.95,.95),shared.cream,structure,0,2.75,0);
      // Upper pyramid roof
      const rUpper=mesh(new THREE.ConeGeometry(0.92,.65,4),roofMaterial,structure,0,3.55,0);
      rUpper.rotation.y=Math.PI/4;rUpper.scale.z=0.92;
      // Town Clock on upper pediment
      const clock=mesh(new THREE.CylinderGeometry(.22,.22,.06,12),shared.cream,g,0,2.85,.50);clock.rotation.x=Math.PI/2;
      mesh(new THREE.TorusGeometry(.23,.025,4,16),shared.dark,g,0,2.85,.51);
      mesh(box(.02,.14,.02),shared.dark,g,0,2.88,.54);
      windowUnit(g,-.82,wallY+.95,.95,.44,.6);windowUnit(g,.82,wallY+.95,.95,.44,.6);
      // Fireplace chimney with stone cap
      mesh(box(.28,.85,.28),mat('#ab8872'),structure,-.85,2.25,-.5);
      mesh(box(.34,.05,.34),mat('#8c7768'),structure,-.85,2.70,-.5);
      chimney={x:x-.85,y:2.76,z:z-.5};
      // Village Announcement Notice Board & bench
      mesh(box(.06,.85,.06),shared.wood,g,1.35,.45,.4);
      mesh(box(.06,.85,.06),shared.wood,g,1.95,.45,.4);
      mesh(box(.75,.45,.04),shared.wood,g,1.65,.62,.4);
      mesh(box(.65,.35,.02),mat('#eadeb8'),g,1.65,.62,.43);
      mesh(box(.85,.06,.12),mat('#6d7a72'),g,1.65,.86,.4);
      mesh(box(.7,.06,.26),shared.wood,g,1.65,.22,.85);
      for(const bx of [-.28,.28]) mesh(box(.05,.2,.22),shared.wood,g,1.65+bx,.1,.85);
      lampPos=[.55,baseY+.9,1.05];
      pole(-1.45,1.7,-.5,1.7);
      mesh(box(.14,.18,.14),mat('#9e9484'),g,-1.45,.09,-.5);
      const flag=mesh(box(.5,.28,.025),roofMaterial,g,-1.15,wallY+1.3,-.5);wind.push({node:flag,phase:i,flag:true});
    }
    houses.push({group:g,structure,hinge,door:0});
    const lamp=mesh(new THREE.SphereGeometry(.09,6,5),mat('#f5d485',{emissive:'#f6b851',emissiveIntensity:.2}),g,lampPos[0],lampPos[1],lampPos[2]);
    lamps.push(lamp);
    if(chimney)for(let k=0;k<4;k++){
      const p=mesh(new THREE.IcosahedronGeometry(.13,0),mat('#f6f1e3',{transparent:true,opacity:.4,depthWrite:false}),scene,chimney.x,chimney.y,chimney.z);
      smoke.push({node:p,x:chimney.x,y0:chimney.y,z:chimney.z,phase:k/4+i*.1});
    }
  }
  ROLES.forEach((_,i)=>building(i));

  // 6. Varied trees: deciduous oaks and evergreen pines
  function tree(x,z,scale=1,type='oak'){
    const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);scene.add(g);
    mesh(new THREE.CylinderGeometry(.08,.13,.75,5),shared.wood,g,0,.38,0);
    if(type==='pine'){
      const b1=mesh(new THREE.ConeGeometry(.5,.6,5),mat('#4e6d4c'),g,0,.85,0);
      const b2=mesh(new THREE.ConeGeometry(.38,.5,5),mat('#587a55'),g,0,1.25,0);
      wind.push({node:b1,phase:x+z},{node:b2,phase:x+z+.3});
    }else{
      const crown=mesh(new THREE.IcosahedronGeometry(.65,0),mat('#688c5a'),g,0,1.08,0);crown.scale.y=1.2;
      wind.push({node:crown,phase:x+z});
    }
  }
  [[-6,-5,'pine'],[-6,-2,'oak'],[-6,4,'oak'],[-6,5.5,'pine'],[6,-5,'oak'],[6,-1,'pine'],[6,5.5,'oak'],[-2,-5.5,'oak'],[2,5.5,'pine'],[-2,5.5,'oak']].forEach(([x,z,t],i)=>tree(x,z,.75+(i%3)*.15,t));

  // 7. Organic pond with stone shoreline, water lilies and arched footbridge
  const pond=mesh(new THREE.CylinderGeometry(1.2,1.3,.09,10),mat('#6ea39f',{metalness:.2,roughness:.25,transparent:true,opacity:.88}),scene,5.5,.06,1.7);
  // Shoreline stones via InstancedMesh (1 draw call)
  const stonePoints=[[-1.2,-.4],[-1.1,.6],[-.4,1.2],[.6,1.1],[1.2,.3],[1.1,-.6],[.2,-1.2]];
  const stoneMesh=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.18,0),mat('#8f8473'),stonePoints.length), sMat=new THREE.Matrix4();
  stonePoints.forEach(([sx,sz],idx)=>{sMat.makeTranslation(5.5+sx,.08,1.7+sz);stoneMesh.setMatrixAt(idx,sMat);});
  scene.add(stoneMesh);
  // Water lilies with blossoms
  mesh(new THREE.CylinderGeometry(.14,.14,.015,6),mat('#588755'),scene,5.1,.11,1.3);
  mesh(new THREE.OctahedronGeometry(.04,0),mat('#fff3a8'),scene,5.1,.13,1.3);
  mesh(new THREE.CylinderGeometry(.12,.12,.015,6),mat('#588755'),scene,5.9,.11,2.1);
  const ripples=[];
  for(let i=0;i<3;i++){
    const ring=mesh(new THREE.TorusGeometry(.28+i*.2,.012,3,14),mat('#d4e4d4'),scene,5.5,.11,1.7);
    ring.rotation.x=Math.PI/2;ripples.push(ring);
  }
  // Arched wooden footbridge spanning across the pond
  for(const px of [4.9,6.0]) for(const pz of [1.32,2.08]) mesh(new THREE.CylinderGeometry(.035,.035,.4,5),shared.wood,scene,px,.18,pz);
  for(const pz of [1.32,2.08]){
    mesh(box(1.35,.07,.06),shared.wood,scene,5.45,.28,pz);
    mesh(box(1.35,.04,.04),shared.wood,scene,5.45,.42,pz);
  }
  const plankMesh=new THREE.InstancedMesh(box(.18,.05,.76),shared.wood,6), plMat=new THREE.Matrix4();
  for(let k=0;k<6;k++){
    const u=k/5, px=4.85+u*1.2, py=.26+Math.sin(u*Math.PI)*.08;
    plMat.makeTranslation(px,py,1.7);plankMesh.setMatrixAt(k,plMat);
  }
  scene.add(plankMesh);
  // Shoreline reeds & cattails
  [[5.0,2.3],[6.1,1.1],[6.2,2.2]].forEach(([rx,rz])=>{
    mesh(new THREE.CylinderGeometry(.015,.015,.45,4),mat('#58754b'),scene,rx,.22,rz);
    mesh(new THREE.CylinderGeometry(.025,.025,.1,5),mat('#6b4c35'),scene,rx,.38,rz);
  });
  // Wildflower accents via InstancedMesh (1 draw call)
  const flowerPoints=[];
  for(let i=0;i<24;i++){
    const x=Math.sin(i*7.7)*6.4,z=Math.cos(i*4.1)*5.6;
    if(Math.abs(x)<1.7||HOMES.some(([a,b])=>Math.hypot(x-a,z-b)<1.8)||Math.hypot(x-5.5,z-1.7)<1.6)continue;
    flowerPoints.push([x,z,i%2===0]);
  }
  const flowerMesh=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.085,0),mat('#e6c36c'),flowerPoints.length), fMat=new THREE.Matrix4();
  flowerPoints.forEach(([fx,fz,isGold],idx)=>{
    fMat.makeTranslation(fx,.16,fz);
    flowerMesh.setMatrixAt(idx,fMat);
    flowerMesh.setColorAt(idx,new THREE.Color(isGold?'#ebd17d':'#f3ebd8'));
  });
  scene.add(flowerMesh);

  // 8. Completed Windmill with masonry base, cap roof, axle housing & 4 lattice sails
  mesh(new THREE.CylinderGeometry(.72,.88,.38,8),mat('#a89b88'),scene,-1.9,.19,-4.8);
  mesh(new THREE.CylinderGeometry(.52,.72,1.8,8),shared.cream,scene,-1.9,1.25,-4.8);
  mesh(new THREE.CylinderGeometry(.56,.56,.1,8),shared.wood,scene,-1.9,2.18,-4.8);
  mesh(new THREE.ConeGeometry(.65,.68,8),mat('#5a6b63'),scene,-1.9,2.57,-4.8);
  mesh(box(.32,.56,.06),shared.wood,scene,-1.9,.38,-4.06);
  mesh(box(.4,.08,.08),shared.dark,scene,-1.9,.68,-4.06);
  mesh(box(.22,.22,.28),shared.wood,scene,-1.9,2.22,-4.36);
  const mill=new THREE.Group();mill.position.set(-1.9,2.22,-4.2);scene.add(mill);
  const hub=mesh(new THREE.CylinderGeometry(.12,.12,.12,6),shared.wood,mill,0,0,0);hub.rotation.x=Math.PI/2;
  for(let i=0;i<4;i++){
    const sail=new THREE.Group();sail.rotation.z=i*Math.PI/2;
    mesh(box(.05,1.4,.04),shared.wood,sail,0,.7,0);
    mesh(box(.22,.55,.02),mat('#e8dfcc'),sail,.12,.85,.01);
    mill.add(sail);
  }

  // Role characters have feet, arms, faces, hair and a distinctive hat.
  for(let i=0;i<4;i++){
    const g=new THREE.Group();g.position.set((i-1.5)*1.15,0,1.8);g.userData={role:ROLES[i],kind:'character',name:ROLES[i][0]+ROLES[i].slice(1).toLowerCase()};scene.add(g);pickables.push(g);
    const body=new THREE.Group();g.add(body);mesh(box(.34,.4,.23),mat(COLORS[i]),body,0,.54,0);
    mesh(new THREE.IcosahedronGeometry(.19,1),shared.skin,body,0,.95,0);
    mesh(new THREE.SphereGeometry(.197,6,3,0,Math.PI*2,0,Math.PI/2),mat('#695042'),body,0,1.01,0);
    for(const x of [-.065,.065])mesh(box(.025,.027,.022),shared.dark,body,x,.97,.167);
    if(i===1)mesh(new THREE.CylinderGeometry(.21,.23,.09,7),mat('#e7bd58'),body,0,1.13,0);
    if(i===0)mesh(box(.34,.03,.08),shared.dark,body,0,.99,.185);
    const legs=[],arms=[];
    for(const x of [-.105,.105]){const leg=mesh(box(.12,.27,.13),shared.dark,g,x,.2,0);legs.push(leg);mesh(box(.14,.085,.21),shared.wood,leg,0,-.13,.025);arms.push(mesh(box(.09,.34,.1),mat(COLORS[i]),body,x*2.2,.54,0));}
    const hintEl = document.createElement('div');
    hintEl.className = 'agent-hint';
    Object.assign(hintEl.style, {
      position: 'absolute', pointerEvents: 'none', background: 'rgba(255,253,245,0.92)', border: '1px solid #c9bda5', boxShadow: '0 2px 5px rgba(0,0,0,0.12)',
      padding: '2px 7px', borderRadius: '4px', fontSize: '11px', color: '#3d382d',
      fontWeight: '600', pointerEvents: 'none', transition: 'opacity 0.25s', opacity: '0', zIndex: '10'
    });
    stage.append(hintEl);
    villagers.push({group:g,body,legs,arms,role:ROLES[i],home:HOMES[i],target:new THREE.Vector3(g.position.x,0,g.position.z),next:0,route:[],mode:'',phase:'outside',phaseAt:0,facing:0,glanceAt:-Infinity,glanceFrom:0,glanceTo:0,hintEl,hintText:'',yieldUntil:0});
  }
  let current=null,meeting=false,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,evening=false,time=0,last=0;
  const media=matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener('change',e=>{paused=e.matches;});
  const view={role:null,progress:0,direction:0,saved:null};
  const exitButton=document.createElement('button');exitButton.id='exit-house';exitButton.textContent='← Exit house';exitButton.hidden=true;stage.append(exitButton);
  const officeTitle=document.createElement('div');officeTitle.id='office-title';officeTitle.hidden=true;stage.append(officeTitle);
  const veil=document.createElement('div');veil.id='office-transition';veil.setAttribute('aria-hidden','true');stage.append(veil);
  const officeZoom=()=>Math.min(2.2,Math.max(.9,stage.clientWidth/stage.clientHeight*2.4));
  function officeFor(role){if(!offices.has(role)){const i=ROLES.indexOf(role);offices.set(role,createOffice(i,villagers[i].group));}return offices.get(role);}
  function enterOffice(role){
    if(view.role)return;
    view.saved={position:camera.position.clone(),target:controls.target.clone(),zoom:camera.zoom};
    view.role=role;view.direction=1;controls.enabled=false;setHover(null);pointerInside=false;
    const office=officeFor(role);officeTitle.replaceChildren();const title=document.createElement('strong');title.textContent=office.palette.name;const sub=document.createElement('span');sub.textContent=office.palette.mood;officeTitle.append(title,sub);
    exitButton.hidden=false;stage.classList.add('in-office');onSelect(role);
    if(media.matches)view.progress=1;
  }
  function exitOffice(){if(!view.role)return;view.direction=-1;controls.enabled=false;setHover(null);if(media.matches)view.progress=0;}
  exitButton.onclick=exitOffice;
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&view.role&&!document.querySelector('dialog[open]'))exitOffice();});
  function updateView(dt){
    if(!view.role)return scene;
    if(view.direction){
      view.progress=THREE.MathUtils.clamp(view.progress+view.direction*dt/.56,0,1);
      const p=view.progress,i=ROLES.indexOf(view.role),home=HOMES[i],saved=view.saved;
      const ease = q => q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
      if(p<.5){const q=p*2,s=ease(q);camera.position.copy(saved.position).lerp(new THREE.Vector3(home[0]+2.3,3.4,home[1]+5),s);controls.target.copy(saved.target).lerp(new THREE.Vector3(home[0],.9,home[1]+.8),s);camera.zoom=THREE.MathUtils.lerp(saved.zoom,3.4,s);}
      else {const q=(p-.5)*2,s=ease(q);camera.position.set(5,6,8).lerp(new THREE.Vector3(9,10,12),s);controls.target.set(0,.6,0);camera.zoom=THREE.MathUtils.lerp(3.4,officeZoom(),s);}
      camera.lookAt(controls.target);camera.updateProjectionMatrix();
      veil.style.opacity=String(Math.pow(Math.sin(Math.PI*p),10));
      officeTitle.hidden=p<.5;
      if(p===1){view.direction=0;controls.enabled=true;controls.enablePan=false;controls.minAzimuthAngle=.1;controls.maxAzimuthAngle=Math.PI/2-.1;controls.minZoom=.85;controls.maxZoom=3.4;controls.update();}
      if(p===0){camera.position.copy(saved.position);controls.target.copy(saved.target);camera.zoom=saved.zoom;camera.updateProjectionMatrix();view.role=null;view.direction=0;controls.enabled=true;controls.enablePan=true;controls.minAzimuthAngle=-Infinity;controls.maxAzimuthAngle=Infinity;controls.minZoom=.65;controls.maxZoom=2.8;exitButton.hidden=true;officeTitle.hidden=true;stage.classList.remove('in-office');controls.update();return scene;}
    }
    return view.progress>=.5?officeFor(view.role).scene:scene;
  }
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down,hovered=null,pointerInside=false,dragging=false;
  const hoverBounds=new THREE.Box3(),frame=createHoverFrame(scene),outline=frame.group;
  const tooltip=document.createElement('div');tooltip.id='world-hover';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;stage.append(tooltip);
  function pick(){if(view.role)return null;ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(pickables.filter(p=>p.visible),true)[0];if(!hit)return null;let o=hit.object;while(o&&!o.userData.role)o=o.parent;return o;}
  function setHover(object){
    if(view.role)object=null;
    if(object===hovered)return;
    hovered=object;
    frame.setTargetOpacity(object ? 1 : 0);
    tooltip.hidden=!object;canvas.style.cursor=object?'pointer':'';
    if(!object)return;
    tooltip.textContent=object.userData.name+' · '+(object.userData.kind==='character'?'Agent':'Building');
    tooltip.dataset.kind=object.userData.kind;tooltip.dataset.role=object.userData.role;
    const v=villagers.find(v=>v.group===object),now=performance.now();
    // One acknowledgement on entry, never sustained camera tracking; debounce mesh-edge re-entry.
    if(v&&!paused&&!media.matches&&now-v.glanceAt>4000){v.glanceAt=now;v.glanceFrom=v.group.rotation.y;v.glanceTo=Math.atan2(camera.position.x-v.group.position.x,camera.position.z-v.group.position.z);}
  }
  function updatePointer(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);}
  canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;updatePointer(e);pointerInside=true;if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])>5){dragging=true;setHover(null);}});
  canvas.addEventListener('pointerleave',()=>{pointerInside=false;setHover(null);});
  canvas.addEventListener('pointercancel',()=>{down=null;dragging=false;pointerInside=false;setHover(null);});
  canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];dragging=false;});
  canvas.addEventListener('pointerup',e=>{const clicked=down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<=5;down=null;dragging=false;if(!clicked||view.role)return;updatePointer(e);const object=pick();if(object){if(object.userData.kind==='building')enterOffice(object.userData.role);else onSelect(object.userData.role);}});
  function updateHover(){
    if(view.role){setHover(null);return;}
    if(pointerInside&&!dragging)setHover(pick());
    let target = null;
    if(hovered) {
      const house=houses.find(h=>h.group===hovered);
      target = house ? house.structure : hovered;
      hoverBounds.setFromObject(target, true);
    }
    frame.update(target,time,!paused&&!media.matches,camera);
    if(!hovered)return;
    const anchor=new THREE.Vector3((hoverBounds.min.x+hoverBounds.max.x)/2,hoverBounds.max.y+.25,(hoverBounds.min.z+hoverBounds.max.z)/2).project(camera);
    const x=Math.max(8,Math.min(stage.clientWidth-tooltip.offsetWidth-8,(anchor.x+1)*stage.clientWidth/2-tooltip.offsetWidth/2));
    const y=Math.max(8,Math.min(stage.clientHeight-tooltip.offsetHeight-8,(1-anchor.y)*stage.clientHeight/2-tooltip.offsetHeight));
    tooltip.style.transform=`translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
  }
  const turn=(from,to,t)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*t;
  function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(w<2||h<2)return;const aspect=w/h;camera.left=-10.6*aspect;camera.right=10.6*aspect;camera.top=10.6;camera.bottom=-10.6;if(view.role&&!view.direction)camera.zoom=officeZoom();camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
  new ResizeObserver(resize).observe(stage);resize();

  function isObstacle(x, z) {
    for(let i=0; i<4; i++) {
      const hx = HOMES[i][0], hz = HOMES[i][1];
      const dx = x - hx, dz = z - hz;
      const angle = Math.atan2(-hx, -hz);
      const cos = Math.cos(-angle), sin = Math.sin(-angle);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) < 1.4 && lz > -1.2 && lz < 1.0) return true;
    }
    if (Math.hypot(x - 5.5, z - 1.7) < 1.3 && Math.abs(z - 1.7) > 0.4) return true;
    if (Math.hypot(x - -1.9, z - -4.8) < 1.0) return true;
    if (Math.hypot(x - 0, z - 0) < 0.8) return true;
    if (Math.hypot(x - -5.35, z - -2.9) < 0.6) return true; // Architect easel
    if (Math.hypot(x - 5.75, z - -3.2) < 0.6) return true; // Coder workbench
    if (Math.hypot(x - -5.25, z - 3.1) < 0.5) return true; // Tester telescope
    if (Math.hypot(x - 5.65, z - 4.0) < 0.6) return true; // Manager notice board
    if (x < -6.8 || x > 6.8 || z < -5.8 || z > 5.8) return true;
    return false;
  }

  function findPath(startVec, targetVec) {
    const gridSize = 0.5;
    const snap = v => Math.round(v / gridSize) * gridSize;
    const checkLine = (x0, z0, x1, z1) => {
      const steps = Math.ceil(Math.hypot(x1-x0, z1-z0) / 0.2);
      for(let i=1; i<=steps; i++) {
        if(isObstacle(x0 + (x1-x0)*(i/steps), z0 + (z1-z0)*(i/steps))) return false;
      }
      return true;
    };
    if (checkLine(startVec.x, startVec.z, targetVec.x, targetVec.z)) {
      return [targetVec.clone()];
    }
    const startX = snap(startVec.x), startZ = snap(startVec.z);
    const targetX = snap(targetVec.x), targetZ = snap(targetVec.z);
    const queue = [{x: startX, z: startZ, g: 0, f: Math.hypot(startX-targetX, startZ-targetZ), path: []}];
    const visited = new Set();
    while(queue.length > 0) {
      queue.sort((a,b) => a.f - b.f);
      const curr = queue.shift();
      const key = curr.x.toFixed(1) + ',' + curr.z.toFixed(1);
      if (visited.has(key)) continue;
      visited.add(key);
      if (Math.hypot(curr.x - targetX, curr.z - targetZ) < 0.1) {
         let route = curr.path.map(p => ({x: p.x, z: p.z}));
         route = [{x: startVec.x, z: startVec.z}, ...route, {x: targetVec.x, z: targetVec.z}];
         const smoothed = [];
         let currentIdx = 0;
         smoothed.push(route[0]);
         while (currentIdx < route.length - 1) {
           let furthest = currentIdx + 1;
           for (let j = route.length - 1; j > currentIdx + 1; j--) {
              if (checkLine(route[currentIdx].x, route[currentIdx].z, route[j].x, route[j].z)) {
                 furthest = j;
                 break;
              }
           }
           smoothed.push(route[furthest]);
           currentIdx = furthest;
         }
         smoothed.shift();
         return smoothed.map(p => new THREE.Vector3(p.x, 0, p.z));
      }
      const dirs = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
      for(let dir of dirs) {
        const nx = curr.x + dir[0] * gridSize, nz = curr.z + dir[1] * gridSize;
        if (!isObstacle(nx, nz)) {
           if (Math.abs(dir[0])===1 && Math.abs(dir[1])===1) {
              if (isObstacle(curr.x + dir[0]*gridSize, curr.z) || isObstacle(curr.x, curr.z + dir[1]*gridSize)) continue;
           }
           queue.push({
             x: nx, z: nz,
             g: curr.g + Math.hypot(dir[0],dir[1])*gridSize,
             f: curr.g + Math.hypot(dir[0],dir[1])*gridSize + Math.hypot(nx-targetX, nz-targetZ),
             path: [...curr.path, {x: nx, z: nz}]
           });
        }
      }
    }
    return [targetVec.clone()];
  }
  function advanceRoute(v,dt){const target=v.route[0];if(!target)return false;const delta=target.clone().sub(v.group.position),dist=delta.length();if(dist<.055){v.group.position.copy(target);v.route.shift();return false;}v.group.position.addScaledVector(delta,Math.min(dist,dt*1.65)/dist);v.facing=Math.atan2(delta.x,delta.z);return true;}
  function workerStep(v,i,working,dt){
    const h=houses[i],[x,z]=v.home;
    const phase=p=>{v.phase=p;v.phaseAt=time;};
    const angle = Math.atan2(-x, -z);
    const approachVec = new THREE.Vector3(x + Math.sin(angle)*1.65, 0, z + Math.cos(angle)*1.65);
    const insideVec = new THREE.Vector3(x + Math.sin(angle)*0.69, 0, z + Math.cos(angle)*0.69);
    
    if(media.matches){v.phase=working?'inside':'outside';v.group.visible=!working;h.door=0;h.hinge.rotation.y=0;if(!working&&v.mode==='work'){v.group.position.copy(approachVec);v.mode='';}return {handled:working,moving:false};}
    if(working&&v.phase==='outside'){
      phase('approaching');v.mode='work';v.glanceAt=-Infinity;
      v.route=findPath(v.group.position, approachVec);
      v.hintText = 'heading to work';
    }
    if(!working&&['approaching','opening','entering'].includes(v.phase)){
      phase('outside');v.mode='';v.route=[];
    }
    if(!working&&v.phase==='inside'){
      phase('exit-opening');
      playTone('work-end');
      setTimeout(()=>playTone('door-exit'), 200);
    }
    let moving=false,open=['opening','entering','exit-opening','exiting'].includes(v.phase);
    if(!paused){
      h.door=THREE.MathUtils.damp(h.door,open?1:0,6,dt);h.hinge.rotation.y=-h.door*Math.PI*.58;
      if(v.phase==='approaching'){moving=advanceRoute(v,dt);if(!v.route.length){phase('opening');v.facing=angle+Math.PI;playTone('door-enter');}}
      else if(v.phase==='opening'&&h.door>.94){phase('entering');v.route=[insideVec];}
      else if(v.phase==='entering'){moving=advanceRoute(v,dt);if(!v.route.length){phase('inside');v.group.visible=false;playTone('work-start');}}
      else if(v.phase==='exit-opening'&&h.door>.94){phase('exiting');v.group.visible=true;v.group.position.copy(insideVec);v.route=[approachVec];v.hintText = 'leaving work';}
      else if(v.phase==='exiting'){moving=advanceRoute(v,dt);if(!v.route.length){phase('outside');v.mode='';v.hintText='';}}
    }
    return {handled:v.phase!=='outside',moving};
  }
  function animate(stamp){requestAnimationFrame(animate);const dt=Math.min((stamp-last)/1000||0,.05);last=stamp;if(document.hidden)return;if(!paused)time+=dt;
    villagers.forEach((v,i)=>{
      const working=current===v.role,mode=meeting?'meeting':'idle';
      const worker=workerStep(v,i,working,dt);
      if(!worker.handled&&(v.mode!==mode || (!paused&&time>v.next&&mode==='idle'))){
        v.mode=mode;
        if(mode==='meeting'){
          v.next=time+30;
          let target=new THREE.Vector3(Math.cos(i*Math.PI/2)*1.5,0,Math.sin(i*Math.PI/2)*1.5);
          v.route=findPath(v.group.position, target);
          v.hintText = 'heading to meeting';
        } else {
          const choices = POIs.slice();
          choices.push({name: 'returning home', pos: new THREE.Vector3(v.home[0], 0, v.home[1]+1.8)});
          const choice = choices[Math.floor(Math.random()*choices.length)];
          v.next = time + 4 + Math.random()*8 + (choice.name.includes('home')?4:0);
          let target = choice.pos.clone();
          target.x += (Math.random()-.5)*.8; target.z += (Math.random()-.5)*.8;
          v.route = findPath(v.group.position, target);
          v.hintText = choice.name;
        }
        if(paused){v.group.position.copy(v.route[v.route.length-1]);v.route=[];}
      }
      const target=v.route[0];let moving=worker.moving;
      const glanceAge=stamp-v.glanceAt,glancing=!worker.handled&&!paused&&!media.matches&&glanceAge>=0&&glanceAge<900;
      if(!worker.handled&&target&&!paused&&!glancing){
        let willCollide = false;
        if(time > v.yieldUntil) {
          for(let j=0; j<villagers.length; j++) {
            if(i===j) continue;
            const other = villagers[j];
            if(other.group.visible && v.group.position.distanceTo(other.group.position) < 0.7) {
              if(i > j || !other.route.length) { 
                willCollide = true;
                v.yieldUntil = time + 0.8 + Math.random()*0.5;
                v.hintText = 'yielding';
                break;
              }
            }
          }
        } else {
          willCollide = true;
        }
        if(!willCollide) {
          const delta=target.clone().sub(v.group.position),dist=delta.length();
          if(dist<.08){
            v.route.shift();
            if(!v.route.length) v.hintText = '';
          }else{
            v.speed = THREE.MathUtils.damp(v.speed || 0, 1.2, 5, dt);
            v.group.position.addScaledVector(delta,Math.min(dist,dt*v.speed)/dist);
            const targetFacing = Math.atan2(delta.x,delta.z);
            const diff = ((targetFacing - (v.facing||0) + Math.PI*3) % (Math.PI*2)) - Math.PI;
            v.facing = (v.facing||0) + diff * Math.min(1, dt * 8);
            moving=true;
          }
        }
      }
      if (!moving) v.speed = THREE.MathUtils.damp(v.speed || 0, 0, 5, dt);
      const stride=moving?Math.sin(time*11+i)*.55:0;v.legs[0].rotation.x=stride;v.legs[1].rotation.x=-stride;v.arms[0].rotation.x=-stride;v.arms[1].rotation.x=stride;
      v.bob = THREE.MathUtils.damp(v.bob || 0, moving ? 1 : 0, 6, dt);
      v.body.position.y=v.bob * Math.abs(Math.sin(time*11+i))*.035;
      v.body.rotation.z=v.bob * Math.sin(time*5.5+i)*.03;
      if(!moving && !working && !worker.handled && !paused) {
         v.body.rotation.y = Math.sin(time*1.5 + i)*0.08;
         v.body.position.y = Math.sin(time*2.5 + i)*0.01;
      } else {
         v.body.rotation.y = 0;
      }
      if(working&&!moving&&!paused)v.arms[1].rotation.x=-.55+Math.sin(time*4)*.2;
      if(meeting&&!moving&&!worker.handled){
         const targetFacing = Math.atan2(-v.group.position.x,-v.group.position.z);
         const diff = ((targetFacing - (v.facing||0) + Math.PI*3) % (Math.PI*2)) - Math.PI;
         v.facing = (v.facing||0) + diff * Math.min(1, dt * 6);
      }
      v.group.rotation.y=glancing?(glanceAge<160?turn(v.glanceFrom,v.glanceTo,glanceAge/160):glanceAge<720?v.glanceTo:turn(v.glanceTo,v.facing,(glanceAge-720)/180)):v.facing;
      lamps[i].material.emissiveIntensity=evening?2:working?1+.2*Math.sin(time*3):.15;
      if(offices.has(v.role))offices.get(v.role).update(time,v.phase==='inside',paused||media.matches);
      if(hintsEnabled && v.hintText && v.phase!=='inside' && v.group.visible) {
        v.hintEl.style.opacity = '1';
        v.hintEl.textContent = v.hintText;
        const p = v.group.position.clone().add(new THREE.Vector3(0, 1.6, 0)).project(camera);
        if(Math.abs(p.x)<1 && Math.abs(p.y)<1) {
          const sx = (p.x+1)/2 * stage.clientWidth;
          const sy = (1-p.y)/2 * stage.clientHeight;
          v.hintEl.style.transform = `translate(-50%, -100%) translate(${sx}px, ${sy}px)`;
        }
      } else {
        v.hintEl.style.opacity = '0';
      }
    });
    wind.forEach(w=>{w.node.rotation.z=Math.sin(time*1.2+w.phase)*(w.flag?.09:.025);});
    smoke.forEach(s=>{const f=(time*.14+s.phase)%1;s.node.position.set(s.x+Math.sin(f*4)*.18,(s.y0||2.65)+f*1.3,s.z);s.node.scale.setScalar(.7+f*1.6);s.node.material.opacity=(1-f)*(1-f)*.4;});
    beacons.forEach(b=>{b.material.emissiveIntensity=(current==='TESTER'?1.2+Math.sin(time*5)*.8:.25);});
    ripples.forEach((r,i)=>{r.scale.setScalar(1+Math.sin(time*1.7+i)*.08);});mill.rotation.z=time*.35;
    const activeScene=updateView(dt);if(!view.direction)controls.update();scene.updateMatrixWorld(true);updateHover();renderer.render(activeScene,camera);window.dispatchEvent(new CustomEvent('village-frame'));
  }requestAnimationFrame(animate);
  function orbitTo(azDeg,polarDeg=1.05,zoom=0){if(zoom){camera.zoom=zoom;camera.updateProjectionMatrix();}const r=camera.position.distanceTo(controls.target);const az=azDeg*Math.PI/180;camera.position.set(controls.target.x+r*Math.sin(polarDeg)*Math.sin(az),controls.target.y+r*Math.cos(polarDeg),controls.target.z+r*Math.sin(polarDeg)*Math.cos(az));controls.update();}
  // Audit seam: frame one house close-up from an azimuth (degrees) and polar angle.
  function focusHouse(i,azDeg=30,polarDeg=1.1,zoom=3.2){if(view.role)return;const [x,z]=HOMES[i];controls.target.set(x,1.2,z);camera.zoom=zoom;camera.position.set(x,1.2,z+30);camera.updateProjectionMatrix();orbitTo(azDeg,polarDeg);}
  return {setState(s){current=s.current_agent;meeting=s.meeting;},reset,exitOffice,orbitTo,focusHouse,
    pause(){paused=!paused;return paused;},get paused(){return paused;},
    night(){evening=!evening;hemi.intensity=evening?1:2.7;sun.intensity=evening?.65:3.3;renderer.setClearColor(evening?'#71818b':'#e5eadb');ground.material.color.set(evening?'#71818b':'#e5eadb');return evening;},
    project(role){const v=villagers.find(v=>v.role===role);if(!v)return null;let anchor;
      if(view.role){if(view.direction||view.role!==role||v.phase!=='inside')return null;anchor=officeFor(role).anchor();}
      else anchor=v.phase==='inside'?new THREE.Vector3(v.home[0],2.8,v.home[1]):v.group.position.clone().add(new THREE.Vector3(0,1.35,0));
      const p=anchor.project(camera);return {x:(p.x+1)/2*stage.clientWidth,y:(1-p.y)/2*stage.clientHeight,visible:Math.abs(p.x)<1&&Math.abs(p.y)<1};},
    diagnostics(){return {renderer:'WebGL',characters:villagers.length,buildings:HOMES.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,hovered:hovered?.userData||null,outlineVisible:outline.visible,hoverFrame:frame.counts(),
      view:{role:view.role,progress:view.progress,direction:view.direction,camera:camera.position.toArray(),zoom:camera.zoom},
      office:view.role?{name:officeFor(view.role).palette.name,walls:officeFor(view.role).wallCount,furniture:Object.keys(officeFor(view.role).assets),occupant:officeFor(view.role).occupant.visible}:null,
      houses:houses.map((h,i)=>{
        if(!h.structure.userData.localBox){
          const box=new THREE.Box3(),inv=new THREE.Matrix4().copy(h.structure.matrixWorld).invert(),v=new THREE.Vector3();
          h.structure.traverse(c=>{if(c.isMesh&&c.geometry){const p=c.geometry.attributes.position;if(!p)return;const m=new THREE.Matrix4().multiplyMatrices(inv,c.matrixWorld);for(let k=0;k<p.count;k++){v.fromBufferAttribute(p,k).applyMatrix4(m);box.expandByPoint(v);}}});
          h.structure.userData.localBox=box;
        }
        return {role:ROLES[i],door:h.door,structureSize:h.structure.userData.localBox.getSize(new THREE.Vector3()).toArray()};
      }),
      targets:pickables.map(o=>{const p=o.position.clone().add(new THREE.Vector3(0,o.userData.kind==='character'?.65:1,0)).project(camera);return {...o.userData,x:(p.x+1)/2*stage.clientWidth,y:(1-p.y)/2*stage.clientHeight};}),
      charactersState:villagers.map(v=>({role:v.role,phase:v.phase,visible:v.group.visible,position:v.group.position.toArray(),heading:v.group.rotation.y,facing:v.facing,glanceAt:v.glanceAt,glanceTo:v.glanceTo}))};}
  };
}
