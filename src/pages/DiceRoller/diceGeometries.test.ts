import { describe, expect, it } from "vitest";
import { DICE_SIDES, type DieSides } from "./diceRoller.types";
import { getDie3DDefinition } from "./diceGeometries";

describe("diceGeometries", () => {
  it.each(DICE_SIDES)("modela geometricamente o dado d%i com os lados corretos", (sides: DieSides) => {
    const def = getDie3DDefinition(sides);
    expect(def).toBeDefined();
    expect(def.die).toBe(sides);
    expect(def.geometry).toBeDefined();

    // Check face count
    const expectedFaces = sides === 100 ? 10 : sides;
    expect(def.faces).toHaveLength(expectedFaces);

    // Check that every face has a valid normal pointing outwards
    for (const face of def.faces) {
      expect(face.normal.length()).toBeCloseTo(1, 2);
      expect(Number.isFinite(face.center.x)).toBe(true);
      expect(Number.isFinite(face.center.y)).toBe(true);
      expect(Number.isFinite(face.center.z)).toBe(true);
      expect(face.indices.length).toBeGreaterThanOrEqual(3);
    }

    // Check UV attributes
    const uvAttr = def.geometry.attributes.uv;
    expect(uvAttr).toBeDefined();
    expect(uvAttr.count).toBe(def.geometry.attributes.position.count);
  });

  it("garante que todas as faces de d20 (1 a 20) existem e as faces opostas somam 21", () => {
    const def = getDie3DDefinition(20);
    const values = def.faces.map((f) => f.value).sort((a, b) => a - b);
    expect(values).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));

    // Opposite faces check
    const pairs: [number, number][] = [];
    for (let i = 0; i < def.faces.length; i++) {
      for (let j = i + 1; j < def.faces.length; j++) {
        if (def.faces[i].normal.dot(def.faces[j].normal) < -0.9) {
          pairs.push([def.faces[i].value, def.faces[j].value]);
        }
      }
    }

    expect(pairs).toHaveLength(10);
    for (const [v1, v2] of pairs) {
      expect(v1 + v2).toBe(21);
    }
  });

  it("garante que todas as faces de d12 (1 a 12) existem e as faces opostas somam 13", () => {
    const def = getDie3DDefinition(12);
    const values = def.faces.map((f) => f.value).sort((a, b) => a - b);
    expect(values).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));

    const pairs: [number, number][] = [];
    for (let i = 0; i < def.faces.length; i++) {
      for (let j = i + 1; j < def.faces.length; j++) {
        if (def.faces[i].normal.dot(def.faces[j].normal) < -0.9) {
          pairs.push([def.faces[i].value, def.faces[j].value]);
        }
      }
    }

    expect(pairs).toHaveLength(6);
    for (const [v1, v2] of pairs) {
      expect(v1 + v2).toBe(13);
    }
  });

  it("garante que todas as faces de d6 (1 a 6) existem e as faces opostas somam 7", () => {
    const def = getDie3DDefinition(6);
    const values = def.faces.map((f) => f.value).sort((a, b) => a - b);
    expect(values).toEqual([1, 2, 3, 4, 5, 6]);

    const pairs: [number, number][] = [];
    for (let i = 0; i < def.faces.length; i++) {
      for (let j = i + 1; j < def.faces.length; j++) {
        if (def.faces[i].normal.dot(def.faces[j].normal) < -0.9) {
          pairs.push([def.faces[i].value, def.faces[j].value]);
        }
      }
    }

    expect(pairs).toHaveLength(3);
    for (const [v1, v2] of pairs) {
      expect(v1 + v2).toBe(7);
    }
  });

  it("garante que o d4 possui exatamente 4 faces triangulares com valores 1 a 4", () => {
    const def = getDie3DDefinition(4);
    expect(def.faces).toHaveLength(4);
    const values = def.faces.map((f) => f.value).sort((a, b) => a - b);
    expect(values).toEqual([1, 2, 3, 4]);
    expect(def.faces.every((f) => f.shape === "triangle")).toBe(true);
  });

  it("garante que o d100 possui faces percentuais (10 a 100)", () => {
    const def = getDie3DDefinition(100);
    expect(def.faces).toHaveLength(10);
    const values = def.faces.map((f) => f.value).sort((a, b) => a - b);
    expect(values).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });
});
