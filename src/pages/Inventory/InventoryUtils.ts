import type { Attributes, Character, InventoryItem } from "../../types/character";
import { atualizarPersonagem, getCharacterById } from "../../services/api";

export type ChaveAtributo = keyof Attributes;

export type BonusAtributos = Partial<Record<ChaveAtributo, number>>;

/**
 * Item do inventário. Os campos extras (ativo, descricao, bonus...) são opcionais,
 * então itens antigos, só com nome e quantidade, continuam funcionando.
 */
export type ItemInventario = InventoryItem & {
  /** Item equipado/ativado: só os ativos somam bônus nos atributos. */
  ativo?: boolean;
  descricao?: string;
  categoria?: string;
  raridade?: string;
  /** Id do item na loja (usado para empilhar compras repetidas). */
  lojaItemId?: string;
  /** Bônus de atributo. Aceita { Força: 2 } ou [{ atributo: "Força", valor: 2 }]. */
  bonus?: unknown;
};

export const ROTULO_ATRIBUTO: Record<ChaveAtributo, string> = {
  forca: "Força",
  destreza: "Destreza",
  constituicao: "Constituição",
  inteligencia: "Inteligência",
  carisma: "Carisma",
};

const SINONIMOS: Record<string, ChaveAtributo> = {
  forca: "forca",
  for: "forca",
  str: "forca",

  destreza: "destreza",
  des: "destreza",
  dex: "destreza",

  constituicao: "constituicao",
  con: "constituicao",

  inteligencia: "inteligencia",
  int: "inteligencia",

  carisma: "carisma",
  car: "carisma",
  cha: "carisma",
};

function normalizarChave(valor: unknown): ChaveAtributo | null {
  if (typeof valor !== "string") return null;

  const limpo = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  return SINONIMOS[limpo] ?? null;
}

function somar(destino: BonusAtributos, chave: ChaveAtributo | null, valor: unknown) {
  const numero = Number(valor);

  if (!chave || !Number.isFinite(numero) || numero === 0) return;

  destino[chave] = (destino[chave] ?? 0) + numero;
}

/** Lê o bônus de um item, em qualquer um dos formatos aceitos. */
export function extrairBonus(origem: unknown): BonusAtributos {
  const resultado: BonusAtributos = {};

  if (!origem) return resultado;

  if (Array.isArray(origem)) {
    for (const entrada of origem) {
      if (!entrada || typeof entrada !== "object") continue;

      const registro = entrada as Record<string, unknown>;

      somar(
        resultado,
        normalizarChave(
          registro.atributo ?? registro.attr ?? registro.chave ?? registro.key,
        ),
        registro.valor ?? registro.value ?? registro.quantidade ?? registro.bonus,
      );
    }

    return resultado;
  }

  if (typeof origem === "object") {
    const registro = origem as Record<string, unknown>;

    // formato { atributo: "Força", valor: 2 }
    const chaveUnica = normalizarChave(registro.atributo ?? registro.attr);
    if (chaveUnica) {
      somar(resultado, chaveUnica, registro.valor ?? registro.value);
      return resultado;
    }

    // formato { Força: 2, Destreza: 1 }
    for (const [chave, valor] of Object.entries(registro)) {
      somar(resultado, normalizarChave(chave), valor);
    }
  }

  return resultado;
}

export function bonusDoItem(item: ItemInventario): BonusAtributos {
  const registro = item as unknown as Record<string, unknown>;

  return extrairBonus(
    item.bonus ??
      registro.bonuses ??
      registro.bonusAtributos ??
      registro.bonus_atributos ??
      registro.atributoBonus,
  );
}

/** Soma o bônus de todos os itens ativos do inventário. */
export function bonusDosItensAtivos(inventario: InventoryItem[]): BonusAtributos {
  const total: BonusAtributos = {};

  for (const item of inventario as ItemInventario[]) {
    if (!item.ativo) continue;

    for (const [chave, valor] of Object.entries(bonusDoItem(item))) {
      somar(total, chave as ChaveAtributo, valor);
    }
  }

  return total;
}

/* ---------- compra na loja ---------- */

export interface ItemDaLoja {
  /** Id do item na loja. */
  id: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  raridade?: string;
  /** Bônus de atributo do item. */
  bonus?: unknown;
}

/**
 * Coloca um item comprado no inventário do personagem e salva no banco.
 * - Compras repetidas do mesmo item empilham a quantidade.
 * - O item entra desativado; o jogador ativa na ficha.
 * - Se `precoPO` for informado, o valor é descontado da carteira (PO).
 */
export async function adicionarItemAoInventario(
  personagemId: string,
  item: ItemDaLoja,
  opcoes: { quantidade?: number; precoPO?: number } = {},
): Promise<Character> {
  const quantidade = Math.max(1, Math.floor(opcoes.quantidade ?? 1));
  const preco = Math.max(0, Math.floor((opcoes.precoPO ?? 0) * quantidade));

  const personagem = await getCharacterById(personagemId);

  if (!personagem) {
    throw new Error("Personagem não encontrado.");
  }

  const carteira = personagem.carteira;
  const ouroAtual = Number(carteira?.po ?? 0);

  if (preco > ouroAtual) {
    throw new Error("Ouro insuficiente para comprar este item.");
  }

  const inventario = [...(personagem.inventory ?? [])] as ItemInventario[];

  const indiceExistente = inventario.findIndex(
    (existente) =>
      (existente.lojaItemId && existente.lojaItemId === item.id) ||
      (!existente.lojaItemId && existente.nome === item.nome),
  );

  if (indiceExistente >= 0) {
    const existente = inventario[indiceExistente];
    inventario[indiceExistente] = {
      ...existente,
      quantidade: existente.quantidade + quantidade,
    };
  } else {
    inventario.push({
      id: "item-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      nome: item.nome,
      quantidade,
      ativo: false,
      lojaItemId: item.id,
      descricao: item.descricao,
      categoria: item.categoria,
      raridade: item.raridade,
      bonus: item.bonus,
    });
  }

  return atualizarPersonagem(personagemId, {
    ...personagem,
    inventory: inventario,
    carteira:
      preco > 0 && carteira
        ? { ...carteira, po: ouroAtual - preco }
        : carteira,
  });
}
