import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const COLORS = { cherry: '#bd1729', sage: '#759a86', lavender: '#9b83bf' };
const CAP_RADIUS = 1.73;
const CAP_BASE = 2.28;
const CAP_HEIGHT = 1.90;

// Angular locations belong to one physical surface, so the spots stay fixed in every view.
const WINDOWS = [
  [0.12, 0.25, 0.115], [0.61, -0.74, 0.13], [0.62, 0.86, 0.14],
  [0.84, 0.00, 0.15], [0.78, -0.32, 0.052], [1.02, -0.52, 0.05],
  [1.07, 0.47, 0.06], [1.24, -0.92, 0.15], [1.22, 0.83, 0.135],
  [1.35, -0.39, 0.082], [1.36, 0.38, 0.083], [1.18, -1.47, 0.095],
  [1.32, 1.49, 0.08], [0.66, -1.87, 0.12], [1.01, -2.09, 0.16],
  [1.34, -2.03, 0.078], [0.56, 2.48, 0.13], [0.90, 2.71, 0.16],
  [1.15, 2.13, 0.07], [1.32, 2.48, 0.095], [0.75, -2.76, 0.06],
  [1.22, -2.88, 0.13], [1.33, 3.08, 0.075], [0.90, 1.69, 0.058],
];

function direction(theta, phi) {
  return new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
}

function surface(theta, phi) {
  const u = Math.sin(theta);
  const radius = CAP_RADIUS * u;
  const organic = 0.025 * Math.sin(phi * 3 + 0.4) * u * u * Math.cos(theta);
  return new THREE.Vector3(
    radius * Math.sin(phi) + 0.085 * (1 - u) ** 2,
    CAP_BASE + CAP_HEIGHT * Math.cos(theta) + organic,
    radius * Math.cos(phi),
  );
}

function surfaceNormal(theta, phi) {
  return new THREE.Vector3(
    Math.sin(theta) * Math.sin(phi) / CAP_RADIUS,
    Math.cos(theta) / CAP_HEIGHT,
    Math.sin(theta) * Math.cos(phi) / CAP_RADIUS,
  ).normalize();
}

