import { ATTRIBUTE_CONFIG, type BaseAttributeKey } from "./personaRules";

export interface RaceTraitDefinition {
  id: string;
  nome: string;
  descricao: string;
}

export interface RaceDefinition {
  id: string;
  nome: string;
  /** Nomes antigos ou grafias alternativas ("Meio-orc"): personagens guardam a raça pelo nome. */
  aliases: string[];
  descricao: string;
  atributoBonus: Record<BaseAttributeKey, number>;
  hpBonus: number;
  mpBonus: number;
  tracos: RaceTraitDefinition[];
}

const ATRIBUTOS: BaseAttributeKey[] = ATTRIBUTE_CONFIG.map(({ key }) => key);

function bonusZerado(): Record<BaseAttributeKey, number> {
  return Object.fromEntries(ATRIBUTOS.map((key) => [key, 0])) as Record<BaseAttributeKey, number>;
}

function racaPadrao(
  id: string,
  nome: string,
  opcoes: {
    aliases?: string[];
    atributos?: Partial<Record<BaseAttributeKey, number>>;
    hp?: number;
    mp?: number;
    traco?: { nome: string; descricao: string };
  } = {},
): RaceDefinition {
  return {
    id,
    nome,
    aliases: opcoes.aliases ?? [],
    descricao: "",
    atributoBonus: { ...bonusZerado(), ...opcoes.atributos },
    hpBonus: opcoes.hp ?? 0,
    mpBonus: opcoes.mp ?? 0,
    tracos: opcoes.traco
      ? [{ id: `traco-${id}-1`, nome: opcoes.traco.nome, descricao: opcoes.traco.descricao }]
      : [],
  };
}

/**
 * União das duas listas que existiam no código (RACAS do seletor e RACE_BONUSES das regras).
 * Os bônus são exatamente os de RACE_BONUSES; raças que só existiam no seletor
 * (Gnomo, Halfling, Meio-elfo, Tiefling) começam sem bônus, como já se comportavam.
 */
export const DEFAULT_RACE_CATALOG: RaceDefinition[] = [
  racaPadrao("anao", "Anão", {
    atributos: { constituicao: 2 },
    hp: 10,
    traco: { nome: "Vigor da Montanha", descricao: "+2 em Constituição e +10 Pontos de Vida (PV)" },
  }),
  racaPadrao("draconato", "Draconato", {
    atributos: { forca: 2, carisma: 1 },
    traco: { nome: "Herança Dracônica", descricao: "+2 em Força e +1 em Carisma" },
  }),
  racaPadrao("elfo", "Elfo", {
    atributos: { destreza: 2 },
    mp: 5,
    traco: { nome: "Graça Élfica", descricao: "+2 em Destreza e +5 Pontos de Mana (PM)" },
  }),
  racaPadrao("gnomo", "Gnomo"),
  racaPadrao("halfling", "Halfling"),
  racaPadrao("humano", "Humano", {
    atributos: { forca: 1, destreza: 1, constituicao: 1, inteligencia: 1, carisma: 1 },
    traco: {
      nome: "Versatilidade Humana",
      descricao: "+1 em Força, Destreza, Constituição, Inteligência e Carisma",
    },
  }),
  racaPadrao("meio-elfo", "Meio-elfo"),
  racaPadrao("meio-orc", "Meio-Orc", {
    aliases: ["Meio-orc"],
    atributos: { forca: 2, constituicao: 1 },
    traco: { nome: "Fúria Implacável", descricao: "+2 em Força e +1 em Constituição" },
  }),
  racaPadrao("orc", "Orc", {
    atributos: { forca: 2 },
    hp: 6,
    traco: { nome: "Brutalidade Primitiva", descricao: "+2 em Força e +6 Pontos de Vida (PV)" },
  }),
  racaPadrao("tiefling", "Tiefling"),
];

/** Ignora acentos, maiúsculas e espaços nas pontas ("Meio-orc" = "meio-Orc", "Anão" = "ANAO"). */
export function chaveDeRaca(nome: string | null | undefined): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

export function findRaceDefinition(
  nome: string | null | undefined,
  catalogo: RaceDefinition[] = DEFAULT_RACE_CATALOG,
): RaceDefinition | undefined {
  const chave = chaveDeRaca(nome);
  if (!chave) return undefined;
  return catalogo.find(
    (raca) =>
      chaveDeRaca(raca.nome) === chave
      || raca.aliases.some((alias) => chaveDeRaca(alias) === chave),
  );
}

function textoSeguro(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().slice(0, 500) : "";
}

function numeroSeguro(valor: unknown, fallback = 0): number {
  return typeof valor === "number" && Number.isFinite(valor) ? Math.trunc(valor) : fallback;
}

export function normalizarCatalogoRacas(valor: unknown): RaceDefinition[] {
  if (!Array.isArray(valor)) return DEFAULT_RACE_CATALOG;

  return valor.flatMap((item): RaceDefinition[] => {
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
      ATRIBUTOS.map((atributo) => [atributo, numeroSeguro(bonusEntrada[atributo])]),
    ) as Record<BaseAttributeKey, number>;

    const tracos: RaceTraitDefinition[] = Array.isArray(entrada.tracos)
      ? entrada.tracos.flatMap((itemTraco): RaceTraitDefinition[] => {
          if (typeof itemTraco !== "object" || itemTraco === null) return [];
          const traco = itemTraco as Record<string, unknown>;
          const tracoId = textoSeguro(traco.id);
          const nomeTraco = textoSeguro(traco.nome);
          if (!tracoId || !nomeTraco) return [];
          return [{ id: tracoId, nome: nomeTraco, descricao: textoSeguro(traco.descricao) }];
        })
      : [];

    return [{
      id,
      nome,
      aliases: Array.isArray(entrada.aliases)
        ? [...new Set(entrada.aliases.map(textoSeguro).filter(Boolean))]
        : [],
      descricao: textoSeguro(entrada.descricao),
      atributoBonus,
      hpBonus: numeroSeguro(entrada.hpBonus),
      mpBonus: numeroSeguro(entrada.mpBonus),
      tracos,
    }];
  });
}

