"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Expand, MousePointerClick } from "lucide-react";

import { cn } from "@/lib/utils";

const WORLD_W = 64;
const WORLD_D = 64;
const WORLD_H = 32;
const HALF_W = WORLD_W / 2;
const HALF_D = WORLD_D / 2;

const PLAYER_HALF = 0.3;
const PLAYER_HEIGHT = 1.75;
const EYE_HEIGHT = 1.6;
const WALK_SPEED = 5.5;
const JUMP_V = 8.4;
const GRAVITY = 22;
const REACH = 5.2;
const MAX_PER_COLOR = 12000;

const COLORS = [
  { name: "Red", hex: 0xff4d6d, css: "#ff4d6d" },
  { name: "Orange", hex: 0xff8c42, css: "#ff8c42" },
  { name: "Yellow", hex: 0xffd166, css: "#ffd166" },
  { name: "Green", hex: 0x5eea7e, css: "#5eea7e" },
  { name: "Blue", hex: 0x4cc9f0, css: "#4cc9f0" },
  { name: "Indigo", hex: 0x8b5cf6, css: "#8b5cf6" },
  { name: "Pink", hex: 0xff85e0, css: "#ff85e0" },
];

type Key = `${number},${number},${number}`;
const k = (x: number, y: number, z: number): Key => `${x},${y},${z}`;

type PerColor = {
  mesh: THREE.InstancedMesh;
  positions: { x: number; y: number; z: number; key: Key }[];
};

type SceneState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  raycaster: THREE.Raycaster;
  perColor: PerColor[];
  voxels: Map<Key, number>; // colorIndex
  player: {
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    yaw: number;
    pitch: number;
    onGround: boolean;
  };
  keys: Set<string>;
  clouds: THREE.Group;
  particles: THREE.Points;
  particleData: Float32Array; // x,y,z,vx,vy,vz,life,size repeating
  particleCount: number;
  dispose: () => void;
};

