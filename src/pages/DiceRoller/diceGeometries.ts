import * as THREE from "three";
import type { DieSides } from "./diceRoller.types";

export type DieFaceShape = "triangle" | "square" | "kite" | "pentagon" | "circle";

export interface DieFace {
  value: number;
  normal: THREE.Vector3;
  center: THREE.Vector3;
  shape: DieFaceShape;
  indices: number[];
  polygon2D: [number, number][]; // Normalized 2D vertices in [-1, 1] for exact canvas border alignment
}

export interface Die3DDefinition {
  die: DieSides;
  geometry: THREE.BufferGeometry;
  faces: DieFace[];
  atlasCols: number;
  atlasRows: number;
  scale: number;
}

interface RawTriangle {
  indices: [number, number, number];
  normal: THREE.Vector3;
  vA: THREE.Vector3;
  vB: THREE.Vector3;
  vC: THREE.Vector3;
}

interface FaceCluster {
  normal: THREE.Vector3;
  triangles: RawTriangle[];
  indices: number[];
  uniqueVertices: THREE.Vector3[];
}

function clusterFaces(rawGeometry: THREE.BufferGeometry): {
  geometry: THREE.BufferGeometry;
  clusters: FaceCluster[];
} {
  const geom = rawGeometry.toNonIndexed ? rawGeometry.toNonIndexed() : rawGeometry;
  const pos = geom.attributes.position;
  const triangles: RawTriangle[] = [];

  for (let i = 0; i < pos.count; i += 3) {
    const vA = new THREE.Vector3().fromBufferAttribute(pos, i);
    const vB = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
    const vC = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
    const cb = new THREE.Vector3().subVectors(vC, vB);
    const ab = new THREE.Vector3().subVectors(vA, vB);
    const normal = new THREE.Vector3().crossVectors(cb, ab).normalize();
    triangles.push({
      indices: [i, i + 1, i + 2],
      normal,
      vA,
      vB,
      vC,
    });
  }

  const clusters: FaceCluster[] = [];
  for (const tri of triangles) {
    let match = clusters.find((c) => c.normal.dot(tri.normal) > 0.96);
    if (!match) {
      match = { normal: tri.normal.clone(), triangles: [], indices: [], uniqueVertices: [] };
      clusters.push(match);
    }
    match.triangles.push(tri);
    match.indices.push(...tri.indices);
  }

  // Collect unique vertices per cluster
  for (const cluster of clusters) {
    const verts: THREE.Vector3[] = [];
    for (const tri of cluster.triangles) {
      for (const v of [tri.vA, tri.vB, tri.vC]) {
        if (!verts.some((existing) => existing.distanceTo(v) < 0.001)) {
          verts.push(v);
        }
      }
    }
    cluster.uniqueVertices = verts;
  }

  return { geometry: geom, clusters };
}

