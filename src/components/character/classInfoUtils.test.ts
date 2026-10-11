import { describe, expect, it } from "vitest";
import { montarInfoClasse } from "./classInfoUtils";
import type { ClassDefinition } from "../../data/personaRules";

const classDefinition: ClassDefinition = {
  id: "guerreiro",
  nome: "Guerreiro",
  aliases: [],
  atributoBonus: { forca: 2, destreza: 0, constituicao: 0, inteligencia: 0, carisma: 0 },
  hpBonus: 10,
  mpBonus: 0,
  usaMagia: false,
  pericias: [],
  habilidades: [],
  magias: [],
};

describe("montarInfoClasse", () => {
  it("mostra o bônus efetivo da campanha acima do catálogo e habilidades com nível", () => {
    const info = montarInfoClasse(
      "Guerreiro",
      "guerreiro",
      [classDefinition],
      [{
        id: "ability-1",
        campanha_id: "campaign-1",
        classe_id: "guerreiro",
        tipo: "HABILIDADE",
        nome: "Golpe tático",
        descricao: "Uma ação especial.",
        atributo: null,
        nivel: 4,
        bonus_atributos: {},
        bonus_hp: 0,
        bonus_mp: 0,
        created_by: "master-1",
      }],
      {
        Guerreiro: {
          atributoBonus: { forca: 0, destreza: 0, constituicao: 0, inteligencia: 2, carisma: 0 },
          hpBonus: 4,
          mpBonus: 3,
        },
      },
    );

    expect(info?.bonusAtributos).toEqual([{ chave: "inteligencia", rotulo: "Inteligência", valor: 2 }]);
    expect(info?.bonusHp).toBe(4);
    expect(info?.bonusMp).toBe(3);
    expect(info?.habilidades).toContainEqual({
      nome: "Golpe tático",
      descricao: "Uma ação especial.",
      nivel: 4,
    });
  });
});