export function Morgancraft() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const selectedRef = useRef(0);
  const [selected, setSelected] = useState(0);
  const [locked, setLocked] = useState(false);
  const [blockCount, setBlockCount] = useState(0);

  const pickColor = useCallback((idx: number) => {
    selectedRef.current = idx;
    setSelected(idx);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const state = buildScene(container, selectedRef, () => {
      setBlockCount(state.voxels.size);
    });
    stateRef.current = state;

    const onLockChange = () => {
      setLocked(document.pointerLockElement === container);
    };
    document.addEventListener("pointerlockchange", onLockChange);

    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      state.dispose();
      stateRef.current = null;
    };
  }, []);

  // Keyboard color shortcuts (work even when not pointer-locked so the kid can preview)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!Number.isNaN(n) && n >= 1 && n <= COLORS.length) {
        pickColor(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickColor]);

  const requestLock = () => {
    containerRef.current?.requestPointerLock();
  };

  const goFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div className="flex flex-1 flex-col">
      <div
        ref={containerRef}
        className="relative h-[70vh] min-h-[480px] w-full overflow-hidden rounded-3xl bg-black ring-4 ring-white/70 shadow-pop"
        onClick={() => !locked && requestLock()}
      >
        {/* Crosshair */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 select-none">
          <div className="relative">
            <div className="absolute -left-3 top-1/2 h-0.5 w-6 -translate-y-1/2 rounded-full bg-white/90 mix-blend-difference" />
            <div className="absolute left-1/2 -top-3 h-6 w-0.5 -translate-x-1/2 rounded-full bg-white/90 mix-blend-difference" />
          </div>
        </div>

        {/* Selected colour pill (top-left) */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white">
          <span
            className="inline-block size-4 rounded-sm ring-2 ring-white/80"
            style={{ background: COLORS[selected].css }}
          />
          {COLORS[selected].name}
          <span className="ml-2 text-xs text-white/70">{blockCount} blocks</span>
        </div>

        {/* Fullscreen button (top-right) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goFullscreen();
          }}
          className="absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black/70"
        >
          <Expand className="size-4" />
          Full screen
        </button>

        {/* Click-to-play overlay */}
        {!locked && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 text-center text-white">
            <MousePointerClick className="size-12" />
            <p className="font-heading mt-3 text-3xl font-bold">Click to play</p>
            <p className="mt-2 max-w-md px-6 text-base font-semibold text-white/90">
              WASD walk · SPACE jump · MOUSE look · CLICK to dig or build ·
              1-7 picks a colour · ESC to pause
            </p>
          </div>
        )}
      </div>

      {/* Colour palette */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {COLORS.map((c, i) => (
          <button
            key={c.name}
            type="button"
            onClick={() => pickColor(i)}
            aria-pressed={i === selected}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl text-xs font-bold ring-4 transition-transform",
              i === selected
                ? "scale-110 ring-foreground"
                : "ring-white/70 hover:-translate-y-0.5",
            )}
            style={{ background: c.css }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <p className="mt-3 text-center text-sm text-muted-foreground">
        Tap an existing block to dig it. Tap empty space to build with the
        selected colour.
      </p>
    </div>
  );
}

function buildScene(
  container: HTMLDivElement,
  selectedRef: React.MutableRefObject<number>,
  notifyChange: () => void,
): SceneState {
  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const sizeCanvas = () => {
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  };
  container.appendChild(renderer.domElement);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";

  // --- Scene + camera ---
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xff9bd0, 50, 120);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
  sizeCanvas();

  // --- Skybox (rainbow gradient dome) ---
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0xff6fcf) },
      midColor: { value: new THREE.Color(0xff97e3) },
      horizonColor: { value: new THREE.Color(0xffe3c2) },
      groundColor: { value: new THREE.Color(0xd28af0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 groundColor;
      varying vec3 vDir;
      void main() {
        float h = vDir.y; // -1 .. 1
        vec3 col;
        if (h >= 0.0) {
          float t = pow(h, 0.55);
          // horizon → mid (lower half of sky) → top
          col = mix(horizonColor, midColor, smoothstep(0.0, 0.4, t));
          col = mix(col, topColor, smoothstep(0.4, 1.0, t));
        } else {
          col = mix(horizonColor, groundColor, smoothstep(0.0, 0.7, -h));
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), skyMat);
  scene.add(sky);

  // --- Lights ---
  scene.add(new THREE.HemisphereLight(0xfff0fb, 0xb47ab3, 0.85));
  const sun = new THREE.DirectionalLight(0xfff5d1, 1.1);
  sun.position.set(40, 60, 30);
  scene.add(sun);
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(4, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8 }),
  );
  sunMesh.position.copy(sun.position).multiplyScalar(1.4);
  scene.add(sunMesh);

  // --- Clouds ---
  const clouds = new THREE.Group();
  const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
  });
  const cloudSeeds = [
    [-20, 22, -10, 6, 2, 4],
    [10, 26, -25, 8, 2, 3],
    [25, 24, 5, 5, 2, 3],
    [-5, 28, 18, 7, 2, 4],
    [-30, 25, 12, 4, 2, 3],
    [18, 23, 22, 6, 2, 4],
  ];
  for (const [cx, cy, cz, w, h, d] of cloudSeeds) {
    const m = new THREE.Mesh(
      cloudGeo,
      cloudMat,
    );
    m.position.set(cx, cy, cz);
    m.scale.set(w, h, d);
    clouds.add(m);
  }
  scene.add(clouds);

  // --- World data ---
  const voxels = new Map<Key, number>();
  // Reused across all addVoxel / removeVoxel calls. Declared early because
  // the initial-plain loop below calls addVoxel before reaching the
  // mutation block.
  const tmpMatrix = new THREE.Matrix4();
  const perColor: PerColor[] = COLORS.map((c) => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: c.hex });
    const mesh = new THREE.InstancedMesh(geo, mat, MAX_PER_COLOR);
    mesh.count = 0;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh, positions: [] };
  });

  // Block edges helper (subtle dark outlines for Minecrafty look)
  const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001));
  const edgesMat = new THREE.LineBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.18,
  });
  void edgesGeo;
  void edgesMat; // not currently instanced; left for future use

  // --- Initial flat plain ---
  // y=0 is the top of the ground layer. Block at (x,0,z) means block occupies y ∈ [0,1].
  // Pattern: rainbow stripes by x.
  for (let x = -HALF_W; x < HALF_W; x++) {
    for (let z = -HALF_D; z < HALF_D; z++) {
      const colorIdx = ((((x + HALF_W) / 4) | 0) + 100) % COLORS.length;
      const safe = Math.abs(colorIdx);
      addVoxel(x, 0, z, safe);
    }
  }
  refreshAllInstances();

  // --- Player ---
  const player = {
    pos: new THREE.Vector3(0, 6, 0), // feet at y=6 so they fall onto the plain
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: -0.2,
    onGround: false,
  };
  syncCamera();

  // --- Raycast & action ---
  const raycaster = new THREE.Raycaster();
  raycaster.far = REACH;
  const meshes = perColor.map((p) => p.mesh);

  // Selection outline (wireframe box around the targeted block)
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthTest: true,
    }),
  );
  outline.visible = false;
  outline.renderOrder = 999;
  scene.add(outline);

  // Face highlight (translucent quad on the face where a new block would go)
  const facePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 0.98),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  facePlane.visible = false;
  facePlane.renderOrder = 999;
  scene.add(facePlane);

  const _faceUp = new THREE.Vector3(0, 1, 0);
  const _faceTmp = new THREE.Vector3();
  function updateHighlight() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0 || !hits[0].face) {
      outline.visible = false;
      facePlane.visible = false;
      return;
    }
    const hit = hits[0];
    const n = hit.face!.normal;
    const inside = hit.point
      .clone()
      .add(n.clone().multiplyScalar(-0.01));
    const bx = Math.floor(inside.x);
    const by = Math.floor(inside.y);
    const bz = Math.floor(inside.z);
    outline.position.set(bx + 0.5, by + 0.5, bz + 0.5);
    outline.visible = true;

    // Position the face plane on the hit face, oriented to match the normal.
    facePlane.position.set(
      bx + 0.5 + n.x * 0.51,
      by + 0.5 + n.y * 0.51,
      bz + 0.5 + n.z * 0.51,
    );
    _faceTmp.copy(facePlane.position).add(n);
    // lookAt + a non-parallel up vector to keep stable orientation
    const up = Math.abs(n.y) > 0.99 ? new THREE.Vector3(0, 0, 1) : _faceUp;
    facePlane.up.copy(up);
    facePlane.lookAt(_faceTmp);
    // Tint to the selected colour so the player sees what they'd place.
    (facePlane.material as THREE.MeshBasicMaterial).color.setHex(
      COLORS[selectedRef.current].hex,
    );
    facePlane.visible = true;
  }

  function onMouseDown(e: MouseEvent) {
    if (document.pointerLockElement !== container) return;
    e.preventDefault();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return;
    const hit = hits[0];
    if (!hit.face) return;
    const inside = hit.point
      .clone()
      .add(hit.face.normal.clone().multiplyScalar(-0.01));
    const outside = hit.point
      .clone()
      .add(hit.face.normal.clone().multiplyScalar(0.01));
    const bx = Math.floor(inside.x);
    const by = Math.floor(inside.y);
    const bz = Math.floor(inside.z);

    if (e.button === 0 || e.button === undefined) {
      // Auto: any click → dig the hit block
      const key = k(bx, by, bz);
      if (voxels.has(key)) {
        removeVoxel(bx, by, bz);
        spawnPuff(bx + 0.5, by + 0.5, bz + 0.5, voxels.get(key) ?? 0);
        notifyChange();
        return;
      }
    }
    // No block at hit → place at the empty cell adjacent to the face
    const px = Math.floor(outside.x);
    const py = Math.floor(outside.y);
    const pz = Math.floor(outside.z);
    if (!withinBounds(px, py, pz)) return;
    if (voxels.has(k(px, py, pz))) return;
    if (intersectsPlayer(px, py, pz, player.pos)) return;
    addVoxel(px, py, pz, selectedRef.current);
    perColor[selectedRef.current].mesh.instanceMatrix.needsUpdate = true;
    spawnPuff(px + 0.5, py + 0.5, pz + 0.5, selectedRef.current);
    notifyChange();
  }
  // Right-click also places (classic mapping); we always interpret left-click as "auto"
  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (document.pointerLockElement !== container) return;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return;
    const hit = hits[0];
    if (!hit.face) return;
    const outside = hit.point
      .clone()
      .add(hit.face.normal.clone().multiplyScalar(0.01));
    const px = Math.floor(outside.x);
    const py = Math.floor(outside.y);
    const pz = Math.floor(outside.z);
    if (!withinBounds(px, py, pz)) return;
    if (voxels.has(k(px, py, pz))) return;
    if (intersectsPlayer(px, py, pz, player.pos)) return;
    addVoxel(px, py, pz, selectedRef.current);
    perColor[selectedRef.current].mesh.instanceMatrix.needsUpdate = true;
    spawnPuff(px + 0.5, py + 0.5, pz + 0.5, selectedRef.current);
    notifyChange();
  }
  container.addEventListener("mousedown", onMouseDown);
  container.addEventListener("contextmenu", onContextMenu);

  // --- Pointer-lock look ---
  function onMouseMove(e: MouseEvent) {
    if (document.pointerLockElement !== container) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch -= e.movementY * 0.0022;
    const lim = Math.PI / 2 - 0.05;
    if (player.pitch > lim) player.pitch = lim;
    if (player.pitch < -lim) player.pitch = -lim;
  }
  document.addEventListener("mousemove", onMouseMove);

  // --- Keyboard ---
  const keys = new Set<string>();
  function onKeyDown(e: KeyboardEvent) {
    if (document.pointerLockElement !== container) return;
    keys.add(e.code);
    if (
      e.code === "Space" ||
      e.code === "KeyW" ||
      e.code === "KeyA" ||
      e.code === "KeyS" ||
      e.code === "KeyD"
    ) {
      e.preventDefault();
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // --- Resize ---
  const ro = new ResizeObserver(() => sizeCanvas());
  ro.observe(container);

  // --- Particles ---
  const PARTICLE_CAP = 400;
  const particleData = new Float32Array(PARTICLE_CAP * 8);
  let particleCount = 0;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_CAP * 3);
  const colors = new Float32Array(PARTICLE_CAP * 3);
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  particles.frustumCulled = false;
  scene.add(particles);

  function spawnPuff(x: number, y: number, z: number, colorIdx: number) {
    const baseColor = new THREE.Color(COLORS[colorIdx].hex);
    for (let i = 0; i < 16; i++) {
      if (particleCount >= PARTICLE_CAP) break;
      const idx = particleCount * 8;
      particleData[idx] = x;
      particleData[idx + 1] = y;
      particleData[idx + 2] = z;
      particleData[idx + 3] = (Math.random() - 0.5) * 3;
      particleData[idx + 4] = 1 + Math.random() * 2.5;
      particleData[idx + 5] = (Math.random() - 0.5) * 3;
      particleData[idx + 6] = 0.5 + Math.random() * 0.4; // life seconds
      particleData[idx + 7] = baseColor.r + baseColor.g * 0 + baseColor.b * 0;
      const ci = particleCount * 3;
      colors[ci] = baseColor.r;
      colors[ci + 1] = baseColor.g;
      colors[ci + 2] = baseColor.b;
      particleCount++;
    }
    particleGeo.attributes.color.needsUpdate = true;
  }

  function updateParticles(dt: number) {
    let write = 0;
    for (let i = 0; i < particleCount; i++) {
      const base = i * 8;
      let life = particleData[base + 6] - dt;
      if (life <= 0) continue;
      const x = particleData[base] + particleData[base + 3] * dt;
      const y = particleData[base + 1] + particleData[base + 4] * dt;
      const z = particleData[base + 2] + particleData[base + 5] * dt;
      const vy = particleData[base + 4] - 9 * dt;
      const wBase = write * 8;
      particleData[wBase] = x;
      particleData[wBase + 1] = y;
      particleData[wBase + 2] = z;
      particleData[wBase + 3] = particleData[base + 3];
      particleData[wBase + 4] = vy;
      particleData[wBase + 5] = particleData[base + 5];
      particleData[wBase + 6] = life;
      particleData[wBase + 7] = particleData[base + 7];
      const pi = write * 3;
      positions[pi] = x;
      positions[pi + 1] = y;
      positions[pi + 2] = z;
      // copy color from source slot
      const srcCi = i * 3;
      const dstCi = write * 3;
      colors[dstCi] = colors[srcCi];
      colors[dstCi + 1] = colors[srcCi + 1];
      colors[dstCi + 2] = colors[srcCi + 2];
      write++;
    }
    particleCount = write;
    // Hide unused
    for (let i = write; i < PARTICLE_CAP; i++) {
      const pi = i * 3;
      positions[pi] = 0;
      positions[pi + 1] = -1000;
      positions[pi + 2] = 0;
    }
    particleGeo.attributes.position.needsUpdate = true;
    particleGeo.attributes.color.needsUpdate = true;
    particleGeo.setDrawRange(0, particleCount);
  }

  // --- World mutation ---
  function addVoxel(x: number, y: number, z: number, colorIdx: number) {
    const key = k(x, y, z);
    if (voxels.has(key)) return;
    voxels.set(key, colorIdx);
    const pc = perColor[colorIdx];
    const slot = pc.positions.length;
    if (slot >= MAX_PER_COLOR) return;
    pc.positions.push({ x, y, z, key });
    tmpMatrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
    pc.mesh.setMatrixAt(slot, tmpMatrix);
    pc.mesh.count = pc.positions.length;
    pc.mesh.instanceMatrix.needsUpdate = true;
  }

  function removeVoxel(x: number, y: number, z: number) {
    const key = k(x, y, z);
    const colorIdx = voxels.get(key);
    if (colorIdx === undefined) return;
    voxels.delete(key);
    const pc = perColor[colorIdx];
    const idx = pc.positions.findIndex((p) => p.key === key);
    if (idx === -1) return;
    const last = pc.positions.length - 1;
    if (idx !== last) {
      const swap = pc.positions[last];
      pc.positions[idx] = swap;
      tmpMatrix.makeTranslation(swap.x + 0.5, swap.y + 0.5, swap.z + 0.5);
      pc.mesh.setMatrixAt(idx, tmpMatrix);
    }
    pc.positions.pop();
    pc.mesh.count = pc.positions.length;
    pc.mesh.instanceMatrix.needsUpdate = true;
  }

  function refreshAllInstances() {
    for (const pc of perColor) {
      for (let i = 0; i < pc.positions.length; i++) {
        const p = pc.positions[i];
        tmpMatrix.makeTranslation(p.x + 0.5, p.y + 0.5, p.z + 0.5);
        pc.mesh.setMatrixAt(i, tmpMatrix);
      }
      pc.mesh.count = pc.positions.length;
      pc.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // --- Helpers ---
  function withinBounds(x: number, y: number, z: number) {
    return (
      x >= -HALF_W &&
      x < HALF_W &&
      z >= -HALF_D &&
      z < HALF_D &&
      y >= 0 &&
      y < WORLD_H
    );
  }
  function intersectsPlayer(bx: number, by: number, bz: number, pos: THREE.Vector3) {
    const minX = pos.x - PLAYER_HALF;
    const maxX = pos.x + PLAYER_HALF;
    const minY = pos.y;
    const maxY = pos.y + PLAYER_HEIGHT;
    const minZ = pos.z - PLAYER_HALF;
    const maxZ = pos.z + PLAYER_HALF;
    return (
      bx + 1 > minX &&
      bx < maxX &&
      by + 1 > minY &&
      by < maxY &&
      bz + 1 > minZ &&
      bz < maxZ
    );
  }

  function syncCamera() {
    camera.position.set(player.pos.x, player.pos.y + EYE_HEIGHT, player.pos.z);
    const e = new THREE.Euler(player.pitch, player.yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(e);
  }

  // --- Physics step ---
  function moveAxis(axis: "x" | "y" | "z", delta: number) {
    const before = player.pos[axis];
    player.pos[axis] += delta;
    // Determine swept block range
    const minX = Math.floor(player.pos.x - PLAYER_HALF);
    const maxX = Math.floor(player.pos.x + PLAYER_HALF - 1e-4);
    const minY = Math.floor(player.pos.y);
    const maxY = Math.floor(player.pos.y + PLAYER_HEIGHT - 1e-4);
    const minZ = Math.floor(player.pos.z - PLAYER_HALF);
    const maxZ = Math.floor(player.pos.z + PLAYER_HALF - 1e-4);
    let collided = false;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (voxels.has(k(x, y, z))) {
            collided = true;
            if (axis === "x") {
              if (delta > 0) player.pos.x = x - PLAYER_HALF - 1e-4;
              else player.pos.x = x + 1 + PLAYER_HALF + 1e-4;
              player.vel.x = 0;
            } else if (axis === "y") {
              if (delta > 0) {
                player.pos.y = y - PLAYER_HEIGHT - 1e-4;
                player.vel.y = 0;
              } else {
                player.pos.y = y + 1 + 1e-4;
                player.vel.y = 0;
                player.onGround = true;
              }
            } else {
              if (delta > 0) player.pos.z = z - PLAYER_HALF - 1e-4;
              else player.pos.z = z + 1 + PLAYER_HALF + 1e-4;
              player.vel.z = 0;
            }
            break;
          }
        }
        if (collided) break;
      }
      if (collided) break;
    }
    if (!collided && axis === "y" && delta < 0) {
      player.onGround = false;
    }

    // Invisible bedrock floor at y=0 — stops you falling through dug-out ground.
    if (axis === "y" && player.pos.y < 0) {
      player.pos.y = 0;
      player.vel.y = 0;
      player.onGround = true;
    }
    // Invisible walls at world edges — stops you walking past the rainbow plain.
    if (axis === "x") {
      const min = -HALF_W + PLAYER_HALF;
      const max = HALF_W - PLAYER_HALF;
      if (player.pos.x < min) {
        player.pos.x = min;
        player.vel.x = 0;
      } else if (player.pos.x > max) {
        player.pos.x = max;
        player.vel.x = 0;
      }
    } else if (axis === "z") {
      const min = -HALF_D + PLAYER_HALF;
      const max = HALF_D - PLAYER_HALF;
      if (player.pos.z < min) {
        player.pos.z = min;
        player.vel.z = 0;
      } else if (player.pos.z > max) {
        player.pos.z = max;
        player.vel.z = 0;
      }
    }
    void before;
  }

  // --- Loop ---
  let last = performance.now();
  let rafId = 0;
  function frame(t: number) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;

    // Input → desired horizontal velocity in camera-relative axes
    let mx = 0;
    let mz = 0;
    if (keys.has("KeyW")) mz -= 1;
    if (keys.has("KeyS")) mz += 1;
    if (keys.has("KeyA")) mx -= 1;
    if (keys.has("KeyD")) mx += 1;
    const mag = Math.hypot(mx, mz);
    if (mag > 0) {
      mx /= mag;
      mz /= mag;
    }
    // Rotate (mx,mz) by yaw around Y. Three.js Y-up rotation matrix:
    //   x' =  x*cos(y) + z*sin(y)
    //   z' = -x*sin(y) + z*cos(y)
    // mz = -1 (W) at yaw=0 → wishZ = -cos = -1 → moves down -Z (forward). ✓
    const cos = Math.cos(player.yaw);
    const sin = Math.sin(player.yaw);
    const wishX = mx * cos + mz * sin;
    const wishZ = -mx * sin + mz * cos;
    const target = WALK_SPEED;
    player.vel.x = wishX * target;
    player.vel.z = wishZ * target;

    // Jump
    if (keys.has("Space") && player.onGround) {
      player.vel.y = JUMP_V;
      player.onGround = false;
    }
    player.vel.y -= GRAVITY * dt;

    // Move with collision (axis-by-axis). moveAxis now also enforces the
    // bedrock floor (y=0) and the invisible walls at the world edges.
    moveAxis("x", player.vel.x * dt);
    moveAxis("z", player.vel.z * dt);
    moveAxis("y", player.vel.y * dt);

    syncCamera();
    updateHighlight();

    // Cloud drift
    clouds.position.x = ((t * 0.001) % 200) - 100;

    updateParticles(dt);

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  return {
    scene,
    camera,
    renderer,
    raycaster,
    perColor,
    voxels,
    player,
    keys,
    clouds,
    particles,
    particleData,
    particleCount,
    dispose: () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      ro.disconnect();
      if (document.pointerLockElement === container) document.exitPointerLock();
      for (const pc of perColor) {
        pc.mesh.geometry.dispose();
        (pc.mesh.material as THREE.Material).dispose();
        scene.remove(pc.mesh);
      }
      particleGeo.dispose();
      particleMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      outline.geometry.dispose();
      (outline.material as THREE.Material).dispose();
      facePlane.geometry.dispose();
      (facePlane.material as THREE.Material).dispose();
      sky.geometry.dispose();
      skyMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