function pairOppositeClusters(clusters: FaceCluster[]): [FaceCluster, FaceCluster][] {
  const remaining = [...clusters];
  const pairs: [FaceCluster, FaceCluster][] = [];

  while (remaining.length > 0) {
    const current = remaining.shift()!;
    let bestIdx = -1;
    let lowestDot = 1;

    for (let i = 0; i < remaining.length; i++) {
      const dot = current.normal.dot(remaining[i].normal);
      if (dot < lowestDot) {
        lowestDot = dot;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const opposite = remaining.splice(bestIdx, 1)[0];
      pairs.push([current, opposite]);
    } else {
      pairs.push([current, current]);
    }
  }

  return pairs;
}

function orderPolygonCCW(
  vertices: THREE.Vector3[],
  center: THREE.Vector3,
  uAxis: THREE.Vector3,
  vAxis: THREE.Vector3,
): [number, number][] {
  const points = vertices.map((v) => {
    const diff = new THREE.Vector3().subVectors(v, center);
    return {
      u: diff.dot(uAxis),
      v: diff.dot(vAxis),
      angle: Math.atan2(diff.dot(vAxis), diff.dot(uAxis)),
    };
  });

  points.sort((a, b) => a.angle - b.angle);

  let maxR = 0.001;
  points.forEach((p) => {
    const r = Math.sqrt(p.u * p.u + p.v * p.v);
    if (r > maxR) maxR = r;
  });

  return points.map((p) => [p.u / maxR, p.v / maxR]);
}

function applyAtlasUVs(
  geometry: THREE.BufferGeometry,
  faces: DieFace[],
  cols: number,
  rows: number,
  uniqueVerticesMap: Map<number, THREE.Vector3[]>,
) {
  const pos = geometry.attributes.position;
  const uvs = new Float32Array(pos.count * 2);

  faces.forEach((face, faceIndex) => {
    const col = faceIndex % cols;
    const row = Math.floor(faceIndex / cols);
    const fNormal = face.normal.clone().normalize();

    const verts = uniqueVerticesMap.get(face.value) ?? [];

    // Canonical UP: select the vertex that points highest along world Y (or world Z if vertical)
    let bestProj = -Infinity;
    let vTop = verts[0] ?? new THREE.Vector3();
    const upRef = Math.abs(fNormal.y) > 0.88 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);

    verts.forEach((v) => {
      const proj = v.dot(upRef);
      if (proj > bestProj) {
        bestProj = proj;
        vTop = v;
      }
    });

    let vAxis = new THREE.Vector3().subVectors(vTop, face.center);
    if (vAxis.lengthSq() < 0.0001) {
      vAxis = new THREE.Vector3()
        .subVectors(upRef, fNormal.clone().multiplyScalar(upRef.dot(fNormal)))
        .normalize();
    } else {
      vAxis.normalize();
    }

    // Right axis = Up cross Normal (points to the right when looking at the face)
    const uAxis = new THREE.Vector3().crossVectors(vAxis, fNormal).normalize();

    // Determine max radius of vertices on this face
    let maxDist = 0.001;
    for (const vertIdx of face.indices) {
      const vert = new THREE.Vector3().fromBufferAttribute(pos, vertIdx);
      const dist = vert.distanceTo(face.center);
      if (dist > maxDist) maxDist = dist;
    }

    const scale = maxDist * 2.22;

    // Apply exact UV coordinates to all vertices in this face
    for (const vertIdx of face.indices) {
      const vert = new THREE.Vector3().fromBufferAttribute(pos, vertIdx);
      const diff = new THREE.Vector3().subVectors(vert, face.center);

      const localU = 0.5 + diff.dot(uAxis) / scale;
      const localV = 0.5 + diff.dot(vAxis) / scale;

      const atlasU = (col + Math.min(0.99, Math.max(0.01, localU))) / cols;
      const atlasV = (rows - 1 - row + Math.min(0.99, Math.max(0.01, localV))) / rows;

      uvs[vertIdx * 2] = atlasU;
      uvs[vertIdx * 2 + 1] = atlasV;
    }

    // Save canonical 2D polygon vertices for exact canvas drawing
    face.polygon2D = orderPolygonCCW(verts, face.center, uAxis, vAxis);
  });

  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
}

function calculateClusterCenter(cluster: FaceCluster, pos: THREE.BufferAttribute): THREE.Vector3 {
  const center = new THREE.Vector3();
  for (const idx of cluster.indices) {
    center.add(new THREE.Vector3().fromBufferAttribute(pos, idx));
  }
  center.divideScalar(cluster.indices.length);
  return center;
}

/* =====================================================================
   D4: TETRAHEDRON (4 Faces)
   ===================================================================== */
function buildD4(): Die3DDefinition {
  const raw = new THREE.TetrahedronGeometry(1.5, 0);
  const { geometry, clusters } = clusterFaces(raw);
  const pos = geometry.attributes.position as THREE.BufferAttribute;

  const vertMap = new Map<number, THREE.Vector3[]>();
  const faces: DieFace[] = clusters.map((cluster, idx) => {
    const value = idx + 1;
    vertMap.set(value, cluster.uniqueVertices);
    return {
      value,
      normal: cluster.normal,
      center: calculateClusterCenter(cluster, pos),
      shape: "triangle",
      indices: cluster.indices,
      polygon2D: [],
    };
  });

  applyAtlasUVs(geometry, faces, 2, 2, vertMap);
  geometry.computeVertexNormals();

  return {
    die: 4,
    geometry,
    faces,
    atlasCols: 2,
    atlasRows: 2,
    scale: 1.1,
  };
}

