
export const CLASSES = [
  "Bardo",
  "Artífice",
  "Paladino",
  "Necromante",
  "Bárbaro",
  "Clérigo",
  "Mago",
  "Ladino",
  "Guerreiro",
] as const;
export type CharacterClass = (typeof CLASSES)[number];

export const RACES = [
  "Humano",
  "Elfo",
  "Anão",
  "Meio-Orc",
  "Orc",
  "Draconato",
] as const;
export type CharacterRace = (typeof RACES)[number];

export const AFFILIATIONS = [
  "Colégio de Magos Arcanum",
  "Ordem da Presa do Lobo",
  "Sombras Urbanas",
] as const;
export type CharacterAffiliation = (typeof AFFILIATIONS)[number];

export type BaseAttributeKey = "forca" | "destreza" | "constituicao" | "inteligencia" | "carisma";

export interface ClassBonusConfig {
  atributoBonus: Record<BaseAttributeKey, number>;
  hpBonus: number;
  mpBonus: number;
}

export type CampaignClassBonuses = Record<string, ClassBonusConfig>;

export interface ClassSkillDefinition {
  id: string;
  nome: string;
  atributo: BaseAttributeKey;
  descricao: string;
}

export interface ClassAbilityDefinition {
  id: string;
  nome: string;
  descricao: string;
  nivel: number;
}

export interface ClassDefinition extends ClassBonusConfig {
  id: string;
  nome: string;
  aliases: string[];
  pericias: ClassSkillDefinition[];
  habilidades: ClassAbilityDefinition[];
}

export const ATTRIBUTE_CONFIG: {
  key: BaseAttributeKey;
  label: string;
  abbr: string;
}[] = [
  { key: "forca", label: "Força", abbr: "FOR" },
  { key: "destreza", label: "Destreza", abbr: "DES" },
  { key: "constituicao", label: "Constituição", abbr: "CON" },
  { key: "inteligencia", label: "Inteligência", abbr: "INT" },
  { key: "carisma", label: "Carisma", abbr: "CAR" },
];

export interface FixedSkillDefinition {
  id: string;
  nome: string;
  atributo: BaseAttributeKey;
  atributoSigla: string;
}

export const FIXED_SKILLS: FixedSkillDefinition[] = [
  { id: "acrobacia", nome: "Acrobacia", atributo: "destreza", atributoSigla: "DES" },
  { id: "arcanismo", nome: "Arcanismo", atributo: "inteligencia", atributoSigla: "INT" },
  { id: "atletismo", nome: "Atletismo", atributo: "forca", atributoSigla: "FOR" },
  { id: "atuacao", nome: "Atuação", atributo: "carisma", atributoSigla: "CAR" },
  { id: "blefar", nome: "Blefar", atributo: "carisma", atributoSigla: "CAR" },
  { id: "furtividade", nome: "Furtividade", atributo: "destreza", atributoSigla: "DES" },
  { id: "historia", nome: "História", atributo: "inteligencia", atributoSigla: "INT" },
  { id: "intimidacao", nome: "Intimidação", atributo: "carisma", atributoSigla: "CAR" },
  { id: "investigacao", nome: "Investigação", atributo: "inteligencia", atributoSigla: "INT" },
  { id: "persuasao", nome: "Persuasão", atributo: "carisma", atributoSigla: "CAR" },
  { id: "religiao", nome: "Religião", atributo: "inteligencia", atributoSigla: "INT" },
];

export interface PersonaBonusDefinition {
  origem: "Classe" | "Raça" | "Filiação";
  nome: string;
  categoria: string;
  descricao: string;
  atributoBonus?: Partial<Record<BaseAttributeKey, number>>;
  hpBonus?: number;
  mpBonus?: number;
}

/**
 * Tabelas de Bônus Automáticos para Persona.
 * Estruturadas de forma modular para fácil substituição/atualização
 * assim que as tabelas finais forem fornecidas.
 */
