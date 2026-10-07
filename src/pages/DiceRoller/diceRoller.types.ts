export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

export type DieSides = (typeof DICE_SIDES)[number];

export const DICE_MODELS: Record<DieSides, { model: string; faces: string; results: string }> = {
  4: { model: "Dado de 4 lados", faces: "4 lados", results: "1 a 4" },
  6: { model: "Dado de 6 lados", faces: "6 lados", results: "1 a 6" },
  8: { model: "Dado de 8 lados", faces: "8 lados", results: "1 a 8" },
  10: { model: "Dado de 10 lados", faces: "10 lados", results: "1 a 10" },
  12: { model: "Dado de 12 lados", faces: "12 lados", results: "1 a 12" },
  20: { model: "Dado de 20 lados", faces: "20 lados", results: "1 a 20" },
  100: { model: "Dado de 100 lados", faces: "100 lados", results: "10, 20, 30 … 100" },
};
export type CriticalOutcome = "success" | "failure" | null;

export interface DiceRoll {
  id: string;
  die: DieSides;
  natural: number;
  modifier: number;
  total: number;
  critical: CriticalOutcome;
  rolledAt: string;
}

export interface RollHistoryStore {
  load(campaignId: string): DiceRoll[];
  save(campaignId: string, rolls: DiceRoll[]): void;
}

export type DiceRandomSource = () => number;

export interface DiceRollerProps {
  campaignId: string;
  modifierValue: string;
  onModifierChange: (value: string) => void;
  historyStore?: RollHistoryStore;
  randomSource?: DiceRandomSource;
  animationDurationMs?: number;
}
