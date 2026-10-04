import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// A ficha só recebe/renderiza o inventário; o comportamento fica nos testes do componente.
vi.mock("../../components/inventory/InventoryItems", () => ({
  default: () => <div data-testid="inventory-items-boundary" />,
}));

const characterId = "7a7b7f47-b8a4-41d3-92fe-1083c17410b1";
const bonusZero = {
  forca: 0,
  destreza: 0,
  constituicao: 0,
  inteligencia: 0,
  carisma: 0,
};

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
    api.getCatalogoGlobalClasses.mockResolvedValue([]);
    api.listarConteudosClasseCampanha.mockResolvedValue([]);
    api.atualizarPersonagem.mockImplementation(async (_id, character) => character);
  });

  it("carrega os dados essenciais da ficha e a aba Inventário", async () => {
    const { container } = renderSheet();

    expect(await screen.findByRole("heading", { name: "Bram Ferroz" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vida e mana" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Atributos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Perícias" })).toBeInTheDocument();
    expect(container.querySelectorAll(".cs-attr-card")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: "Inventário" })).toBeInTheDocument();
  });

  it("permite navegar entre abas pelo teclado", async () => {
    renderSheet();
    await screen.findByRole("heading", { name: "Bram Ferroz" });

    const inventoryTab = screen.getByRole("tab", { name: "Inventário" });
    fireEvent.keyDown(inventoryTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Magias" })).toHaveAttribute("aria-selected", "true");
  });

  it("limita o valor atual de vida ao máximo configurado", async () => {
    const { container } = renderSheet();
    await screen.findByRole("heading", { name: "Bram Ferroz" });

    const vitalInputs = container.querySelectorAll<HTMLInputElement>(".cs-vital-input");
    expect(vitalInputs).toHaveLength(2);
    fireEvent.change(vitalInputs[0], { target: { value: "250" } });

    expect(vitalInputs[0]).toHaveValue(200);
  });

  it("permite alterar o valor de uma perícia", async () => {
    renderSheet();
    await screen.findByRole("heading", { name: "Bram Ferroz" });

    const skillInput = screen.getByRole("textbox", { name: "Valor de Acrobacia" });
    fireEvent.change(skillInput, { target: { value: "2" } });

    expect(skillInput).toHaveValue("2");
  });

  it("apresenta os bônus da classe na aba Classe", async () => {
    api.getCatalogoGlobalClasses.mockResolvedValueOnce([{
      id: "guerreiro",
      nome: "Guerreiro",
      aliases: [],
      usaMagia: false,
      atributoBonus: { ...bonusZero, forca: 5 },
      hpBonus: 10,
      mpBonus: 0,
      pericias: [],
      habilidades: [],
      magias: [],
    }]);

    renderSheet();
    await screen.findByRole("heading", { name: "Bram Ferroz" });

    expect(await screen.findByText("+5 Força")).toBeInTheDocument();
    expect(screen.getByText("+10 Vida")).toBeInTheDocument();
  });

  it("exibe habilidades cadastradas no catálogo da classe", async () => {
    api.getCatalogoGlobalClasses.mockResolvedValueOnce([{
      id: "guerreiro",
      nome: "Guerreiro",
      aliases: [],
      usaMagia: false,
      atributoBonus: bonusZero,
      hpBonus: 0,
      mpBonus: 0,
      pericias: [],
      habilidades: [
        { id: "golpe", nome: "Golpe preciso", descricao: "Acerta o ponto fraco.", nivel: 1 },
      ],
      magias: [],
    }]);

    renderSheet();
    await screen.findByRole("heading", { name: "Bram Ferroz" });

    expect(await screen.findByText("Golpe preciso")).toBeInTheDocument();
    expect(screen.getByText("Acerta o ponto fraco.")).toBeInTheDocument();
  });

  it("salva automaticamente uma nota alterada na aba Notas", async () => {
    renderSheet();
    await screen.findByRole("heading", { name: "Bram Ferroz" });
    fireEvent.click(screen.getByRole("tab", { name: "Notas" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Notas" }), {
      target: { value: "A chave da torre está com a curandeira." },
    });

    await waitFor(() => {
      expect(api.atualizarPersonagem).toHaveBeenCalledWith(
        characterId,
        expect.objectContaining({ notas: "A chave da torre está com a curandeira." }),
      );
    }, { timeout: 2000 });
  });

  it("não permite editar a ficha sem permissão", async () => {
    api.getCharacterAccess.mockResolvedValue({ canEdit: false, isMaster: false });
    renderSheet();
    await screen.findByRole("heading", { name: "Bram Ferroz" });

    expect(screen.queryByRole("button", { name: "Editar ficha completa" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Notas" }));
    expect(screen.queryByRole("textbox", { name: "Notas" })).not.toBeInTheDocument();
    expect(screen.getByText("Nenhuma anotação ainda.")).toBeInTheDocument();
  });
});