export const RACE_BONUSES: Record<string, PersonaBonusDefinition> = {
  Humano: {
    origem: "Raça",
    categoria: "Humano",
    nome: "Versatilidade Humana",
    descricao: "+1 em Força, Destreza, Constituição, Inteligência e Carisma",
    atributoBonus: { forca: 1, destreza: 1, constituicao: 1, inteligencia: 1, carisma: 1 },
  },
  Elfo: {
    origem: "Raça",
    categoria: "Elfo",
    nome: "Graça Élfica",
    descricao: "+2 em Destreza e +5 Pontos de Mana (PM)",
    atributoBonus: { destreza: 2 },
    mpBonus: 5,
  },
  Anão: {
    origem: "Raça",
    categoria: "Anão",
    nome: "Vigor da Montanha",
    descricao: "+2 em Constituição e +10 Pontos de Vida (PV)",
    atributoBonus: { constituicao: 2 },
    hpBonus: 10,
  },
  "Meio-Orc": {
    origem: "Raça",
    categoria: "Meio-Orc",
    nome: "Fúria Implacável",
    descricao: "+2 em Força e +1 em Constituição",
    atributoBonus: { forca: 2, constituicao: 1 },
  },
  Orc: {
    origem: "Raça",
    categoria: "Orc",
    nome: "Brutalidade Primitiva",
    descricao: "+2 em Força e +6 Pontos de Vida (PV)",
    atributoBonus: { forca: 2 },
    hpBonus: 6,
  },
  Draconato: {
    origem: "Raça",
    categoria: "Draconato",
    nome: "Herança Dracônica",
    descricao: "+2 em Força e +1 em Carisma",
    atributoBonus: { forca: 2, carisma: 1 },
  },
};

export const CLASS_BONUSES: Record<string, PersonaBonusDefinition> = {
  Bardo: {
    origem: "Classe",
    categoria: "Bardo",
    nome: "Inspiração Artística",
    descricao: "+2 em Carisma e +6 Pontos de Mana (PM)",
    atributoBonus: { carisma: 2 },
    mpBonus: 6,
  },
  Artífice: {
    origem: "Classe",
    categoria: "Artífice",
    nome: "Engenho Arcano",
    descricao: "+2 em Inteligência e +5 Pontos de Mana (PM)",
    atributoBonus: { inteligencia: 2 },
    mpBonus: 5,
  },
  Paladino: {
    origem: "Classe",
    categoria: "Paladino",
    nome: "Juramento Divino",
    descricao: "+2 em Força, +1 em Carisma e +8 Pontos de Vida (PV)",
    atributoBonus: { forca: 2, carisma: 1 },
    hpBonus: 8,
  },
  Necromante: {
    origem: "Classe",
    categoria: "Necromante",
    nome: "Comunhão Sombria",
    descricao: "+2 em Inteligência e +8 Pontos de Mana (PM)",
    atributoBonus: { inteligencia: 2 },
    mpBonus: 8,
  },
  Bárbaro: {
    origem: "Classe",
    categoria: "Bárbaro",
    nome: "Fúria Berserker",
    descricao: "+2 em Força e +12 Pontos de Vida (PV)",
    atributoBonus: { forca: 2 },
    hpBonus: 12,
  },
  Clérigo: {
    origem: "Classe",
    categoria: "Clérigo",
    nome: "Bênção da Fé",
    descricao: "+1 em Constituição, +1 em Carisma, +5 PV e +5 PM",
    atributoBonus: { constituicao: 1, carisma: 1 },
    hpBonus: 5,
    mpBonus: 5,
  },
  Mago: {
    origem: "Classe",
    categoria: "Mago",
    nome: "Arcanismo Primordial",
    descricao: "+2 em Inteligência e +10 Pontos de Mana (PM)",
    atributoBonus: { inteligencia: 2 },
    mpBonus: 10,
  },
  Ladino: {
    origem: "Classe",
    categoria: "Ladino",
    nome: "Astúcia das Sombras",
    descricao: "+2 em Destreza e +1 em Carisma",
    atributoBonus: { destreza: 2, carisma: 1 },
  },
  Guerreiro: {
    origem: "Classe",
    categoria: "Guerreiro",
    nome: "Técnica de Combate",
    descricao: "+2 em Força e +10 Pontos de Vida (PV)",
    atributoBonus: { forca: 2 },
    hpBonus: 10,
  },
};

