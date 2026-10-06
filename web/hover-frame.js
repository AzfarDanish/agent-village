import * as THREE from 'three';

// Controls the length of the hover wireframe corner brackets (in local units).
export const BRACKET_LENGTH = 0.55;

// The 8 corners of the bounding box and their inward direction vectors.
const CORNERS = [
  { minX: true,  minY: true,  minZ: true,  dx:  1, dy:  1, dz:  1 },
  { minX: true,  minY: true,  minZ: false, dx:  1, dy:  1, dz: -1 },
  { minX: true,  minY: false, minZ: true,  dx:  1, dy: -1, dz:  1 },
  { minX: true,  minY: false, minZ: false, dx:  1, dy: -1, dz: -1 },
  { minX: false, minY: true,  minZ: true,  dx: -1, dy:  1, dz:  1 },
  { minX: false, minY: true,  minZ: false, dx: -1, dy:  1, dz: -1 },
  { minX: false, minY: false, minZ: true,  dx: -1, dy: -1, dz:  1 },
  { minX: false, minY: false, minZ: false, dx: -1, dy: -1, dz: -1 }
];

export function createHoverFrame(scene) {
  const group = new THREE.Group();
  // We disable matrixAutoUpdate so we can explicitly align it to the hovered object
  group.matrixAutoUpdate = false;
  
  const material = new THREE.MeshBasicMaterial({ color: '#ffe3a1', depthTest: false, transparent: true, opacity: 0 });
  const brackets = [];
  
  // thickness of the bracket lines
  const th = 0.055;
  const len = BRACKET_LENGTH;
  
  const geoX = new THREE.BoxGeometry(len, th, th);
  const geoY = new THREE.BoxGeometry(th, len, th);
  const geoZ = new THREE.BoxGeometry(th, th, len);

  for (let i = 0; i < 8; i++) {
    const bGroup = new THREE.Group();
    bGroup.renderOrder = 21;
    
    // Shift centers so the outer corner is exactly at (0,0,0) and legs extend in the +X, +Y, +Z directions
    const mX = new THREE.Mesh(geoX, material);
    mX.position.set(len / 2, th / 2, th / 2);
    
    const mY = new THREE.Mesh(geoY, material);
    mY.position.set(th / 2, len / 2, th / 2);
    
    const mZ = new THREE.Mesh(geoZ, material);
    mZ.position.set(th / 2, th / 2, len / 2);
    
    bGroup.add(mX, mY, mZ);
    group.add(bGroup);
    brackets.push(bGroup);
  }
  
  group.visible = false;
  scene.add(group);
  const cam = new THREE.Vector3();
  const cornerPos = new THREE.Vector3();
  let targetOpacity = 0;
  
  return {
    group,
    counts() {
      let visible = 0;
      for (const b of brackets) if (b.visible) visible++;
      return { brackets: visible, corners: visible, totalCorners: 8 };
    },
    setTargetOpacity(op) { targetOpacity = op; },
    update(object, time, animate, camera, dt = 0.016) {
      material.opacity = THREE.MathUtils.damp(material.opacity, targetOpacity, 10, dt);
      group.visible = material.opacity > 0.01;
      if (!group.visible || !object) return;

      // Align frame group entirely with the object's world transform
      group.matrix.copy(object.matrixWorld);
      group.matrixWorld.copy(object.matrixWorld);
      group.matrixWorldNeedsUpdate = false;

      // Compute or retrieve the object's exact local bounds (unaffected by its world rotation)
      // Using vertex scanning avoids AABB inflation on rotated child geometries (such as angled pyramid roofs).
      if (!object.userData.localBox) {
        const box = new THREE.Box3();
        const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
        const v = new THREE.Vector3();
        object.traverse(c => {
          if (c.isMesh && c.geometry && c.visible) {
            const pos = c.geometry.attributes.position;
            if (!pos) return;
            const m = new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld);
            for (let i = 0; i < pos.count; i++) {
              v.fromBufferAttribute(pos, i).applyMatrix4(m);
              box.expandByPoint(v);
            }
          }
        });
        object.userData.localBox = box;
      }
      const bounds = object.userData.localBox;

      // Transform camera to the object's local space to find the farthest back corner
      const invGroup = new THREE.Matrix4().copy(group.matrixWorld).invert();
      camera.getWorldPosition(cam);
      cam.applyMatrix4(invGroup);
      
      let back = -1, best = -Infinity;
      CORNERS.forEach((c, i) => {
        cornerPos.set(
          c.minX ? bounds.min.x : bounds.max.x,
          c.minY ? bounds.min.y : bounds.max.y,
          c.minZ ? bounds.min.z : bounds.max.z
        );
        const d = cornerPos.distanceToSquared(cam);
        if (d > best) { best = d; back = i; }
      });
      
      const s = animate ? 1 + Math.sin(time * 4) * 0.08 : 1;
      CORNERS.forEach((c, i) => {
        brackets[i].visible = i !== back;
        cornerPos.set(
          c.minX ? bounds.min.x : bounds.max.x,
          c.minY ? bounds.min.y : bounds.max.y,
          c.minZ ? bounds.min.z : bounds.max.z
        );
        brackets[i].position.copy(cornerPos);
        brackets[i].scale.set(c.dx * s, c.dy * s, c.dz * s);
      });
    }
  };
}
