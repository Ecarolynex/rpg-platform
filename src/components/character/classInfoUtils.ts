import type { Attributes } from "../../types/character";
import type { CampaignClassContent } from "../../services/api";
import {
  ATTRIBUTE_CONFIG,
  type CampaignClassBonuses,
  type ClassDefinition,
} from "../../data/personaRules";

export interface ClassInfo {
  nome: string;
  descricao: string;
  bonusAtributos: { chave: string; rotulo: string; valor: number }[];
  bonusHp: number;
  bonusMp: number;
  habilidades: { nome: string; descricao: string; nivel?: number }[];
}

type BonusAtributos = Partial<Record<keyof Attributes, number>>;
type HabilidadeBruta = { nome?: unknown; descricao?: unknown; nivel?: unknown };

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function normalizarChave(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
}

function resolverBonusCampanha(
  classeNome: string,
  classeId: string | undefined,
  bonuses: CampaignClassBonuses,
) {
  const entrada = Object.entries(bonuses).find(([key]) =>
    normalizarChave(key) === normalizarChave(classeNome) ||
    normalizarChave(key) === normalizarChave(classeId ?? ""),
  );
  return entrada?.[1];
}

/**
 * Apresenta a regra efetiva da classe, seguindo a mesma precedência do cálculo:
 * override da campanha > classe criada na campanha > catálogo global/local.
 */
export function montarInfoClasse(
  nome: string | undefined,
  classeId: string | undefined,
  catalogo: ClassDefinition[],
  conteudos: CampaignClassContent[],
  bonusCampanha: CampaignClassBonuses = {},
): ClassInfo | null {
  if (!nome) return null;

  const chaveNome = normalizarChave(nome);
  const definicao = catalogo.find(
    (item) =>
      (classeId && item.id === classeId) ||
      normalizarChave(item.nome) === chaveNome ||
      item.aliases?.some((alias) => normalizarChave(alias) === chaveNome),
  );

  const idClasse = definicao?.id ?? classeId;
  const conteudoClasse = conteudos.find(
    (item) =>
      item.tipo === "CLASSE" &&
      ((idClasse && item.classe_id === idClasse) || normalizarChave(item.nome) === chaveNome),
  );
  const override = resolverBonusCampanha(nome, idClasse, bonusCampanha);

  if (!definicao && !conteudoClasse && !override) return null;

  const descricao =
    texto(conteudoClasse?.descricao) ||
    texto((definicao as (ClassDefinition & { descricao?: unknown }) | undefined)?.descricao);

  const bonusBrutos = (override?.atributoBonus ??
    conteudoClasse?.bonus_atributos ??
    definicao?.atributoBonus ??
    {}) as BonusAtributos;

  const bonusAtributos = ATTRIBUTE_CONFIG.map(({ key, label }) => ({
    chave: String(key),
    rotulo: label,
    valor: Number(bonusBrutos[key as keyof Attributes] ?? 0) || 0,
  })).filter((item) => item.valor !== 0);

  const habilidadesDefinicao = (
    (definicao?.habilidades ?? []) as unknown as HabilidadeBruta[]
  ).map((item) => ({
    nome: texto(item?.nome),
    descricao: texto(item?.descricao),
    nivel: typeof item?.nivel === "number" ? item.nivel : undefined,
  }));

  const habilidadesCampanha = conteudos
    .filter((item) => item.tipo === "HABILIDADE" && idClasse && item.classe_id === idClasse)
    .map((item) => ({
      nome: texto(item.nome),
      descricao: texto(item.descricao),
      nivel: typeof item.nivel === "number" ? item.nivel : undefined,
    }));

  const habilidades = [...habilidadesDefinicao, ...habilidadesCampanha].filter(
    (item, index, lista) =>
      item.nome && lista.findIndex((outro) => outro.nome === item.nome) === index,
  );

  return {
    nome: definicao?.nome ?? conteudoClasse?.nome ?? nome,
    descricao,
    bonusAtributos,
    bonusHp: Number(override?.hpBonus ?? conteudoClasse?.bonus_hp ?? definicao?.hpBonus ?? 0) || 0,
    bonusMp: Number(override?.mpBonus ?? conteudoClasse?.bonus_mp ?? definicao?.mpBonus ?? 0) || 0,
    habilidades,
  };
}