const classeId = (nome: string) =>
  nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const DEFAULT_CLASS_CATALOG: ClassDefinition[] = Object.entries(
  CLASS_BONUSES,
).map(([nome, bonus]) => ({
  id: classeId(nome),
  nome,
  aliases: [],
  atributoBonus: {
    forca: bonus.atributoBonus?.forca ?? 0,
    destreza: bonus.atributoBonus?.destreza ?? 0,
    constituicao: bonus.atributoBonus?.constituicao ?? 0,
    inteligencia: bonus.atributoBonus?.inteligencia ?? 0,
    carisma: bonus.atributoBonus?.carisma ?? 0,
  },
  hpBonus: bonus.hpBonus ?? 0,
  mpBonus: bonus.mpBonus ?? 0,
  pericias: [],
  habilidades: [],
}));

function textoSeguro(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().slice(0, 500) : "";
}

function numeroSeguro(valor: unknown, fallback = 0): number {
  return typeof valor === "number" && Number.isFinite(valor)
    ? Math.trunc(valor)
    : fallback;
}

const ATRIBUTOS_BASE: BaseAttributeKey[] = [
  "forca",
  "destreza",
  "constituicao",
  "inteligencia",
  "carisma",
];

export function normalizarCatalogoClasses(valor: unknown): ClassDefinition[] {
  if (!Array.isArray(valor)) return DEFAULT_CLASS_CATALOG;

  return valor.flatMap((item): ClassDefinition[] => {
    if (typeof item !== "object" || item === null) return [];
    const entrada = item as Record<string, unknown>;
    const id = textoSeguro(entrada.id);
    const nome = textoSeguro(entrada.nome);
    if (!id || !nome) return [];
    const bonusEntrada =
      typeof entrada.atributoBonus === "object" && entrada.atributoBonus !== null
        ? (entrada.atributoBonus as Record<string, unknown>)
        : {};
    const atributoBonus = Object.fromEntries(
      ATRIBUTOS_BASE.map((atributo) => [
        atributo,
        numeroSeguro(bonusEntrada[atributo]),
      ]),
    ) as Record<BaseAttributeKey, number>;
    const pericias: ClassSkillDefinition[] = Array.isArray(entrada.pericias)
      ? entrada.pericias.flatMap((itemPericia): ClassSkillDefinition[] => {
          if (typeof itemPericia !== "object" || itemPericia === null) return [];
          const pericia = itemPericia as Record<string, unknown>;
          const periciaId = textoSeguro(pericia.id);
          const nomePericia = textoSeguro(pericia.nome);
          const atributo = pericia.atributo;
          if (
            !periciaId ||
            !nomePericia ||
            typeof atributo !== "string" ||
            !ATRIBUTOS_BASE.includes(atributo as BaseAttributeKey)
          ) return [];
          return [{
            id: periciaId,
            nome: nomePericia,
            atributo: atributo as BaseAttributeKey,
            descricao: textoSeguro(pericia.descricao),
          }];
        })
      : [];
    const habilidades: ClassAbilityDefinition[] = Array.isArray(entrada.habilidades)
      ? entrada.habilidades.flatMap((itemHabilidade): ClassAbilityDefinition[] => {
          if (typeof itemHabilidade !== "object" || itemHabilidade === null) return [];
          const habilidade = itemHabilidade as Record<string, unknown>;
          const habilidadeId = textoSeguro(habilidade.id);
          const nomeHabilidade = textoSeguro(habilidade.nome);
          if (!habilidadeId || !nomeHabilidade) return [];
          return [{
            id: habilidadeId,
            nome: nomeHabilidade,
            descricao: textoSeguro(habilidade.descricao),
            nivel: Math.max(1, Math.min(20, numeroSeguro(habilidade.nivel, 1))),
          }];
        })
      : [];

    return [{
      id,
      nome,
      aliases: Array.isArray(entrada.aliases)
        ? entrada.aliases.map(textoSeguro).filter(Boolean)
        : [],
      atributoBonus,
      hpBonus: numeroSeguro(entrada.hpBonus),
      mpBonus: numeroSeguro(entrada.mpBonus),
      pericias,
      habilidades,
    }];
  });
}

