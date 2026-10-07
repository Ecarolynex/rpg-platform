import { describe, expect, it } from "vitest";
import { createDiceRoll } from "./diceLogic";
import {
  createSessionRollHistoryStore,
  getRollHistoryStorageKey,
} from "./rollHistoryStorage";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key) { return values.get(key) ?? null; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

describe("histórico de rolagens", () => {
  it("separa o histórico por campanha e limita a lista às 20 entradas mais recentes", () => {
    const storage = createMemoryStorage();
    const store = createSessionRollHistoryStore(() => storage);
    const rolls = Array.from({ length: 22 }, (_, index) =>
      createDiceRoll(6, index, () => 0.5),
    ).reverse();

    store.save("campanha A", rolls);

    expect(store.load("campanha A")).toHaveLength(20);
    expect(store.load("campanha A")[0].id).toBe(rolls[0].id);
    expect(store.load("campanha B")).toEqual([]);
    expect(getRollHistoryStorageKey("campanha A")).toContain("campanha%20A");
  });

  it("ignora JSON inválido e retorna lista vazia", () => {
    const storage = createMemoryStorage();
    storage.setItem(getRollHistoryStorageKey("campaign-1"), "{");
    const store = createSessionRollHistoryStore(() => storage);

    expect(store.load("campaign-1")).toEqual([]);
  });
});
