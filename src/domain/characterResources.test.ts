import { describe, expect, it } from "vitest";
import type { Character } from "../types/character";
import { applyResourceDelta, setResourceCurrent } from "./characterResources";

const base: Character = {
  id: "resource-test",
  nome: "Nara",
  raca: "Humano",
  classe: "Guerreiro",
  nivel: 1,
  hp: { atual: 9, max: 12, temp: 4 },
  mp: { atual: 5, max: 8, temp: 2 },
  attributes: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, carisma: 10 },
  skills: [], inventory: [], spells: [], notas: "",
};

describe("character temporary resources", () => {
  it("uses a temporary reserve before reducing current HP/MP", () => {
    expect(applyResourceDelta(base, "hp", -3, 12)).toMatchObject({ atual: 9, temp: 1 });
    expect(applyResourceDelta(base, "mp", -5, 8)).toMatchObject({ atual: 2, temp: 0 });
  });

  it("does not restore current resources when the maximum grows", () => {
    expect(applyResourceDelta(base, "hp", 0, 30)).toMatchObject({ atual: 9, max: 30, temp: 4 });
  });

  it("clamps only when the maximum decreases and leaves reserve separate", () => {
    expect(setResourceCurrent(base, "hp", base.hp.atual, 6)).toMatchObject({ atual: 6, max: 6, temp: 4 });
  });

  it("restores normal current resource without spending temporary reserve", () => {
    expect(applyResourceDelta(base, "mp", 20, 8)).toMatchObject({ atual: 8, temp: 2 });
  });
});
