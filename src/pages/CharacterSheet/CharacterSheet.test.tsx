import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import type { Character } from "../../types/character";
import CharacterSheet from "./CharacterSheet";

const api = vi.hoisted(() => ({
  getCharacterById: vi.fn(),
  getCharacterAccess: vi.fn(),
  getInventory: vi.fn(),
  atualizarPersonagem: vi.fn(),
}));

vi.mock("../../services/api", () => api);

const characterId = "7a7b7f47-b8a4-41d3-92fe-1083c17410b1";

function makeCharacter(): Character {
  return {
    id: characterId,
    campanhaId: "campaign-1",
    nome: "Bram Ferroz",
    raca: "Humano",
    classe: "Guerreiro",
    nivel: 1,
    hp: { atual: 10, max: 10, temp: 4 },
    mp: { atual: 10, max: 10 },
    attributes: {
      forca: 10,
      destreza: 10,
      constituicao: 10,
      inteligencia: 10,
      sabedoria: 10,
      carisma: 10,
    },
    skills: [
      { id: "acrobacia", nome: "Acrobacia", atributo: "destreza", treinada: false, bonus: 0 },
    ],
    inventory: [],
    spells: [],
    carteira: { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 },
    notas: "",
  };
}

function renderSheet() {
  return render(
    <MemoryRouter initialEntries={[`/personagem/${characterId}`]}>
      <Routes>
        <Route path="/personagem/:id" element={<CharacterSheet />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CharacterSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCharacterById.mockResolvedValue(makeCharacter());
    api.getCharacterAccess.mockResolvedValue({ canEdit: true, isMaster: false });
    api.getInventory.mockResolvedValue([]);
    api.atualizarPersonagem.mockImplementation(async (_id, character) => character);
  });

  it("carrega a ficha e seus controles de vida e mana", async () => {
    renderSheet();

    expect(await screen.findByRole("heading", { name: "Bram Ferroz" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vida e mana" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inventário completo" })).toHaveAttribute(
      "href",
      `/personagem/${characterId}/inventario`,
    );
  });

  it("permite ao dono treinar uma perícia", async () => {
    renderSheet();
    await screen.findByRole("heading", { name: "Bram Ferroz" });
    fireEvent.click(screen.getByRole("button", { name: "Perícias" }));

    const acrobaticsRow = screen.getByText("Acrobacia").closest("li");
    expect(acrobaticsRow).not.toBeNull();
    fireEvent.click(within(acrobaticsRow as HTMLElement).getByRole("button", { name: "+ Treinar" }));

    expect(acrobaticsRow).toHaveTextContent("Treinada");
  });

  it("permite equipar um item manual e habilita seu bônus", async () => {
    renderSheet();
    await screen.findByRole("heading", { name: "Bram Ferroz" });
    fireEvent.click(screen.getByRole("button", { name: "Inventário" }));
    fireEvent.click(screen.getByRole("button", { name: /adicionar item ao inventário/i }));

    fireEvent.change(screen.getByPlaceholderText(/nome do item/i), {
      target: { value: "Anel da força" },
    });
    fireEvent.change(screen.getByLabelText("Atributo do bônus do equipamento"), {
      target: { value: "forca" },
    });
    fireEvent.change(screen.getByLabelText("Valor do bônus do equipamento"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    const itemRow = screen.getByText("Anel da força").closest("li");
    expect(itemRow).not.toBeNull();
    fireEvent.click(within(itemRow as HTMLElement).getByRole("button", { name: "Equipar" }));
    fireEvent.click(screen.getByRole("button", { name: "Atributos" }));

    const strength = screen.getByText("Força").closest(".attribute-block");
    expect(strength).toHaveTextContent("15");
    expect(strength).toHaveTextContent("+2");
  });

  it("não permite editar a ficha de outro personagem", async () => {
    api.getCharacterAccess.mockResolvedValue({ canEdit: false, isMaster: false });
    renderSheet();
    await screen.findByRole("heading", { name: "Bram Ferroz" });

    expect(screen.queryByRole("button", { name: "Editar ficha completa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Treinar" })).not.toBeInTheDocument();
  });
});