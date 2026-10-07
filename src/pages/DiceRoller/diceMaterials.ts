import * as THREE from "three";
import type { Die3DDefinition, DieFace } from "./diceGeometries";

const CELL_SIZE = 360;

export type DiceColorTheme =
  | "emerald"
  | "ruby"
  | "sapphire"
  | "amethyst"
  | "marble"
  | "amber"
  | "obsidian";

export interface DiceThemeConfig {
  id: DiceColorTheme;
  name: string;
  bgCenter: string;
  bgMid: string;
  bgEdge: string;
  veinColor: string;
  innerShade: string;
  goldHighlight: string;
  goldMain: string;
  goldDark: string;
  swatch: string;
}

export const DICE_COLOR_THEMES: Record<DiceColorTheme, DiceThemeConfig> = {
  emerald: {
    id: "emerald",
    name: "Esmeralda Nobre",
    bgCenter: "#184b3f",
    bgMid: "#0c2822",
    bgEdge: "#030e0b",
    veinColor: "rgba(199, 166, 108, 0.12)",
    innerShade: "rgba(3, 15, 12, 0.82)",
    goldHighlight: "#faeed2",
    goldMain: "#dfbc77",
    goldDark: "#85602a",
    swatch: "#1b4d41",
  },
  ruby: {
    id: "ruby",
    name: "Rubi Dragão",
    bgCenter: "#541217",
    bgMid: "#33080b",
    bgEdge: "#140204",
    veinColor: "rgba(255, 180, 180, 0.12)",
    innerShade: "rgba(22, 2, 4, 0.85)",
    goldHighlight: "#fff1d6",
    goldMain: "#e8c278",
    goldDark: "#91692e",
    swatch: "#63181e",
  },
  sapphire: {
    id: "sapphire",
    name: "Safira Astral",
    bgCenter: "#122d56",
    bgMid: "#081a36",
    bgEdge: "#020713",
    veinColor: "rgba(180, 220, 255, 0.14)",
    innerShade: "rgba(3, 9, 24, 0.85)",
    goldHighlight: "#f5f8ff",
    goldMain: "#d1dcff",
    goldDark: "#798cb8",
    swatch: "#183769",
  },
  amethyst: {
    id: "amethyst",
    name: "Ametista Arcana",
    bgCenter: "#451a56",
    bgMid: "#280b33",
    bgEdge: "#0f0214",
    veinColor: "rgba(235, 190, 255, 0.14)",
    innerShade: "rgba(18, 3, 24, 0.85)",
    goldHighlight: "#ffeaf5",
    goldMain: "#e7bad6",
    goldDark: "#945f80",
    swatch: "#501e66",
  },
  marble: {
    id: "marble",
    name: "Mármore Alvo",
    bgCenter: "#ecebe8",
    bgMid: "#d6d4cf",
    bgEdge: "#aba79e",
    veinColor: "rgba(100, 95, 85, 0.18)",
    innerShade: "rgba(70, 68, 62, 0.35)",
    goldHighlight: "#99732b",
    goldMain: "#634714",
    goldDark: "#3b2a09",
    swatch: "#dfded9",
  },
  amber: {
    id: "amber",
    name: "Âmbar Solar",
    bgCenter: "#663e0e",
    bgMid: "#402404",
    bgEdge: "#1a0d01",
    veinColor: "rgba(255, 230, 160, 0.16)",
    innerShade: "rgba(26, 13, 1, 0.85)",
    goldHighlight: "#fff8dc",
    goldMain: "#f0cb78",
    goldDark: "#9e772f",
    swatch: "#73450e",
  },
  obsidian: {
    id: "obsidian",
    name: "Obsidiana Sombria",
    bgCenter: "#242528",
    bgMid: "#121315",
    bgEdge: "#040405",
    veinColor: "rgba(215, 60, 60, 0.14)",
    innerShade: "rgba(0, 0, 0, 0.88)",
    goldHighlight: "#ffe6e6",
    goldMain: "#e04f4f",
    goldDark: "#851c1c",
    swatch: "#161719",
  },
};

