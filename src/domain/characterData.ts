import { LIMITE_RECURSO } from "../data/dnd";
import type {
  Attributes,
  Character,
  CharacterDataV1,
  InventoryItem,
  Skill,
  Spell,
  Wallet,
} from "../types/character";

const ATTRIBUTE_KEYS: (keyof Attributes)[] = [
  "forca",
  "destreza",
  "constituicao",
  "inteligencia",
  "carisma",
];
const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

function integer(value: unknown, fallback = 0, min = -999999, max = 999999): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseAttributes(value: unknown): Attributes | null {
  const record = asRecord(value);
  if (!record || ATTRIBUTE_KEYS.some((key) => typeof record[key] !== "number" || !Number.isFinite(record[key]))) {
    return null;
  }
  return {
    forca: integer(record.forca, 10, 1, 30),
    destreza: integer(record.destreza, 10, 1, 30),
    constituicao: integer(record.constituicao, 10, 1, 30),
    inteligencia: integer(record.inteligencia, 10, 1, 30),
    carisma: integer(record.carisma, 10, 1, 30),
  };
}

function parseResource(value: unknown): { atual: number; temp?: number } {
  const record = asRecord(value) ?? {};
  const temp = record.temp;
  return {
    atual: integer(record.atual, 0, 0, LIMITE_RECURSO),
    ...(typeof temp === "number" && Number.isFinite(temp)
      ? { temp: integer(temp, 0, 0, LIMITE_RECURSO) }
      : {}),
  };
}

function parseSkills(value: unknown): Skill[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Skill[] => {
    const record = asRecord(item);
    if (
      !record ||
      typeof record.id !== "string" ||
      typeof record.nome !== "string" ||
      typeof record.atributo !== "string" ||
      !ATTRIBUTE_KEYS.includes(record.atributo as keyof Attributes)
    ) return [];

    return [{
      id: record.id,
      nome: record.nome,
      atributo: record.atributo as keyof Attributes,
      ...(optionalText(record.descricao) !== undefined ? { descricao: record.descricao as string } : {}),
      treinada: record.treinada === true,
      bonus: integer(record.bonus),
      ...(typeof record.bonusManual === "number" && Number.isFinite(record.bonusManual)
        ? { bonusManual: integer(record.bonusManual) }
        : {}),
    }];
  });
}

function parseBonusAtributos(value: unknown): InventoryItem["bonusAtributos"] {
  const record = asRecord(value);
  if (!record) return undefined;
  const bonus: Partial<Attributes> = {};
  for (const key of ATTRIBUTE_KEYS) {
    if (typeof record[key] === "number" && Number.isFinite(record[key])) {
      bonus[key] = integer(record[key]);
    }
  }
  return bonus;
}

function parseInventory(value: unknown): InventoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): InventoryItem[] => {
    const record = asRecord(item);
    if (typeof record?.id !== "string" || typeof record.nome !== "string") return [];
    const bonusAtributos = parseBonusAtributos(record.bonusAtributos);
    const effect = asRecord(record.efeitoMecanico);
    const recurso = effect?.recurso;
    const efeitoMecanico: InventoryItem["efeitoMecanico"] = effect?.tipo === "ATRIBUTO" &&
      typeof effect.atributo === "string" && ATTRIBUTE_KEYS.includes(effect.atributo as keyof Attributes) &&
      typeof effect.valor === "number" && Number.isFinite(effect.valor)
      ? { tipo: "ATRIBUTO", atributo: effect.atributo as keyof Attributes, valor: integer(effect.valor) }
      : effect?.tipo === "RECURSO" &&
          (recurso === "hp" || recurso === "mp") &&
          typeof effect.valor === "number" && Number.isFinite(effect.valor)
        ? { tipo: "RECURSO", recurso, valor: integer(effect.valor) }
        : effect?.tipo === "NENHUM"
          ? { tipo: "NENHUM" }
          : null;
    return [{
      id: record.id,
      nome: record.nome,
      quantidade: integer(record.quantidade, 0, 0, 999999),
      ...(optionalText(record.descricao) !== undefined ? { descricao: record.descricao as string } : {}),
      ...(optionalText(record.imagemUrl) !== undefined ? { imagemUrl: record.imagemUrl as string } : {}),
      ...(typeof record.equipado === "boolean" ? { equipado: record.equipado } : {}),
      ...(bonusAtributos ? { bonusAtributos } : {}),
      ...(typeof record.cargas === "number" || record.cargas === null ? { cargas: record.cargas } : {}),
      ...(typeof record.cargasMaximas === "number" || record.cargasMaximas === null ? { cargasMaximas: record.cargasMaximas } : {}),
      ...(efeitoMecanico ? { efeitoMecanico } : {}),
    }];
  });
}

