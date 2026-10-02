import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import {
  adicionarConteudoClasseCampanha,
  excluirCampanha,
  getCampaignAccess,
  salvarBonusClassesCampanha,
} from "../../services/api";
import Campaign from "./Campaign";

vi.mock("../../services/api", () => ({
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
  getCharacters: vi.fn().mockResolvedValue([]),
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
      vi.mocked(getCampaignAccess).mockResolvedValue({ isMaster: false, startingGold: 0 });
    });

    it("permite adicionar habilidades exclusivas a uma classe da campanha", async () => {
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

  it("pede confirmação antes de chamar a exclusão", async () => {
    renderCampaign();

    fireEvent.click(await screen.findByRole("button", { name: "Excluir campanha" }));

    expect(screen.getByRole("alertdialog")).toHaveTextContent("Excluir “Aventura de Teste”?");
    expect(screen.getByRole("button", { name: "Confirmar exclusão" })).toBeInTheDocument();
    expect(excluirCampanha).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(excluirCampanha).not.toHaveBeenCalled();
  });

  it("não mostra a opção para jogadores", async () => {
    vi.mocked(getCampaignAccess).mockResolvedValueOnce({ isMaster: false, startingGold: 0 });
    renderCampaign();

    expect(await screen.findByRole("heading", { name: "Meu personagem nesta aventura" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir campanha" })).not.toBeInTheDocument();
  });
});
