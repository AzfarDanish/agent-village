import * as THREE from 'three';

// Geometry instead of WebGL linewidth: consistent chunky edges on all browsers.
export function createHoverFrame(scene){
  const group=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:'#ffe3a0',depthTest:false});
  const edges=[],corners=[];group.renderOrder=20;
  for(let i=0;i<12;i++){const edge=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,1,6),material);edge.renderOrder=20;group.add(edge);edges.push(edge);}
  for(let i=0;i<8;i++){const corner=new THREE.Mesh(new THREE.IcosahedronGeometry(.045,0),material);corner.renderOrder=21;group.add(corner);corners.push(corner);}
  group.visible=false;scene.add(group);
  const up=new THREE.Vector3(0,1,0),delta=new THREE.Vector3();
  return {group,update(bounds,time,animate){
    const vertices=[];for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++)vertices.push(new THREE.Vector3(x?bounds.max.x:bounds.min.x,y?bounds.max.y:bounds.min.y,z?bounds.max.z:bounds.min.z));
    let n=0;vertices.forEach((v,i)=>{corners[i].position.copy(v);corners[i].scale.setScalar(animate?1+Math.sin(time*3+i*.5)*.12:1);for(const bit of [1,2,4]){const j=i^bit;if(j<i)continue;const edge=edges[n++];delta.subVectors(vertices[j],v);edge.position.copy(v).addScaledVector(delta,.5);edge.quaternion.setFromUnitVectors(up,delta.clone().normalize());edge.scale.y=delta.length();}});
  }};
}
