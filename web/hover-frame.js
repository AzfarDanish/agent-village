import * as THREE from 'three';

// Chunky geometry edges (linewidth is unreliable across browsers).
// Only the camera-facing side renders: the corner farthest from the camera
// and every edge touching it stay hidden, so the frame reads as a
// silhouette instead of a full cage.
const PAIRS = [];
for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) {
  const j = i ^ bit;
  if (j > i) PAIRS.push([i, j]);
}

export function createHoverFrame(scene) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: '#ffe3a1', depthTest: false });
  const edges = [], corners = [];
  group.renderOrder = 20;
  for (const [a, b] of PAIRS) {
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1, 6), material);
    edge.renderOrder = 20;
    edge.userData.pair = [a, b];
    group.add(edge);
    edges.push(edge);
  }
  for (let i = 0; i < 8; i++) {
    const corner = new THREE.Mesh(new THREE.IcosahedronGeometry(.06, 0), material);
    corner.renderOrder = 21;
    corner.userData.index = i;
    group.add(corner);
    corners.push(corner);
  }
  group.visible = false;
  scene.add(group);
  const up = new THREE.Vector3(0, 1, 0), delta = new THREE.Vector3(), cam = new THREE.Vector3();
  let visibleEdges = 0, visibleCorners = 0;
  return {
    group,
    counts() { return { edges: visibleEdges, corners: visibleCorners, totalEdges: PAIRS.length, totalCorners: 8 }; },
    update(bounds, time, animate, camera) {
      const vertices = [];
      for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++)
        vertices.push(new THREE.Vector3(x ? bounds.max.x : bounds.min.x, y ? bounds.max.y : bounds.min.y, z ? bounds.max.z : bounds.min.z));
      // Farthest corner from the camera is the back side: hide it entirely.
      camera.getWorldPosition(cam);
      let back = 0, best = -Infinity;
      vertices.forEach((v, i) => {
        const d = v.distanceToSquared(cam);
        if (d > best) { best = d; back = i; }
      });
      vertices.forEach((v, i) => {
        corners[i].visible = i !== back;
        corners[i].position.copy(v);
        corners[i].scale.setScalar(animate ? 1 + Math.sin(time * 3 + i * .6) * .15 : 1);
      });
      visibleEdges = 0; visibleCorners = 0;
      for (const corner of corners) if (corner.visible) visibleCorners++;
      for (const edge of edges) {
        const [a, b] = edge.userData.pair;
        const front = a !== back && b !== back;
        edge.visible = front;
        if (front) visibleEdges++;
        else continue;
        delta.subVectors(vertices[b], vertices[a]);
        edge.position.copy(vertices[a]).addScaledVector(delta, .5);
        edge.quaternion.setFromUnitVectors(up, delta.clone().normalize());
        edge.scale.set(animate ? 1 + Math.sin(time * 3 + a) * .1 : 1, delta.length(), 1);
      }
    }
  };
}
