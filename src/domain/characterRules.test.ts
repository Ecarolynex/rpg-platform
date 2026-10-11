import { describe, expect, it } from "vitest";
import type { Character } from "../types/character";
import { calculateDerivedCharacterStats } from "./characterRules";

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: "character-1",
    nome: "Nara",
    raca: "Humano",
    classe: "Guerreiro",
    classeId: "guerreiro",
    nivel: 1,
    hp: { atual: 10, max: 200 },
    mp: { atual: 10, max: 200 },
    attributes: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, carisma: 10 },
    skills: [],
    inventory: [],
    spells: [],
    notas: "",
    ...overrides,
  };
}

const zeroBonus = { forca: 0, destreza: 0, constituicao: 0, inteligencia: 0, carisma: 0 };

describe("calculateDerivedCharacterStats", () => {
  it("keeps character base values unchanged and calculates independent sources once", () => {
    const source = character({
      filiacao: "Sombras Urbanas",
      inventory: [{
        id: "ring",
        nome: "Anel",
        quantidade: 1,
        equipado: true,
        bonusAtributos: { carisma: 2, forca: 1 },
      }],
    });
    const result = calculateDerivedCharacterStats(source);

    expect(result.attributesBase).toEqual(source.attributes);
    expect(result.attributesFinal).toEqual({ forca: 14, destreza: 12, constituicao: 11, inteligencia: 11, carisma: 14 });
    expect(result.breakdown.raca.forca).toBe(1);
    expect(result.breakdown.classe.forca).toBe(2);
    expect(result.breakdown.filiacao.destreza).toBe(1);
    expect(result.breakdown.equipamento.forca).toBe(1);
    expect(source.attributes.forca).toBe(10);
  });

  it("uses the campaign's explicit class override instead of adding it to the global value", () => {
    const result = calculateDerivedCharacterStats(character(), {
      campaignClassBonuses: {
        Guerreiro: {
          atributoBonus: { ...zeroBonus, forca: 4 },
          hpBonus: 3,
          mpBonus: 0,
        },
      },
    });

    expect(result.breakdown.classe.forca).toBe(4);
    expect(result.attributesFinal.forca).toBe(15); // base 10 + human 1 + campaign 4
    expect(result.hpMax).toBe(13); // level-1 class die + campaign PV bonus
  });

  it("resolves a campaign-only class by stable class id", () => {
    const result = calculateDerivedCharacterStats(character({
      classe: "Dançarino das Brumas",
      classeId: "mist-dancer",
    }), {
      classCatalog: [],
      campaignClassContents: [{
        classe_id: "mist-dancer",
        tipo: "CLASSE",
        nome: "Dançarino das Brumas",
        bonus_atributos: { destreza: 3 },
        bonus_hp: 2,
        bonus_mp: 4,
      }],
    });

    expect(result.breakdown.classe.destreza).toBe(3);
    expect(result.hpMax).toBe(10);
    expect(result.mpMax).toBe(23);
  });

  it("ignores unequipped gear and supports supplied relational equipment bonuses", () => {
    const result = calculateDerivedCharacterStats(character({
      classe: "Classe sem bônus",
      inventory: [{ id: "weapon", nome: "Machado", quantidade: 1, equipado: false, bonusAtributos: { forca: 5 } }],
    }), {
      classCatalog: [],
      equippedItemBonuses: [{ forca: 2 }],
    });

    expect(result.breakdown.equipamento.forca).toBe(2);
    expect(result.attributesFinal.forca).toBe(13); // base 10 + human 1 + supplied gear 2
  });
});
