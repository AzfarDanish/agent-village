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
  const shared = {wood:mat('#8e6948'),cream:mat('#f5e9cc'),dark:mat('#4f645e'),skin:mat('#e5b98e'),roof:mat('#628781')};
  function mesh(geo,material,parent,x=0,y=0,z=0) {const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  // A cutaway island, tiled lawn and cobblestone footpaths.
  mesh(box(15.1,.65,13.1),mat('#b9ab8b'),scene,0,-.49,0);
  const tiles=new THREE.InstancedMesh(box(.98,.16,.98),mat('#91aa73'),15*13), matrix=new THREE.Matrix4();let n=0;
  for(let x=-7;x<=7;x++)for(let z=-6;z<=6;z++) {matrix.makeTranslation(x,-.09,z);tiles.setMatrixAt(n,matrix);tiles.setColorAt(n,new THREE.Color((x+z)%3===0?'#a5b984':'#9caf7c'));n++;}
  tiles.receiveShadow=true;scene.add(tiles);
  const pathMaterial=mat('#d8c7a5');
  for(let i=-6;i<=6;i++) {mesh(box(.9,.08,.92),pathMaterial,scene,i,.04,0);if(Math.abs(i)<6)mesh(box(.92,.08,.9),pathMaterial,scene,0,.04,i);}
  for(const [x,z] of HOMES)for(let k=1;k<=Math.abs(z)-1;k++)mesh(box(.85,.07,.82),pathMaterial,scene,x,.04,k*Math.sign(z));
  const plaza=mesh(new THREE.CylinderGeometry(2.05,2.05,.12,12),mat('#d5c4a2'),scene,0,.1,0);
  const table=mesh(new THREE.CylinderGeometry(.65,.65,.13,8),shared.wood,scene,0,.65,0);mesh(box(.2,.55,.2),shared.wood,scene,0,.32,0);
  for(let i=0;i<4;i++){let a=i*Math.PI/2;mesh(box(.55,.13,.3),shared.wood,scene,Math.cos(a)*1.15,.35,Math.sin(a)*1.15);}
  const wind=[],smoke=[],lamps=[],beacons=[],pickables=[],villagers=[],houses=[],offices=new Map();
  // Four distinct silhouettes: tall tower, wide workshop, round lab, grand hall.
  // Only walls/roof/door/porch live in `structure` (the hover bounds);
  // plinth, windows, flags and yard props stay outside it.
  const glassMat=mat('#829d9c');
  function windowUnit(g,wx,wy,wz,ww,wh){
    mesh(box(ww,wh,.07),glassMat,g,wx,wy,wz);
    mesh(box(.045,wh+.04,.08),shared.cream,g,wx,wy,wz);
    mesh(box(ww+.05,.04,.08),shared.cream,g,wx,wy,wz);
    mesh(box(ww+.1,.1,.16),shared.wood,g,wx,wy-.06,wz-.04);
  }
  function building(i){
    const [x,z]=HOMES[i],g=new THREE.Group();g.position.set(x,0,z);g.userData={role:ROLES[i],kind:'building',name:['Architect’s studio','Coder’s workshop','Tester’s lab','Manager’s hall'][i]};scene.add(g);pickables.push(g);
    const roofMaterial=mat(COLORS[i]);
    mesh(box(2.3,.17,2),mat('#bbb298'),g,0,.13,0);
    const structure=new THREE.Group();g.add(structure);
    const hinge=new THREE.Group();g.add(hinge);
    const doorway=(w,h,dz)=>{mesh(box(w+.08,h+.08,.05),shared.wood,structure,0,h/2+.19,dz-.01);mesh(box(w,h,.04),shared.dark,structure,0,h/2+.19,dz);};
    const doorLeaf=(w,h,dx,dz)=>{hinge.position.set(dx,.19,dz);mesh(box(w,h,.06),shared.wood,hinge,w/2,h/2,0);mesh(new THREE.SphereGeometry(.035,5,4),mat('#d9be71'),hinge,w-.1,.55,.045);};
    const pyramid=(r,h,y)=>{const roof=mesh(new THREE.ConeGeometry(r,h,4),roofMaterial,structure,0,y,0);roof.rotation.y=Math.PI/4;roof.scale.z=.88;return roof;};
    const pole=(px,py,pz,ph)=>{mesh(new THREE.CylinderGeometry(.025,.025,ph,6),shared.wood,g,px,py,pz);};
    let lampPos,chimney=null;
    if(i===0){
      // Architect: tall narrow drafting tower with a steep spire.
      mesh(box(1.62,.16,1.62),shared.wood,structure,0,.19,0);
      mesh(box(1.5,2.1,1.4),shared.cream,structure,0,1.16,0);
      doorway(.5,1.0,.7);doorLeaf(.48,.96,-.24,.74);
      pyramid(1.3,1.5,2.96);
      mesh(box(.22,.7,.22),mat('#c0a28b'),structure,.45,3.0,-.4);chimney={x:x+.45,y:3.4,z:z-.4};
      for(const sx of [-1,1]){mesh(box(.05,.9,.34),glassMat,g,sx*.76,1.35,0);mesh(box(.06,.96,.05),shared.cream,g,sx*.76,1.35,.18);mesh(box(.06,.96,.05),shared.cream,g,sx*.76,1.35,-.18);}
      windowUnit(g,0,1.78,.72,.4,.4);
      mesh(box(.95,.08,.6),shared.wood,g,-1.35,.6,.9);mesh(box(.65,.02,.4),mat('#c8dde1'),g,-1.35,.66,.9);
      lampPos=[.42,1.05,.82];pole(-1.0,1.05,-.3,1.5);
      const flag=mesh(box(.46,.26,.025),roofMaterial,g,-.75,1.62,-.3);wind.push({node:flag,phase:i,flag:true});
    }else if(i===1){
      // Coder: wide low workshop with a broad shallow roof and tall chimney.
      mesh(box(2.56,.14,1.86),shared.wood,structure,0,.2,0);
      mesh(box(2.5,1.15,1.7),shared.cream,structure,0,.72,0);
      doorway(.52,1.0,.85);doorLeaf(.5,.96,-.25,.89);
      pyramid(1.75,.75,1.67);
      mesh(box(.3,1.0,.3),mat('#c0a28b'),structure,.75,1.95,-.45);chimney={x:x+.75,y:2.5,z:z-.45};
      windowUnit(g,-.82,.85,.86,.44,.44);windowUnit(g,.82,.85,.86,.44,.44);
      mesh(box(.05,.5,.3),glassMat,g,1.26,.75,0);
      mesh(box(.8,.55,.5),shared.wood,g,1.75,.3,.6);mesh(box(.5,.34,.12),shared.dark,g,1.75,.75,.6);mesh(box(.39,.24,.13),mat('#9ccbb1'),g,1.75,.75,.61);
      lampPos=[.5,1.05,.97];pole(-1.35,1.15,-.4,1.6);
      const flag=mesh(box(.5,.28,.025),roofMaterial,g,-1.08,1.78,-.4);wind.push({node:flag,phase:i,flag:true});
    }else if(i===2){
      // Tester: round observation tower with a conical cap and beacon.
      mesh(new THREE.CylinderGeometry(1.12,1.12,.14,10),shared.wood,structure,0,.2,0);
      mesh(new THREE.CylinderGeometry(1.02,1.08,1.7,10),shared.cream,structure,0,.95,0);
      doorway(.5,1.0,1.06);doorLeaf(.48,.96,-.24,1.10);
      mesh(new THREE.ConeGeometry(1.2,1.0,6),roofMaterial,structure,0,2.3,0);
      const beacon=mesh(new THREE.SphereGeometry(.09,6,5),mat('#ffd166',{emissive:'#ffb347',emissiveIntensity:.3}),structure,0,2.86,0);beacons.push(beacon);
      for(const sx of [-.55,.55]){mesh(new THREE.TorusGeometry(.17,.035,5,10),shared.cream,g,sx,1.3,.90);mesh(new THREE.CylinderGeometry(.15,.15,.06,8),glassMat,g,sx,1.3,.875).rotation.x=Math.PI/2;}
      mesh(new THREE.CylinderGeometry(.27,.35,.55,6),mat('#b49abe'),g,-1.5,.4,.3);mesh(new THREE.ConeGeometry(.4,.7,6),roofMaterial,g,-1.5,1.02,.3);
      lampPos=[.45,1.05,1.02];pole(1.25,1.0,-.5,1.4);
      const flag=mesh(box(.44,.25,.025),roofMaterial,g,1.5,1.55,-.5);wind.push({node:flag,phase:i,flag:true});
    }else{
      // Manager: grand double-height hall, two-tier roof, columned porch.
      mesh(box(2.42,.16,1.94),shared.wood,structure,0,.2,0);
      mesh(box(2.3,1.8,1.9),shared.cream,structure,0,1.04,0);
      doorway(.56,1.1,.95);doorLeaf(.54,1.06,-.27,.99);
      pyramid(1.62,.8,2.34);
      mesh(box(1.05,.5,.95),shared.cream,structure,0,2.99,0);
      pyramid(0.92,.62,3.55);
      for(const sx of [-.95,.95])mesh(box(.16,1.0,.16),shared.wood,structure,sx,.5,1.15);
      mesh(box(2.3,.12,.6),shared.wood,structure,0,1.06,1.1);
      windowUnit(g,-.82,1.25,.96,.44,.6);windowUnit(g,.82,1.25,.96,.44,.6);
      const clock=mesh(new THREE.CylinderGeometry(.24,.24,.07,12),shared.cream,g,0,1.62,.97);clock.rotation.x=Math.PI/2;mesh(box(.02,.19,.08),shared.dark,g,0,1.68,1.01);
      mesh(box(1.1,.5,.5),shared.wood,g,1.65,.3,.4);
      mesh(box(.28,.8,.28),mat('#c0a28b'),structure,-.8,2.3,-.5);chimney={x:x-.8,y:2.75,z:z-.5};
      lampPos=[.55,1.1,1.05];pole(-1.35,1.2,-.5,1.7);
      const flag=mesh(box(.5,.28,.025),roofMaterial,g,-1.08,1.9,-.5);wind.push({node:flag,phase:i,flag:true});
    }
    houses.push({group:g,structure,hinge,door:0});
    const lamp=mesh(new THREE.SphereGeometry(.09,6,5),mat('#f5d485',{emissive:'#f6b851',emissiveIntensity:.2}),g,lampPos[0],lampPos[1],lampPos[2]);lamps.push(lamp);
    if(chimney)for(let k=0;k<4;k++){const p=mesh(new THREE.IcosahedronGeometry(.13,0),mat('#f6f1e3',{transparent:true,opacity:.4,depthWrite:false}),scene,chimney.x,chimney.y,chimney.z);smoke.push({node:p,x:chimney.x,y0:chimney.y,z:chimney.z,phase:k/4+i*.1});}
  }
  ROLES.forEach((_,i)=>building(i));
  function tree(x,z,scale=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);scene.add(g);mesh(new THREE.CylinderGeometry(.09,.14,.8,5),shared.wood,g,0,.4,0);const crown=mesh(new THREE.IcosahedronGeometry(.67,0),mat('#6d8e60'),g,0,1.12,0);crown.scale.y=1.2;wind.push({node:crown,phase:x+z});}
  [[-6,-5],[-6,-2],[-6,4],[-6,5.5],[6,-5],[6,-1],[6,5.5],[-2,-5.5],[2,5.5],[-2,5.5]].forEach(([x,z],i)=>tree(x,z,.75+(i%3)*.15));
  // Pond, reeds, bridge, flowers and a windmill.
  const pond=mesh(new THREE.CylinderGeometry(1.03,1.03,.06,9),mat('#8ebcb8',{metalness:.15,roughness:.35}),scene,5.7,.055,1.7);pond.scale.z=.7;
  const ripples=[];for(let i=0;i<3;i++){const ring=mesh(new THREE.TorusGeometry(.28+i*.2,.012,3,18),mat('#d4e4d4'),scene,5.7,.1,1.7);ring.rotation.x=Math.PI/2;ripples.push(ring);}
  for(let i=0;i<5;i++)mesh(box(.25,.1,1.6),shared.wood,scene,5.2+i*.25,.19,1.7);
  for(let i=0;i<28;i++){const x=Math.sin(i*7.7)*6.4,z=Math.cos(i*4.1)*5.6;if(Math.abs(x)<1.7||HOMES.some(([a,b])=>Math.hypot(x-a,z-b)<1.7))continue;mesh(new THREE.IcosahedronGeometry(.1,0),mat(i%2?'#e6c36c':'#e9dcc0'),scene,x,.18,z);}
  mesh(new THREE.CylinderGeometry(.35,.6,1.5,7),shared.cream,scene,-1.9,.74,-5);
  const mill=new THREE.Group();mill.position.set(-1.9,2.6,-4.62);scene.add(mill);for(let i=0;i<4;i++){let blade=mesh(box(.14,.94,.07),shared.wood,mill,0,0,0);blade.rotation.z=i*Math.PI/2;blade.position.set(Math.sin(-i*Math.PI/2)*.47,Math.cos(i*Math.PI/2)*.47,0);}
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
    villagers.push({group:g,body,legs,arms,role:ROLES[i],home:HOMES[i],target:new THREE.Vector3(g.position.x,0,g.position.z),next:0,route:[],mode:'',phase:'outside',phaseAt:0,facing:0,glanceAt:-Infinity,glanceFrom:0,glanceTo:0});
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
      if(p<.5){const q=p*2,s=q*q*(3-2*q);camera.position.copy(saved.position).lerp(new THREE.Vector3(home[0]+2.3,3.4,home[1]+5),s);controls.target.copy(saved.target).lerp(new THREE.Vector3(home[0],.9,home[1]+.8),s);camera.zoom=THREE.MathUtils.lerp(saved.zoom,3.4,s);}
      else {const q=(p-.5)*2,s=q*q*(3-2*q);camera.position.set(5,6,8).lerp(new THREE.Vector3(9,10,12),s);controls.target.set(0,.6,0);camera.zoom=THREE.MathUtils.lerp(3.4,officeZoom(),s);}
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
    hovered=object;outline.visible=!!object;tooltip.hidden=!object;canvas.style.cursor=object?'pointer':'';
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
    if(!hovered)return;
    const house=houses.find(h=>h.group===hovered);
    // Precise vertices avoid the oversized AABB produced by a rotated cone's local box.
    hoverBounds.setFromObject(house?house.structure:hovered,true).expandByScalar(.045);
    frame.update(hoverBounds,time,!paused&&!media.matches,camera);
    const anchor=new THREE.Vector3((hoverBounds.min.x+hoverBounds.max.x)/2,hoverBounds.max.y+.25,(hoverBounds.min.z+hoverBounds.max.z)/2).project(camera);
    const x=Math.max(8,Math.min(stage.clientWidth-tooltip.offsetWidth-8,(anchor.x+1)*stage.clientWidth/2-tooltip.offsetWidth/2));
    const y=Math.max(8,Math.min(stage.clientHeight-tooltip.offsetHeight-8,(1-anchor.y)*stage.clientHeight/2-tooltip.offsetHeight));
    tooltip.style.transform=`translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
  }
  const turn=(from,to,t)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*t;
  function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(w<2||h<2)return;const aspect=w/h;camera.left=-10.6*aspect;camera.right=10.6*aspect;camera.top=10.6;camera.bottom=-10.6;if(view.role&&!view.direction)camera.zoom=officeZoom();camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
  new ResizeObserver(resize).observe(stage);resize();
  function advanceRoute(v,dt){const target=v.route[0];if(!target)return false;const delta=target.clone().sub(v.group.position),dist=delta.length();if(dist<.055){v.group.position.copy(target);v.route.shift();return false;}v.group.position.addScaledVector(delta,Math.min(dist,dt*1.65)/dist);v.facing=Math.atan2(delta.x,delta.z);return true;}
  function workerStep(v,i,working,dt){
    const h=houses[i],[x,z]=v.home;
    const phase=p=>{v.phase=p;v.phaseAt=time;};
    if(media.matches){v.phase=working?'inside':'outside';v.group.visible=!working;h.door=0;h.hinge.rotation.y=0;if(!working&&v.mode==='work'){v.group.position.set(x,0,z+1.65);v.mode='';}return {handled:working,moving:false};}
    if(working&&v.phase==='outside'){
      phase('approaching');v.mode='work';v.glanceAt=-Infinity;
      const side=x+Math.sign(x)*1.8;
      v.route=[new THREE.Vector3(v.group.position.x,0,0),new THREE.Vector3(side,0,0),new THREE.Vector3(side,0,z+1.65),new THREE.Vector3(x,0,z+1.65)];
    }
    if(!working&&['approaching','opening','entering'].includes(v.phase)){
      phase('outside');v.mode='';v.route=[];
    }
    if(!working&&v.phase==='inside')phase('exit-opening');
    let moving=false,open=['opening','entering','exit-opening','exiting'].includes(v.phase);
    if(!paused){
      h.door=THREE.MathUtils.damp(h.door,open?1:0,12,dt);h.hinge.rotation.y=-h.door*Math.PI*.58;
      if(v.phase==='approaching'){moving=advanceRoute(v,dt);if(!v.route.length){phase('opening');v.facing=Math.PI;}}
      else if(v.phase==='opening'&&h.door>.94){phase('entering');v.route=[new THREE.Vector3(x,0,z+.69)];}
      else if(v.phase==='entering'){moving=advanceRoute(v,dt);if(!v.route.length){phase('inside');v.group.visible=false;}}
      else if(v.phase==='exit-opening'&&h.door>.94){phase('exiting');v.group.visible=true;v.group.position.set(x,0,z+.69);v.route=[new THREE.Vector3(x,0,z+1.65)];}
      else if(v.phase==='exiting'){moving=advanceRoute(v,dt);if(!v.route.length){phase('outside');v.mode='';}}
    }
    return {handled:v.phase!=='outside',moving};
  }
  function animate(stamp){requestAnimationFrame(animate);const dt=Math.min((stamp-last)/1000||0,.05);last=stamp;if(document.hidden)return;if(!paused)time+=dt;
    villagers.forEach((v,i)=>{
      const working=current===v.role,mode=meeting?'meeting':'idle';
      const worker=workerStep(v,i,working,dt);
      if(!worker.handled&&(v.mode!==mode || (!paused&&time>v.next&&mode==='idle'))){
        v.mode=mode;v.next=time+7+i;
        let target=mode==='meeting'?new THREE.Vector3(Math.cos(i*Math.PI/2)*1.5,0,Math.sin(i*Math.PI/2)*1.5):new THREE.Vector3((i%2?1:-1)*(1.5+Math.random()*2.5),0,(Math.random()-.5)*1.8);
        // Use the central street for long journeys, avoiding houses.
        v.route=Math.abs(v.group.position.z-target.z)>2?[new THREE.Vector3(v.group.position.x,0,0),new THREE.Vector3(target.x,0,0),target]:[target];
        if(Math.abs(v.group.position.x-v.home[0])<.3&&v.group.position.z>v.home[1]+1.2){const side=v.home[0]+Math.sign(v.home[0])*1.8;v.route=[new THREE.Vector3(side,0,v.group.position.z),new THREE.Vector3(side,0,0),new THREE.Vector3(target.x,0,0),target];}
        if(paused){v.group.position.copy(target);v.route=[];}
      }
      const target=v.route[0];let moving=worker.moving;
      const glanceAge=stamp-v.glanceAt,glancing=!worker.handled&&!paused&&!media.matches&&glanceAge>=0&&glanceAge<900;
      if(!worker.handled&&target&&!paused&&!glancing){const delta=target.clone().sub(v.group.position),dist=delta.length();if(dist<.08)v.route.shift();else{v.group.position.addScaledVector(delta,Math.min(dist,dt*1.2)/dist);v.facing=Math.atan2(delta.x,delta.z);moving=true;}}
      const stride=moving?Math.sin(time*11+i)*.55:0;v.legs[0].rotation.x=stride;v.legs[1].rotation.x=-stride;v.arms[0].rotation.x=-stride;v.arms[1].rotation.x=stride;
      v.body.position.y=moving?Math.abs(Math.sin(time*11+i))*.035:0;
      if(working&&!moving&&!paused)v.arms[1].rotation.x=-.55+Math.sin(time*4)*.2;
      if(meeting&&!moving&&!worker.handled)v.facing=Math.atan2(-v.group.position.x,-v.group.position.z);
      v.group.rotation.y=glancing?(glanceAge<160?turn(v.glanceFrom,v.glanceTo,glanceAge/160):glanceAge<720?v.glanceTo:turn(v.glanceTo,v.facing,(glanceAge-720)/180)):v.facing;
      lamps[i].material.emissiveIntensity=evening?2:working?1+.2*Math.sin(time*3):.15;
      if(offices.has(v.role))offices.get(v.role).update(time,v.phase==='inside',paused||media.matches);
    });
    wind.forEach(w=>{w.node.rotation.z=Math.sin(time*1.2+w.phase)*(w.flag?.09:.025);});
    smoke.forEach(s=>{const f=(time*.14+s.phase)%1;s.node.position.set(s.x+Math.sin(f*4)*.18,(s.y0||2.65)+f*1.3,s.z);s.node.scale.setScalar(.7+f*1.6);s.node.material.opacity=(1-f)*.35;});
    beacons.forEach(b=>{b.material.emissiveIntensity=(current==='TESTER'?1.2+Math.sin(time*5)*.8:.25);});
    ripples.forEach((r,i)=>{r.scale.setScalar(1+Math.sin(time*1.7+i)*.08);});mill.rotation.z=time*.35;
    const activeScene=updateView(dt);if(!view.direction)controls.update();scene.updateMatrixWorld(true);updateHover();renderer.render(activeScene,camera);window.dispatchEvent(new CustomEvent('village-frame'));
  }requestAnimationFrame(animate);
  function orbitTo(azDeg,polarDeg=1.05){const r=camera.position.distanceTo(controls.target);const az=azDeg*Math.PI/180;camera.position.set(controls.target.x+r*Math.sin(polarDeg)*Math.sin(az),controls.target.y+r*Math.cos(polarDeg),controls.target.z+r*Math.sin(polarDeg)*Math.cos(az));controls.update();}
  return {setState(s){current=s.current_agent;meeting=s.meeting;},reset,exitOffice,orbitTo,
    pause(){paused=!paused;return paused;},get paused(){return paused;},
    night(){evening=!evening;hemi.intensity=evening?1:2.7;sun.intensity=evening?.65:3.3;renderer.setClearColor(evening?'#71818b':'#e5eadb');ground.material.color.set(evening?'#71818b':'#e5eadb');return evening;},
    project(role){const v=villagers.find(v=>v.role===role);if(!v)return null;let anchor;
      if(view.role){if(view.direction||view.role!==role||v.phase!=='inside')return null;anchor=officeFor(role).anchor();}
      else anchor=v.phase==='inside'?new THREE.Vector3(v.home[0],2.8,v.home[1]):v.group.position.clone().add(new THREE.Vector3(0,1.35,0));
      const p=anchor.project(camera);return {x:(p.x+1)/2*stage.clientWidth,y:(1-p.y)/2*stage.clientHeight,visible:Math.abs(p.x)<1&&Math.abs(p.y)<1};},
    diagnostics(){return {renderer:'WebGL',characters:villagers.length,buildings:HOMES.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,hovered:hovered?.userData||null,outlineVisible:outline.visible,hoverFrame:frame.counts(),
      view:{role:view.role,progress:view.progress,direction:view.direction,camera:camera.position.toArray(),zoom:camera.zoom},
      office:view.role?{name:officeFor(view.role).palette.name,walls:officeFor(view.role).wallCount,furniture:Object.keys(officeFor(view.role).assets),occupant:officeFor(view.role).occupant.visible}:null,
      houses:houses.map((h,i)=>({role:ROLES[i],door:h.door,structureSize:new THREE.Box3().setFromObject(h.structure,true).getSize(new THREE.Vector3()).toArray()})),
      targets:pickables.map(o=>{const p=o.position.clone().add(new THREE.Vector3(0,o.userData.kind==='character'?.65:1,0)).project(camera);return {...o.userData,x:(p.x+1)/2*stage.clientWidth,y:(1-p.y)/2*stage.clientHeight};}),
      charactersState:villagers.map(v=>({role:v.role,phase:v.phase,visible:v.group.visible,position:v.group.position.toArray(),heading:v.group.rotation.y,facing:v.facing,glanceAt:v.glanceAt,glanceTo:v.glanceTo}))};}
  };
}
