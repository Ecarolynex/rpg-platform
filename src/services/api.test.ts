import { beforeEach, expect, it, vi } from "vitest";
import { excluirCampanha, vincularPersonagem } from "./api";

const { getUser, from } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: { getUser },
    from,
  },
}));

const zeroWallet = { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 };

describe("vincularPersonagem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("zera todas as moedas ao vincular o personagem à campanha", async () => {
    const membershipQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "membership-1" }, error: null }),
    };
    membershipQuery.select.mockReturnValue(membershipQuery);
    membershipQuery.eq.mockReturnValue(membershipQuery);

    const characterRow = {
      id: "character-1",
      user_id: "user-1",
      campanha_id: null,
      nome: "Aventureiro",
      nivel: 1,
      dados: {
        nome: "Aventureiro",
        raca: "Humano",
        classe: "Guerreiro",
        nivel: 1,
        hp: { atual: 10, max: 10 },
        mp: { atual: 0, max: 0 },
        attributes: {
          forca: 10,
          destreza: 10,
          constituicao: 10,
          inteligencia: 10,
          sabedoria: 10,
          carisma: 10,
        },
        skills: [],
        inventory: [],
        spells: [],
        carteira: { pc: 12, pp: 3, pe: 1, po: 1250, pl: 2 },
        notas: "",
      },
    };

    const characterQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: characterRow, error: null }),
    };
    characterQuery.select.mockReturnValue(characterQuery);
    characterQuery.eq.mockReturnValue(characterQuery);

    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          ...characterRow,
          campanha_id: "campaign-1",
          dados: { ...characterRow.dados, carteira: zeroWallet },
        },
        error: null,
      }),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockReturnValue(updateQuery);

    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    from
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(characterQuery)
      .mockReturnValueOnce(updateQuery);

    const result = await vincularPersonagem("character-1", "campaign-1");

    expect(updateQuery.update).toHaveBeenCalledWith({
      campanha_id: "campaign-1",
      dados: expect.objectContaining({ carteira: zeroWallet }),
    });
    expect(result.carteira).toEqual(zeroWallet);
  });
});

describe("excluirCampanha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recusa a exclusão quando o usuário não é mestre", async () => {
    const membershipQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { papel: "JOGADOR" }, error: null }),
    };
    membershipQuery.select.mockReturnValue(membershipQuery);
    membershipQuery.eq.mockReturnValue(membershipQuery);

    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    from.mockReturnValueOnce(membershipQuery);

    await expect(excluirCampanha("campaign-1")).rejects.toThrow(
      "Somente o Mestre pode excluir esta campanha.",
    );
    expect(from).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith("campanha_membros");
  });
});