/* =====================================================================
   D6: CUBE (6 Faces)
   ===================================================================== */
function buildD6(): Die3DDefinition {
  const raw = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const { geometry, clusters } = clusterFaces(raw);
  const pos = geometry.attributes.position as THREE.BufferAttribute;

  const pairs = pairOppositeClusters(clusters);
  const values = [
    [1, 6],
    [2, 5],
    [3, 4],
  ];

  const vertMap = new Map<number, THREE.Vector3[]>();
  const faces: DieFace[] = [];
  pairs.forEach((pair, pairIdx) => {
    const [c1, c2] = pair;
    const [v1, v2] = values[pairIdx % values.length];
    vertMap.set(v1, c1.uniqueVertices);
    vertMap.set(v2, c2.uniqueVertices);

    faces.push({
      value: v1,
      normal: c1.normal,
      center: calculateClusterCenter(c1, pos),
      shape: "square",
      indices: c1.indices,
      polygon2D: [],
    });
    faces.push({
      value: v2,
      normal: c2.normal,
      center: calculateClusterCenter(c2, pos),
      shape: "square",
      indices: c2.indices,
      polygon2D: [],
    });
  });

  applyAtlasUVs(geometry, faces, 3, 2, vertMap);
  geometry.computeVertexNormals();

  return {
    die: 6,
    geometry,
    faces,
    atlasCols: 3,
    atlasRows: 2,
    scale: 1.15,
  };
}

/* =====================================================================
   D8: OCTAHEDRON (8 Faces)
   ===================================================================== */
function buildD8(): Die3DDefinition {
  const raw = new THREE.OctahedronGeometry(1.4, 0);
  const { geometry, clusters } = clusterFaces(raw);
  const pos = geometry.attributes.position as THREE.BufferAttribute;

  const pairs = pairOppositeClusters(clusters);
  const values = [
    [1, 8],
    [2, 7],
    [3, 6],
    [4, 5],
  ];

  const vertMap = new Map<number, THREE.Vector3[]>();
  const faces: DieFace[] = [];
  pairs.forEach((pair, pairIdx) => {
    const [c1, c2] = pair;
    const [v1, v2] = values[pairIdx % values.length];
    vertMap.set(v1, c1.uniqueVertices);
    vertMap.set(v2, c2.uniqueVertices);

    faces.push({
      value: v1,
      normal: c1.normal,
      center: calculateClusterCenter(c1, pos),
      shape: "triangle",
      indices: c1.indices,
      polygon2D: [],
    });
    faces.push({
      value: v2,
      normal: c2.normal,
      center: calculateClusterCenter(c2, pos),
      shape: "triangle",
      indices: c2.indices,
      polygon2D: [],
    });
  });

  applyAtlasUVs(geometry, faces, 4, 2, vertMap);
  geometry.computeVertexNormals();

  return {
    die: 8,
    geometry,
    faces,
    atlasCols: 4,
    atlasRows: 2,
    scale: 1.18,
  };
}

/* =====================================================================
   D10 / D100: PENTAGONAL TRAPEZOHEDRON (10 Kite Faces)
   100% Outward Normals, Counter-Clockwise Winding
   ===================================================================== */
