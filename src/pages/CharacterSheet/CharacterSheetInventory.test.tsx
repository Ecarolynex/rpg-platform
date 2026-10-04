import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Character } from "../../types/character";
import CharacterSheet from "./CharacterSheet";

const api = vi.hoisted(() => ({
  atualizarPersonagem: vi.fn(),
  enviarRetrato: vi.fn(),
  getCatalogoGlobalClasses: vi.fn(),
  getCharacterAccess: vi.fn(),
  getCharacterById: vi.fn(),
  listarConteudosClasseCampanha: vi.fn(),
}));

vi.mock("../../services/api", () => api);

vi.mock("../../components/inventory/InventoryItems", () => ({
  default: ({
    characterId,
    campaignId,
  }: {
    characterId: string;
    campaignId?: string | null;
  }) => (
    <div
      data-testid="character-inventory"
      data-character-id={characterId}
      data-campaign-id={campaignId ?? ""}
    />
  ),
}));

const characterId = "character-sheet-inventory-test";
const legacyItemName = "Item legado não exibido";

function makeCharacter(): Character {
  return {
    id: characterId,
    campanhaId: "campaign-1",
    nome: "Bram Ferroz",
    raca: "Humano",
    classe: "Guerreiro",
    nivel: 1,
    hp: { atual: 10, max: 10 },
    mp: { atual: 10, max: 10 },
    attributes: {
      forca: 10,
      destreza: 10,
      constituicao: 10,
      inteligencia: 10,
      carisma: 10,
    },
    skills: [],
    inventory: [{ id: "legacy-item", nome: legacyItemName, quantidade: 3 }],
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

describe("CharacterSheet inventory integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCharacterById.mockResolvedValue(makeCharacter());
    api.getCharacterAccess.mockResolvedValue({ canEdit: true, isMaster: false });
    api.getCatalogoGlobalClasses.mockResolvedValue([]);
    api.listarConteudosClasseCampanha.mockResolvedValue([]);
    api.atualizarPersonagem.mockImplementation(async (_id, character) => character);
  });

  it("monta o componente de inventário na aba com os IDs do personagem e campanha", async () => {
    renderSheet();
    await screen.findByRole("heading", { name: "Bram Ferroz" });

    fireEvent.click(screen.getByRole("tab", { name: "Inventário" }));

    const inventory = await screen.findByTestId("character-inventory");
    expect(inventory).toHaveAttribute("data-character-id", characterId);
    expect(inventory).toHaveAttribute("data-campaign-id", "campaign-1");
    expect(screen.queryByText(legacyItemName)).not.toBeInTheDocument();
  });
});