export function normalizarBonusClassesCampanha(
  valores?: unknown,
  incluirPadroes = true,
): CampaignClassBonuses {
  const entrada =
    typeof valores === "object" && valores !== null
      ? (valores as Record<string, unknown>)
      : {};
  const resultado: CampaignClassBonuses = {};

  for (const [classe, definicao] of incluirPadroes
    ? Object.entries(CLASS_BONUSES)
    : []) {
    const personalizado =
      typeof entrada[classe] === "object" && entrada[classe] !== null
        ? (entrada[classe] as Record<string, unknown>)
        : {};
    const atributosPersonalizados =
      typeof personalizado.atributoBonus === "object" &&
      personalizado.atributoBonus !== null
        ? (personalizado.atributoBonus as Record<string, unknown>)
        : {};
    const atributoBonus: Record<BaseAttributeKey, number> = {
      forca: definicao.atributoBonus?.forca ?? 0,
      destreza: definicao.atributoBonus?.destreza ?? 0,
      constituicao: definicao.atributoBonus?.constituicao ?? 0,
      inteligencia: definicao.atributoBonus?.inteligencia ?? 0,
      carisma: definicao.atributoBonus?.carisma ?? 0,
    };

    for (const atributo of Object.keys(atributoBonus) as BaseAttributeKey[]) {
      const valor = atributosPersonalizados[atributo];
      if (typeof valor === "number" && Number.isFinite(valor)) {
        atributoBonus[atributo] = Math.trunc(valor);
      }
    }

    resultado[classe] = {
      atributoBonus,
      hpBonus:
        typeof personalizado.hpBonus === "number" &&
        Number.isFinite(personalizado.hpBonus)
          ? Math.trunc(personalizado.hpBonus)
          : definicao.hpBonus ?? 0,
      mpBonus:
        typeof personalizado.mpBonus === "number" &&
        Number.isFinite(personalizado.mpBonus)
          ? Math.trunc(personalizado.mpBonus)
          : definicao.mpBonus ?? 0,
    };
  }

  for (const [classe, entradaClasse] of Object.entries(entrada)) {
    if (classe in resultado || typeof entradaClasse !== "object" || entradaClasse === null) {
      continue;
    }
    const personalizado = entradaClasse as Record<string, unknown>;
    const atributos =
      typeof personalizado.atributoBonus === "object" && personalizado.atributoBonus !== null
        ? (personalizado.atributoBonus as Record<string, unknown>)
        : {};
    const atributoBonus = Object.fromEntries(
      ATRIBUTOS_BASE.map((atributo) => [
        atributo,
        numeroSeguro(atributos[atributo]),
      ]),
    ) as Record<BaseAttributeKey, number>;
    resultado[classe] = {
      atributoBonus,
      hpBonus: numeroSeguro(personalizado.hpBonus),
      mpBonus: numeroSeguro(personalizado.mpBonus),
    };
  }

  return resultado;
}

export function obterBonusClasse(
  classe: string,
  bonusesCampanha?: CampaignClassBonuses,
  catalogo?: ClassDefinition[],
): ClassBonusConfig {
  const campanha = bonusesCampanha?.[classe];
  const definicaoCatalogo = (catalogo ?? DEFAULT_CLASS_CATALOG).find(
    (item) => item.nome === classe || item.aliases.includes(classe),
  );
  const definicao = definicaoCatalogo
    ? {
        atributoBonus: definicaoCatalogo.atributoBonus,
        hpBonus: definicaoCatalogo.hpBonus,
        mpBonus: definicaoCatalogo.mpBonus,
      }
    : CLASS_BONUSES[classe];

  return campanha ?? {
    atributoBonus: {
      forca: definicao?.atributoBonus?.forca ?? 0,
      destreza: definicao?.atributoBonus?.destreza ?? 0,
      constituicao: definicao?.atributoBonus?.constituicao ?? 0,
      inteligencia: definicao?.atributoBonus?.inteligencia ?? 0,
      carisma: definicao?.atributoBonus?.carisma ?? 0,
    },
    hpBonus: definicao?.hpBonus ?? 0,
    mpBonus: definicao?.mpBonus ?? 0,
  };
}

