import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Character } from "../../types/character";
import {
  makeAuthoritativeResourcesFixture,
  makeCampaignCharacter,
} from "../../test/fixtures/rewards";
import CharacterSheet from "./CharacterSheet";

const api = vi.hoisted(() => ({
  atualizarPersonagem: vi.fn(),
  enviarRetrato: vi.fn(),
  getCatalogoGlobalClasses: vi.fn(),
  getCharacterAccess: vi.fn(),
  getCharacterById: vi.fn(),
  listarConteudosClasseCampanha: vi.fn(),
  getCampaignClassBonuses: vi.fn(),
  getInventory: vi.fn(),
  reconciliarLimitesRecursosPersonagem: vi.fn(),
  getCharacterResourceMaximums: vi.fn(),
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
  return makeCampaignCharacter({
    id: characterId,
    xp: undefined,
    nome: "Bram Ferroz",
    nivel: 1,
    hp: { atual: 10, max: 10 },
    mp: { atual: 10, max: 10 },
    inventory: [{ id: "legacy-item", nome: legacyItemName, quantidade: 3 }],
    carteira: { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 },
  });
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
    api.getCampaignClassBonuses.mockResolvedValue({});
    api.getInventory.mockResolvedValue([]);
    const resourceResponse = makeAuthoritativeResourcesFixture({
      dados_version: 1,
      hp_atual: 10,
      mp_atual: 10,
      hp_max: 20,
      mp_max: 18,
    });
    api.reconciliarLimitesRecursosPersonagem.mockResolvedValue(resourceResponse);
    api.getCharacterResourceMaximums.mockResolvedValue(resourceResponse);
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
