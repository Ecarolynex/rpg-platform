import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CampaignMap from "./CampaignMap";
import { supabase } from "../../services/supabase";

vi.mock("../../services/api", () => ({
  getCampaignAccess: vi.fn().mockResolvedValue({ isMaster: true }),
  enviarRetrato: vi.fn().mockResolvedValue("https://fake.url/avatar.png"),
  atualizarPersonagem: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../services/bestiario", () => ({
  listarBestiario: vi.fn().mockResolvedValue([]),
}));

const mockCampanha = {
  id: "camp-123",
  nome: "Aventuras em Aldória",
  created_by: "user-mestre",
};

const mockMapas = [
  {
    id: "mapa-1",
    campanha_id: "camp-123",
    nome: "Vila de Valéria",
    descricao: null,
    imagem_path: "camp-123/mapa1.png",
    ativo: true,
  },
  {
    id: "mapa-2",
    campanha_id: "camp-123",
    nome: "Masmorra Profunda",
    descricao: null,
    imagem_path: "camp-123/mapa2.png",
    ativo: true,
  },
];

const mockMarcadores = [
  {
    id: "mark-1",
    mapa_id: "mapa-1",
    campanha_id: "camp-123",
    personagem_id: "char-1",
    criatura_id: null,
    criado_por: "user-1",
    tipo: "personagem",
    nome: "Galandor",
    pos_x: 20,
    pos_y: 30,
    visivel: true,
    descricao: null,
  },
];

const mockPersonagens = [
  {
    id: "char-1",
    nome: "Galandor",
    campanha_id: "camp-123",
    user_id: "user-1",
    dados: {
      portraitUrl: "https://fake.url/galandor.png",
    },
  },
];

describe("CampaignMap - Múltiplos Mapas e Marcadores", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: { id: "user-mestre", email: "mestre@teste.com" } } as any,
      error: null,
    });

    vi.spyOn(supabase.storage, "from").mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://fake.storage/map.png" },
        error: null,
      }),
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    } as any);

    vi.spyOn(supabase, "channel").mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({}),
    } as any);

    vi.spyOn(supabase, "removeChannel").mockResolvedValue("ok" as any);

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "campanhas") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockCampanha, error: null }),
            }),
          }),
        } as any;
      }
      if (table === "personagens") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockPersonagens, error: null }),
            }),
          }),
        } as any;
      }
      if (table === "mapas") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockMapas, error: null }),
            }),
          }),
        } as any;
      }
      if (table === "mapa_marcadores") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockMarcadores, error: null }),
            }),
          }),
        } as any;
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      } as any;
    });
  });

  function renderizar() {
    return render(
      <MemoryRouter initialEntries={["/campanha/camp-123/mapa"]}>
        <Routes>
          <Route path="/campanha/:id/mapa" element={<CampaignMap />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("renderiza as abas de múltiplos mapas e os nomes configurados", async () => {
    renderizar();

    await waitFor(() => {
      expect(screen.getByText("🗺️ Vila de Valéria")).toBeInTheDocument();
      expect(screen.getByText("🗺️ Masmorra Profunda")).toBeInTheDocument();
    });
  });

  it("permite alternar entre mapas pelas abas", async () => {
    renderizar();

    await waitFor(() => {
      expect(screen.getByText("🗺️ Vila de Valéria")).toBeInTheDocument();
    });

    const abaMasmorra = screen.getByText("🗺️ Masmorra Profunda");
    fireEvent.click(abaMasmorra);

    await waitFor(() => {
      expect(abaMasmorra.getAttribute("aria-selected")).toBe("true");
    });
  });

  it("permite ativar a visualização de dois mapas lado a lado (split view)", async () => {
    renderizar();

    await waitFor(() => {
      expect(screen.getByText(/Visualizar 2 Mapas Lado a Lado/i)).toBeInTheDocument();
    });

    const botaoSplit = screen.getByText(/Visualizar 2 Mapas Lado a Lado/i);
    fireEvent.click(botaoSplit);

    await waitFor(() => {
      expect(screen.getByText(/Visualização Única/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Segundo mapa:/i)).toBeInTheDocument();
    });
  });

  it("exibe avatar circular com foto para jogadores nos marcadores e na lista", async () => {
    renderizar();

    await waitFor(() => {
      // Marcador no mapa
      const marcador = screen.getByTitle("Galandor");
      expect(marcador).toBeInTheDocument();
      // O marcador deve conter imagem com a URL do portrait
      const imgToken = marcador.querySelector("img");
      expect(imgToken).toHaveAttribute("src", "https://fake.url/galandor.png");
    });
  });
});