function buildD10OrD100(sides: 10 | 100): Die3DDefinition {
  const radius = 1.35;
  const height = 1.48;
  const offset = 0.32;

  const top = new THREE.Vector3(0, height, 0);
  const bottom = new THREE.Vector3(0, -height, 0);
  const equator: THREE.Vector3[] = [];

  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5;
    const y = i % 2 === 0 ? offset : -offset;
    equator.push(new THREE.Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle)));
  }

  const positions: number[] = [];
  const faces: DieFace[] = [];
  const vertMap = new Map<number, THREE.Vector3[]>();

  const d10Values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const d100Values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const valList = sides === 100 ? d100Values : d10Values;

  // 5 Top Kites — apex = top, wide vertex = mid (equatorial even), wings = prev & next (odd)
  for (let k = 0; k < 5; k++) {
    const prev = equator[(2 * k - 1 + 10) % 10]; // left wing (odd)
    const mid = equator[2 * k];                   // opposite equatorial vertex (even)
    const next = equator[(2 * k + 1) % 10];       // right wing (odd)

    const startIndex = positions.length / 3;
    // Two triangles forming the kite — outward-facing CCW
    positions.push(top.x, top.y, top.z, mid.x, mid.y, mid.z, prev.x, prev.y, prev.z);
    positions.push(top.x, top.y, top.z, next.x, next.y, next.z, mid.x, mid.y, mid.z);

    // Geometric centroid of the 4 unique kite vertices
    const center = new THREE.Vector3()
      .add(top)
      .add(prev)
      .add(mid)
      .add(next)
      .divideScalar(4);

    // Face normal via cross product of kite diagonals (top->mid X prev->next)
    const diag1 = new THREE.Vector3().subVectors(mid, top);
    const diag2 = new THREE.Vector3().subVectors(next, prev);
    const normal = new THREE.Vector3().crossVectors(diag1, diag2).normalize();
    // Ensure it points outward (away from origin)
    if (normal.dot(center) < 0) normal.negate();

    const value = valList[k * 2]; // 1, 3, 5, 7, 9 or 10, 30, 50, 70, 90
    vertMap.set(value, [top, prev, mid, next]);

    faces.push({
      value,
      normal,
      center,
      shape: "kite",
      indices: [startIndex, startIndex + 1, startIndex + 2, startIndex + 3, startIndex + 4, startIndex + 5],
      polygon2D: [],
    });
  }

  // 5 Bottom Kites — apex = bottom, wide vertex = mid (equatorial even shifted), wings = prev & next (odd)
  for (let k = 0; k < 5; k++) {
    const prev = equator[(2 * k + 1) % 10]; // left wing (odd)
    const mid = equator[(2 * k + 2) % 10];  // opposite equatorial vertex (even)
    const next = equator[(2 * k + 3) % 10]; // right wing (odd)

    const startIndex = positions.length / 3;
    // Two triangles forming the kite — outward-facing CCW
    positions.push(bottom.x, bottom.y, bottom.z, prev.x, prev.y, prev.z, mid.x, mid.y, mid.z);
    positions.push(bottom.x, bottom.y, bottom.z, mid.x, mid.y, mid.z, next.x, next.y, next.z);

    // Geometric centroid of the 4 unique kite vertices
    const center = new THREE.Vector3()
      .add(bottom)
      .add(prev)
      .add(mid)
      .add(next)
      .divideScalar(4);

    // Face normal via cross product of kite diagonals (bottom->mid X prev->next)
    const diag1 = new THREE.Vector3().subVectors(mid, bottom);
    const diag2 = new THREE.Vector3().subVectors(next, prev);
    const normal = new THREE.Vector3().crossVectors(diag1, diag2).normalize();
    // Ensure it points outward (away from origin)
    if (normal.dot(center) < 0) normal.negate();

    const value = valList[k * 2 + 1]; // 2, 4, 6, 8, 10 or 20, 40, 60, 80, 100
    vertMap.set(value, [bottom, prev, mid, next]);

    faces.push({
      value,
      normal,
      center,
      shape: "kite",
      indices: [startIndex, startIndex + 1, startIndex + 2, startIndex + 3, startIndex + 4, startIndex + 5],
      polygon2D: [],
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  applyAtlasUVs(geometry, faces, 5, 2, vertMap);

  return {
    die: sides,
    geometry,
    faces,
    atlasCols: 5,
    atlasRows: 2,
    scale: 1.15,
  };
}

/* =====================================================================
   D12: DODECAHEDRON (12 Pentagonal Faces)
   ===================================================================== */
function buildD12(): Die3DDefinition {
  const raw = new THREE.DodecahedronGeometry(1.3, 0);
  const { geometry, clusters } = clusterFaces(raw);
  const pos = geometry.attributes.position as THREE.BufferAttribute;

  const pairs = pairOppositeClusters(clusters);
  const values = [
    [1, 12],
    [2, 11],
    [3, 10],
    [4, 9],
    [5, 8],
    [6, 7],
  ];

  const vertMap = new Map<number, THREE.Vector3[]>();
  const faces: DieFace[] = [];
  pairs.forEach((pair, pairIdx) => {
    const [c1, c2] = pair;
    const [v1, v2] = values[pairIdx % values.length];
    vertMap.set(v1, c1.uniqueVertices);
    vertMap.set(v2, c2.uniqueVertices);

    faces.push({
      value: v1,
      normal: c1.normal,
      center: calculateClusterCenter(c1, pos),
      shape: "pentagon",
      indices: c1.indices,
      polygon2D: [],
    });
    faces.push({
      value: v2,
      normal: c2.normal,
      center: calculateClusterCenter(c2, pos),
      shape: "pentagon",
      indices: c2.indices,
      polygon2D: [],
    });
  });

  applyAtlasUVs(geometry, faces, 4, 3, vertMap);
  geometry.computeVertexNormals();

  return {
    die: 12,
    geometry,
    faces,
    atlasCols: 4,
    atlasRows: 3,
    scale: 1.15,
  };
}

/* =====================================================================
   D20: ICOSAHEDRON (20 Triangular Faces)
   ===================================================================== */
function buildD20(): Die3DDefinition {
  const raw = new THREE.IcosahedronGeometry(1.35, 0);
  const { geometry, clusters } = clusterFaces(raw);
  const pos = geometry.attributes.position as THREE.BufferAttribute;

  const pairs = pairOppositeClusters(clusters);
  const values = [
    [20, 1],
    [19, 2],
    [18, 3],
    [17, 4],
    [16, 5],
    [15, 6],
    [14, 7],
    [13, 8],
    [12, 9],
    [11, 10],
  ];

  const vertMap = new Map<number, THREE.Vector3[]>();
  const faces: DieFace[] = [];
  pairs.forEach((pair, pairIdx) => {
    const [c1, c2] = pair;
    const [v1, v2] = values[pairIdx % values.length];
    vertMap.set(v1, c1.uniqueVertices);
    vertMap.set(v2, c2.uniqueVertices);

    faces.push({
      value: v1,
      normal: c1.normal,
      center: calculateClusterCenter(c1, pos),
      shape: "triangle",
      indices: c1.indices,
      polygon2D: [],
    });
    faces.push({
      value: v2,
      normal: c2.normal,
      center: calculateClusterCenter(c2, pos),
      shape: "triangle",
      indices: c2.indices,
      polygon2D: [],
    });
  });

  applyAtlasUVs(geometry, faces, 5, 4, vertMap);
  geometry.computeVertexNormals();

  return {
    die: 20,
    geometry,
    faces,
    atlasCols: 5,
    atlasRows: 4,
    scale: 1.18,
  };
}

const DIE_DEFINITIONS_CACHE = new Map<DieSides, Die3DDefinition>();

export function getDie3DDefinition(die: DieSides): Die3DDefinition {
  const cached = DIE_DEFINITIONS_CACHE.get(die);
  if (cached) return cached;

  let def: Die3DDefinition;
  switch (die) {
    case 4:
      def = buildD4();
      break;
    case 6:
      def = buildD6();
      break;
    case 8:
      def = buildD8();
      break;
    case 10:
      def = buildD10OrD100(10);
      break;
    case 12:
      def = buildD12();
      break;
    case 20:
      def = buildD20();
      break;
    case 100:
      def = buildD10OrD100(100);
      break;
  }

  DIE_DEFINITIONS_CACHE.set(die, def);
  return def;
}