// ---------------------------------------------------------------------------
// Raças por campanha: o Mestre libera/bloqueia raças do catálogo global,
// ajusta bônus só para a mesa e cria raças exclusivas da campanha.
// ---------------------------------------------------------------------------

export interface CampaignRaceOverride {
  /** Impede escolher a raça em NOVOS personagens. Fichas existentes não mudam. */
  bloqueada?: boolean;
  /** Bônus de atributo que substituem os do catálogo global (só nesta campanha). */
  atributoBonus?: Partial<Record<BaseAttributeKey, number>>;
  hpBonus?: number;
  mpBonus?: number;
}

export interface CampaignRaceConfig {
  /** Chave = id da raça (estável mesmo se o nome mudar). */
  overrides: Record<string, CampaignRaceOverride>;
  exclusivas: RaceDefinition[];
}

export const EMPTY_CAMPAIGN_RACE_CONFIG: CampaignRaceConfig = { overrides: {}, exclusivas: [] };

export interface RaceResolvida extends RaceDefinition {
  origem: "GLOBAL" | "CAMPANHA";
  bloqueada: boolean;
  /** true quando o Mestre trocou os bônus do catálogo global nesta campanha. */
  personalizada: boolean;
}

function overrideTemConteudo(o: CampaignRaceOverride): boolean {
  return (
    Boolean(o.bloqueada)
    || o.atributoBonus !== undefined
    || o.hpBonus !== undefined
    || o.mpBonus !== undefined
  );
}

export function normalizarConfigRacasCampanha(valor: unknown): CampaignRaceConfig {
  if (typeof valor !== "object" || valor === null) return EMPTY_CAMPAIGN_RACE_CONFIG;
  const entrada = valor as Record<string, unknown>;

  const overrides: Record<string, CampaignRaceOverride> = {};
  if (typeof entrada.overrides === "object" && entrada.overrides !== null) {
    for (const [id, bruto] of Object.entries(entrada.overrides)) {
      if (typeof bruto !== "object" || bruto === null) continue;
      const o = bruto as Record<string, unknown>;
      const resultado: CampaignRaceOverride = {};

      if (o.bloqueada === true) resultado.bloqueada = true;

      if (typeof o.atributoBonus === "object" && o.atributoBonus !== null) {
        const bonus = o.atributoBonus as Record<string, unknown>;
        const parcial: Partial<Record<BaseAttributeKey, number>> = {};
        for (const atributo of ATRIBUTOS) {
          const v = bonus[atributo];
          if (typeof v === "number" && Number.isFinite(v)) parcial[atributo] = Math.trunc(v);
        }
        if (Object.keys(parcial).length > 0) resultado.atributoBonus = parcial;
      }

      if (typeof o.hpBonus === "number" && Number.isFinite(o.hpBonus)) {
        resultado.hpBonus = Math.trunc(o.hpBonus);
      }
      if (typeof o.mpBonus === "number" && Number.isFinite(o.mpBonus)) {
        resultado.mpBonus = Math.trunc(o.mpBonus);
      }

      if (overrideTemConteudo(resultado)) overrides[id] = resultado;
    }
  }

  const exclusivas = Array.isArray(entrada.exclusivas)
    ? normalizarCatalogoRacas(entrada.exclusivas)
    : [];

  return { overrides, exclusivas };
}

/**
 * Raças válidas numa campanha: catálogo global (com os ajustes do Mestre) + raças exclusivas.
 * Raças bloqueadas continuam na lista (com bloqueada = true) para que fichas existentes
 * mantenham os bônus; quem monta o seletor de criação é que filtra as bloqueadas.
 */
export function racasDaCampanha(
  catalogo: RaceDefinition[],
  config: CampaignRaceConfig = EMPTY_CAMPAIGN_RACE_CONFIG,
): RaceResolvida[] {
  const globais: RaceResolvida[] = catalogo.map((raca) => {
    const o = config.overrides[raca.id];
    return {
      ...raca,
      atributoBonus: o?.atributoBonus
        ? { ...raca.atributoBonus, ...o.atributoBonus }
        : raca.atributoBonus,
      hpBonus: o?.hpBonus ?? raca.hpBonus,
      mpBonus: o?.mpBonus ?? raca.mpBonus,
      origem: "GLOBAL",
      bloqueada: Boolean(o?.bloqueada),
      personalizada:
        o?.atributoBonus !== undefined || o?.hpBonus !== undefined || o?.mpBonus !== undefined,
    };
  });

  const nomesGlobais = new Set(catalogo.map((raca) => chaveDeRaca(raca.nome)));
  const exclusivas: RaceResolvida[] = config.exclusivas
    .filter((raca) => !nomesGlobais.has(chaveDeRaca(raca.nome)))
    .map((raca) => ({
      ...raca,
      origem: "CAMPANHA",
      bloqueada: Boolean(config.overrides[raca.id]?.bloqueada),
      personalizada: false,
    }));

  return [...globais, ...exclusivas];
}