function drawFacePolygonPath(
  ctx: CanvasRenderingContext2D,
  polygon2D: [number, number][],
  cx: number,
  cy: number,
  size: number,
) {
  if (!polygon2D || polygon2D.length < 3) {
    ctx.arc(cx, cy, size * 0.85, 0, Math.PI * 2);
    return;
  }

  ctx.beginPath();
  polygon2D.forEach(([u, v], i) => {
    // In canonical projection: u is horizontal, v is vertical up
    // In Canvas 2D: px = cx + u * size, py = cy - v * size
    const px = cx + u * size;
    const py = cy - v * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

export function createDiceAtlasTexture(
  definition: Die3DDefinition,
  colorTheme: DiceColorTheme = "emerald",
  canvas?: HTMLCanvasElement,
): THREE.CanvasTexture | null {
  const { faces, atlasCols, atlasRows, die } = definition;
  const width = atlasCols * CELL_SIZE;
  const height = atlasRows * CELL_SIZE;

  const targetCanvas =
    canvas ?? (typeof document !== "undefined" ? document.createElement("canvas") : null);
  if (!targetCanvas) return null;

  targetCanvas.width = width;
  targetCanvas.height = height;

  const ctx = targetCanvas.getContext("2d");
  if (!ctx) return null;

  const theme = DICE_COLOR_THEMES[colorTheme] ?? DICE_COLOR_THEMES.emerald;

  // Background overall fill
  ctx.fillStyle = theme.bgEdge;
  ctx.fillRect(0, 0, width, height);

  faces.forEach((face: DieFace, faceIndex: number) => {
    const col = faceIndex % atlasCols;
    const row = Math.floor(faceIndex / atlasCols);

    const cellX = col * CELL_SIZE;
    const cellY = row * CELL_SIZE;
    const cx = cellX + CELL_SIZE / 2;
    const cy = cellY + CELL_SIZE / 2;
    const shapeSize = CELL_SIZE * 0.44;

    ctx.save();

    // Clip to cell
    ctx.beginPath();
    ctx.rect(cellX, cellY, CELL_SIZE, CELL_SIZE);
    ctx.clip();

    // 1. Deep resin radial background
    const bgGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, CELL_SIZE * 0.65);
    bgGrad.addColorStop(0, theme.bgCenter);
    bgGrad.addColorStop(0.55, theme.bgMid);
    bgGrad.addColorStop(1, theme.bgEdge);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE);

    // Marble veins / subtle gemstone streaks
    ctx.strokeStyle = theme.veinColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cellX + 25, cellY + 45);
    ctx.bezierCurveTo(cx - 35, cy - 45, cx + 55, cy + 25, cellX + CELL_SIZE - 25, cellY + CELL_SIZE - 35);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cellX + 55, cellY + CELL_SIZE - 45);
    ctx.bezierCurveTo(cx - 25, cy + 35, cx + 25, cy - 35, cellX + CELL_SIZE - 45, cellY + 55);
    ctx.stroke();

    // 2. Beveled Gold Face Border - 100% ALIGNED USING EXACT POLYGON VERTICES!
    drawFacePolygonPath(ctx, face.polygon2D, cx, cy, shapeSize);
    ctx.save();
    ctx.clip();

    // Inner facet shade
    const facetGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, shapeSize);
    facetGrad.addColorStop(0, "rgba(255, 255, 255, 0.08)");
    facetGrad.addColorStop(1, theme.innerShade);
    ctx.fillStyle = facetGrad;
    ctx.fill();
    ctx.restore();

    // Golden rim outer shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;

    // Metallic gold rim stroke
    const borderGrad = ctx.createLinearGradient(cx - shapeSize, cy - shapeSize, cx + shapeSize, cy + shapeSize);
    borderGrad.addColorStop(0, theme.goldHighlight);
    borderGrad.addColorStop(0.35, theme.goldMain);
    borderGrad.addColorStop(0.7, theme.goldHighlight);
    borderGrad.addColorStop(1, theme.goldDark);

    drawFacePolygonPath(ctx, face.polygon2D, cx, cy, shapeSize);
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner fine contour line (92% scale)
    drawFacePolygonPath(ctx, face.polygon2D, cx, cy, shapeSize * 0.9);
    ctx.strokeStyle = "rgba(255, 240, 200, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 3. Special ornamentation for Nat 20 or Nat 1 on d20
    const isNat20 = die === 20 && face.value === 20;
    const isNat1 = die === 20 && face.value === 1;

    if (isNat20) {
      // Golden laurel / radiant crown glow
      ctx.save();
      ctx.strokeStyle = "rgba(255, 230, 150, 0.75)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, shapeSize * 0.58, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = theme.goldHighlight;
      const dots = 8;
      for (let d = 0; d < dots; d++) {
        const da = (d * 2 * Math.PI) / dots;
        const dx = cx + shapeSize * 0.58 * Math.cos(da);
        const dy = cy + shapeSize * 0.58 * Math.sin(da);
        ctx.beginPath();
        ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (isNat1) {
      ctx.save();
      ctx.strokeStyle = "rgba(239, 68, 68, 0.75)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, shapeSize * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Face Number Typography
    const strVal = String(face.value);
    let fontSize = 84;
    if (strVal.length === 2) fontSize = 72;
    if (strVal.length >= 3) fontSize = 54;

    ctx.font = `bold ${fontSize}px "Cinzel", "Cinzel Decorative", "Times New Roman", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const textCenterY = cy;

    // Engraved dark depth shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.95)";
    ctx.fillText(strVal, cx + 2, textCenterY + 3);

    // Bevel light top-left edge
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillText(strVal, cx - 1, textCenterY - 1);

    // Main metallic text gradient
    const textGrad = ctx.createLinearGradient(
      cx,
      textCenterY - fontSize / 2,
      cx,
      textCenterY + fontSize / 2,
    );

    if (isNat20) {
      textGrad.addColorStop(0, "#ffffff");
      textGrad.addColorStop(0.3, "#fff2cf");
      textGrad.addColorStop(0.7, "#f5cf7a");
      textGrad.addColorStop(1, "#9c6e21");
    } else if (isNat1) {
      textGrad.addColorStop(0, "#ffe5e5");
      textGrad.addColorStop(0.4, "#ef4444");
      textGrad.addColorStop(1, "#7f1d1d");
    } else {
      textGrad.addColorStop(0, theme.goldHighlight);
      textGrad.addColorStop(0.4, theme.goldMain);
      textGrad.addColorStop(0.8, theme.goldDark);
      textGrad.addColorStop(1, theme.goldDark);
    }

    ctx.fillStyle = textGrad;
    ctx.fillText(strVal, cx, textCenterY);

    // Distinguish 6 and 9 with a tasteful gold dot underneath
    if (face.value === 6 || face.value === 9) {
      ctx.fillStyle = theme.goldHighlight;
      ctx.beginPath();
      ctx.arc(cx, textCenterY + fontSize * 0.44, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });

  const texture = new THREE.CanvasTexture(targetCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

export function createDieMaterial(texture: THREE.CanvasTexture | null): THREE.Material {
  if (!texture) {
    return new THREE.MeshStandardMaterial({
      color: 0x133830,
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });
  }

  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.22,
    metalness: 0.14,
    side: THREE.DoubleSide, // Guarantees no backface culling artifacts on any polyhedron
  });
}
