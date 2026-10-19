import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DiceRollerPage from "./DiceRollerPage";

const listarMinhasCampanhas = vi.fn();

vi.mock("../../services/api", () => ({
  listarMinhasCampanhas: (...args: unknown[]) => listarMinhasCampanhas(...args),
}));

describe("DiceRollerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite abrir o rolador de dados pelo menu geral (/dados) em modo livre", async () => {
    listarMinhasCampanhas.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/dados"]}>
        <Routes>
          <Route path="/dados" element={<DiceRollerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Rolagem de Dados")).toBeInTheDocument();
    expect(screen.getByText("Ferramenta de mesa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rolar d20" })).toBeInTheDocument();
  });

  it("exibe o seletor de campanhas ao abrir pelo menu geral quando o usuário possui campanhas", async () => {
    listarMinhasCampanhas.mockResolvedValue([
      { id: "c1", nome: "Crônicas de Arton", status: "ATIVA" },
    ]);

    render(
      <MemoryRouter initialEntries={["/dados"]}>
        <Routes>
          <Route path="/dados" element={<DiceRollerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText("Vincular rolagens à campanha")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Rolagem Livre (Geral)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Crônicas de Arton" })).toBeInTheDocument();
  });

  it("abre diretamente na campanha quando rota possui :id", async () => {
    render(
      <MemoryRouter initialEntries={["/campanha/c1/dados"]}>
        <Routes>
          <Route path="/campanha/:id/dados" element={<DiceRollerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Rolagem de Dados")).toBeInTheDocument();
    expect(screen.getByText("Ferramenta da campanha")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegação da campanha" })).toBeInTheDocument();
  });
});
