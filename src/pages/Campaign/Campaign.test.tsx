import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import {
  adicionarConteudoClasseCampanha,
  creditarExperienciaCampanha,
  entregarItemCampanha,
  listarPersonagensDaCampanha,
  excluirCampanha,
  getCampaignAccess,
  salvarBonusClassesCampanha,
} from "../../services/api";
import Campaign from "./Campaign";

vi.mock("../../services/api", () => ({
  creditarOuroCampanha: vi.fn().mockResolvedValue(1),
  creditarExperienciaCampanha: vi.fn().mockResolvedValue(1),
  entregarItemCampanha: vi.fn().mockResolvedValue(1),
  listarCatalogoItens: vi.fn().mockResolvedValue([]),
  listarRecompensasCampanha: vi.fn().mockResolvedValue([]),
  adicionarConteudoClasseCampanha: vi.fn().mockImplementation(async (campaignId, conteudo) => ({
    ...conteudo,
    id: "content-1",
    campanha_id: campaignId,
    created_by: "master-1",
  })),
  excluirCampanha: vi.fn().mockResolvedValue(undefined),
  getCatalogoGlobalClasses: vi.fn().mockResolvedValue([{
    id: "guerreiro",
    nome: "Guerreiro",
    aliases: [],
    atributoBonus: { forca: 2, destreza: 0, constituicao: 0, inteligencia: 0, carisma: 0 },
    hpBonus: 10,
    mpBonus: 0,
    pericias: [],
    habilidades: [],
  }]),
  getCampaignAccess: vi.fn().mockResolvedValue({ isMaster: true, startingGold: 0 }),
  getCampaignResourceMaximums: vi.fn().mockResolvedValue([]),
  getCharacters: vi.fn().mockResolvedValue([]),
  getEquippedAttributeBonusesByCharacter: vi.fn().mockResolvedValue({}),
  salvarBonusClassesCampanha: vi.fn().mockImplementation(async (_id, bonuses) => bonuses),
  listarMinhasCampanhas: vi.fn().mockResolvedValue([{
    id: "campaign-1",
    nome: "Aventura de Teste",
    descricao: "Uma aventura de teste.",
    sistema: "Elementum",
    imagem_url: null,
    moeda_principal: "Ouro",
    ouro_inicial: 0,
    bonus_classes: null,
    status: "ATIVA",
    codigo_convite: "ABC123",
    created_by: "master-1",
    created_at: "2026-09-30T00:00:00.000Z",
  }]),
  listarConteudosClasseCampanha: vi.fn().mockResolvedValue([]),
  listarPersonagensDaCampanha: vi.fn().mockResolvedValue([]),
  removerConteudoClasseCampanha: vi.fn(),
  vincularPersonagem: vi.fn(),
}));

