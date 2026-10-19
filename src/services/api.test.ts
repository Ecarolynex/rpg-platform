import { beforeEach, expect, it, vi } from "vitest";
import {
  adicionarItemExistenteNaLoja,
  canManageGlobalClassCatalog,
  comprarCarrinho,
  creditarOuroCampanha,
  creditarExperienciaCampanha,
  criarCampanha,
  entregarItemCampanha,
  getEquippedAttributeBonusesByCharacter,
  getCampaignResourceMaximums,
  getCharacterResourceMaximums,
  listarRecompensasCampanha,
  reconciliarLimitesRecursosPersonagem,
  excluirCampanha,
  atualizarPersonagem,
  removerItemDaLoja,
  salvarBonusClassesCampanha,
  salvarItemDaLoja,
  usarItemPersonagem,
  vincularPersonagem,
} from "./api";
import {
  makeAuthoritativeResourcesFixture,
  makeCampaignResourceFixture,
  makeRewardHistoryFixture,
  rewardFixtureIds,
} from "../test/fixtures/rewards";
import { normalizarBonusClassesCampanha } from "../data/personaRules";

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


describe("atualizarPersonagem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists versioned current and manual maximum resources", async () => {
    rpc.mockImplementation(async (_name, payload) => ({
      data: {
        id: "character-1",
        campanha_id: null,
        nome: "Aventureiro",
        nivel: 1,
        dados: payload.p_dados,
        dados_version: 2,
      },
      error: null,
    }));

    await atualizarPersonagem("character-1", {
      id: "character-1",
      dataVersion: 1,
      nome: "Aventureiro",
      raca: "Humano",
      classe: "Guerreiro",
      nivel: 1,
      hp: { atual: 250, max: 250, temp: 7 },
      mp: { atual: 240, max: 240 },
      attributes: {
        forca: 10,
        destreza: 10,
        constituicao: 10,
        inteligencia: 10,
        carisma: 10,
      },
      skills: [],
      inventory: [],
      spells: [],
      notas: "",
    });

    const payload = rpc.mock.calls[0][1];
    expect(payload.p_versao_esperada).toBe(1);
    expect(payload.p_dados.schemaVersion).toBe(1);
    expect(payload.p_dados.hp).toEqual({ atual: 250, max: 250, temp: 7 });
    expect(payload.p_dados.mp).toEqual({ atual: 240, max: 240 });
  });
});

describe("canManageGlobalClassCatalog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses only the trusted app-metadata claim", async () => {
    getUser.mockResolvedValue({
      data: { user: { app_metadata: { global_rules_admin: true } } },
      error: null,
    });
    await expect(canManageGlobalClassCatalog()).resolves.toBe(true);

    getUser.mockResolvedValue({
      data: { user: { app_metadata: { global_rules_admin: "true" } } },
      error: null,
    });
    await expect(canManageGlobalClassCatalog()).resolves.toBe(false);
  });
});

describe("usarItemPersonagem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not send client-provided resource maxima", async () => {
    rpc.mockResolvedValue({
      data: {
        personagem_id: "character-1",
        hp: { atual: 12 },
        mp: null,
        quantidade: 1,
        hp_max: 18,
        mp_max: 18,
      },
      error: null,
    });

    await usarItemPersonagem("character-1", "potion-1");

    expect(rpc).toHaveBeenCalledWith("usar_item_personagem", {
      p_personagem_id: "character-1",
      p_item_id: "potion-1",
    });
  });
});

describe("creditarOuroCampanha", () => {
  beforeEach(() => vi.clearAllMocks());

  it("envia o crédito para a RPC de campanha, sem snapshot da personagem", async () => {
    rpc.mockResolvedValue({ data: 3, error: null });
    await expect(creditarOuroCampanha("campaign-1", 50, undefined, "req-1")).resolves.toBe(3);
    expect(rpc).toHaveBeenCalledWith("creditar_ouro_campanha", {
      p_campanha_id: "campaign-1",
      p_quantia: 50,
      p_personagem_id: null,
      p_request_id: "req-1",
    });
  });
});

