import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { getDie3DDefinition, type Die3DDefinition } from "./diceGeometries";
import {
  createDiceAtlasTexture,
  createDieMaterial,
  type DiceColorTheme,
  DICE_COLOR_THEMES,
} from "./diceMaterials";
import type { DiceRoll, DieSides } from "./diceRoller.types";
import { DieIcon } from "./DiceIcons";

interface Dice3DStageProps {
  die: DieSides;
  isRolling: boolean;
  latestRoll: DiceRoll | null;
  colorTheme?: DiceColorTheme;
  onTriggerRoll?: () => void;
  animationDurationMs?: number;
}

function isWebGLSupported(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
    return Boolean(gl && typeof (gl as WebGLRenderingContext).getExtension === "function");
  } catch {
    return false;
  }
}

function createWoodTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Base dark mahogany / oak color
  ctx.fillStyle = "#331c10";
  ctx.fillRect(0, 0, 512, 512);

  // Wood planks & grain fibers
  for (let y = 0; y < 512; y += 2) {
    const noise = Math.sin(y * 0.06) * 4 + Math.sin(y * 0.015) * 10;
    const tone = 20 + Math.sin(y * 0.12) * 15;
    ctx.strokeStyle = `rgba(${tone + 35}, ${tone + 10}, ${tone / 2}, 0.15)`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, y + noise);
    ctx.lineTo(512, y + noise);
    ctx.stroke();
  }

  // Plank seams
  for (let x = 128; x < 512; x += 128) {
    ctx.strokeStyle = "rgba(10, 5, 2, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();

    ctx.strokeStyle = "rgba(90, 50, 25, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 2, 0);
    ctx.lineTo(x + 2, 512);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.5, 1.5);
  return texture;
}