function renderCampaign() {
  return render(
    <MemoryRouter initialEntries={["/campanha/campaign-1"]}>
      <Routes>
        <Route path="/campanha/:id" element={<Campaign />} />
        <Route path="/campanhas" element={<p>Lista de campanhas</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("exclusão da campanha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCampaignAccess).mockResolvedValue({ isMaster: true, startingGold: 0 });
  });

  describe("conteúdos personalizados da campanha", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(getCampaignAccess).mockResolvedValue({ isMaster: true, startingGold: 0 });
    });

    it("permite ao Mestre adicionar habilidades exclusivas a uma classe da campanha", async () => {
      renderCampaign();

      fireEvent.change(await screen.findByLabelText("Nome"), {
        target: { value: "Passo das sombras" },
      });
      fireEvent.change(screen.getByLabelText("Descrição"), {
        target: { value: "Move-se sem ser percebido." },
      });
      fireEvent.change(screen.getByLabelText("Nível de desbloqueio"), {
        target: { value: "4" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Adicionar à campanha" }));

      await waitFor(() => {
        expect(adicionarConteudoClasseCampanha).toHaveBeenCalledWith(
          "campaign-1",
          expect.objectContaining({
            classe_id: "guerreiro",
            tipo: "HABILIDADE",
            nome: "Passo das sombras",
            nivel: 4,
          }),
        );
      });
      expect(await screen.findByRole("heading", { name: "Passo das sombras" })).toBeInTheDocument();
    });
  });

  describe("bônus de classe da campanha", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(getCampaignAccess).mockResolvedValue({ isMaster: true, startingGold: 0 });
      vi.mocked(salvarBonusClassesCampanha).mockImplementation(async (_id, bonuses) => bonuses);
    });

    it("permite ao mestre configurar os cinco atributos do sistema", async () => {
      renderCampaign();

      const forcaGuerreiro = await screen.findByRole("spinbutton", {
        name: "Guerreiro - Força",
      });
      expect(screen.getAllByRole("spinbutton", { name: /^Guerreiro - / })).toHaveLength(7);

      fireEvent.change(forcaGuerreiro, { target: { value: "4" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar bônus" }));

      await waitFor(() => {
        expect(salvarBonusClassesCampanha).toHaveBeenCalledWith(
          "campaign-1",
          expect.objectContaining({
            Guerreiro: expect.objectContaining({
              atributoBonus: expect.objectContaining({ forca: 4 }),
            }),
          }),
        );
      });
      expect(await screen.findByRole("status")).toHaveTextContent(
        "Bônus de classe salvos para esta campanha.",
      );
    });

    it("não mostra a configuração para jogadores", async () => {
      vi.mocked(getCampaignAccess).mockResolvedValueOnce({ isMaster: false, startingGold: 0 });
      renderCampaign();

      expect(await screen.findByRole("heading", { name: "Meu personagem nesta aventura" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Bônus de classe desta campanha" })).not.toBeInTheDocument();
    });
  });

  it("aplica XP ao personagem selecionado e confirma a operação", async () => {
    vi.mocked(listarPersonagensDaCampanha).mockResolvedValueOnce([{
      id: "character-1",
      campanhaId: "campaign-1",
      nome: "Lira",
      raca: "Humano",
      classe: "Guerreiro",
      nivel: 2,
      xp: 100,
      hp: { atual: 10, max: 10 },
      mp: { atual: 10, max: 10 },
      attributes: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, carisma: 10 },
      skills: [], inventory: [], spells: [], notas: "",
    }]);
    renderCampaign();

    fireEvent.change(await screen.findByLabelText("Tipo de recompensa"), { target: { value: "XP" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("Destinatário"), { target: { value: "character-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Entregar Recompensa" }));

    await waitFor(() => {
      expect(creditarExperienciaCampanha).toHaveBeenCalledWith(
        "campaign-1", 150, "character-1", expect.any(String),
      );
    });
    expect(await screen.findByText("Concluído! 150 XP foram entregues para Lira.")).toBeInTheDocument();
  });

  it("entrega um item ao personagem ou ao grupo selecionado", async () => {
    vi.mocked(listarPersonagensDaCampanha).mockResolvedValueOnce([{
      id: "character-1",
      campanhaId: "campaign-1",
      nome: "Lira",
      raca: "Humano",
      classe: "Guerreiro",
      nivel: 2,
      xp: 100,
      hp: { atual: 10, max: 10 },
      mp: { atual: 10, max: 10 },
      attributes: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, carisma: 10 },
      skills: [], inventory: [], spells: [], notas: "",
    }]);
    const { listarCatalogoItens } = await import("../../services/api");
    vi.mocked(listarCatalogoItens).mockResolvedValueOnce([{ itemId: "potion-1", nome: "Poção" } as never]);
    renderCampaign();

    fireEvent.change(await screen.findByLabelText("Tipo de recompensa"), { target: { value: "ITEM" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "potion-1" } });
    fireEvent.change(screen.getByLabelText("Destinatário"), { target: { value: "character-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Entregar Recompensa" }));

    await waitFor(() => {
      expect(entregarItemCampanha).toHaveBeenCalledWith(
        "campaign-1", "potion-1", 2, "character-1", expect.any(String),
      );
    });
    expect(await screen.findByText("Concluído! 2 Poção foram entregues para Lira.")).toBeInTheDocument();
  });

  it("gera uma nova chave de recompensa quando muda o item e preserva a chave em retries idênticos", async () => {
    vi.mocked(listarPersonagensDaCampanha).mockResolvedValueOnce([{
      id: "character-1",
      campanhaId: "campaign-1",
      nome: "Lira",
      raca: "Humano",
      classe: "Guerreiro",
      nivel: 2,
      xp: 100,
      hp: { atual: 10, max: 10 },
      mp: { atual: 10, max: 10 },
      attributes: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, carisma: 10 },
      skills: [], inventory: [], spells: [], notas: "",
    }]);
    const { listarCatalogoItens } = await import("../../services/api");
    vi.mocked(listarCatalogoItens).mockResolvedValueOnce([
      { itemId: "item-a", nome: "Poção rubra" },
      { itemId: "item-b", nome: "Poção azul" },
    ] as never);
    vi.mocked(entregarItemCampanha)
      .mockRejectedValueOnce(new Error("Falha temporária"))
      .mockRejectedValueOnce(new Error("Falha temporária"))
      .mockRejectedValueOnce(new Error("Falha temporária"))
      .mockResolvedValueOnce(1);

    renderCampaign();
    fireEvent.change(await screen.findByLabelText("Tipo de recompensa"), {
      target: { value: "ITEM" },
    });
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "item-a" } });
    const form = screen.getByRole("button", { name: "Entregar Recompensa" }).closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    await screen.findByText("Falha temporária");
    const firstRequestId = vi.mocked(entregarItemCampanha).mock.calls[0][4];

    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "item-b" } });
    fireEvent.submit(form!);
    await waitFor(() => expect(entregarItemCampanha).toHaveBeenCalledTimes(2));
    await screen.findByText("Falha temporária");
    const secondRequestId = vi.mocked(entregarItemCampanha).mock.calls[1][4];
    expect(secondRequestId).not.toBe(firstRequestId);

    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "item-a" } });
    fireEvent.submit(form!);
    await waitFor(() => expect(entregarItemCampanha).toHaveBeenCalledTimes(3));
    const retriedFirstItemId = vi.mocked(entregarItemCampanha).mock.calls[2][4];
    expect(retriedFirstItemId).toBe(firstRequestId);
    await screen.findByText("Falha temporária");

    fireEvent.submit(form!);
    await waitFor(() => expect(entregarItemCampanha).toHaveBeenCalledTimes(4));
    expect(vi.mocked(entregarItemCampanha).mock.calls[3][4]).toBe(firstRequestId);
    expect(await screen.findByText("Concluído! 50 Poção rubra foram entregues para 1 personagens do grupo.")).toBeInTheDocument();
  });

  it("confirma a cópia do convite apenas após sucesso e oferece cópia manual na falha", async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const writeText = vi.fn().mockRejectedValue(new Error("Bloqueada pelo navegador"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      renderCampaign();
      fireEvent.click(await screen.findByRole("button", { name: "Copiar" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível copiar o convite. Selecione o código para copiá-lo manualmente.",
      );
      expect(screen.getAllByText("ABC123")).toHaveLength(2);
      expect(screen.queryByText("Convite copiado!")).not.toBeInTheDocument();
      expect(writeText).toHaveBeenCalledWith("ABC123");
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", originalClipboard);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
    }
  });

  it("confirma que o código foi copiado quando a Clipboard API resolve", async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      renderCampaign();
      fireEvent.click(await screen.findByRole("button", { name: "Copiar" }));

      expect(await screen.findByText("Convite copiado!")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Copiado!" })).toBeInTheDocument();
      expect(writeText).toHaveBeenCalledWith("ABC123");
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", originalClipboard);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
    }
  });

  it("não declara sucesso se a Clipboard API estiver indisponível", async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Reflect.deleteProperty(navigator, "clipboard");

    try {
      renderCampaign();
      fireEvent.click(await screen.findByRole("button", { name: "Copiar" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("copiá-lo manualmente");
      expect(screen.getAllByText("ABC123")).toHaveLength(2);
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", originalClipboard);
      }
    }
  });

  it("pede confirmação antes de chamar a exclusão", async () => {
    renderCampaign();

    const dangerZone = await screen.findByRole("region", { name: "Zona de perigo" });
    expect(dangerZone).toHaveTextContent("A exclusão remove a campanha e não pode ser desfeita.");
    fireEvent.click(within(dangerZone).getByRole("button", { name: "Excluir campanha" }));

    expect(screen.getByRole("alertdialog")).toHaveTextContent("Excluir “Aventura de Teste”?");
    expect(screen.getByRole("button", { name: "Confirmar exclusão" })).toBeInTheDocument();
    expect(excluirCampanha).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(excluirCampanha).not.toHaveBeenCalled();
  });

  it("exclui a campanha e retorna à lista após confirmação", async () => {
    renderCampaign();

    fireEvent.click(await screen.findByRole("button", { name: "Excluir campanha" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));

    await waitFor(() => {
      expect(excluirCampanha).toHaveBeenCalledWith("campaign-1");
    });
    expect(await screen.findByText("Lista de campanhas")).toBeInTheDocument();
  });

  it("não mostra a opção para jogadores", async () => {
    vi.mocked(getCampaignAccess).mockResolvedValueOnce({ isMaster: false, startingGold: 0 });
    renderCampaign();

    expect(await screen.findByRole("heading", { name: "Meu personagem nesta aventura" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir campanha" })).not.toBeInTheDocument();
  });
});
