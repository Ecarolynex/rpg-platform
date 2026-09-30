import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { excluirCampanha, getCampaignAccess } from "../../services/api";
import Campaign from "./Campaign";

vi.mock("../../services/api", () => ({
  excluirCampanha: vi.fn().mockResolvedValue(undefined),
  getCampaignAccess: vi.fn().mockResolvedValue({ isMaster: true, startingGold: 0 }),
  getCharacters: vi.fn().mockResolvedValue([]),
  listarMinhasCampanhas: vi.fn().mockResolvedValue([{
    id: "campaign-1",
    nome: "Aventura de Teste",
    descricao: "Uma aventura de teste.",
    sistema: "Elementum",
    imagem_url: null,
    moeda_principal: "Ouro",
    ouro_inicial: 0,
    status: "ATIVA",
    codigo_convite: "ABC123",
    created_by: "master-1",
    created_at: "2026-09-30T00:00:00.000Z",
  }]),
  listarPersonagensDaCampanha: vi.fn().mockResolvedValue([]),
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