function capGeometry() {
  const columns = 112;
  const rows = 40;
  const positions = [], normals = [], indices = [];
  for (let row = 0; row <= rows; row++) {
    const theta = row / rows * Math.PI / 2;
    for (let column = 0; column <= columns; column++) {
      const phi = column / columns * Math.PI * 2;
      positions.push(...surface(theta, phi).toArray());
      normals.push(...surfaceNormal(theta, phi).toArray());
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      if (row > 0) indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

function windowGeometry(theta, phi, radius) {
  const center = direction(theta, phi);
  const helper = Math.abs(center.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const tangentU = new THREE.Vector3().crossVectors(helper, center).normalize();
  const tangentV = new THREE.Vector3().crossVectors(center, tangentU).normalize();
  const segments = 40, rings = 8;
  const positions = [], normals = [], indices = [];

  const addVertex = (r, angle) => {
    const arc = radius * r;
    const d = center.clone().multiplyScalar(Math.cos(arc))
      .addScaledVector(tangentU, Math.sin(arc) * Math.cos(angle))
      .addScaledVector(tangentV, Math.sin(arc) * Math.sin(angle)).normalize();
    const t = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1));
    const p = Math.atan2(d.x, d.z);
    const normal = surfaceNormal(t, p);
    // Raised porcelain lenses have an actual curved silhouette and catch side light.
    const relief = 0.009 + (0.012 + radius * CAP_RADIUS * 0.50) * (1 - r * r) ** 1.35;
    positions.push(...surface(t, p).addScaledVector(normal, relief).toArray());
    normals.push(...normal.toArray());
  };
  addVertex(0, 0);
  for (let ring = 1; ring <= rings; ring++) {
    for (let segment = 0; segment < segments; segment++) addVertex(ring / rings, segment / segments * Math.PI * 2);
  }
  for (let i = 0; i < segments; i++) indices.push(0, 1 + i, 1 + (i + 1) % segments);
  for (let ring = 1; ring < rings; ring++) {
    const inner = 1 + (ring - 1) * segments, outer = inner + segments;
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      indices.push(inner + i, outer + i, inner + next, outer + i, outer + next, inner + next);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function stemGeometry() {
  const v = (r, y) => new THREE.Vector3(r, y, 0);
  const curves = [
    [v(0, 0), v(0.63, 0), v(0.86, 0.02), v(0.86, 0.34)],
    [v(0.86, 0.34), v(0.91, 0.86), v(0.41, 1.14), v(0.41, 1.72)],
    [v(0.41, 1.72), v(0.41, 1.98), v(0.56, 2.17), v(0.64, 2.28)],
    [v(0.64, 2.28), v(0.55, 2.28), v(0.20, 2.28), v(0, 2.28)],
  ];
  const points = [];
  curves.forEach((controls, i) => {
    const sampled = new THREE.CubicBezierCurve3(...controls).getPoints(12);
    if (i) sampled.shift();
    sampled.forEach(p => points.push(new THREE.Vector2(Math.max(0, p.x), p.y)));
  });
  return new THREE.LatheGeometry(points, 88);
}

function diffuserGeometry() {
  const profile = [new THREE.Vector2(0, 2.34), new THREE.Vector2(1.42, 2.34)];
  const dome = new THREE.CubicBezierCurve3(
    new THREE.Vector3(1.42, 2.34, 0),
    new THREE.Vector3(1.48, 2.69, 0),
    new THREE.Vector3(0.86, 2.98, 0),
    new THREE.Vector3(0, 2.98, 0),
  );
  dome.getPoints(24).slice(1).forEach(point => profile.push(new THREE.Vector2(point.x, point.y)));
  return new THREE.LatheGeometry(profile, 88);
}

/** Build the original exterior and concealed components for its exploded view. */
export function createMushroom({ color = COLORS.cherry } = {}) {
  const lamp = new THREE.Group();
  lamp.name = 'Mimo-mushroom-lamp';
  lamp.userData = { design: 'Original procedural mushroom lamp', windowCount: WINDOWS.length };
  const cap = new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.18 });
  cap.name = 'Cherry-glazed-cap';
  const stem = new THREE.MeshPhysicalMaterial({ color: '#f3e6cd', roughness: 0.29, clearcoat: 0.35, clearcoatRoughness: 0.26 });
  stem.name = 'Ivory-ceramic-stem';
  const windows = new THREE.MeshPhysicalMaterial({ color: '#fff0d8', roughness: 0.27, clearcoat: 0.35, clearcoatRoughness: 0.28, emissive: '#ffd6a3', emissiveIntensity: 0 });
  windows.name = 'Warm-light-windows';
  const underside = new THREE.MeshStandardMaterial({ color: '#f3dfb8', roughness: 0.45, emissive: '#ffca83', emissiveIntensity: 0, side: THREE.DoubleSide });
  underside.name = 'Warm-cap-underside';
  const diffuser = new THREE.MeshPhysicalMaterial({ color: '#fff3db', roughness: 0.42, clearcoat: 0.12, emissive: '#ffd6a3', emissiveIntensity: 0 });
  diffuser.name = 'Opal-diffuser-material';
  const led = new THREE.MeshStandardMaterial({ color: '#f2cf8d', roughness: 0.38, metalness: 0.18, emissive: '#ffd19a', emissiveIntensity: 0 });
  led.name = 'Warm-LED-module';
  const bottom = stem.clone();
  bottom.name = 'Ivory-bottom-cover';

  const parts = [
    ['Cap', capGeometry(), cap],
    ['Stem', stemGeometry(), stem],
    ['Light-windows', mergeGeometries(WINDOWS.map(p => windowGeometry(...p))), windows],
    ['Rolled-cap-rim', new THREE.TorusGeometry(1.705, 0.055, 10, 112).rotateX(Math.PI / 2).translate(0, CAP_BASE + 0.006, 0), cap],
    ['Cap-underside', new THREE.RingGeometry(0.55, 1.72, 112).rotateX(Math.PI / 2).translate(0, CAP_BASE - 0.014, 0), underside],
    ['Opal-diffuser', diffuserGeometry(), diffuser],
    ['LED-module', new THREE.CylinderGeometry(0.60, 0.60, 0.04, 64).translate(0, 2.31, 0), led],
    // A slight inset keeps this cover concealed by the original rounded stem base.
    ['Bottom-cover', new THREE.CylinderGeometry(0.70, 0.70, 0.035, 64).translate(0, 0.08, 0), bottom],
  ];
  for (const [name, geometry, material] of parts) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = name !== 'Light-windows';
    mesh.receiveShadow = true;
    lamp.add(mesh);
  }
  lamp.updateMatrixWorld(true);
  return lamp;
}
