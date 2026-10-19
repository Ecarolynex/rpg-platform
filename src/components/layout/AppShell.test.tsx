import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

const listarMinhasCampanhas = vi.fn();
const getCharacterById = vi.fn();
const mockLogout = vi.fn();

vi.mock("../../services/api", () => ({
  listarMinhasCampanhas: (...args: unknown[]) => listarMinhasCampanhas(...args),
  getCharacterById: (...args: unknown[]) => getCharacterById(...args),
}));

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", nome: "Mestre dos Magos", email: "mestre@teste.com" },
    logout: mockLogout,
    loading: false,
  }),
}));

describe("AppShell - Navegação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarMinhasCampanhas.mockResolvedValue([]);
    getCharacterById.mockResolvedValue(null);
  });

  it("exibe o link para Bestiário e Dados no menu geral", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Meus personagens" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Campanhas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Classes e habilidades" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bestiário" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dados" })).toBeInTheDocument();
  });

  it("exibe o menu geral mesmo ao navegar na tela de ficha de personagem", async () => {
    getCharacterById.mockResolvedValue({
      id: "p1",
      nome: "Aventureiro Valente",
      campanhaId: null,
    });

    render(
      <MemoryRouter initialEntries={["/personagem/p1"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/personagem/:id" element={<div>Ficha do personagem</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Meus personagens" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Campanhas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Classes e habilidades" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bestiário" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dados" })).toBeInTheDocument();
  });

  it("exibe os itens da campanha incluindo o Bestiário e Dados ao navegar dentro de uma campanha", async () => {
    listarMinhasCampanhas.mockResolvedValue([
      { id: "c1", nome: "Masmorra Infinita", status: "ATIVA" },
    ]);

    render(
      <MemoryRouter initialEntries={["/campanha/c1"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/campanha/:id" element={<div>Campanha Detalhe</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Masmorra Infinita")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Visão geral" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mapa" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Loja" })).toBeInTheDocument();

    // Há dois links para Bestiário e Dados: no menu geral e na campanha atual
    const bestiarioLinks = screen.getAllByRole("link", { name: "Bestiário" });
    expect(bestiarioLinks.length).toBe(2);
    expect(bestiarioLinks[0]).toHaveAttribute("href", "/bestiario");
    expect(bestiarioLinks[1]).toHaveAttribute("href", "/campanha/c1/bestiario");

    const dadosLinks = screen.getAllByRole("link", { name: "Dados" });
    expect(dadosLinks.length).toBe(2);
    expect(dadosLinks[0]).toHaveAttribute("href", "/dados");
    expect(dadosLinks[1]).toHaveAttribute("href", "/campanha/c1/dados");
  });
});