export function Dice3DStage({
  die,
  isRolling,
  latestRoll,
  colorTheme = "emerald",
  onTriggerRoll,
  animationDurationMs = 1200,
}: Dice3DStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasWebGL, setHasWebGL] = useState(() => isWebGLSupported());
  const [impactEffect, setImpactEffect] = useState<"none" | "normal" | "success" | "failure">("none");

  // Keep refs for 3D state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const dieMeshRef = useRef<THREE.Mesh | null>(null);
  const dieDefRef = useRef<Die3DDefinition | null>(null);
  const textureCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());

  // Interactive rotation state
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const manualEulerRef = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const idleSpinRef = useRef(0);

  // Roll physics state
  const rollStartTimeRef = useRef<number | null>(null);
  const rollDurationRef = useRef(animationDurationMs);
  const rollFromQuatRef = useRef(new THREE.Quaternion());
  const rollTargetQuatRef = useRef(new THREE.Quaternion());
  const rollTumbleSpeedRef = useRef(new THREE.Vector3());

  // Update roll duration when prop changes
  useEffect(() => {
    rollDurationRef.current = animationDurationMs;
  }, [animationDurationMs]);

  // Compute target orientation facing camera
  const computeTargetQuaternion = useCallback(
    (targetValue: number, definition: Die3DDefinition): THREE.Quaternion => {
      const match = definition.faces.find((f) => f.value === targetValue) ?? definition.faces[0];
      const quat = new THREE.Quaternion();
      if (!match) return quat;

      // Normal in local coordinates
      const faceNormal = match.normal.clone().normalize();
      // Vector pointing toward the camera view direction
      const cameraViewVec = new THREE.Vector3(0, 0.45, 0.89).normalize();
      quat.setFromUnitVectors(faceNormal, cameraViewVec);

      // Add subtle organic twist
      const subtleTwist = new THREE.Quaternion().setFromAxisAngle(
        cameraViewVec,
        (Math.random() - 0.5) * 0.1,
      );
      quat.premultiply(subtleTwist);

      return quat;
    },
    [],
  );

  // Initialize 3D Scene with Wooden Tabletop & Tray
  useEffect(() => {
    if (!hasWebGL) return;
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 240;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 3.4, 5.6);
    camera.lookAt(0, 0.18, 0);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setHasWebGL(false);
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Warm Tavern / Candlelight Lighting
    const ambientLight = new THREE.AmbientLight(0xfff1dc, 2.0);
    scene.add(ambientLight);

    const candleLight = new THREE.DirectionalLight(0xffecd0, 2.6);
    candleLight.position.set(3.5, 7.5, 4.5);
    candleLight.castShadow = true;
    candleLight.shadow.mapSize.width = 1024;
    candleLight.shadow.mapSize.height = 1024;
    candleLight.shadow.camera.near = 0.5;
    candleLight.shadow.camera.far = 15;
    candleLight.shadow.bias = -0.001;
    scene.add(candleLight);

    const rimWarm = new THREE.PointLight(0xffc570, 1.8, 12);
    rimWarm.position.set(-3.5, 2.5, -2.5);
    scene.add(rimWarm);

    const mysticAccent = new THREE.PointLight(0x7df9d2, 1.3, 10);
    mysticAccent.position.set(3, 1.5, 3);
    scene.add(mysticAccent);

    // ==========================================================
    // MESA DE MADEIRA & BANDEJA DE ROLAGEM (WOODEN TABLE & TRAY)
    // ==========================================================
    const woodTexture = createWoodTexture();

    // 1. Tabletop Background Floor (Wooden Planks)
    const tableGeo = new THREE.PlaneGeometry(14, 14);
    const tableMat = new THREE.MeshStandardMaterial({
      map: woodTexture ?? undefined,
      color: 0x22130a,
      roughness: 0.65,
      metalness: 0.1,
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.rotation.x = -Math.PI / 2;
    tableMesh.position.y = -0.16;
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

    // 2. Raised Wooden Octagonal/Circular Tray Base
    const woodTrayGeo = new THREE.CylinderGeometry(2.45, 2.55, 0.22, 40);
    const woodTrayMat = new THREE.MeshStandardMaterial({
      map: woodTexture ?? undefined,
      color: 0x422413,
      roughness: 0.45,
      metalness: 0.15,
    });
    const woodTrayMesh = new THREE.Mesh(woodTrayGeo, woodTrayMat);
    woodTrayMesh.position.y = -0.05;
    woodTrayMesh.receiveShadow = true;
    scene.add(woodTrayMesh);

    // 3. Inner Felt Inlay (Velvet Tray Floor)
    const feltGeo = new THREE.CylinderGeometry(2.32, 2.32, 0.02, 40);
    const feltMat = new THREE.MeshStandardMaterial({
      color: 0x071b15,
      roughness: 0.9,
      metalness: 0.05,
    });
    const feltMesh = new THREE.Mesh(feltGeo, feltMat);
    feltMesh.position.y = 0.06;
    feltMesh.receiveShadow = true;
    scene.add(feltMesh);

    // 4. Polished Brass / Golden Inlay Ring
    const brassRimGeo = new THREE.TorusGeometry(2.35, 0.045, 16, 48);
    const brassRimMat = new THREE.MeshStandardMaterial({
      color: 0xcca86b,
      roughness: 0.2,
      metalness: 0.85,
    });
    const brassRimMesh = new THREE.Mesh(brassRimGeo, brassRimMat);
    brassRimMesh.rotation.x = Math.PI / 2;
    brassRimMesh.position.y = 0.07;
    scene.add(brassRimMesh);

    // 5. Outer Brass Corner Accents (Rivets)
    for (let r = 0; r < 8; r++) {
      const angle = (r * Math.PI) / 4;
      const studGeo = new THREE.SphereGeometry(0.05, 12, 12);
      const studMesh = new THREE.Mesh(studGeo, brassRimMat);
      studMesh.position.set(2.45 * Math.cos(angle), 0.07, 2.45 * Math.sin(angle));
      scene.add(studMesh);
    }

    // Resize observer
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth || 320;
      const h = container.clientHeight || 240;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation Loop
    let animId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const dieMesh = dieMeshRef.current;
      const dieDef = dieDefRef.current;

      if (dieMesh && dieDef) {
        if (rollStartTimeRef.current !== null) {
          // ACTIVE ROLLING
          const elapsed = (time - rollStartTimeRef.current) / 1000;
          const totalDur = (rollDurationRef.current || 1200) / 1000;
          const progress = Math.min(1, elapsed / totalDur);

          // Multi-bounce trajectory
          let posY = 0;
          if (progress < 0.45) {
            const p1 = progress / 0.45;
            posY = Math.sin(p1 * Math.PI) * 2.2;
          } else if (progress < 0.75) {
            const p2 = (progress - 0.45) / 0.3;
            posY = Math.sin(p2 * Math.PI) * 0.9;
          } else if (progress < 0.92) {
            const p3 = (progress - 0.75) / 0.17;
            posY = Math.sin(p3 * Math.PI) * 0.3;
          } else {
            posY = 0;
          }
          dieMesh.position.y = posY + 0.22;

          // Rotation: high-speed tumbling blending into target quaternion
          if (progress < 0.65) {
            const speed = (1 - progress * 0.7) * 22;
            dieMesh.rotateX(rollTumbleSpeedRef.current.x * delta * speed);
            dieMesh.rotateY(rollTumbleSpeedRef.current.y * delta * speed);
            dieMesh.rotateZ(rollTumbleSpeedRef.current.z * delta * speed);
          } else {
            const blendT = (progress - 0.65) / 0.35;
            const easeOut = 1 - Math.pow(1 - blendT, 3);
            dieMesh.quaternion.slerp(rollTargetQuatRef.current, Math.min(1, easeOut * 0.35 + 0.05));
          }

          if (progress >= 1) {
            dieMesh.position.y = 0.22;
            dieMesh.quaternion.copy(rollTargetQuatRef.current);
            rollStartTimeRef.current = null;
          }
        } else {
          // IDLE HOVER
          idleSpinRef.current += delta * 0.3;
          const hoverY = 0.26 + Math.sin(time * 0.002) * 0.06;
          dieMesh.position.y = hoverY;

          if (isDraggingRef.current) {
            dieMesh.rotation.copy(manualEulerRef.current);
          } else {
            dieMesh.rotation.y += delta * 0.22;
            dieMesh.rotation.x = Math.sin(time * 0.001) * 0.06;
          }
        }
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [hasWebGL]);

  // Load or Switch 3D Die Model when die or colorTheme changes
  useEffect(() => {
    if (!hasWebGL || !sceneRef.current) return;
    const scene = sceneRef.current;

    // Remove previous mesh
    if (dieMeshRef.current) {
      scene.remove(dieMeshRef.current);
      dieMeshRef.current.geometry.dispose();
      dieMeshRef.current = null;
    }

    const definition = getDie3DDefinition(die);
    dieDefRef.current = definition;

    const cacheKey = `${die}-${colorTheme}`;
    let texture = textureCacheRef.current.get(cacheKey);
    if (!texture) {
      texture = createDiceAtlasTexture(definition, colorTheme) ?? undefined;
      if (texture) {
        textureCacheRef.current.set(cacheKey, texture);
      }
    }

    const material = createDieMaterial(texture ?? null);
    const mesh = new THREE.Mesh(definition.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = false; // Prevents self-shadowing acne
    mesh.scale.setScalar(definition.scale);
    mesh.position.set(0, 0.26, 0);

    // Initial resting orientation
    const initValue = latestRoll?.natural ?? (die === 20 ? 20 : die === 100 ? 100 : die);
    const initQuat = computeTargetQuaternion(initValue, definition);
    mesh.quaternion.copy(initQuat);

    scene.add(mesh);
    dieMeshRef.current = mesh;
  }, [die, colorTheme, hasWebGL, computeTargetQuaternion, latestRoll]);

  // Handle Roll Trigger from props
  useEffect(() => {
    if (isRolling) {
      rollStartTimeRef.current = performance.now();
      setImpactEffect("none");

      if (dieMeshRef.current) {
        rollFromQuatRef.current.copy(dieMeshRef.current.quaternion);

        // Random tumble vector
        rollTumbleSpeedRef.current.set(
          (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.6),
          (Math.random() > 0.5 ? 1 : -1) * (0.9 + Math.random() * 0.7),
          (Math.random() > 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.5),
        );
      }

      const targetVal = latestRoll?.natural ?? 1;
      const def = dieDefRef.current ?? getDie3DDefinition(die);
      rollTargetQuatRef.current = computeTargetQuaternion(targetVal, def);

      const timer = window.setTimeout(() => {
        if (latestRoll?.critical === "success") {
          setImpactEffect("success");
        } else if (latestRoll?.critical === "failure") {
          setImpactEffect("failure");
        } else {
          setImpactEffect("normal");
        }

        const clearTimer = window.setTimeout(() => {
          setImpactEffect("none");
        }, 800);
        return () => window.clearTimeout(clearTimer);
      }, Math.max(0, animationDurationMs - 120));

      return () => window.clearTimeout(timer);
    }
  }, [isRolling, latestRoll, die, animationDurationMs, computeTargetQuaternion]);

  // Pointer Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    if (dieMeshRef.current) {
      manualEulerRef.current.setFromQuaternion(dieMeshRef.current.quaternion, "YXZ");
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !dieMeshRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    manualEulerRef.current.y += dx * 0.012;
    manualEulerRef.current.x += dy * 0.012;
    dieMeshRef.current.rotation.copy(manualEulerRef.current);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const currentThemeConfig = DICE_COLOR_THEMES[colorTheme] ?? DICE_COLOR_THEMES.emerald;

  // Fallback 2.5D SVG Polyhedral View if WebGL is unavailable
  if (!hasWebGL) {
    return (
      <div
        className={`dice-3d-stage is-fallback ${isRolling ? "is-rolling" : ""} impact-${impactEffect}`}
        onClick={onTriggerRoll}
        title="Clique para rolar o dado"
        role="button"
        tabIndex={0}
      >
        <div className="dice-fallback-arena">
          <div className="dice-fallback-polyhedron">
            <DieIcon sides={die} size={96} className="dice-fallback-svg" />
            <div className="dice-fallback-badge">
              <span className="dice-fallback-number">{latestRoll?.natural ?? die}</span>
            </div>
          </div>
          <p className="dice-fallback-prompt">d{die} modelado · {currentThemeConfig.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`dice-3d-stage ${isRolling ? "is-rolling" : ""} impact-${impactEffect}`}
      onClick={onTriggerRoll}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      title="Clique ou toque para rolar; arraste para girar em 3D"
      role="button"
      tabIndex={0}
      aria-label={`Mesa de madeira com rolagem 3D para o dado d${die}. Clique para rolar.`}
    >
      <div className="dice-3d-canvas-container" ref={containerRef} />

      {/* Floating 3D HUD Indicators */}
      <div className="dice-3d-hud" aria-hidden="true">
        <div className="dice-3d-badge">
          <DieIcon sides={die} size={18} />
          <span>d{die}</span>
          {latestRoll && <span className="dice-3d-current-val">· {latestRoll.natural}</span>}
          <span className="dice-3d-theme-tag">{currentThemeConfig.name}</span>
        </div>
        <span className="dice-3d-hint">
          {isRolling ? "Rolando na mesa de madeira…" : "Clique para rolar · Arraste para inspecionar"}
        </span>
      </div>

      {/* Impact Flash Rings */}
      {impactEffect !== "none" && (
        <div className={`dice-impact-ring dice-impact-${impactEffect}`} aria-hidden="true" />
      )}
    </div>
  );
}
