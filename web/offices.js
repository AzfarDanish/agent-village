import * as THREE from 'three';

const PALETTES = [
  {name:'Architect’s studio',mood:'Daylight, paper & blueprints',wall:'#cedfdf',floor:'#e8e2cf',tile:'#dad9c5',wood:'#bd956b',accent:'#6d9fae',bg:'#dce6e1',light:2.8},
  {name:'Coder’s workshop',mood:'Midnight, amber & terminal green',wall:'#283c45',floor:'#44535a',tile:'#3b494e',wood:'#8b6448',accent:'#e0a15e',bg:'#263b43',light:1.1},
  {name:'Tester’s lab',mood:'Plum, cool light & careful experiments',wall:'#534863',floor:'#756981',tile:'#6a6077',wood:'#aaa0b0',accent:'#9ed5ce',bg:'#403a53',light:1.5},
  {name:'Manager’s hall',mood:'Sage, warm oak & shared ideas',wall:'#d7dec6',floor:'#dfcfad',tile:'#d1c3a3',wood:'#966d49',accent:'#7d9d6b',bg:'#e4e6d5',light:2.6},
];

export function createOffice(index, character) {
  const palette = PALETTES[index];
  const scene = new THREE.Scene(); 
  scene.background = new THREE.Color(palette.bg);
  const materials = new Map(), assets = {};
  
  function material(color, extra={}) {
    const key = color + JSON.stringify(extra);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({color, roughness:0.85, flatShading:true, ...extra}));
    return materials.get(key);
  }
  
  function add(geo, color, parent, x=0, y=0, z=0, extra={}) {
    const m = new THREE.Mesh(geo, material(color, extra));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  
  const box = (w, h, d, c, p, x=0, y=0, z=0) => add(new THREE.BoxGeometry(w, h, d), c, p, x, y, z);
  const cyl = (rt, rb, h, s, c, p, x=0, y=0, z=0) => add(new THREE.CylinderGeometry(rt, rb, h, s), c, p, x, y, z);
  
  function asset(name, position=[0,0,0], parent=scene) {
    const g = new THREE.Group(); g.name = name; g.position.set(...position);
    parent.add(g); assets[name] = g; return g;
  }
  
  const room = asset('room');
  const walls = asset('walls');
  let seat, occupantAngle;

  if (index === 0) {
    // ARCHITECT (5.5 x 5.5)
    box(5.5, 0.28, 5.5, palette.wood, room, 0, -0.16, 0);
    for(let x=0; x<5; x++) for(let z=0; z<5; z++) box(0.98, 0.02, 0.98, (x+z)%2 ? palette.floor : palette.tile, room, x - 2.0, -0.01, z - 2.0);
    box(0.16, 2.8, 5.5, palette.wall, walls, -2.75, 1.4, 0); // West
    box(5.5, 2.8, 0.16, palette.wall, walls, 0, 1.4, -2.75); // North
    
    const door = asset('office doorway', [-2.65, 0, 1.0]);
    box(0.1, 1.9, 0.85, palette.wood, door, 0, 0.95, 0);
    box(0.12, 1.65, 0.64, palette.accent, door, 0.01, 0.825, 0);

    // Large center rug
    box(3.5, 0.025, 2.5, '#9fb8b8', room, 0.5, 0.01, 0.5);

    const desk = asset('table', [0.5, 0, 0.5]); desk.rotation.y = -0.2;
    box(2.2, 0.1, 1.2, palette.wood, desk, 0, 0.9, 0); 
    const tilt = box(1.2, 0.04, 0.8, '#e0d8c8', desk, 0, 0.95, 0); tilt.rotation.x = -0.15;
    for(let x of [-0.9, 0.9]) for(let z of [-0.4, 0.4]) cyl(0.04, 0.04, 0.9, 4, '#555', desk, x, 0.45, z);
    
    seat = new THREE.Vector3(0, 0, 0.8).applyAxisAngle(new THREE.Vector3(0,1,0), -0.2).add(desk.position);
    occupantAngle = -0.2 + Math.PI;

    const computer = asset('computer', [-0.7, 0.95, -0.2], desk);
    box(0.2, 0.02, 0.15, '#ccc', computer, 0, 0.01, 0);
    box(0.04, 0.2, 0.04, '#ccc', computer, 0, 0.1, 0);
    box(0.6, 0.4, 0.04, '#ddd', computer, 0, 0.3, 0);
    box(0.56, 0.36, 0.02, '#222', computer, 0, 0.3, 0.02);

    const laptop = asset('laptop', [0.8, 0.95, 0], desk); laptop.rotation.y = -0.3;
    box(0.4, 0.02, 0.3, '#bbb', laptop, 0, 0.01, 0);
    const lid = box(0.4, 0.28, 0.02, '#aaa', laptop, 0, 0.15, -0.15); lid.rotation.x = -0.1;

    const printer = asset('printer', [-1.5, 0, -2.0]);
    box(1.8, 0.8, 0.6, '#eee', printer, 0, 0.4, 0);
    cyl(0.1, 0.1, 1.6, 8, '#333', printer, 0, 0.85, 0).rotation.z = Math.PI/2;
    
    const picture = asset('wall picture', [0.5, 1.8, -2.65]);
    box(1.8, 1.2, 0.05, '#528da1', picture, 0, 0, 0);
    for(let i=0;i<3;i++) box(0.4, 0.3, 0.02, '#fff', picture, -0.6 + i*0.5, 0.2, 0.03);

    const pencil = asset('pencil', [0.2, 0.98, 0.2], desk);
    cyl(0.01, 0.01, 0.15, 6, '#222', pencil, 0, 0, 0).rotation.z = Math.PI/2;

    const lamp = asset('lamp', [-0.8, 0.95, -0.4], desk);
    cyl(0.08, 0.08, 0.02, 8, '#222', lamp, 0, 0.01, 0);
    box(0.02, 0.4, 0.02, '#222', lamp, 0.1, 0.2, 0).rotation.z = -0.3;
    cyl(0.1, 0.15, 0.15, 8, palette.accent, lamp, 0.3, 0.35, 0).rotation.z = 0.5;

    const books = asset('books', [-2.5, 0, -0.5]);
    box(0.4, 1.6, 1.2, palette.wood, books, 0, 0.8, 0);
    for(let i=0; i<4; i++) box(0.3, 0.08, 0.25, ['#444','#555','#666','#777'][i], books, 0, 1.24 + i*0.08, 0);
    
    // Extras for density
    const wastebasket = asset('wastebasket', [1.8, 0, 0.5]);
    cyl(0.18, 0.14, 0.4, 8, '#444', wastebasket, 0, 0.2, 0);
    
    const plant = asset('plant', [2.0, 0, -2.0]);
    cyl(0.3, 0.2, 0.4, 8, '#fff', plant, 0, 0.2, 0);
    for(let i=0; i<3; i++) add(new THREE.SphereGeometry(0.35, 7, 7), '#4a7543', plant, Math.sin(i*2.1)*0.15, 0.6 + i*0.2, Math.cos(i*2.1)*0.15);
    
    const model = asset('model', [-1.5, 0, 1.5]);
    box(0.6, 1.0, 0.6, '#eee', model, 0, 0.5, 0); // pedestal
    box(0.4, 0.2, 0.4, '#fff', model, 0, 1.1, 0); // building mass
    box(0.2, 0.3, 0.2, '#fff', model, -0.05, 1.35, -0.05);
  }
  else if (index === 1) {
    // CODER (7.0 x 4.0)
    box(7.0, 0.28, 4.0, palette.wood, room, 0, -0.16, 0);
    for(let x=0; x<7; x++) for(let z=0; z<4; z++) box(0.98, 0.02, 0.98, '#333', room, x - 3.0, -0.01, z - 1.5);
    box(0.16, 2.8, 4.0, palette.wall, walls, -3.5, 1.4, 0); // West
    box(7.0, 2.8, 0.16, palette.wall, walls, 0, 1.4, -2.0); // North
    
    const door = asset('office doorway', [-2.0, 0, -1.9]);
    box(0.85, 1.9, 0.1, palette.wood, door, 0, 0.95, 0);
    box(0.64, 1.65, 0.12, palette.accent, door, 0, 0.825, 0.01);

    // Center circular rug
    cyl(1.2, 1.2, 0.025, 16, '#2a3b43', room, 0, 0.01, 0.5);

    const desk = asset('table', [0, 0, -1.2]);
    box(2.8, 0.1, 1.0, '#3a2e26', desk, 0, 0.85, 0); 
    for(let x of [-1.3, 1.3]) box(0.1, 0.85, 0.8, '#222', desk, x, 0.425, 0);
    // Return desk
    const returnDesk = asset('return', [1.4, 0, -0.5]);
    box(1.0, 0.1, 1.2, '#3a2e26', returnDesk, 0, 0.85, 0);
    box(0.1, 0.85, 0.8, '#222', returnDesk, 0.4, 0.425, 0);

    seat = new THREE.Vector3(0, 0, 0.7).add(desk.position);
    occupantAngle = Math.PI;

    const computer = asset('computer', [0, 0.85, -0.2], desk);
    box(0.2, 0.5, 0.4, '#111', computer, 1.0, -0.6, 0); 
    for(let i of [-1, 1]) {
      const mon = asset(`mon${i}`, [i*0.35, 0.3, 0], computer); mon.rotation.y = i * -0.2;
      box(0.6, 0.35, 0.05, '#222', mon, 0, 0, 0);
      box(0.56, 0.31, 0.02, '#0f0', mon, 0, 0, 0.03, {emissive:'#0a0', emissiveIntensity:0.5});
    }

    const laptop = asset('laptop', [-0.8, 0.85, 0.1], desk); laptop.rotation.y = 0.4;
    box(0.35, 0.04, 0.25, '#151515', laptop, 0, 0.02, 0);
    const lid = box(0.35, 0.25, 0.02, '#151515', laptop, 0, 0.14, -0.12); lid.rotation.x = -0.15;
    box(0.31, 0.21, 0.01, '#222', lid, 0, 0, 0.015);

    const printer = asset('printer', [-2.8, 0, -1.2]);
    box(1.0, 0.6, 0.8, '#333', printer, 0, 0.3, 0); // cabinet
    box(0.5, 0.2, 0.4, '#ccc', printer, 0, 0.7, 0); // printer

    const picture = asset('wall picture', [-3.4, 1.6, 0]); picture.rotation.y = Math.PI/2;
    box(1.2, 1.6, 0.05, '#000', picture, 0, 0, 0);
    box(1.0, 1.4, 0.01, '#111', picture, 0, 0, 0.03);
    for(let i=0; i<8; i++) box(0.8, 0.02, 0.01, '#0f0', picture, 0, 0.6 - i*0.15, 0.04);

    const pencil = asset('pencil', [0.5, 0.86, 0.3], desk);
    box(0.01, 0.01, 0.12, '#eeaa00', pencil, 0, 0, 0).rotation.y = 0.5;

    const lamp = asset('lamp', [-1.0, 0.85, -0.3], desk);
    cyl(0.05, 0.05, 0.4, 8, '#111', lamp, 0, 0.2, 0);
    box(0.4, 0.02, 0.04, '#111', lamp, 0.2, 0.4, 0);
    box(0.38, 0.01, 0.02, palette.accent, lamp, 0.2, 0.39, 0, {emissive:palette.accent, emissiveIntensity:1});
    const bulb = new THREE.PointLight(palette.accent, 2, 4); bulb.position.set(0, 0.5, 0); lamp.add(bulb);

    const books = asset('books', [0, 0.86, 0], returnDesk);
    for(let i=0; i<5; i++) box(0.06, 0.25, 0.2, ['#a33','#3a3','#33a'][i%3], books, -0.15 + i*0.08, 0.125, -0.2);

    // Extras
    const rack = asset('server rack', [-2.8, 0, 1.0]);
    box(1.0, 1.6, 1.0, '#111', rack, 0, 0.8, 0);
    for(let i=0; i<6; i++) {
      box(0.8, 0.1, 0.05, '#333', rack, 0, 0.3 + i*0.2, 0.5);
      box(0.1, 0.02, 0.01, '#0f0', rack, -0.3, 0.3 + i*0.2, 0.53, {emissive:'#0f0', emissiveIntensity:0.8});
    }
    
    const whiteboard = asset('whiteboard', [2.5, 0, 1.0]); whiteboard.rotation.y = -0.3;
    box(1.5, 1.0, 0.04, '#fff', whiteboard, 0, 1.2, 0);
    box(1.6, 1.1, 0.02, '#aaa', whiteboard, 0, 1.2, -0.02);
    cyl(0.03, 0.03, 1.6, 6, '#aaa', whiteboard, -0.6, 0.8, 0);
    cyl(0.03, 0.03, 1.6, 6, '#aaa', whiteboard, 0.6, 0.8, 0);

    const mug = asset('mug', [0.3, 0.86, 0.2], returnDesk);
    cyl(0.04, 0.04, 0.1, 8, '#fff', mug, 0, 0.05, 0);
    
    // Cables
    const cables = asset('cables', [-1.8, 0, 1.0]);
    const cb1 = add(new THREE.TorusGeometry(0.3, 0.01, 4, 12), '#222', cables, 0, 0.02, 0); cb1.rotation.x = Math.PI/2;
    const cb2 = add(new THREE.TorusGeometry(0.2, 0.01, 4, 12), '#111', cables, 0.1, 0.02, 0.1); cb2.rotation.x = Math.PI/2;
  }
  else if (index === 2) {
    // TESTER (4.0 x 7.0)
    box(4.0, 0.28, 7.0, palette.wood, room, 0, -0.16, 0);
    for(let x=0; x<4; x++) for(let z=0; z<7; z++) box(0.98, 0.02, 0.98, (x+z)%2 ? '#eee' : '#ccc', room, x - 1.5, -0.01, z - 3.0);
    box(0.16, 2.8, 7.0, palette.wall, walls, -2.0, 1.4, 0); // West
    box(4.0, 2.8, 0.16, palette.wall, walls, 0, 1.4, -3.5); // North
    
    const door = asset('office doorway', [-1.9, 0, 2.0]); door.rotation.y = Math.PI/2;
    box(0.85, 1.9, 0.1, palette.wood, door, 0, 0.95, 0);
    box(0.64, 1.65, 0.12, palette.accent, door, 0, 0.825, -0.01);

    const desk = asset('table', [0, 0, 0]); 
    box(2.4, 0.1, 2.4, '#eef2f5', desk, 0, 0.8, 0); 
    box(1.2, 0.12, 1.2, palette.bg, desk, 0, 0.8, 0.6); 
    for(let x of [-1.0, 1.0]) for(let z of [-1.0, 1.0]) cyl(0.05, 0.05, 0.8, 6, '#aaa', desk, x, 0.4, z);

    seat = new THREE.Vector3(0, 0, 0.6).add(desk.position);
    occupantAngle = Math.PI;

    const computer = asset('computer', [0, 0.85, -0.8], desk);
    box(0.6, 0.5, 0.3, '#ddd', computer, 0, 0.25, 0);
    box(0.5, 0.4, 0.02, '#111', computer, 0, 0.25, 0.16);
    box(0.4, 0.3, 0.01, '#88aaff', computer, -0.05, 0.25, 0.17, {emissive:'#88aaff', emissiveIntensity:0.3});

    const laptop = asset('laptop', [0.8, 0.85, -0.3], desk); laptop.rotation.y = -0.5;
    box(0.35, 0.06, 0.25, '#333', laptop, 0, 0.03, 0); 
    const lid = box(0.35, 0.25, 0.04, '#333', laptop, 0, 0.15, -0.1); lid.rotation.x = -0.2;
    box(0.3, 0.2, 0.01, '#ccc', lid, 0, 0, 0.025);

    const printer = asset('printer', [-0.8, 0.85, 0], desk);
    box(0.3, 0.2, 0.2, '#eee', printer, 0, 0.1, 0);
    cyl(0.06, 0.06, 0.25, 8, '#fff', printer, 0, 0.25, -0.05).rotation.z = Math.PI/2;

    const picture = asset('wall picture', [0, 1.5, -3.4]);
    box(1.5, 1.0, 0.05, '#ccc', picture, 0, 0, 0);
    box(1.3, 0.8, 0.02, '#fff', picture, 0, 0, 0.03);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 16), '#f55', picture, -0.3, 0, 0.04).rotation.x = Math.PI/2;

    const pencil = asset('pencil', [0.4, 0.86, 0.2], desk);
    cyl(0.015, 0.015, 0.12, 6, '#d33', pencil, 0, 0, 0).rotation.z = Math.PI/2;

    const lamp = asset('lamp', [0, 0.85, -0.4], desk);
    cyl(0.1, 0.1, 0.02, 8, '#aaa', lamp, 0, 0.01, 0);
    cyl(0.02, 0.02, 0.6, 6, '#aaa', lamp, 0, 0.3, -0.1).rotation.x = 0.2;
    const ring = add(new THREE.TorusGeometry(0.12, 0.02, 8, 16), '#fff', lamp, 0, 0.6, 0.1); ring.rotation.x = Math.PI/2;
    add(new THREE.TorusGeometry(0.12, 0.015, 8, 16), palette.accent, lamp, 0, 0.58, 0.1, {emissive:palette.accent, emissiveIntensity:1}).rotation.x = Math.PI/2;
    const bulb2 = new THREE.PointLight('#fff', 1.5, 4); bulb2.position.set(0, 0.6, 0.1); lamp.add(bulb2);

    const books = asset('books', [1.0, 0, -2.5]); // on rolling cart
    box(0.8, 0.8, 0.6, '#999', books, 0, 0.4, 0); // cart
    for(let i=0; i<3; i++) box(0.4, 0.05, 0.3, '#eee', books, 0, 0.825 + i*0.06, 0);
    
    // Extras
    const pegboard = asset('pegboard', [-1.95, 1.5, -1.0]); pegboard.rotation.y = Math.PI/2;
    box(1.2, 0.8, 0.04, '#c1a68d', pegboard, 0, 0, 0);
    box(0.1, 0.2, 0.02, '#333', pegboard, -0.3, 0.1, 0.03); // tool
    box(0.2, 0.1, 0.02, '#333', pegboard, 0.2, -0.1, 0.03);
    
    const toolbox = asset('toolbox', [-1.0, 0, -2.5]);
    box(0.6, 0.4, 0.4, '#a33', toolbox, 0, 0.2, 0);
    
    const crates = asset('crates', [1.2, 0, 2.5]);
    box(0.6, 0.3, 0.6, '#33a', crates, 0, 0.15, 0);
    box(0.6, 0.3, 0.6, '#33a', crates, 0.1, 0.45, 0);
  }
  else if (index === 3) {
    // MANAGER (6.0 x 6.0)
    box(6.0, 0.28, 6.0, palette.wood, room, 0, -0.16, 0);
    for(let x=0; x<6; x++) for(let z=0; z<6; z++) box(0.98, 0.02, 0.98, (x+z)%2 ? palette.wood : '#855c3c', room, x - 2.5, -0.01, z - 2.5);
    box(0.16, 2.8, 6.0, palette.wall, walls, -3.0, 1.4, 0); // West
    box(6.0, 2.8, 0.16, palette.wall, walls, 0, 1.4, -3.0); // North
    
    const door = asset('office doorway', [-2.9, 0, 0]); door.rotation.y = Math.PI/2;
    box(0.85, 1.9, 0.1, palette.wood, door, 0, 0.95, 0);
    box(0.64, 1.65, 0.12, palette.accent, door, 0, 0.825, 0.01);

    // Large central persian rug
    box(4.0, 0.025, 4.0, '#8c3a3a', room, 0, 0.01, 0);
    box(3.6, 0.026, 3.6, '#a85a4a', room, 0, 0.01, 0);

    const desk = asset('table', [-1.0, 0, -1.0]); 
    box(2.6, 0.1, 1.2, '#5c3a21', desk, 0, 0.85, 0); 
    for(let x of [-1.0, 1.0]) box(0.6, 0.85, 1.0, '#4a2c16', desk, x, 0.425, 0);
    box(2.4, 0.7, 0.05, '#4a2c16', desk, 0, 0.35, -0.4); 

    seat = new THREE.Vector3(0, 0, -1.8); // World position `(-1.0, 0, -1.8)`
    occupantAngle = 0; 

    const computer = asset('computer', [0.6, 0.85, 0.2], desk); computer.rotation.y = Math.PI; 
    box(0.1, 0.02, 0.1, '#ccc', computer, 0, 0.01, 0);
    box(0.02, 0.15, 0.02, '#ccc', computer, 0, 0.08, 0);
    box(0.5, 0.35, 0.02, '#ddd', computer, 0, 0.25, 0);
    box(0.48, 0.33, 0.01, '#111', computer, 0, 0.25, 0.015);

    const laptop = asset('laptop', [-0.6, 0.85, 0.1], desk); laptop.rotation.y = Math.PI - 0.2;
    box(0.3, 0.015, 0.22, '#d4af37', laptop, 0, 0.01, 0); 
    const lid = box(0.3, 0.22, 0.015, '#d4af37', laptop, 0, 0.11, -0.11); lid.rotation.x = -0.1;

    const printer = asset('printer', [-2.5, 0, -2.5]);
    box(1.0, 0.6, 1.0, '#4a2c16', printer, 0, 0.3, 0); // corner credenza
    box(0.5, 0.3, 0.4, '#111', printer, 0, 0.75, 0); 

    const picture = asset('wall picture', [-2.9, 1.7, -1.0]); picture.rotation.y = Math.PI/2;
    box(1.6, 1.0, 0.06, '#d4af37', picture, 0, 0, 0); 
    box(1.4, 0.8, 0.02, '#fff', picture, 0, 0, 0.04);
    box(1.2, 0.6, 0.01, '#3a5a40', picture, 0, 0, 0.05); 

    const pencil = asset('pencil', [0.2, 0.86, 0.2], desk); pencil.rotation.y = Math.PI;
    cyl(0.01, 0.01, 0.1, 8, '#d4af37', pencil, 0, 0, 0).rotation.z = Math.PI/2; 

    const lamp = asset('lamp', [0.9, 0.85, 0.3], desk); lamp.rotation.y = Math.PI;
    cyl(0.06, 0.08, 0.02, 12, '#b8860b', lamp, 0, 0.01, 0);
    cyl(0.01, 0.01, 0.3, 8, '#b8860b', lamp, 0, 0.15, 0);
    const shade = add(new THREE.CylinderGeometry(0.1, 0.15, 0.15, 16, 1, false, 0, Math.PI), '#2d5a27', lamp, 0, 0.3, 0);
    shade.rotation.x = -Math.PI/2;
    const bulb3 = new THREE.PointLight('#ffc', 1.5, 4); bulb3.position.set(0, 0.2, 0); lamp.add(bulb3);

    const books = asset('books', [1.5, 0, -2.8]);
    box(2.4, 2.2, 0.4, palette.wood, books, 0, 1.1, 0); // large bookshelf
    for(let r=0; r<3; r++) {
      for(let i=0; i<8; i++) box(0.06, 0.3, 0.2, ['#311','#131','#113'][i%3], books, -0.8 + i*0.08, 0.5 + r*0.6, 0.05);
    }
    
    // Extras
    const meetingTable = asset('meetingTable', [1.5, 0, 1.5]);
    cyl(0.8, 0.8, 0.1, 16, '#5c3a21', meetingTable, 0, 0.75, 0);
    cyl(0.2, 0.2, 0.7, 8, '#4a2c16', meetingTable, 0, 0.35, 0);
    
    // 3 chairs around table
    for(let i=0; i<3; i++) {
      const a = i * Math.PI*2/3;
      const c = asset(`chair${i}`, [Math.cos(a)*1.1, 0, Math.sin(a)*1.1], meetingTable);
      c.rotation.y = -a;
      box(0.5, 0.1, 0.5, '#222', c, 0, 0.45, 0); // seat
      box(0.5, 0.5, 0.1, '#222', c, 0, 0.75, 0.2); // back
    }
    
    const sofa = asset('sofa', [-2.0, 0, 2.0]); sofa.rotation.y = Math.PI/2;
    box(1.8, 0.3, 0.8, '#311', sofa, 0, 0.15, 0); // base
    box(1.8, 0.2, 0.7, '#422', sofa, 0, 0.4, -0.05); // cushions
    box(1.8, 0.4, 0.2, '#311', sofa, 0, 0.5, 0.3); // back
    
    const plant = asset('plant', [2.5, 0, -2.0]);
    cyl(0.25, 0.2, 0.4, 8, '#b8860b', plant, 0, 0.2, 0);
    for(let i=0; i<4; i++) add(new THREE.SphereGeometry(0.3, 6, 6), '#2d5a27', plant, Math.sin(i*2)*0.15, 0.5 + i*0.25, Math.cos(i*2)*0.15);
  }

  scene.add(new THREE.HemisphereLight(index===2?'#d5deff':'#fff2d8', '#3b4342', palette.light));
  const sun = new THREE.DirectionalLight(index===1?'#9cbec8':'#fff1d5', index===1?1:2.4);
  sun.position.set(3, 9, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {left:-6, right:6, top:6, bottom:-6});
  sun.shadow.normalBias = 0.025;
  scene.add(sun);

  const occupant = character.clone(true);
  occupant.name = 'office occupant'; 
  occupant.scale.setScalar(1.15); 
  occupant.visible = false;
  occupant.position.copy(seat); 
  occupant.rotation.y = occupantAngle;
  scene.add(occupant);

  const body = occupant.children[0], arms = body.children.slice(-2);

  return {
    scene, palette, occupant, assets, wallCount: 2,
    update(time, working, paused) {
      occupant.visible = working;
      if(!working) return;
      arms.forEach((a, i) => { a.rotation.x = -1.1 + (paused ? 0 : Math.sin(time*7 + i*2)*0.1); });
      body.rotation.x = paused ? 0 : Math.sin(time*1.8)*0.018;
    },
    anchor() { return occupant.position.clone().add(new THREE.Vector3(0, 1.55, 0)); }
  };
}
