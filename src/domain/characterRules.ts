import {
  calcularManaMaxima,
  calcularVidaMaxima,
  LIMITE_RECURSO,
} from "../data/dnd";
import {
  AFFILIATION_BONUSES,
  CLASS_BONUSES,
  DEFAULT_CLASS_CATALOG,
  RACE_BONUSES,
  type BaseAttributeKey,
  type CampaignClassBonuses,
  type ClassDefinition,
  type PersonaBonusDefinition,
} from "../data/personaRules";
import type { Attributes, Character, InventoryItem } from "../types/character";

export interface CampaignClassRule {
  classe_id: string;
  tipo: string;
  nome: string;
  bonus_atributos?: Partial<Record<BaseAttributeKey, number>> | null;
  bonus_hp?: number | null;
  bonus_mp?: number | null;
}

export interface CharacterRulesContext {
  classCatalog?: ClassDefinition[];
  campaignClassBonuses?: CampaignClassBonuses;
  campaignClassContents?: CampaignClassRule[];
  equippedItemBonuses?: Partial<Record<BaseAttributeKey, number>>[];
  serverResourceMaximums?: { hpMax: number; mpMax: number };
}

export interface CharacterRuleBreakdown {
  raca: Record<BaseAttributeKey, number>;
  classe: Record<BaseAttributeKey, number>;
  filiacao: Record<BaseAttributeKey, number>;
  equipamento: Record<BaseAttributeKey, number>;
  hp: { raca: number; classe: number; filiacao: number };
  mp: { raca: number; classe: number; filiacao: number };
}

export interface DerivedCharacterStats {
  attributesBase: Attributes;
  attributeBonuses: Record<BaseAttributeKey, number>;
  attributesFinal: Attributes;
  breakdown: CharacterRuleBreakdown;
  hpMax: number;
  mpMax: number;
}

const ATTRIBUTE_KEYS: BaseAttributeKey[] = [
  "forca",
  "destreza",
  "constituicao",
  "inteligencia",
  "carisma",
];
const emptyAttributes = (): Record<BaseAttributeKey, number> => ({
  forca: 0,
  destreza: 0,
  constituicao: 0,
  inteligencia: 0,
  carisma: 0,
});

const normalizeKey = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();

function findPersonaBonus(
  catalog: Record<string, PersonaBonusDefinition>,
  key?: string,
): PersonaBonusDefinition | undefined {
  if (!key) return undefined;
  const entry = Object.entries(catalog).find(([name]) => normalizeKey(name) === normalizeKey(key));
  return entry?.[1];
}

function addAttributeBonus(
  target: Record<BaseAttributeKey, number>,
  bonus?: Partial<Record<BaseAttributeKey, number>> | null,
): void {
  if (!bonus) return;
  for (const attribute of ATTRIBUTE_KEYS) {
    const value = bonus[attribute];
    if (typeof value === "number" && Number.isFinite(value)) {
      target[attribute] += Math.trunc(value);
    }
  }
}

function getClassDefinition(
  character: Pick<Character, "classe" | "classeId">,
  catalog: ClassDefinition[],
): ClassDefinition | undefined {
  return catalog.find((definition) =>
    (character.classeId && definition.id === character.classeId) ||
    normalizeKey(definition.nome) === normalizeKey(character.classe) ||
    definition.aliases.some((alias) => normalizeKey(alias) === normalizeKey(character.classe)),
  );
}

function getCampaignOverride(
  character: Pick<Character, "classe" | "classeId">,
  overrides?: CampaignClassBonuses,
) {
  if (!overrides) return undefined;
  const entry = Object.entries(overrides).find(([key]) =>
    normalizeKey(key) === normalizeKey(character.classe) ||
    normalizeKey(key) === normalizeKey(character.classeId ?? ""),
  );
  return entry?.[1];
}

function getCampaignClassContent(
  character: Pick<Character, "classe" | "classeId">,
  contents: CampaignClassRule[] = [],
) {
  return contents.find((content) =>
    content.tipo === "CLASSE" && (
      (character.classeId && content.classe_id === character.classeId) ||
      normalizeKey(content.nome) === normalizeKey(character.classe)
    ),
  );
}

