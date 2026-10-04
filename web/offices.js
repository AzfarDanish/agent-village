import * as THREE from 'three';

const PALETTES = [
  {name:'Architect’s studio',mood:'Daylight, paper & blueprints',wall:'#cedfdf',floor:'#e8e2cf',tile:'#dad9c5',wood:'#bd956b',accent:'#6d9fae',bg:'#dce6e1',light:2.8,desk:[-.4,-.65],angle:0},
  {name:'Coder’s workshop',mood:'Midnight, amber & terminal green',wall:'#283c45',floor:'#44535a',tile:'#3b494e',wood:'#8b6448',accent:'#e0a15e',bg:'#263b43',light:1.1,desk:[-.9,-.3],angle:Math.PI/2},
  {name:'Tester’s lab',mood:'Plum, cool light & careful experiments',wall:'#534863',floor:'#756981',tile:'#6a6077',wood:'#aaa0b0',accent:'#9ed5ce',bg:'#403a53',light:1.5,desk:[.7,-.7],angle:0},
  {name:'Manager’s hall',mood:'Sage, warm oak & shared ideas',wall:'#d7dec6',floor:'#dfcfad',tile:'#d1c3a3',wood:'#966d49',accent:'#7d9d6b',bg:'#e4e6d5',light:2.6,desk:[-.5,.05],angle:-Math.PI/2},
];

