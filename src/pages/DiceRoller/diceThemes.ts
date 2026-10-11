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
