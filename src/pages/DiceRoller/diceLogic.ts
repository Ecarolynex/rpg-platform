import { DICE_SIDES, type CriticalOutcome, type DiceRoll, type DieSides } from "./diceRoller.types";
import type { DiceRandomSource } from "./diceRoller.types";

export const MAX_ROLL_HISTORY = 20;

export function parseModifier(value: string): number {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "+" || trimmed === "-") return 0;

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export function formatModifier(modifier: number): string {
  if (modifier > 0) return `+${modifier}`;
  return String(modifier);
}

export function rollDie(sides: DieSides, random: DiceRandomSource = Math.random): number {
  if (!DICE_SIDES.some((supportedSides) => supportedSides === sides)) {
    throw new RangeError("Tipo de dado não suportado.");
  }

  const sample = random();
  if (!Number.isFinite(sample)) {
    throw new RangeError("A fonte aleatória precisa retornar um número finito.");
  }

  const boundedSample = Math.min(1 - Number.EPSILON, Math.max(0, sample));

  if (sides === 100) {
    return (Math.floor(boundedSample * 10) + 1) * 10;
  }

  return Math.floor(boundedSample * sides) + 1;
}

export function classifyCritical(natural: number, sides: DieSides): CriticalOutcome {
  const minimumNatural = sides === 100 ? 10 : 1;
  if (natural === sides) return "success";
  if (natural === minimumNatural) return "failure";
  return null;
}

export function createDiceRoll(
  die: DieSides,
  modifier: number,
  random: DiceRandomSource = Math.random,
): DiceRoll {
  const natural = rollDie(die, random);
  const safeModifier = Number.isSafeInteger(modifier) ? modifier : 0;

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `roll-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    die,
    natural,
    modifier: safeModifier,
    total: natural + safeModifier,
    critical: classifyCritical(natural, die),
    rolledAt: new Date().toISOString(),
  };
}

export function formatDiceFormula(roll: DiceRoll): string {
  const modifier = roll.modifier > 0
    ? ` + ${roll.modifier}`
    : roll.modifier < 0
      ? ` - ${Math.abs(roll.modifier)}`
      : "";

  return `d${roll.die} (${roll.natural})${modifier} = ${roll.total}`;
}

export function formatDetailedRoll(roll: DiceRoll): string {
  return `Dado: d${roll.die} | Rolado: ${roll.natural} | Modificador: ${formatModifier(roll.modifier)} | Total: ${roll.total}`;
}

export function formatRollTime(rolledAt: string): string {
  const date = new Date(rolledAt);
  if (Number.isNaN(date.getTime())) return "Horário indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