export function createOffice(index, character) {
  const palette=PALETTES[index], scene=new THREE.Scene();scene.background=new THREE.Color(palette.bg);
  const materials=new Map(), assets={};
  function material(color,extra={}){const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:true,...extra}));return materials.get(key);}
  function add(geo,color,parent,x=0,y=0,z=0,extra={}){const m=new THREE.Mesh(geo,material(color,extra));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const box=(w,h,d,c,p,x=0,y=0,z=0)=>add(new THREE.BoxGeometry(w,h,d),c,p,x,y,z);
  function asset(name,position=[0,0,0],parent=scene){const g=new THREE.Group();g.name=name;g.position.set(...position);parent.add(g);assets[name]=g;return g;}
  const room=asset('room');
  box(6.25,.28,6.25,palette.wood,room,0,-.18,0);
  for(let x=0;x<6;x++)for(let z=0;z<6;z++)box(.98,.1,.98,(x+z)%2?palette.floor:palette.tile,room,x-2.5,0,z-2.5);
  // The north and west walls are the only walls. South/east stay open.
  const walls=asset('walls');box(6.2,2.8,.16,palette.wall,walls,0,1.37,-3.05);box(.16,2.8,6.2,palette.wall,walls,-3.05,1.37,0);
  box(6.15,.11,.2,palette.wood,walls,0,.14,-2.94);box(.2,.11,6.15,palette.wood,walls,-2.94,.14,0);
  // Open doorway motif on the west wall, visible from the desk.
  const door=asset('office doorway',[-2.95,0,1.9]);box(.03,1.9,.85,palette.wood,door,0,.95,0);box(.05,1.65,.64,palette.accent,door,.025,.86,0);
  const rug=asset('rug',[.15,.065,.6]);box(2.5,.025,1.6,palette.accent,rug);for(let x=-1;x<=1;x+=.4)box(.025,.01,1.4,palette.floor,rug,x,.02,0);
  const desk=asset('table',[palette.desk[0],0,palette.desk[1]]);desk.rotation.y=palette.angle;
  box(2.25,.14,1.05,palette.wood,desk,0,.92,0);
  for(const x of [-.9,.9])for(const z of [-.35,.35])box(.12,.88,.12,palette.wood,desk,x,.44,z);
  const computer=asset('computer',[-.46,1, -.24],desk);
  box(.72,.5,.075,'#263638',computer,0,.35,0);box(.62,.38,.02,palette.accent,computer,0,.36,.049);
  box(.08,.18,.08,'#354248',computer,0,.08,0);box(.35,.025,.2,'#354248',computer,0,0,0);
  for(let y=.23;y<.5;y+=.065)box(.35,.014,.01,index===1?'#b8ead2':'#e2f1df',computer,-.06,y,.065);
  box(.6,.035,.2,'#47595b',desk,-.46,1.015,.26);box(.11,.04,.14,'#47595b',desk,.02,1.025,.27);
  const laptop=asset('laptop',[.48,1.015,.13],desk);box(.52,.035,.35,'#bec8c4',laptop);
  const lid=asset('laptop lid',[0,.03,-.14],laptop);lid.rotation.x=-.18;box(.52,.34,.025,'#b0bcba',lid,0,.17,0);box(.45,.27,.018,'#537b84',lid,0,.18,.022);
  const pencil=asset('pencil',[.9,1.03,.27],desk);const shaft=add(new THREE.CylinderGeometry(.018,.018,.31,6),'#e1b459',pencil);shaft.rotation.z=Math.PI/2;
  const nib=add(new THREE.ConeGeometry(.019,.07,6),'#403e37',pencil,.185,0,0);nib.rotation.z=-Math.PI/2;
  const lamp=asset('lamp',[.9,1,-.3],desk);add(new THREE.CylinderGeometry(.15,.16,.04,10),'#394b46',lamp,0,.03,0);box(.035,.48,.035,'#394b46',lamp,0,.29,0);
  add(new THREE.ConeGeometry(.21,.25,8),palette.accent,lamp,0,.59,0);
  add(new THREE.SphereGeometry(.06,6,4),'#fff2b0',lamp,0,.48,0,{emissive:'#ffe79a',emissiveIntensity:2});
  const bulb=new THREE.PointLight('#ffdd9d',index===1?6:2,4,2);bulb.position.set(0,.47,0);lamp.add(bulb);
  const chair=asset('chair',[0,0,.92],desk);box(.65,.14,.56,palette.accent,chair,0,.49,0);box(.65,.62,.13,palette.accent,chair,0,.82,.28);
  for(const x of [-.24,.24])for(const z of [-.19,.19])box(.055,.45,.055,'#46554a',chair,x,.22,z);
  const printerStand=asset('printer cabinet',[index===2?-1.9:1.9,0,index===3?-1.75:-1.85]);
  box(.95,.68,.8,palette.wood,printerStand,0,.38,0);box(.78,.38,.6,'#d9dfd8',printerStand,0,.9,0);
  const printer=asset('printer',[0,.92,0],printerStand);box(.68,.055,.43,'#4f5b5a',printer,0,.2,0);box(.46,.012,.32,'#f6f1db',printer,0,.03,.36);box(.51,.055,.025,'#31464c',printer,0,.02,.31);
  add(new THREE.SphereGeometry(.028,5,4),'#9ce8bf',printer,.27,.14,.32,{emissive:'#8ee6b4',emissiveIntensity:.8});
  const shelf=asset('bookshelf',[-2.46,0,-1.4]);box(.66,1.65,1.9,palette.wood,shelf,0,.86,0);
  const books=asset('books',[.37,0,0],shelf);for(let row=0;row<2;row++)for(let i=0;i<7;i++)box(.17,.33+(i%3)*.06,.16,[palette.accent,'#c68165','#dcc78d','#7b9b91'][i%4],books,0,.57+row*.66,-.73+i*.24);
  for(let i=0;i<3;i++)box(.45,.065,.29,[palette.accent,'#ebd7a8','#638a8c'][i],desk,-.94,1.04+i*.07,.08);
  const picture=asset('wall picture',[.25,1.91,-2.94]);box(1.35,.92,.08,palette.wood,picture);box(1.18,.75,.025,'#f3e4bd',picture,0,0,.055);
  for(let i=0;i<3;i++){const art=add(new THREE.ConeGeometry(.23,.42,3),[palette.accent,'#b9bd89','#d49972'][i],picture,(i-1)*.34,-.09,.085);art.scale.z=.05;}
  const plant=asset('plant',[2.35,0,2.12]);add(new THREE.CylinderGeometry(.24,.17,.4,7),palette.wood,plant,0,.23,0);box(.045,.65,.045,'#628460',plant,0,.65,0);
  for(let i=0;i<3;i++)add(new THREE.IcosahedronGeometry(.24,0),'#7b9d67',plant,Math.sin(i*2)*.18,.85+i*.13,Math.cos(i*2)*.18);
  if(index===0){const plan=asset('blueprint board',[-1.4,1.9,-2.92]);box(1.25,.85,.05,'#528da1',plan);for(let i=0;i<4;i++)box(.9,.012,.01,'#c8e4e6',plan,0,-.28+i*.18,.035);}
  if(index===1){const tower=asset('computer tower',[palette.desk[0]+1.15,.4,palette.desk[1]]);box(.4,.72,.55,'#24333a',tower);for(let i=0;i<3;i++)add(new THREE.TorusGeometry(.085,.014,4,10),'#dfaa65',tower,0,-.18+i*.18,.285);}
  if(index===2){const board=asset('test board',[1.8,1.85,-2.93]);box(1.1,.86,.05,'#d6dad2',board);for(let i=0;i<6;i++)box(.19,.15,.02,i%3?'#b3c28f':'#c98582',board,(i%3-1)*.29,Math.floor(i/3)*.28-.13,.04);}
  if(index===3){const meeting=asset('side table',[1.6,.52,1.1]);add(new THREE.CylinderGeometry(.6,.6,.12,8),palette.wood,meeting);box(.15,.49,.15,palette.wood,meeting,0,-.29,0);}
  scene.add(new THREE.HemisphereLight(index===2?'#d5deff':'#fff2d8','#3b4342',palette.light));
  const sun=new THREE.DirectionalLight(index===1?'#9cbec8':'#fff1d5',index===1?1:2.4);sun.position.set(3,9,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5});sun.shadow.normalBias=.025;scene.add(sun);
  const occupant=character.clone(true);occupant.name='office occupant';occupant.scale.setScalar(1.15);occupant.visible=false;
  const seat=new THREE.Vector3(0,.03,.82).applyAxisAngle(new THREE.Vector3(0,1,0),palette.angle);seat.add(desk.position);occupant.position.copy(seat);occupant.rotation.y=palette.angle+Math.PI;scene.add(occupant);
  const body=occupant.children[0],arms=body.children.slice(-2);
  return {scene,palette,occupant,assets,wallCount:2,update(time,working,paused){occupant.visible=working;if(!working)return;arms.forEach((a,i)=>{a.rotation.x=-1.1+(paused?0:Math.sin(time*7+i*2)*.1);});body.rotation.x=paused?0:Math.sin(time*1.8)*.018;},
    anchor(){return occupant.position.clone().add(new THREE.Vector3(0,1.55,0));}};
}