describe("recompensas e sincronização", () => {
  beforeEach(() => vi.clearAllMocks());

  it("carrega máximos por campanha usando a assinatura pública da RPC", async () => {
    const maximum = makeCampaignResourceFixture();
    rpc.mockResolvedValue({ data: [maximum], error: null });

    await expect(getCampaignResourceMaximums(rewardFixtureIds.campaign)).resolves.toEqual([maximum]);
    expect(rpc).toHaveBeenCalledWith("listar_maximos_recursos_campanha", {
      p_campanha_id: rewardFixtureIds.campaign,
    });
  });

  it("carrega histórico direto da tabela com campos e ordenação esperados", async () => {
    const reward = makeRewardHistoryFixture();
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [reward], error: null });
    from.mockReturnValueOnce(query);

    await expect(listarRecompensasCampanha(rewardFixtureIds.campaign)).resolves.toEqual([reward]);
    expect(from).toHaveBeenCalledWith("campanha_recompensas");
    expect(query.eq).toHaveBeenCalledWith("campanha_id", rewardFixtureIds.campaign);
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(20);
  });

  it("envia XP e itens para RPCs com destinatário e chave de idempotência", async () => {
    rpc
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: 1, error: null });

    await creditarExperienciaCampanha("campaign-1", 125, "character-1", "xp-request");
    await entregarItemCampanha("campaign-1", "item-1", 2, "character-1", "item-request");

    expect(rpc).toHaveBeenNthCalledWith(1, "creditar_experiencia_campanha", {
      p_campanha_id: "campaign-1",
      p_quantia: 125,
      p_personagem_id: "character-1",
      p_request_id: "xp-request",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "entregar_item_campanha", {
      p_campanha_id: "campaign-1",
      p_item_id: "item-1",
      p_quantidade: 2,
      p_personagem_id: "character-1",
      p_request_id: "item-request",
    });
  });

  it("carrega máximos autoritativos sem escrever a ficha em modo de leitura", async () => {
    rpc.mockResolvedValue({
      data: makeAuthoritativeResourcesFixture({ hp_atual: 12, mp_atual: 8, hp_max: 22 }),
      error: null,
    });
    await expect(getCharacterResourceMaximums("character-1")).resolves.toMatchObject({
      hp_atual: 12, mp_atual: 8, hp_max: 22, mp_max: 16,
    });
    expect(rpc).toHaveBeenCalledWith("get_character_resource_maximums", {
      p_personagem_id: "character-1",
    });
  });

  it("consulta máximos autoritativos para fichas de leitura sem modificar dados", async () => {
    rpc.mockResolvedValue({
      data: makeAuthoritativeResourcesFixture({ hp_atual: 12, mp_atual: 8, hp_max: 22 }),
      error: null,
    });
    await expect(getCharacterResourceMaximums("character-1")).resolves.toMatchObject({
      hp_atual: 12, mp_atual: 8, hp_max: 22, mp_max: 16,
    });
    expect(rpc).toHaveBeenCalledWith("get_character_resource_maximums", {
      p_personagem_id: "character-1",
    });
  });

  it("retorna máximos calculados pelo servidor", async () => {
    const resources = makeAuthoritativeResourcesFixture({
      dados_version: 5,
      hp_atual: 16,
      mp_atual: 7,
      hp_max: 24,
      mp_max: 18,
    });
    rpc.mockResolvedValue({ data: resources, error: null });
    await expect(reconciliarLimitesRecursosPersonagem("character-1")).resolves.toEqual(resources);
    expect(rpc).toHaveBeenCalledWith("reconciliar_limites_recursos_personagem", {
      p_personagem_id: "character-1",
    });
  });

  it("agrega bônus de itens equipados por personagem", async () => {
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      eq: vi.fn(),
      gt: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.gt.mockResolvedValue({
      data: [
        { personagem_id: "character-1", itens: { bonus_atributos: { constituicao: 2, forca: 1 } } },
        { personagem_id: "character-1", itens: [{ bonus_atributos: { constituicao: 1 } }] },
        { personagem_id: "character-2", itens: { bonus_atributos: { inteligencia: 3 } } },
      ],
      error: null,
    });
    from.mockReturnValue(query);

    await expect(getEquippedAttributeBonusesByCharacter(["character-1", "character-2", "character-1"])).resolves.toEqual({
      "character-1": { constituicao: 3, forca: 1 },
      "character-2": { inteligencia: 3 },
    });
    expect(query.in).toHaveBeenCalledWith("personagem_id", ["character-1", "character-2"]);
    expect(query.eq).toHaveBeenCalledWith("equipado", true);
    expect(query.gt).toHaveBeenCalledWith("quantidade", 0);
  });
});