export const AFFILIATION_BONUSES: Record<string, PersonaBonusDefinition> = {
  "Colégio de Magos Arcanum": {
    origem: "Filiação",
    categoria: "Colégio de Magos Arcanum",
    nome: "Segredos da Academia",
    descricao: "+1 em Inteligência e +6 Pontos de Mana (PM)",
    atributoBonus: { inteligencia: 1 },
    mpBonus: 6,
  },
  "Ordem da Presa do Lobo": {
    origem: "Filiação",
    categoria: "Ordem da Presa do Lobo",
    nome: "Instinto de Caça",
    descricao: "+1 em Constituição e +6 Pontos de Vida (PV)",
    atributoBonus: { constituicao: 1 },
    hpBonus: 6,
  },
  "Sombras Urbanas": {
    origem: "Filiação",
    categoria: "Sombras Urbanas",
    nome: "Rede Clandestina",
    descricao: "+1 em Destreza e +1 em Carisma",
    atributoBonus: { destreza: 1, carisma: 1 },
  },
};

/**
 * Calcula o bônus/modificador padrão de D&D simplificado: floor((valor - 10) / 2)
 */
export function calculateAttributeModifier(value: number): number {
  const safeVal = Number.isFinite(value) ? value : 10;
  return Math.floor((safeVal - 10) / 2);
}

/**
 * Formata o modificador para exibição (+2, -1, +0)
 */
export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

/**
 * Retorna todos os bônus automáticos acumulados de Raça, Classe e Filiação
 */
export function getActivePersonaBonuses(
  raca?: string,
  classe?: string,
  filiacao?: string
): PersonaBonusDefinition[] {
  const bonuses: PersonaBonusDefinition[] = [];

  if (raca && RACE_BONUSES[raca]) {
    bonuses.push(RACE_BONUSES[raca]);
  }
  if (classe && CLASS_BONUSES[classe]) {
    bonuses.push(CLASS_BONUSES[classe]);
  }
  if (filiacao && AFFILIATION_BONUSES[filiacao]) {
    bonuses.push(AFFILIATION_BONUSES[filiacao]);
  }

  return bonuses;
}

/**
 * Calcula os bônus totais agregados para cada atributo, HP e MP
 */
export function calculateTotalPersonaBonuses(
  raca?: string,
  classe?: string,
  filiacao?: string,
  bonusesCampanha?: CampaignClassBonuses,
  catalogo?: ClassDefinition[],
): {
  attributeBonuses: Record<BaseAttributeKey, number>;
  hpBonus: number;
  mpBonus: number;
} {
  const active = getActivePersonaBonuses(raca, undefined, filiacao);
  const bonusCatalogo = classe
    ? (catalogo ?? DEFAULT_CLASS_CATALOG).find(
        (item) => item.nome === classe || item.aliases.includes(classe),
      )
    : undefined;
  const bonusClasse = classe
    ? bonusesCampanha?.[classe] ?? bonusCatalogo ?? CLASS_BONUSES[classe]
    : undefined;
  const attributeBonuses: Record<BaseAttributeKey, number> = {
    forca: 0,
    destreza: 0,
    constituicao: 0,
    inteligencia: 0,
    carisma: 0,
  };
  let hpBonus = 0;
  let mpBonus = 0;

  for (const bonus of active) {
    if (bonus.hpBonus) hpBonus += bonus.hpBonus;
    if (bonus.mpBonus) mpBonus += bonus.mpBonus;
    if (bonus.atributoBonus) {
      for (const [attr, val] of Object.entries(bonus.atributoBonus)) {
        if (attr in attributeBonuses && typeof val === "number") {
          attributeBonuses[attr as BaseAttributeKey] += val;
        }
      }
    }
  }

  if (bonusClasse) {
    hpBonus += bonusClasse.hpBonus ?? 0;
    mpBonus += bonusClasse.mpBonus ?? 0;
    for (const [attr, val] of Object.entries(bonusClasse.atributoBonus ?? {})) {
      if (attr in attributeBonuses && typeof val === "number") {
        attributeBonuses[attr as BaseAttributeKey] += val;
      }
    }
  }

  return { attributeBonuses, hpBonus, mpBonus };
}
