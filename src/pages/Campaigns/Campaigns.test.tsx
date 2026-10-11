import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Campaigns from "./Campaigns";
import { criarCampanha, entrarNaCampanha, listarMinhasCampanhas } from "../../services/api";

vi.mock("../../services/api", () => ({
  criarCampanha: vi.fn(),
  entrarNaCampanha: vi.fn(),
  listarMinhasCampanhas: vi.fn(),
}));

const campaign = {
  id: "campaign-1",
  nome: "Crônicas do Norte",
  descricao: "Uma campanha de teste.",
  sistema: "Elementum",
  imagem_url: null,
  moeda_principal: "Ouro",
  ouro_inicial: 1250,
  status: "ATIVA",
  codigo_convite: "ABC123",
  created_by: "master-1",
  created_at: "2026-10-11T00:00:00.000Z",
  bonus_classes: null,
};

function renderCampaigns() {
  return render(
    <MemoryRouter>
      <Campaigns />
    </MemoryRouter>,
  );
}

describe("lista e criação de campanhas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listarMinhasCampanhas).mockResolvedValue([]);
    vi.mocked(criarCampanha).mockResolvedValue(campaign);
    vi.mocked(entrarNaCampanha).mockResolvedValue(campaign);
  });

  it("mostra erro de carregamento e permite tentar novamente", async () => {
    vi.mocked(listarMinhasCampanhas)
      .mockRejectedValueOnce(new Error("Falha de rede"))
      .mockResolvedValueOnce([campaign]);

    renderCampaigns();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de rede");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("heading", { name: "Crônicas do Norte" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(listarMinhasCampanhas).toHaveBeenCalledTimes(2);
  });

  it("mantém confirmação e código de convite se o refresh após criação falhar", async () => {
    vi.mocked(listarMinhasCampanhas)
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("Falha ao atualizar a lista"))
      .mockResolvedValueOnce([campaign]);

    renderCampaigns();
    fireEvent.click(await screen.findByRole("button", { name: "+ Criar campanha" }));
    fireEvent.change(screen.getByLabelText("Nome da campanha"), {
      target: { value: "Crônicas do Norte" },
    });

    const createForm = screen.getByLabelText("Nome da campanha").closest("form");
    expect(createForm).not.toBeNull();
    fireEvent.submit(createForm!);

    expect(await screen.findByText("Campanha criada com sucesso!")).toBeInTheDocument();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao atualizar a lista");

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(listarMinhasCampanhas).toHaveBeenCalledTimes(3);
  });
});
