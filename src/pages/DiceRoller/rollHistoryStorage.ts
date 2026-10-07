import { DICE_SIDES, type DiceRoll, type DieSides, type RollHistoryStore } from "./diceRoller.types";
import { classifyCritical, MAX_ROLL_HISTORY } from "./diceLogic";

const STORAGE_PREFIX = "rpg-platform-dice-";

export function getRollHistoryStorageKey(campaignId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(campaignId)}`;
}

function isDiceRoll(value: unknown): value is DiceRoll {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DiceRoll>;
  const dieIsSupported = DICE_SIDES.some((sides) => sides === candidate.die);

  if (
    typeof candidate.id !== "string" ||
    !dieIsSupported ||
    !Number.isSafeInteger(candidate.natural) ||
    !Number.isSafeInteger(candidate.modifier) ||
    !Number.isSafeInteger(candidate.total) ||
    typeof candidate.rolledAt !== "string" ||
    Number.isNaN(Date.parse(candidate.rolledAt))
  ) {
    return false;
  }

  const die = candidate.die as DieSides;
  const natural = candidate.natural as number;
  const modifier = candidate.modifier as number;

  return (
    natural >= 1 &&
    natural <= die &&
    candidate.total === natural + modifier &&
    candidate.critical === classifyCritical(natural, die)
  );
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function createSessionRollHistoryStore(
  storageProvider: () => Storage | null = getSessionStorage,
): RollHistoryStore {
  return {
    load(campaignId) {
      try {
        const storage = storageProvider();
        const saved = storage?.getItem(getRollHistoryStorageKey(campaignId));
        if (!saved) return [];

        const parsed: unknown = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isDiceRoll).slice(0, MAX_ROLL_HISTORY);
      } catch {
        return [];
      }
    },
    save(campaignId, rolls) {
      try {
        const storage = storageProvider();
        if (!storage) return;
        storage.setItem(
          getRollHistoryStorageKey(campaignId),
          JSON.stringify(rolls.filter(isDiceRoll).slice(0, MAX_ROLL_HISTORY)),
        );
      } catch {
        // A rolagem continua disponível na tela mesmo se o navegador bloquear o armazenamento.
      }
    },
  };
}

export const sessionRollHistoryStore = createSessionRollHistoryStore();
