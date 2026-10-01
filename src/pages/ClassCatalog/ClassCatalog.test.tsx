import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  getCatalogoGlobalClasses,
  salvarCatalogoGlobalClasses,
} from "../../services/api";
import ClassCatalog from "./ClassCatalog";

vi.mock("../../services/api", () => ({
  getCatalogoGlobalClasses: vi.fn(),
  salvarCatalogoGlobalClasses: vi.fn(),
}));

const warrior = {
  id: "guerreiro",
  nome: "Guerreiro",
  aliases: [],
  atributoBonus: {
    forca: 2,
    destreza: 0,
    constituicao: 0,
    inteligencia: 0,
    carisma: 0,
  },
  hpBonus: 10,
  mpBonus: 0,
  pericias: [],
  habilidades: [],
};

describe("catálogo global de classes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCatalogoGlobalClasses).mockResolvedValue([warrior]);
    vi.mocked(salvarCatalogoGlobalClasses).mockImplementation(async (catalogo) => catalogo);
  });

  it("edita bônus e adiciona habilidades com nível de desbloqueio", async () => {
    render(<ClassCatalog />);

    fireEvent.change(await screen.findByRole("spinbutton", { name: "Guerreiro - Força" }), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Nova habilidade" }), {
      target: { value: "Golpe preciso" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Nível de desbloqueio" }), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Descrição da nova habilidade" }), {
      target: { value: "Atinge um ponto vulnerável." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar habilidade" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar catálogo" }));

    await waitFor(() => {
      expect(salvarCatalogoGlobalClasses).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            nome: "Guerreiro",
            atributoBonus: expect.objectContaining({ forca: 4 }),
            habilidades: [
              expect.objectContaining({
                nome: "Golpe preciso",
                nivel: 3,
                descricao: "Atinge um ponto vulnerável.",
              }),
            ],
          }),
        ]),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Catálogo compartilhado atualizado.",
    );
  });
});