describe("criarCampanha", () => {
  beforeEach(() => vi.clearAllMocks());

  it("usa uma única RPC atômica e preserva a chave entre tentativas de código duplicado", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "master-1" } }, error: null });
    rpc
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "Código duplicado" } })
      .mockResolvedValueOnce({ data: { id: "campaign-1", codigo_convite: "ABC123" }, error: null });

    await expect(criarCampanha({
      nome: "Aventura",
      descricao: "",
      sistema: "",
      moeda_principal: "PO",
      ouro_inicial: 1250,
    })).resolves.toMatchObject({ id: "campaign-1" });

    expect(rpc).toHaveBeenCalledTimes(2);
    const firstCall = rpc.mock.calls[0][1];
    const secondCall = rpc.mock.calls[1][1];
    expect(firstCall.p_request_id).toBe(secondCall.p_request_id);
    expect(rpc).toHaveBeenNthCalledWith(1, "criar_campanha_atomica", expect.objectContaining({
      p_nome: "Aventura",
      p_request_id: expect.any(String),
    }));
  });
});

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
    ], "purchase-request-1");

    expect(rpc).toHaveBeenCalledWith("registrar_compra_carrinho", {
      p_personagem_id: "character-1",
      p_itens: [{ loja_item_id: "store-item-1", quantidade: 2 }],
      p_request_id: "purchase-request-1",
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

  it("links through one RPC and preserves the existing wallet", async () => {
    const characterRow = {
      id: "character-1",
      campanha_id: null,
      nome: "Aventureiro",
      nivel: 1,
      dados_version: 4,
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
    from.mockReturnValueOnce(characterQuery);
    rpc.mockResolvedValueOnce({
      data: { ...characterRow, campanha_id: "campaign-1", dados_version: 5 },
      error: null,
    });

    const result = await vincularPersonagem("character-1", "campaign-1");

    expect(rpc).toHaveBeenCalledWith("vincular_personagem_campanha", {
      p_personagem_id: "character-1",
      p_campanha_id: "campaign-1",
      p_versao_esperada: 4,
    });
    expect(result.carteira).toEqual(characterRow.dados.carteira);
    expect(result.dataVersion).toBe(5);
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

describe("salvarBonusClassesCampanha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recusa alterações feitas por quem não é mestre", async () => {
    const membershipQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { papel: "JOGADOR" },
        error: null,
      }),
    };
    membershipQuery.select.mockReturnValue(membershipQuery);
    membershipQuery.eq.mockReturnValue(membershipQuery);
    getUser.mockResolvedValue({ data: { user: { id: "player-1" } }, error: null });
    from.mockReturnValue(membershipQuery);

    await expect(
      salvarBonusClassesCampanha("campaign-1", normalizarBonusClassesCampanha()),
    ).rejects.toThrow("Somente o Mestre pode alterar os bônus da campanha.");
    expect(from).toHaveBeenCalledTimes(1);
  });
});