function getEquipmentBonuses(
  character: Pick<Character, "inventory">,
  context: CharacterRulesContext,
): Partial<Record<BaseAttributeKey, number>>[] {
  if (context.equippedItemBonuses) return context.equippedItemBonuses;
  return (character.inventory ?? [])
    .filter((item: InventoryItem) => item.equipado === true)
    .map((item) => item.bonusAtributos ?? {});
}

/** Calcula os totais sem modificar nem persistir atributos-base ou máximos derivados. */
export function calculateDerivedCharacterStats(
  character: Pick<Character, "raca" | "classe" | "classeId" | "filiacao" | "nivel" | "attributes" | "inventory">,
  context: CharacterRulesContext = {},
): DerivedCharacterStats {
  const catalog = context.classCatalog ?? DEFAULT_CLASS_CATALOG;
  const classDefinition = getClassDefinition(character, catalog);
  const override = getCampaignOverride(character, context.campaignClassBonuses);
  const campaignClass = getCampaignClassContent(character, context.campaignClassContents);
  const raceBonus = findPersonaBonus(RACE_BONUSES, character.raca);
  const affiliationBonus = findPersonaBonus(AFFILIATION_BONUSES, character.filiacao);
  const defaultClassBonus = findPersonaBonus(CLASS_BONUSES, character.classe);

  // Precedência: override explícito da campanha > classe criada na campanha > catálogo > regras locais.
  const classAttributeBonus = override?.atributoBonus
    ?? (campaignClass
      ? campaignClass.bonus_atributos
      : classDefinition?.atributoBonus ?? defaultClassBonus?.atributoBonus);
  const classHpBonus = override?.hpBonus
    ?? (campaignClass
      ? campaignClass.bonus_hp
      : classDefinition?.hpBonus ?? defaultClassBonus?.hpBonus);
  const classMpBonus = override?.mpBonus
    ?? (campaignClass
      ? campaignClass.bonus_mp
      : classDefinition?.mpBonus ?? defaultClassBonus?.mpBonus);

  const breakdown: CharacterRuleBreakdown = {
    raca: emptyAttributes(),
    classe: emptyAttributes(),
    filiacao: emptyAttributes(),
    equipamento: emptyAttributes(),
    hp: {
      raca: raceBonus?.hpBonus ?? 0,
      classe: classHpBonus ?? 0,
      filiacao: affiliationBonus?.hpBonus ?? 0,
    },
    mp: {
      raca: raceBonus?.mpBonus ?? 0,
      classe: classMpBonus ?? 0,
      filiacao: affiliationBonus?.mpBonus ?? 0,
    },
  };

  addAttributeBonus(breakdown.raca, raceBonus?.atributoBonus);
  addAttributeBonus(breakdown.classe, classAttributeBonus);
  addAttributeBonus(breakdown.filiacao, affiliationBonus?.atributoBonus);
  for (const equipmentBonus of getEquipmentBonuses(character, context)) {
    addAttributeBonus(breakdown.equipamento, equipmentBonus);
  }

  const attributeBonuses = emptyAttributes();
  const attributesFinal = {} as Attributes;
  for (const attribute of ATTRIBUTE_KEYS) {
    attributeBonuses[attribute] =
      breakdown.raca[attribute] +
      breakdown.classe[attribute] +
      breakdown.filiacao[attribute] +
      breakdown.equipamento[attribute];
    attributesFinal[attribute] = character.attributes[attribute] + attributeBonuses[attribute];
  }

  const level = Math.max(1, Math.trunc(character.nivel || 1));
  const hpMax = Math.max(1, Math.min(
    LIMITE_RECURSO,
    calcularVidaMaxima(character.classe, level, attributesFinal.constituicao) +
      breakdown.hp.raca + breakdown.hp.classe + breakdown.hp.filiacao,
  ));
  const mpMax = Math.max(0, Math.min(
    LIMITE_RECURSO,
    calcularManaMaxima(attributesFinal.inteligencia) +
      breakdown.mp.raca + breakdown.mp.classe + breakdown.mp.filiacao,
  ));

  return {
    attributesBase: { ...character.attributes },
    attributeBonuses,
    attributesFinal,
    breakdown,
    hpMax: context.serverResourceMaximums?.hpMax ?? hpMax,
    mpMax: context.serverResourceMaximums?.mpMax ?? mpMax,
  };
}
