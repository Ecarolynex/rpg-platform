import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InventoryItems from "./InventoryItems";

const api = vi.hoisted(() => ({
  getInventory: vi.fn(),
}));

vi.mock("../../services/api", () => ({
  getInventory: api.getInventory,
}));

const characterId = "persisted-character-1";

function inventoryRow({
  id = "potion-1",
  name = "Poção de cura",
  quantity = 2,
  equipped = true,
  items,
}: {
  id?: string;
  name?: string;
  quantity?: number;
  equipped?: boolean;
  items?: unknown;
} = {}) {
  return {
    item_id: id,
    quantidade: quantity,
    equipado: equipped,
    itens: items ?? {
      id,
      nome: name,
      descricao: "Recupera ferimentos leves.",
      tipo: "Consumível",
      raridade: "Comum",
      efeito: "Recupera 10 pontos de vida.",
      imagem_url: null,
    },
  };
}

function renderInventory(campaignId?: string) {
  return render(
    <MemoryRouter>
      <InventoryItems characterId={characterId} campaignId={campaignId} />
    </MemoryRouter>,
  );
}

describe("InventoryItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getInventory.mockResolvedValue([]);
  });

  it("mostra o estado de carregamento enquanto busca o inventário", () => {
    api.getInventory.mockReturnValue(new Promise(() => undefined));

    renderInventory();

    expect(screen.getByRole("status")).toHaveTextContent("Carregando inventário...");
    expect(api.getInventory).toHaveBeenCalledWith(characterId);
  });

  it("renderiza detalhes persistidos e normaliza relacionamentos de item", async () => {
    api.getInventory.mockResolvedValue([
      inventoryRow(),
      inventoryRow({
        id: "sword-1",
        name: "Espada antiga",
        quantity: 1,
        equipped: false,
        items: [{
          id: "sword-1",
          nome: "Espada antiga",
          descricao: "Uma lâmina bem conservada.",
          tipo: "Arma",
          raridade: "Rara",
          efeito: null,
          imagem_url: null,
        }],
      }),
    ]);

    renderInventory("campaign-7");

    expect(await screen.findByRole("region", {
      name: "Inventário persistido do personagem",
    })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Poção de cura" })).toBeInTheDocument();
    expect(screen.getByText("x2")).toBeInTheDocument();
    expect(screen.getByText("Recupera ferimentos leves.")).toBeInTheDocument();
    expect(screen.getByText(/Recupera 10 pontos de vida\./)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Espada antiga" })).toBeInTheDocument();
    expect(screen.getByText("Arma · Rara")).toBeInTheDocument();
    expect(screen.getAllByText("Equipado")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Adicionar itens pela loja" })).toHaveAttribute(
      "href",
      "/campanha/campaign-7/loja",
    );
    expect(api.getInventory).toHaveBeenCalledTimes(1);
    expect(api.getInventory).toHaveBeenCalledWith(characterId);
  });

  it("mostra estado vazio e link da loja quando pertence a uma campanha", async () => {
    api.getInventory.mockResolvedValue([]);

    renderInventory("campaign-7");

    expect(await screen.findByRole("heading", { name: "Inventário vazio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Adicionar itens pela loja" })).toHaveAttribute(
      "href",
      "/campanha/campaign-7/loja",
    );
  });

  it("permite repetir a busca após erro", async () => {
    api.getInventory
      .mockRejectedValueOnce(new Error("Falha de rede"))
      .mockResolvedValueOnce([inventoryRow()]);

    renderInventory();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de rede");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("heading", { name: "Poção de cura" })).toBeInTheDocument();
    expect(api.getInventory).toHaveBeenCalledTimes(2);
  });
});
