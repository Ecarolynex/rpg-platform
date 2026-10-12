import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Bestiary from "./Bestiary";

const getCampaignAccess = vi.fn();
const listarBestiario = vi.fn();

vi.mock("../../services/api", () => ({
  getCampaignAccess: (...args: unknown[]) => getCampaignAccess(...args),
}));
vi.mock("../../services/bestiario", () => ({
  listarBestiario: (...args: unknown[]) => listarBestiario(...args),
  salvarCriatura: vi.fn(),
  alternarVisibilidadeCriatura: vi.fn(),
  excluirCriatura: vi.fn(),
}));

const criatura = {
  id: "c1",
  campanha_id: "camp1",
  nome: "Lobo Sombrio",
  tipo: "inimigo",
  nivel_ameaca: "3",
  vida: 40,
  descricao: "Caça nas clareiras.",
  ataques: "Mordida",
  fraquezas: "Fogo",
  visivel: true,
  criado_em: "2026-10-11",
};

function abrir() {
  return render(
    <MemoryRouter initialEntries={["/campanha/camp1/bestiario"]}>
      <Routes>
        <Route path="/campanha/:id/bestiario" element={<Bestiary />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Bestiário", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mostra o formulário de cadastro apenas ao Mestre", async () => {
    getCampaignAccess.mockResolvedValue({ isMaster: true, startingGold: 0 });
    listarBestiario.mockResolvedValue([criatura]);
    abrir();
    expect(await screen.findByText("Lobo Sombrio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar criatura" })).toBeInTheDocument();
  });

  it("jogador vê as criaturas reveladas sem controles de edição", async () => {
    getCampaignAccess.mockResolvedValue({ isMaster: false, startingGold: 0 });
    listarBestiario.mockResolvedValue([criatura]);
    abrir();
    expect(await screen.findByText("Lobo Sombrio")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Cadastrar criatura" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
    });
  });
});
