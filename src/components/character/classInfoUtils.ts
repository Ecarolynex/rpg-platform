import type { Attributes } from "../../types/character";
import type { CampaignClassContent } from "../../services/api";
import { ATTRIBUTE_CONFIG, type ClassDefinition } from "../../data/personaRules";

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

/**
 * Junta o que existe sobre a classe: catálogo global (data/personaRules + banco)
 * e conteúdo personalizado da campanha. Retorna null se a classe não for encontrada.
 */
export function montarInfoClasse(
  nome: string | undefined,
  classeId: string | undefined,
  catalogo: ClassDefinition[],
  conteudos: CampaignClassContent[],
): ClassInfo | null {
  if (!nome) return null;

  const definicao = catalogo.find(
    (item) =>
      (classeId && item.id === classeId) ||
      item.nome === nome ||
      item.aliases?.includes(nome),
  );

  const idClasse = definicao?.id ?? classeId;

  const conteudoClasse = conteudos.find(
    (item) =>
      item.tipo === "CLASSE" &&
      ((idClasse && item.classe_id === idClasse) || item.nome === nome),
  );

  if (!definicao && !conteudoClasse) return null;

  const descricao =
    texto(conteudoClasse?.descricao) ||
    texto(
      (definicao as (ClassDefinition & { descricao?: unknown }) | undefined)
        ?.descricao,
    );

  const bonusBrutos = (definicao?.atributoBonus ??
    conteudoClasse?.bonus_atributos ??
    {}) as unknown as BonusAtributos;

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
    .filter(
      (item) =>
        (item.tipo as string) === "HABILIDADE" &&
        idClasse &&
        item.classe_id === idClasse,
    )
    .map((item) => ({
      nome: texto(item.nome),
      descricao: texto(item.descricao),
      nivel: undefined as number | undefined,
    }));

  const habilidades = [...habilidadesDefinicao, ...habilidadesCampanha].filter(
    (item, index, lista) =>
      item.nome && lista.findIndex((outro) => outro.nome === item.nome) === index,
  );

  return {
    nome: definicao?.nome ?? conteudoClasse?.nome ?? nome,
    descricao,
    bonusAtributos,
    bonusHp: Number(definicao?.hpBonus ?? conteudoClasse?.bonus_hp ?? 0) || 0,
    bonusMp: Number(definicao?.mpBonus ?? conteudoClasse?.bonus_mp ?? 0) || 0,
    habilidades,
  };
}