function parseSpells(value: unknown): Spell[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Spell[] => {
    const record = asRecord(item);
    if (typeof record?.id !== "string" || typeof record.nome !== "string") return [];
    return [{
      id: record.id,
      nome: record.nome,
      custo: integer(record.custo, 0, 0, LIMITE_RECURSO),
      descricao: typeof record.descricao === "string" ? record.descricao : "",
    }];
  });
}

function parseWallet(value: unknown): Wallet | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  return {
    pc: integer(record.pc, 0, 0, 9999999),
    pp: integer(record.pp, 0, 0, 9999999),
    pe: integer(record.pe, 0, 0, 9999999),
    po: integer(record.po, 0, 0, 9999999),
    pl: integer(record.pl, 0, 0, 9999999),
  };
}

/**
 * Decodifica o JSONB de personagens, aceitando o formato legado sem versão e V1.
 * Máximos de PV/PM legados são deliberadamente descartados: agora são derivados
 * das regras efetivas; valores atuais e temporários permanecem estado persistido.
 */
export function parseCharacterData(value: unknown): CharacterDataV1 | null {
  const record = asRecord(value);
  if (!record || (record.schemaVersion !== undefined && record.schemaVersion !== 1)) {
    return null;
  }

  const attributes = parseAttributes(record.attributes);
  if (!attributes) return null;

  const preserved = { ...record };
  delete preserved.id;
  delete preserved.campanhaId;
  delete preserved.dataVersion;
  delete preserved.xp;

  const character = {
    ...preserved,
    schemaVersion: 1 as const,
    nome: typeof record.nome === "string" ? record.nome : "Aventureiro",
    raca: typeof record.raca === "string" ? record.raca : "Humano",
    classe: typeof record.classe === "string" ? record.classe : "Aventureiro",
    ...(typeof record.classeId === "string" ? { classeId: record.classeId } : {}),
    nivel: integer(record.nivel, 1, 1, 20),
    ...(typeof record.portraitUrl === "string" ? { portraitUrl: record.portraitUrl } : {}),
    ...(typeof record.alinhamento === "string" ? { alinhamento: record.alinhamento } : {}),
    ...(typeof record.qualidades === "string" ? { qualidades: record.qualidades } : {}),
    ...(typeof record.origem === "string" ? { origem: record.origem } : {}),
    ...(typeof record.idade === "string" ? { idade: record.idade } : {}),
    ...(typeof record.historia === "string" ? { historia: record.historia } : {}),
    ...(typeof record.aparencia === "string" ? { aparencia: record.aparencia } : {}),
    ...(typeof record.objetivo === "string" ? { objetivo: record.objetivo } : {}),
    ...(typeof record.defeito === "string" ? { defeito: record.defeito } : {}),
    ...(typeof record.filiacao === "string" ? { filiacao: record.filiacao } : {}),
    ...(typeof record.altura === "number" && Number.isFinite(record.altura) ? { altura: record.altura } : {}),
    ...(typeof record.tracos === "string" ? { tracos: record.tracos } : {}),
    ...(typeof record.defeitos === "string" ? { defeitos: record.defeitos } : {}),
    hp: parseResource(record.hp),
    mp: parseResource(record.mp),
    attributes,
    skills: parseSkills(record.skills),
    inventory: parseInventory(record.inventory),
    spells: parseSpells(record.spells),
    ...(record.carteira && asRecord(record.carteira)
      ? { carteira: parseWallet(record.carteira) }
      : {}),
    notas: typeof record.notas === "string" ? record.notas : "",
  } satisfies CharacterDataV1;

  return character;
}

/** Serializa apenas o contrato persistido, nunca metadados relacionais ou máximos derivados. */
export function serializeCharacterData(character: Character): CharacterDataV1 {
  const persistedFields: Record<string, unknown> = { ...character };
  delete persistedFields.id;
  delete persistedFields.campanhaId;
  delete persistedFields.dataVersion;
  delete persistedFields.xp;
  delete persistedFields.hp;
  delete persistedFields.mp;
  const hp = character.hp;
  const mp = character.mp;

  return {
    ...persistedFields,
    schemaVersion: 1,
    hp: {
      atual: integer(hp.atual, 0, 0, LIMITE_RECURSO),
      ...(hp.temp !== undefined ? { temp: integer(hp.temp, 0, 0, LIMITE_RECURSO) } : {}),
    },
    mp: {
      atual: integer(mp.atual, 0, 0, LIMITE_RECURSO),
      ...(mp.temp !== undefined ? { temp: integer(mp.temp, 0, 0, LIMITE_RECURSO) } : {}),
    },
  } as CharacterDataV1;
}
