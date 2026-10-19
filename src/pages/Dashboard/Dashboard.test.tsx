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

const classCatalog = [
  {
    id: "guerreiro",
    nome: "Guerreiro",
    aliases: [],
    usaMagia: false,
    atributoBonus: { forca: 0, destreza: 0, constituicao: 0, inteligencia: 0, carisma: 0 },
    hpBonus: 10,
    mpBonus: 0,
    pericias: [
      { id: "luta", nome: "Luta", atributo: "forca", descricao: "Combate corporal" },
      { id: "atletismo", nome: "Atletismo", atributo: "forca", descricao: "Esforço físico" },
    ],
    habilidades: [
      { nome: "Golpe Poderoso", descricao: "Ataque devastador", nivel: 1 },
      { nome: "Investida Heroica", descricao: "Avança e ataca", nivel: 3 },
    ],
    magias: [],
  },
  {
    id: "mago",
    nome: "Mago",
    aliases: [],
    usaMagia: true,
    atributoBonus: { forca: 0, destreza: 0, constituicao: 0, inteligencia: 2, carisma: 0 },
    hpBonus: 4,
    mpBonus: 16,
    pericias: [
      { id: "misticismo", nome: "Misticismo", atributo: "inteligencia", descricao: "Conhecimento arcano" },
    ],
    habilidades: [
      { nome: "Raio Arcano", descricao: "Dano de energia", nivel: 1 },
    ],
    magias: [],
  },
];

