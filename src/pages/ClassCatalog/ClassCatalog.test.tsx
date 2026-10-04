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
  usaMagia: false,
  magias: [],
};

describe("catÃ¡logo global de classes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCatalogoGlobalClasses).mockResolvedValue([warrior]);
    vi.mocked(salvarCatalogoGlobalClasses).mockImplementation(async (catalogo) => catalogo);
  });

  it("edita bÃ´nus e adiciona habilidades com nÃ­vel de desbloqueio", async () => {
    render(<ClassCatalog />);

    fireEvent.change(await screen.findByRole("spinbutton", { name: "Guerreiro - ForÃ§a" }), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Nova habilidade" }), {
      target: { value: "Golpe preciso" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "NÃ­vel de desbloqueio" }), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "DescriÃ§Ã£o da nova habilidade" }), {
      target: { value: "Atinge um ponto vulnerÃ¡vel." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar habilidade" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar catÃ¡logo" }));

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
                descricao: "Atinge um ponto vulnerÃ¡vel.",
              }),
            ],
          }),
        ]),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "CatÃ¡logo compartilhado atualizado.",
    );
  });
});

