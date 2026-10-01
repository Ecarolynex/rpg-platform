import { beforeEach, expect, it, vi } from "vitest";
import {
  adicionarItemExistenteNaLoja,
  comprarCarrinho,
  excluirCampanha,
  removerItemDaLoja,
  salvarItemDaLoja,
  vincularPersonagem,
} from "./api";

const { getUser, from, rpc } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: { getUser },
    from,
    rpc,
  },
}));

const zeroWallet = { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 };

describe("comprarCarrinho", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envia o personagem e o carrinho à transação do Supabase", async () => {
    rpc.mockResolvedValue({
      data: {
        personagem_id: "character-1",
        saldo_po: 750,
        total_gasto: 500,
      },
      error: null,
    });

    await comprarCarrinho("character-1", [
      { lojaItemId: "store-item-1", quantidade: 2 },
    ]);

    expect(rpc).toHaveBeenCalledWith("registrar_compra_carrinho", {
      p_personagem_id: "character-1",
      p_itens: [{ loja_item_id: "store-item-1", quantidade: 2 }],
    });
  });
});

describe("administração do catálogo da loja", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("salva uma carta nova no catálogo e na loja da campanha", async () => {
    rpc.mockResolvedValue({
      data: { loja_id: "shop-1", loja_item_id: "offer-1", item_id: "catalog-1" },
      error: null,
    });

    const saved = await salvarItemDaLoja({
      campanhaId: "campaign-1",
      nome: "Capa Arcana",
      descricao: "Capa de teste",
      tipo: "ARMADURA",
      raridade: "INCOMUM",
      efeito: "+2 em Inteligência",
      imagemUrl: null,
      precoCompra: 400,
      estoque: 2,
      ativo: true,
    });

    expect(rpc).toHaveBeenCalledWith("salvar_item_loja", expect.objectContaining({
      p_campanha_id: "campaign-1",
      p_nome: "Capa Arcana",
      p_preco_compra: 400,
      p_estoque: 2,
    }));
    expect(saved.id).toBe("offer-1");
    expect(saved.itemId).toBe("catalog-1");
  });

  it("reutiliza e remove ofertas por campanha", async () => {
    rpc
      .mockResolvedValueOnce({ data: "offer-2", error: null })
      .mockResolvedValueOnce({ data: true, error: null });

    await adicionarItemExistenteNaLoja("campaign-1", "catalog-1", 300, 4);
    await removerItemDaLoja("campaign-1", "offer-2");

    expect(rpc).toHaveBeenNthCalledWith(1, "adicionar_item_existente_loja", {
      p_campanha_id: "campaign-1",
      p_item_id: "catalog-1",
      p_preco_compra: 300,
      p_estoque: 4,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "remover_item_loja", {
      p_campanha_id: "campaign-1",
      p_loja_item_id: "offer-2",
    });
  });
});

describe("vincularPersonagem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("zera todas as moedas ao vincular o personagem à campanha", async () => {
    const membershipQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "membership-1" }, error: null }),
    };
    membershipQuery.select.mockReturnValue(membershipQuery);
    membershipQuery.eq.mockReturnValue(membershipQuery);

    const characterRow = {
      id: "character-1",
      user_id: "user-1",
      campanha_id: null,
      nome: "Aventureiro",
      nivel: 1,
      dados: {
        nome: "Aventureiro",
        raca: "Humano",
        classe: "Guerreiro",
        nivel: 1,
        hp: { atual: 10, max: 10 },
        mp: { atual: 0, max: 0 },
        attributes: {
          forca: 10,
          destreza: 10,
          constituicao: 10,
          inteligencia: 10,
          sabedoria: 10,
          carisma: 10,
        },
        skills: [],
        inventory: [],
        spells: [],
        carteira: { pc: 12, pp: 3, pe: 1, po: 1250, pl: 2 },
        notas: "",
      },
    };

    const characterQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: characterRow, error: null }),
    };
    characterQuery.select.mockReturnValue(characterQuery);
    characterQuery.eq.mockReturnValue(characterQuery);

    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          ...characterRow,
          campanha_id: "campaign-1",
          dados: { ...characterRow.dados, carteira: zeroWallet },
        },
        error: null,
      }),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockReturnValue(updateQuery);

    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    from
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(characterQuery)
      .mockReturnValueOnce(updateQuery);

    const result = await vincularPersonagem("character-1", "campaign-1");

    expect(updateQuery.update).toHaveBeenCalledWith({
      campanha_id: "campaign-1",
      dados: expect.objectContaining({ carteira: zeroWallet }),
    });
    expect(result.carteira).toEqual(zeroWallet);
  });
});

describe("excluirCampanha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recusa a exclusão quando o usuário não é mestre", async () => {
    const membershipQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { papel: "JOGADOR" }, error: null }),
    };
    membershipQuery.select.mockReturnValue(membershipQuery);
    membershipQuery.eq.mockReturnValue(membershipQuery);

    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    from.mockReturnValueOnce(membershipQuery);

    await expect(excluirCampanha("campaign-1")).rejects.toThrow(
      "Somente o Mestre pode excluir esta campanha.",
    );
    expect(from).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith("campanha_membros");
  });
});