function bonusesWithHp(hpBonus: number) {
  return {
    Guerreiro: {
      atributoBonus: { forca: 0, destreza: 0, constituicao: 0, inteligencia: 0, carisma: 0 },
      hpBonus,
      mpBonus: 0,
    },
    Mago: {
      atributoBonus: { forca: 0, destreza: 0, constituicao: 0, inteligencia: 2, carisma: 0 },
      hpBonus: 4,
      mpBonus: 16,
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
        hp: { atual: 212, max: 212 },
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

  it("impede salvar o personagem sem selecionar uma campanha válida", async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /\+ novo personagem/i }));
    await screen.findByRole("heading", { name: /criação de personagem/i });

    const saveBtn = screen.getByRole("button", { name: /selecione uma campanha/i });
    expect(saveBtn).toBeDisabled();

    fireEvent.submit(screen.getByLabelText("Nome do personagem").closest("form")!);
    expect(api.criarPersonagem).not.toHaveBeenCalled();
  });

  it("permite escolher habilidades iniciais da classe e calcula a prévia de Vitalidade e Mana", async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /\+ novo personagem/i }));
    await screen.findByRole("option", { name: "Campanha A" });
    fireEvent.change(screen.getByLabelText("Vincular a uma campanha (opcional)"), {
      target: { value: "campaign-a" },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar personagem" })).toBeEnabled());

    fireEvent.change(screen.getByLabelText("Nome do personagem"), { target: { value: "Thorin" } });
    fireEvent.change(screen.getByLabelText("Classe"), { target: { value: "Guerreiro" } });

    // Habilidade inicial Golpe Poderoso disponível para escolha
    const golpeCheckbox = await screen.findByRole("checkbox", { name: /golpe poderoso/i });
    expect(golpeCheckbox).not.toBeChecked();
    fireEvent.click(golpeCheckbox);
    expect(golpeCheckbox).toBeChecked();

    // Desbloqueio futuro apresentado
    expect(screen.getAllByText(/investida heroica/i)[0]).toBeInTheDocument();

    // Prévia dinâmica de Vitalidade e Mana
    expect(screen.getByText(/pontos de vida \(pv máximo\)/i)).toBeInTheDocument();
    expect(screen.getByText(/pontos de mana \(pm máximo\)/i)).toBeInTheDocument();

    fireEvent.submit(screen.getByLabelText("Nome do personagem").closest("form")!);
    await waitFor(() => expect(api.criarPersonagem).toHaveBeenCalledOnce());
    expect(api.criarPersonagem).toHaveBeenCalledWith(
      "campaign-a",
      expect.objectContaining({
        nome: "Thorin",
        classe: "Guerreiro",
        habilidades: [
          expect.objectContaining({
            nome: "Golpe Poderoso",
            nivel: 1,
          }),
        ],
      }),
    );
  });

  it("notifica revalidação ao trocar de classe sem apagar atributos ou perícias", async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /\+ novo personagem/i }));
    await screen.findByRole("option", { name: "Campanha A" });
    fireEvent.change(screen.getByLabelText("Vincular a uma campanha (opcional)"), {
      target: { value: "campaign-a" },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar personagem" })).toBeEnabled());

    fireEvent.change(screen.getByLabelText("Classe"), { target: { value: "Guerreiro" } });
    const golpeCheckbox = await screen.findByRole("checkbox", { name: /golpe poderoso/i });
    fireEvent.click(golpeCheckbox);

    // Marca perícia Luta
    const lutaCheckbox = screen.getByRole("checkbox", { name: /luta/i });
    fireEvent.click(lutaCheckbox);
    expect(lutaCheckbox).toBeChecked();

    // Altera atributo Força
    const forcaInput = screen.getByLabelText("Força");
    fireEvent.change(forcaInput, { target: { value: "14" } });
    expect(forcaInput).toHaveValue(14);

    // Troca classe para Mago
    fireEvent.change(screen.getByLabelText("Classe"), { target: { value: "Mago" } });

    // Mensagem de revalidação orienta o jogador
    expect(await screen.findByText(/a classe foi alterada de guerreiro para mago/i)).toBeInTheDocument();

    // Atributos e perícias foram preservados
    expect(forcaInput).toHaveValue(14);
    expect(lutaCheckbox).toBeChecked();
  });

  it("permite vincular campanha por código de convite no criador de personagem", async () => {
    const campanhaPorCodigo = {
      id: "campaign-c",
      nome: "Campanha Convidada C",
      descricao: "Mesa especial",
      sistema: "Elementum",
      imagem_url: null,
      moeda_principal: "Ouro",
      status: "ATIVA",
      codigo_convite: "CONVITE123",
      created_by: "master-c",
      created_at: "2026-10-11T00:00:00.000Z",
      ouro_inicial: 50,
      bonus_classes: null,
    };
    api.entrarNaCampanha.mockResolvedValueOnce(campanhaPorCodigo);

    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /\+ novo personagem/i }));
    await screen.findByRole("heading", { name: /criação de personagem/i });

    const codeInput = screen.getByLabelText("Código de convite da campanha");
    fireEvent.change(codeInput, { target: { value: "convite123" } });
    expect(codeInput).toHaveValue("CONVITE123");

    fireEvent.click(screen.getByRole("button", { name: "Vincular Código" }));
    await waitFor(() => expect(api.entrarNaCampanha).toHaveBeenCalledWith("CONVITE123"));

    expect(await screen.findByText(/campanha "campanha convidada c" vinculada com sucesso!/i)).toBeInTheDocument();
  });

  it("permite inserir valores manuais customizados de Vida máxima e Mana máxima na criação", async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /\+ novo personagem/i }));
    await screen.findByRole("option", { name: "Campanha A" });
    fireEvent.change(screen.getByLabelText("Vincular a uma campanha (opcional)"), {
      target: { value: "campaign-a" },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar personagem" })).toBeEnabled());

    fireEvent.change(screen.getByLabelText("Nome do personagem"), { target: { value: "Custom Hero" } });

    // Modifica manualmente os valores máximos de Vida e Mana
    const hpInput = screen.getByLabelText("Pontos de Vida (PV Máximo)");
    const mpInput = screen.getByLabelText("Pontos de Mana (PM Máximo)");

    fireEvent.change(hpInput, { target: { value: "350" } });
    fireEvent.change(mpInput, { target: { value: "180" } });

    expect(hpInput).toHaveValue(350);
    expect(mpInput).toHaveValue(180);

    fireEvent.submit(screen.getByLabelText("Nome do personagem").closest("form")!);
    await waitFor(() => expect(api.criarPersonagem).toHaveBeenCalledOnce());
    expect(api.criarPersonagem).toHaveBeenCalledWith(
      "campaign-a",
      expect.objectContaining({
        nome: "Custom Hero",
        hp: { atual: 350, max: 350 },
        mp: { atual: 180, max: 180 },
      }),
    );
  });
});
