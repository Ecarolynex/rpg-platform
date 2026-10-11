import { describe, expect, it } from "vitest";
import { parseCharacterData, serializeCharacterData } from "./characterData";
import type { Character } from "../types/character";

const attributes = {
  forca: 12,
  destreza: 10,
  constituicao: 14,
  inteligencia: 11,
  carisma: 8,
};

function legacyCharacter(): Record<string, unknown> {
  return {
    id: "old-id",
    campanhaId: "legacy-campaign",
    nome: "Nara",
    raca: "Humano",
    classe: "Guerreiro",
    nivel: 2,
    hp: { atual: 17, max: 24, temp: 4 },
    mp: { atual: 5, max: 50 },
    attributes,
    skills: [{ id: "athletics", nome: "Atletismo", atributo: "forca", treinada: true, bonus: 2 }],
    inventory: [{ id: "ring", nome: "Anel", quantidade: 1, equipado: true, bonusAtributos: { carisma: 1 } }],
    spells: [{ id: "spark", nome: "Faísca", custo: 2, descricao: "Luz." }],
    carteira: { pc: 2, pp: 3, pe: 1, po: 15, pl: 0 },
    notas: "",
    campaignSpecificLegacyField: { custom: true },
  };
}

describe("character data contract", () => {
  it("migrates legacy shape to V1 without persisted max values", () => {
    const parsed = parseCharacterData(legacyCharacter());

    expect(parsed).toMatchObject({
      schemaVersion: 1,
      nome: "Nara",
      hp: { atual: 17, temp: 4 },
      mp: { atual: 5 },
      attributes,
      carteira: { pc: 2, pp: 3, pe: 1, po: 15, pl: 0 },
      campaignSpecificLegacyField: { custom: true },
    });
    expect(parsed?.hp).not.toHaveProperty("max");
    expect(parsed?.mp).not.toHaveProperty("max");
  });

  it("serializes only the V1 data contract and preserves temporary resources", () => {
    const parsed = parseCharacterData(legacyCharacter());
    expect(parsed).not.toBeNull();
    const character = {
      ...parsed!,
      id: "character-1",
      campanhaId: "campaign-1",
      dataVersion: 8,
      hp: { ...parsed!.hp, max: 25 },
      mp: { ...parsed!.mp, max: 16 },
    } as Character;

    const serialized = serializeCharacterData(character);
    expect(serialized.schemaVersion).toBe(1);
    expect(serialized.hp).toEqual({ atual: 17, temp: 4 });
    expect(serialized.mp).toEqual({ atual: 5 });
    expect(serialized).not.toHaveProperty("id");
    expect(serialized).not.toHaveProperty("campanhaId");
    expect(serialized).not.toHaveProperty("dataVersion");
    expect(serialized.hp).not.toHaveProperty("max");
    expect(serialized).toHaveProperty("campaignSpecificLegacyField.custom", true);
  });

  it("rejects unsupported versions and malformed required attributes", () => {
    expect(parseCharacterData({ ...legacyCharacter(), schemaVersion: 9 })).toBeNull();
    expect(parseCharacterData({ ...legacyCharacter(), attributes: { forca: "10" } })).toBeNull();
  });
});
