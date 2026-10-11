import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";

const api = vi.hoisted(() => ({
  buscarCampanhaPorCodigo: vi.fn(),
  criarPersonagem: vi.fn(),
  getCatalogoGlobalClasses: vi.fn(),
  enviarRetrato: vi.fn(),
  entrarNaCampanha: vi.fn(),
  excluirPersonagem: vi.fn(),
  getCharacters: vi.fn(),
  listarConteudosClasseCampanha: vi.fn(),
  getCampaignClassBonuses: vi.fn(),
  getEquippedAttributeBonusesByCharacter: vi.fn(),
  getCampaignResourceMaximums: vi.fn(),
  listarMinhasCampanhas: vi.fn(),
  vincularPersonagem: vi.fn(),
}));

vi.mock("../../services/api", () => api);

const campaigns = [
  {
    id: "campaign-a",
    nome: "Campanha A",
    descricao: "",
    sistema: "Elementum",
    imagem_url: null,
    moeda_principal: "Ouro",
    status: "ATIVA",
    codigo_convite: "AAAAAA",
    created_by: "master-1",
    created_at: "2026-10-11T00:00:00.000Z",
    ouro_inicial: 0,
    bonus_classes: null,
  },
  {
    id: "campaign-b",
    nome: "Campanha B",
    descricao: "",
    sistema: "Elementum",
    imagem_url: null,
    moeda_principal: "Ouro",
    status: "ATIVA",
    codigo_convite: "BBBBBB",
    created_by: "master-2",
    created_at: "2026-10-11T00:00:00.000Z",
    ouro_inicial: 0,
    bonus_classes: null,
  },
];

const classCatalog = [{
  id: "guerreiro",
  nome: "Guerreiro",
  aliases: [],
  usaMagia: false,
  atributoBonus: { forca: 0, destreza: 0, constituicao: 0, inteligencia: 0, carisma: 0 },
  hpBonus: 10,
  mpBonus: 0,
  pericias: [],
  habilidades: [],
  magias: [],
}];

function bonusesWithHp(hpBonus: number) {
  return {
    Guerreiro: {
      atributoBonus: { forca: 0, destreza: 0, constituicao: 0, inteligencia: 0, carisma: 0 },
      hpBonus,
      mpBonus: 0,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCharacters.mockResolvedValue([]);
    api.listarMinhasCampanhas.mockResolvedValue(campaigns);
    api.getCatalogoGlobalClasses.mockResolvedValue(classCatalog);
    api.listarConteudosClasseCampanha.mockResolvedValue([]);
    api.getCampaignClassBonuses.mockResolvedValue(bonusesWithHp(10));
    api.getEquippedAttributeBonusesByCharacter.mockResolvedValue({});
    api.getCampaignResourceMaximums.mockResolvedValue([]);
    api.criarPersonagem.mockImplementation(async (campanhaId, personagem) => ({
      ...personagem,
      id: "created-character",
      campanhaId,
      dataVersion: 1,
    }));
  });

  it("exibe a ficha de criação de novo personagem com os campos principais de história", async () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: /\+ novo personagem/i }));

    expect(screen.getByText(/escolha uma ficha para continuar sua jornada/i)).toBeInTheDocument();

    const formHeading = await screen.findByRole("heading", { name: /criação de personagem/i });
    expect(formHeading).toBeInTheDocument();
    expect(screen.getByLabelText(/nome do personagem/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/raça/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/classe/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/história do personagem/i)).toBeInTheDocument();
  });

  it("mantém a dashboard limpa e não exibe a loja como bloco principal", () => {
    renderDashboard();

    expect(screen.queryByRole("heading", { name: /mercado da campanha/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publicar carta/i })).not.toBeInTheDocument();
  });

  it("usa as regras da campanha selecionada quando respostas anteriores chegam fora de ordem", async () => {
    const rulesA = deferred<ReturnType<typeof bonusesWithHp>>();
    const rulesB = deferred<ReturnType<typeof bonusesWithHp>>();
    api.getCampaignClassBonuses.mockImplementation((campaignId: string) =>
      campaignId === "campaign-a" ? rulesA.promise : rulesB.promise,
    );

    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /\+ novo personagem/i }));
    await screen.findByRole("option", { name: "Campanha A" });
    const campaignSelect = screen.getByLabelText("Vincular a uma campanha (opcional)");
    fireEvent.change(campaignSelect, { target: { value: "campaign-a" } });
    fireEvent.change(campaignSelect, { target: { value: "campaign-b" } });

    expect(campaignSelect).toHaveValue("campaign-b");
    expect(await screen.findByRole("status")).toHaveTextContent("Carregando regras da campanha...");
    expect(screen.getByRole("button", { name: "Carregando regras..." })).toBeDisabled();

    await act(async () => {
      rulesB.resolve(bonusesWithHp(12));
      await rulesB.promise;
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar personagem" })).toBeEnabled());

    await act(async () => {
      rulesA.resolve(bonusesWithHp(80));
      await rulesA.promise;
    });

    fireEvent.change(screen.getByLabelText("Nome do personagem"), {
      target: { value: "Bram da Campanha B" },
    });
    fireEvent.change(screen.getByLabelText("Classe"), { target: { value: "Guerreiro" } });
    fireEvent.submit(screen.getByLabelText("Nome do personagem").closest("form")!);

    await waitFor(() => expect(api.criarPersonagem).toHaveBeenCalledOnce());
    expect(api.criarPersonagem).toHaveBeenCalledWith(
      "campaign-b",
      expect.objectContaining({
        nome: "Bram da Campanha B",
        hp: { atual: 22, max: 22 },
      }),
    );
  });

  it("impede criar personagem vinculado enquanto as regras falharam e permite tentar novamente", async () => {
    api.getCampaignClassBonuses
      .mockRejectedValueOnce(new Error("Falha simulada ao carregar regras"))
      .mockResolvedValueOnce(bonusesWithHp(12));

    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /\+ novo personagem/i }));
    await screen.findByRole("option", { name: "Campanha B" });
    fireEvent.change(screen.getByLabelText("Vincular a uma campanha (opcional)"), {
      target: { value: "campaign-b" },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha simulada ao carregar regras");
    expect(screen.getByRole("button", { name: "Salvar personagem" })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText("Nome do personagem").closest("form")!);
    expect(api.criarPersonagem).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Tentar carregar novamente" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar personagem" })).toBeEnabled());
  });
});
