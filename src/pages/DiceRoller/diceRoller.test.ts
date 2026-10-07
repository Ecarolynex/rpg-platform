import { describe, expect, it } from "vitest";
import {
  classifyCritical,
  createDiceRoll,
  formatDetailedRoll,
  formatDiceFormula,
  formatModifier,
  parseModifier,
  rollDie,
} from "./diceLogic";
import { DICE_SIDES } from "./diceRoller.types";

describe("rolagem de dados", () => {
  it.each(DICE_SIDES)("gera os valores extremos válidos de d%s", (sides) => {
    expect(rollDie(sides, () => 0)).toBe(sides === 100 ? 10 : 1);
    expect(rollDie(sides, () => 1)).toBe(sides);
  });

  it("mantém o resultado natural dentro dos limites quando a fonte aleatória sai da faixa", () => {
    expect(rollDie(6, () => -0.2)).toBe(1);
    expect(rollDie(6, () => 1.2)).toBe(6);
  });

  it("classifica críticos pelo valor natural, antes do modificador", () => {
    expect(classifyCritical(20, 20)).toBe("success");
    expect(classifyCritical(1, 20)).toBe("failure");
    expect(classifyCritical(19, 20)).toBeNull();
    expect(classifyCritical(100, 100)).toBe("success");
    expect(classifyCritical(10, 100)).toBe("failure");
    expect(classifyCritical(50, 100)).toBeNull();
  });

  it("rola d100 em dezenas entre 10 e 100", () => {
    expect(rollDie(100, () => 0)).toBe(10);
    expect(rollDie(100, () => 0.23)).toBe(30);
    expect(rollDie(100, () => 1)).toBe(100);
  });

  it("calcula o total e detalha modificadores positivos, negativos e zero", () => {
    const positive = createDiceRoll(20, 3, () => 0.7);
    const negative = createDiceRoll(4, -1, () => 0);
    const neutral = createDiceRoll(6, 0, () => 0.5);

    expect(positive).toMatchObject({ natural: 15, modifier: 3, total: 18, critical: null });
    expect(formatDiceFormula(positive)).toBe("d20 (15) + 3 = 18");
    expect(formatDetailedRoll(positive)).toBe(
      "Dado: d20 | Rolado: 15 | Modificador: +3 | Total: 18",
    );
    expect(formatDiceFormula(negative)).toBe("d4 (1) - 1 = 0");
    expect(formatModifier(-1)).toBe("-1");
    expect(formatDiceFormula(neutral)).toBe("d6 (4) = 4");
    expect(formatModifier(0)).toBe("0");
  });

  it("trata o campo vazio como zero e preserva inteiros com sinal", () => {
    expect(parseModifier("")).toBe(0);
    expect(parseModifier("-")).toBe(0);
    expect(parseModifier("+3")).toBe(3);
    expect(parseModifier("-1")).toBe(-1);
    expect(parseModifier("1.5")).toBe(0);
  });
});
