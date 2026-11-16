import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent, PointerEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { getCampaignAccess, enviarRetrato, getCharacterById, atualizarPersonagem } from "../../services/api";
import { listarBestiario } from "../../services/bestiario";
import type { Criatura } from "../../services/bestiario";
import "./CampaignMap.css";

type Campaign = { id: string; nome: string; created_by: string };

export type MapData = {
  id: string;
  campanha_id: string;
  nome: string;
  descricao: string | null;
  imagem_path: string;
  ativo: boolean;
};

export type MarkerType =
  | "boss"
  | "inimigo"
  | "personagem"
  | "local"
  | "tesouro"
  | "portal"
  | "secreto";

export type Marker = {
  id: string;
  mapa_id: string;
  campanha_id: string;
  personagem_id: string | null;
  criatura_id: string | null;
  criado_por: string;
  tipo: MarkerType;
  nome: string;
  pos_x: number;
  pos_y: number;
  visivel: boolean;
  descricao: string | null;
};

export type Character = {
  id: string;
  nome: string;
  campanha_id: string | null;
  user_id: string;
  portraitUrl?: string;
};

// O que o Mestre ou Jogador "segurou" para colocar no mapa com o próximo clique.
type Armado =
  | { kind: "personagem"; personagem: Character }
  | { kind: "criatura"; criatura: Criatura }
  | { kind: "livre" };

type AbaPainel = "jogadores" | "bestiario" | "marcadores" | "gerenciarMapas";

const LIVRE_OPTIONS: { type: MarkerType; label: string }[] = [
  { type: "local", label: "Local" },
  { type: "tesouro", label: "Tesouro" },
  { type: "portal", label: "Portal" },
  { type: "secreto", label: "Segredo" },
];

const TIPO_LABEL: Record<MarkerType, string> = {
  boss: "Chefe",
  inimigo: "Inimigo",
  personagem: "Aventureiro",
  local: "Local",
  tesouro: "Tesouro",
  portal: "Portal",
  secreto: "Segredo",
};

// Ícone de cada tipo de marcador livre (peças de criatura/personagem usam foto ou inicial)
const ICONE_TIPO: Partial<Record<MarkerType, string>> = {
  local: "📍",
  tesouro: "💰",
  portal: "🌀",
  secreto: "❓",
};

const DRAG_THRESHOLD_PX = 4;

function inicial(nome: string) {
  return nome.trim().charAt(0).toUpperCase() || "?";
}

function erroMensagem(error: unknown, padrao: string) {
  return error instanceof Error && error.message ? error.message : padrao;
}

// Foto dentro do aro; sem foto (ou se falhar), mostra o ícone do tipo ou a inicial.
function TokenFace({
  nome,
  imagemUrl,
  icone,
}: {
  nome: string;
  imagemUrl?: string | null;
  icone?: string;
}) {
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    setFalhou(false);
  }, [imagemUrl]);

  if (imagemUrl && !falhou) {
    return (
      <img
        src={imagemUrl}
        alt=""
        draggable={false}
        loading="lazy"
        onError={() => setFalhou(true)}
      />
    );
  }
  return <>{icone ?? inicial(nome)}</>;
}

export default function CampaignMap() {
  const { id: campanhaId } = useParams<{ id: string }>();

  // Refs de arrasto e ponteiro
  const mapRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragRef = useRef<{
    mapaId: string;
    id: string;
    moved: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  const inputNovoMapaRef = useRef<HTMLInputElement>(null);
  const inputAvatarRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isMaster, setIsMaster] = useState(false);

  // Lista de mapas cadastrados
  const [mapas, setMapas] = useState<MapData[]>([]);
  const [mapaAtivoId, setMapaAtivoId] = useState<string>("");
  const [mapaSecundarioId, setMapaSecundarioId] = useState<string>("");
  const [splitView, setSplitView] = useState(false);

  // Cache de URLs assinadas dos mapas: mapaId -> url
  const [mapUrls, setMapUrls] = useState<Record<string, string>>({});

  // Marcadores de todos os mapas abertos ou conhecidos: mapaId -> Marker[]
  const [marcadoresPorMapa, setMarcadoresPorMapa] = useState<Record<string, Marker[]>>({});

  const [personagens, setPersonagens] = useState<Character[]>([]);
  const [criaturas, setCriaturas] = useState<Criatura[]>([]);

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [aba, setAba] = useState<AbaPainel>("jogadores");
  const [armado, setArmado] = useState<Armado | null>(null);
  const [selecionado, setSelecionado] = useState<{ mapaId: string; marker: Marker } | null>(null);

  // Posições temporárias de arraste: `${mapaId}:${markerId}` -> { x, y }
  const [posLocal, setPosLocal] = useState<Record<string, { x: number; y: number }>>({});

  // Criação de marcador livre
  const [livreTipo, setLivreTipo] = useState<MarkerType>("local");
  const [livreNome, setLivreNome] = useState("");
  const [livreDescricao, setLivreDescricao] = useState("");

  // Criação / Upload de novo mapa com nome personalizado
  const [novoMapaNome, setNovoMapaNome] = useState("");
  const [renomeandoMapaId, setRenomeandoMapaId] = useState<string | null>(null);
  const [nomeEmEdicao, setNomeEmEdicao] = useState("");

  // Upload de avatar de personagem
  const [personagemParaFoto, setPersonagemParaFoto] = useState<Character | null>(null);

  const meuPersonagem = useMemo(
    () => personagens.find((p) => p.user_id === userId) ?? null,
    [personagens, userId],
  );

  // Mapas exibidos na tela
  const mapaPrimario = useMemo(
    () => mapas.find((m) => m.id === mapaAtivoId) ?? (mapas[0] || null),
    [mapas, mapaAtivoId],
  );

  const mapaSecundario = useMemo(() => {
    if (!splitView) return null;
    return mapas.find((m) => m.id === mapaSecundarioId && m.id !== mapaPrimario?.id) ?? null;
  }, [mapas, splitView, mapaSecundarioId, mapaPrimario]);

  // Acesso rápido à criatura de cada peça
  const criaturaPorId = useMemo(() => {
    const map = new Map<string, Criatura>();
    criaturas.forEach((c) => map.set(c.id, c));
    return map;
  }, [criaturas]);

  // Acesso rápido ao personagem de cada peça
  const personagemPorId = useMemo(() => {
    const map = new Map<string, Character>();
    personagens.forEach((p) => map.set(p.id, p));
    return map;
  }, [personagens]);

  function imagemDoMarcador(marker: Marker): string | null {
    if (marker.criatura_id) {
      return criaturaPorId.get(marker.criatura_id)?.imagem_url ?? null;
    }
    if (marker.personagem_id) {
      return personagemPorId.get(marker.personagem_id)?.portraitUrl ?? null;
    }
    return null;
  }

  function avisar(texto: string) {
    setMensagem(texto);
    setErro("");
  }

  // Obter signed URL para um mapa se ainda não tiver em cache
  const obterSignedUrl = useCallback(async (caminho: string): Promise<string> => {
    const { data: signed, error } = await supabase.storage
      .from("mapas-campanha")
      .createSignedUrl(caminho, 3600);
    if (error) throw error;
    return signed.signedUrl;
  }, []);

  const recarregarMarcadores = useCallback(
    async (mapaId: string, mestre: boolean) => {
      let query = supabase
        .from("mapa_marcadores")
        .select("*")
        .eq("mapa_id", mapaId)
        .order("criado_em", { ascending: true });
      if (!mestre) query = query.eq("visivel", true);
      const { data, error } = await query;
      if (error) throw error;
      setMarcadoresPorMapa((prev) => ({
        ...prev,
        [mapaId]: (data ?? []) as Marker[],
      }));
    },
    [],
  );

  // Carregar personagens da campanha com dados completos para extrair portraitUrl
  const recarregarPersonagens = useCallback(async (campId: string) => {
    const { data, error } = await supabase
      .from("personagens")
      .select("id, nome, campanha_id, user_id, dados")
      .eq("campanha_id", campId)
      .order("nome", { ascending: true });
    if (error) throw error;

    const lista: Character[] = (data ?? []).map((row: any) => {
      let portraitUrl: string | undefined;
      if (row.dados && typeof row.dados === "object") {
        if (typeof row.dados.portraitUrl === "string" && row.dados.portraitUrl) {
          portraitUrl = row.dados.portraitUrl;
        } else if (typeof row.dados.imagemUrl === "string" && row.dados.imagemUrl) {
          portraitUrl = row.dados.imagemUrl;
        }
      }
      return {
        id: row.id,
        nome: row.nome,
        campanha_id: row.campanha_id,
        user_id: row.user_id,
        portraitUrl,
      };
    });
    setPersonagens(lista);
  }, []);

  /* ---------- Carregamento inicial ---------- */
  useEffect(() => {
    if (!campanhaId) return;

    async function carregar() {
      setLoading(true);
      setErro("");
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado.");
        setUserId(user.id);

        const { data: campanhaData, error: campanhaError } = await supabase
          .from("campanhas")
          .select("id, nome, created_by")
          .eq("id", campanhaId)
          .single();
        if (campanhaError) throw campanhaError;
        setCampaign(campanhaData);

        const { isMaster: mestre } = await getCampaignAccess(campanhaId!);
        setIsMaster(mestre);

        await recarregarPersonagens(campanhaId!);

        // Criaturas do Bestiário
        setCriaturas(await listarBestiario(campanhaId!).catch(() => []));

        // Todos os mapas da campanha
        let mapasQuery = supabase
          .from("mapas")
          .select("id, campanha_id, nome, descricao, imagem_path, ativo")
          .eq("campanha_id", campanhaId)
          .order("criado_em", { ascending: true });

        // Jogador só vê mapas ativos se mestre mantiver ativo=true
        if (!mestre) {
          mapasQuery = mapasQuery.eq("ativo", true);
        }

        const { data: mapasData, error: mapasError } = await mapasQuery;
        if (mapasError) throw mapasError;

        const mapasCarregados = (mapasData ?? []) as MapData[];
        setMapas(mapasCarregados);

        if (mapasCarregados.length > 0) {
          const primeiro = mapasCarregados[0];
          setMapaAtivoId(primeiro.id);
          if (mapasCarregados.length > 1) {
            setMapaSecundarioId(mapasCarregados[1].id);
          }

          // Carregar marcadores e URLs de todos os mapas
          for (const m of mapasCarregados) {
            void recarregarMarcadores(m.id, mestre).catch(() => undefined);
            void obterSignedUrl(m.imagem_path)
              .then((url) => {
                setMapUrls((prev) => ({ ...prev, [m.id]: url }));
              })
              .catch(() => undefined);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar mapa:", error);
        setErro(erroMensagem(error, "Não foi possível carregar os mapas da campanha."));
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, [campanhaId, recarregarMarcadores, recarregarPersonagens, obterSignedUrl]);

  /* ---------- Tempo real: canal para todos os mapas da campanha ---------- */
  useEffect(() => {
    if (!campanhaId) return;

    const canal = supabase
      .channel(`mapa-campanha-${campanhaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mapa_marcadores",
          filter: `campanha_id=eq.${campanhaId}`,
        },
        (payload) => {
          if (dragRef.current) return; // não interrompe arraste em andamento
          const mapaId = (payload.new as any)?.mapa_id || (payload.old as any)?.mapa_id;
          if (mapaId) {
            void recarregarMarcadores(mapaId, isMaster).catch(() => undefined);
          } else {
            // Recarrega todos os mapas abertos
            mapas.forEach((m) => void recarregarMarcadores(m.id, isMaster).catch(() => undefined));
          }
          void listarBestiario(campanhaId).then(setCriaturas).catch(() => undefined);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mapas",
          filter: `campanha_id=eq.${campanhaId}`,
        },
        async () => {
          let query = supabase
            .from("mapas")
            .select("id, campanha_id, nome, descricao, imagem_path, ativo")
            .eq("campanha_id", campanhaId)
            .order("criado_em", { ascending: true });
          if (!isMaster) query = query.eq("ativo", true);
          const { data } = await query;
          if (data) {
            const novos = data as MapData[];
            setMapas(novos);
            for (const m of novos) {
              if (!mapUrls[m.id]) {
                void obterSignedUrl(m.imagem_path)
                  .then((url) => setMapUrls((prev) => ({ ...prev, [m.id]: url })))
                  .catch(() => undefined);
              }
            }
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [campanhaId, isMaster, mapas, mapUrls, obterSignedUrl, recarregarMarcadores]);

  /* ---------- Utilidades de Posicionamento e Arraste ---------- */
  function posicaoDoPonteiro(mapaId: string, clientX: number, clientY: number) {
    const el = mapRefs.current[mapaId];
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  }

  function podeMover(marker: Marker) {
    if (isMaster) return true;
    return (
      marker.tipo === "personagem" &&
      !!meuPersonagem &&
      marker.personagem_id === meuPersonagem.id
    );
  }

  /* ---------- Upload e Gerenciamento de Mapas ---------- */
  async function handleEnviarNovoMapa(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo || !campanhaId || !userId || !isMaster) return;

    if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type)) {
      setErro("Use uma imagem PNG, JPG ou WEBP.");
      return;
    }
    if (arquivo.size > 15 * 1024 * 1024) {
      setErro("A imagem do mapa deve ter no máximo 15 MB.");
      return;
    }

    setSalvando(true);
    setErro("");
    try {
      const extensao = arquivo.name.split(".").pop()?.toLowerCase() || "jpg";
      const caminho = `${campanhaId}/${crypto.randomUUID()}.${extensao}`;

      const { error: uploadError } = await supabase.storage
        .from("mapas-campanha")
        .upload(caminho, arquivo, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const nomeFinal =
        novoMapaNome.trim() ||
        arquivo.name.replace(/\.[^/.]+$/, "") ||
        `Mapa ${mapas.length + 1}`;

      const { data: novoMapa, error: mapaError } = await supabase
        .from("mapas")
        .insert({
          campanha_id: campanhaId,
          nome: nomeFinal,
          descricao: null,
          imagem_path: caminho,
          ativo: true,
          criado_por: userId,
        })
        .select()
        .single();

      if (mapaError) {
        await supabase.storage.from("mapas-campanha").remove([caminho]);
        throw mapaError;
      }

      const signedUrl = await obterSignedUrl(caminho);
      setMapUrls((prev) => ({ ...prev, [novoMapa.id]: signedUrl }));
      setMapas((prev) => [...prev, novoMapa as MapData]);
      setMapaAtivoId(novoMapa.id);
      setMarcadoresPorMapa((prev) => ({ ...prev, [novoMapa.id]: [] }));
      setNovoMapaNome("");
      avisar(`Mapa "${novoMapa.nome}" adicionado com sucesso!`);
    } catch (error) {
      console.error("Erro ao enviar mapa:", error);
      setErro(erroMensagem(error, "Não foi possível enviar o mapa."));
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarNomeMapa(mapaId: string) {
    if (!nomeEmEdicao.trim() || !isMaster) {
      setRenomeandoMapaId(null);
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("mapas")
        .update({ nome: nomeEmEdicao.trim() })
        .eq("id", mapaId);
      if (error) throw error;
      setMapas((prev) =>
        prev.map((m) => (m.id === mapaId ? { ...m, nome: nomeEmEdicao.trim() } : m)),
      );
      avisar("Nome do mapa atualizado.");
    } catch (error) {
      setErro(erroMensagem(error, "Erro ao renomear o mapa."));
    } finally {
      setSalvando(false);
      setRenomeandoMapaId(null);
    }
  }

  async function handleAlternarAtivoMapa(mapaId: string, statusAtual: boolean) {
    if (!isMaster) return;
    try {
      const { error } = await supabase
        .from("mapas")
        .update({ ativo: !statusAtual })
        .eq("id", mapaId);
      if (error) throw error;
      setMapas((prev) =>
        prev.map((m) => (m.id === mapaId ? { ...m, ativo: !statusAtual } : m)),
      );
      avisar(!statusAtual ? "Mapa visível aos jogadores." : "Mapa oculto dos jogadores.");
    } catch (error) {
      setErro(erroMensagem(error, "Erro ao alterar visibilidade do mapa."));
    }
  }

  async function handleExcluirMapa(mapaId: string, nomeMapa: string) {
    if (!isMaster) return;
    if (
      !window.confirm(
        `Tem certeza que deseja excluir o mapa "${nomeMapa}"? Todos os marcadores vinculados a ele serão removidos.`,
      )
    ) {
      return;
    }

    setSalvando(true);
    try {
      // 1. Deletar marcadores do mapa
      await supabase.from("mapa_marcadores").delete().eq("mapa_id", mapaId);

      // 2. Deletar registro do mapa
      const mapaAlvo = mapas.find((m) => m.id === mapaId);
      const { error } = await supabase.from("mapas").delete().eq("id", mapaId);
      if (error) throw error;

      // 3. Remover imagem do storage (opcional, se falhar não trava)
      if (mapaAlvo?.imagem_path) {
        await supabase.storage.from("mapas-campanha").remove([mapaAlvo.imagem_path]).catch(() => null);
      }

      const restantes = mapas.filter((m) => m.id !== mapaId);
      setMapas(restantes);
      if (mapaAtivoId === mapaId) {
        setMapaAtivoId(restantes[0]?.id || "");
      }
      if (mapaSecundarioId === mapaId) {
        setMapaSecundarioId(restantes.find((m) => m.id !== restantes[0]?.id)?.id || "");
      }
      avisar(`Mapa "${nomeMapa}" excluído.`);
    } catch (error) {
      setErro(erroMensagem(error, "Não foi possível excluir o mapa."));
    } finally {
      setSalvando(false);
    }
  }

  /* ---------- Upload / Troca de Avatar do Personagem ---------- */
  async function handleEnviarAvatar(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo || !personagemParaFoto) return;

    if (!arquivo.type.startsWith("image/")) {
      setErro("Selecione um arquivo de imagem válido (PNG, JPG, WEBP).");
      return;
    }

    setSalvando(true);
    setErro("");
    try {
      avisar("Enviando foto do avatar...");
      const fotoUrl = await enviarRetrato(arquivo);

      // Obter personagem completo e atualizar retrato
      const charCompleto = await getCharacterById(personagemParaFoto.id);
      if (charCompleto) {
        await atualizarPersonagem(personagemParaFoto.id, {
          ...charCompleto,
          portraitUrl: fotoUrl,
        });
      } else {
        // Fallback direto via dados JSON se não vier via getCharacterById
        const { data: charRow } = await supabase
          .from("personagens")
          .select("dados")
          .eq("id", personagemParaFoto.id)
          .single();
        const dadosAtuais = (charRow?.dados as Record<string, unknown>) || {};
        await supabase
          .from("personagens")
          .update({ dados: { ...dadosAtuais, portraitUrl: fotoUrl } })
          .eq("id", personagemParaFoto.id);
      }

      // Atualizar estado local
      setPersonagens((prev) =>
        prev.map((p) => (p.id === personagemParaFoto.id ? { ...p, portraitUrl: fotoUrl } : p)),
      );

      avisar(`Avatar de ${personagemParaFoto.nome} atualizado com sucesso!`);
      setPersonagemParaFoto(null);
    } catch (error) {
      console.error("Erro ao enviar avatar:", error);
      setErro(erroMensagem(error, "Não foi possível atualizar a foto do personagem."));
    } finally {
      setSalvando(false);
    }
  }

  /* ---------- Inserir e Posicionar Marcadores ---------- */
  async function inserirMarcador(
    mapaId: string,
    campos: Partial<Marker> & { tipo: MarkerType; nome: string },
    x: number,
    y: number,
  ) {
    if (!campanhaId || !userId) return;
    const { error } = await supabase.from("mapa_marcadores").insert({
      mapa_id: mapaId,
      campanha_id: campanhaId,
      criado_por: userId,
      personagem_id: null,
      criatura_id: null,
      descricao: null,
      visivel: true,
      pos_x: x,
      pos_y: y,
      ...campos,
    });
    if (error) throw error;
  }

  async function posicionarNoMapa(mapaId: string, x: number, y: number) {
    setSalvando(true);
    try {
      const marcadoresDesteMapa = marcadoresPorMapa[mapaId] || [];

      if (armado?.kind === "personagem") {
        const existente = marcadoresDesteMapa.find(
          (m) => m.tipo === "personagem" && m.personagem_id === armado.personagem.id,
        );
        if (existente) {
          const { error } = await supabase
            .from("mapa_marcadores")
            .update({ pos_x: x, pos_y: y })
            .eq("id", existente.id);
          if (error) throw error;
          avisar(`${armado.personagem.nome} foi movido.`);
        } else {
          await inserirMarcador(
            mapaId,
            {
              tipo: "personagem",
              nome: armado.personagem.nome,
              personagem_id: armado.personagem.id,
            },
            x,
            y,
          );
          avisar(`${armado.personagem.nome} entrou no mapa.`);
        }
      } else if (armado?.kind === "criatura") {
        const c = armado.criatura;
        await inserirMarcador(
          mapaId,
          {
            tipo: c.tipo === "boss" ? "boss" : "inimigo",
            nome: c.nome,
            criatura_id: c.id,
            descricao: c.descricao,
            visivel: false, // nasce oculta ao Mestre
          },
          x,
          y,
        );
        avisar(`${c.nome} posicionada (oculta aos jogadores).`);
      } else if (armado?.kind === "livre") {
        if (!livreNome.trim()) {
          setErro("Informe um nome para o marcador.");
          return;
        }
        await inserirMarcador(
          mapaId,
          {
            tipo: livreTipo,
            nome: livreNome.trim(),
            descricao: livreDescricao.trim() || null,
          },
          x,
          y,
        );
        setLivreNome("");
        setLivreDescricao("");
        avisar("Marcador criado.");
      }

      await recarregarMarcadores(mapaId, isMaster);
      if (armado?.kind !== "criatura" && armado?.kind !== "livre") {
        setArmado(null);
      }
    } catch (error) {
      console.error("Erro ao posicionar:", error);
      setErro(erroMensagem(error, "Não foi possível posicionar no mapa."));
    } finally {
      setSalvando(false);
    }
  }

  function handleCliqueMapa(mapaId: string, event: MouseEvent<HTMLDivElement>) {
    if (!armado) {
      setSelecionado(null);
      return;
    }
    const pos = posicaoDoPonteiro(mapaId, event.clientX, event.clientY);
    if (pos) void posicionarNoMapa(mapaId, pos.x, pos.y);
  }

  /* ---------- Arrastar Peças / Marcadores ---------- */
  function iniciarArraste(
    mapaId: string,
    event: PointerEvent<HTMLDivElement>,
    marker: Marker,
  ) {
    event.stopPropagation();
    setSelecionado({ mapaId, marker });
    if (!podeMover(marker)) return;

    dragRef.current = {
      mapaId,
      id: marker.id,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moverArraste(
    mapaId: string,
    event: PointerEvent<HTMLDivElement>,
    marker: Marker,
  ) {
    const drag = dragRef.current;
    if (!drag || drag.id !== marker.id || drag.mapaId !== mapaId) return;

    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <
        DRAG_THRESHOLD_PX
    ) {
      return;
    }
    drag.moved = true;
    const pos = posicaoDoPonteiro(mapaId, event.clientX, event.clientY);
    if (pos) {
      setPosLocal({ [`${mapaId}:${marker.id}`]: pos });
    }
  }

  async function soltarArraste(
    mapaId: string,
    event: PointerEvent<HTMLDivElement>,
    marker: Marker,
  ) {
    const drag = dragRef.current;
    if (!drag || drag.id !== marker.id || drag.mapaId !== mapaId) return;
    dragRef.current = null;
    if (!drag.moved) return;

    const chave = `${mapaId}:${marker.id}`;
    const pos = posicaoDoPonteiro(mapaId, event.clientX, event.clientY) ?? posLocal[chave];
    setPosLocal({});
    if (!pos) return;

    // Atualização otimista
    setMarcadoresPorMapa((prev) => ({
      ...prev,
      [mapaId]: (prev[mapaId] || []).map((m) =>
        m.id === marker.id ? { ...m, pos_x: pos.x, pos_y: pos.y } : m,
      ),
    }));

    const { error } = await supabase
      .from("mapa_marcadores")
      .update({ pos_x: pos.x, pos_y: pos.y })
      .eq("id", marker.id);

    if (error) {
      setErro(erroMensagem(error, "Não foi possível mover a peça."));
      await recarregarMarcadores(mapaId, isMaster).catch(() => undefined);
    }
  }

  async function alternarVisibilidadeMarcador(mapaId: string, marker: Marker) {
    if (!isMaster) return;
    const { error } = await supabase
      .from("mapa_marcadores")
      .update({ visivel: !marker.visivel })
      .eq("id", marker.id);
    if (error) {
      setErro(erroMensagem(error, "Não foi possível alterar a visibilidade."));
      return;
    }
    await recarregarMarcadores(mapaId, isMaster);
    avisar(marker.visivel ? "Peça oculta dos jogadores." : "Peça revelada aos jogadores.");
  }

  async function removerMarcador(mapaId: string, marker: Marker) {
    if (!isMaster) return;
    if (!window.confirm(`Remover "${marker.nome}" do mapa?`)) return;
    const { error } = await supabase.from("mapa_marcadores").delete().eq("id", marker.id);
    if (error) {
      setErro(erroMensagem(error, "Não foi possível remover o marcador."));
      return;
    }
    setSelecionado(null);
    await recarregarMarcadores(mapaId, isMaster);
    avisar("Marcador removido.");
  }

  /* ---------- Renderizador de um Painel de Mapa Individual ---------- */
  function renderizarPainelMapa(m: MapData, ehSecundario = false) {
    const url = mapUrls[m.id];
    const todosMarcadores = marcadoresPorMapa[m.id] || [];
    const marcadoresVisiveis = todosMarcadores.filter((mk) => isMaster || mk.visivel);

    return (
      <section
        key={m.id}
        className={`map-card map-viewer-card ${ehSecundario ? "secondary-map-view" : ""}`}
      >
        <div className="map-toolbar">
          <div className="map-title-zone">
            {ehSecundario ? (
              <div className="map-secondary-select">
                <label htmlFor="select-mapa-secundario">Segundo mapa:</label>
                <select
                  id="select-mapa-secundario"
                  value={m.id}
                  onChange={(e) => setMapaSecundarioId(e.target.value)}
                >
                  {mapas
                    .filter((outro) => outro.id !== mapaPrimario?.id)
                    .map((outro) => (
                      <option key={outro.id} value={outro.id}>
                        {outro.nome}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <strong>{m.nome}</strong>
            )}
            <span>
              {isMaster ? "Visão do Mestre" : "Visão do Aventureiro"}
              {!m.ativo && isMaster && " · (Oculto dos jogadores)"}
            </span>
          </div>

          <div className="map-toolbar-actions">
            {armado && !ehSecundario && (
              <button
                type="button"
                className="map-button active"
                onClick={() => setArmado(null)}
              >
                Cancelar posicionamento
              </button>
            )}
            {!isMaster && meuPersonagem && !armado && (
              <button
                type="button"
                className="map-button"
                onClick={() =>
                  setArmado({ kind: "personagem", personagem: meuPersonagem })
                }
              >
                Posicionar meu personagem
              </button>
            )}
          </div>
        </div>

        {armado && (
          <p className="map-hint">
            {armado.kind === "personagem" &&
              `Clique no mapa para posicionar ${armado.personagem.nome}.`}
            {armado.kind === "criatura" &&
              `Clique no mapa para colocar ${armado.criatura.nome}. Pode clicar várias vezes.`}
            {armado.kind === "livre" && "Clique no ponto desejado para adicionar o marcador."}
          </p>
        )}

        <div
          ref={(el) => {
            mapRefs.current[m.id] = el;
          }}
          className={armado ? "campaign-map active-placement" : "campaign-map"}
          onClick={(e) => handleCliqueMapa(m.id, e)}
        >
          {url ? (
            <img src={url} alt={`Mapa ${m.nome}`} draggable={false} />
          ) : (
            <div className="map-loading-placeholder">Carregando imagem do mapa...</div>
          )}

          {marcadoresVisiveis.map((marker) => {
            const chave = `${m.id}:${marker.id}`;
            const pos = posLocal[chave] ?? { x: marker.pos_x, y: marker.pos_y };
            const movel = podeMover(marker);
            const fotoMarcador = imagemDoMarcador(marker);
            const isSelected =
              selecionado?.mapaId === m.id && selecionado?.marker.id === marker.id;

            const classes = [
              "map-marker",
              `marker-${marker.tipo}`,
              isSelected ? "selected" : "",
              !marker.visivel ? "hidden-from-players" : "",
              movel ? "movable" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={marker.id}
                className={classes}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                title={marker.nome}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => iniciarArraste(m.id, e, marker)}
                onPointerMove={(e) => moverArraste(m.id, e, marker)}
                onPointerUp={(e) => void soltarArraste(m.id, e, marker)}
                onPointerCancel={() => {
                  dragRef.current = null;
                  setPosLocal({});
                }}
              >
                <span
                  className={
                    fotoMarcador
                      ? "map-marker-token has-image"
                      : ICONE_TIPO[marker.tipo]
                        ? "map-marker-token has-icon"
                        : "map-marker-token"
                  }
                >
                  <TokenFace
                    nome={marker.nome}
                    imagemUrl={fotoMarcador}
                    icone={ICONE_TIPO[marker.tipo]}
                  />
                </span>
                <span className="map-marker-name">{marker.nome}</span>
              </div>
            );
          })}
        </div>

        {/* Detalhes do marcador selecionado neste mapa */}
        {selecionado && selecionado.mapaId === m.id && (
          <aside className="map-selected" aria-label="Peça selecionada">
            <div className="map-selected-info">
              {imagemDoMarcador(selecionado.marker) && (
                <img
                  className="map-selected-img"
                  src={imagemDoMarcador(selecionado.marker)!}
                  alt={`Imagem de ${selecionado.marker.nome}`}
                />
              )}
              <div>
                <strong>{selecionado.marker.nome}</strong>
                <small>
                  {ICONE_TIPO[selecionado.marker.tipo]
                    ? `${ICONE_TIPO[selecionado.marker.tipo]} `
                    : ""}
                  {TIPO_LABEL[selecionado.marker.tipo]}
                  {isMaster &&
                    !selecionado.marker.visivel &&
                    " · oculto dos jogadores"}
                </small>
                {selecionado.marker.descricao && (
                  <p>{selecionado.marker.descricao}</p>
                )}
              </div>
            </div>
            {isMaster && (
              <div className="map-selected-actions">
                <button
                  type="button"
                  className="map-button secondary"
                  onClick={() =>
                    void alternarVisibilidadeMarcador(
                      m.id,
                      selecionado.marker,
                    )
                  }
                >
                  {selecionado.marker.visivel ? "Ocultar" : "Revelar"}
                </button>
                <button
                  type="button"
                  className="map-button danger"
                  onClick={() =>
                    void removerMarcador(m.id, selecionado.marker)
                  }
                >
                  Remover
                </button>
              </div>
            )}
          </aside>
        )}
      </section>
    );
  }

  /* ---------- Render Principal ---------- */
  if (loading) {
    return (
      <main className="campaign-map-page">
        <p role="status">Carregando os mapas da campanha...</p>
      </main>
    );
  }

  if (!campaign) {
    return (
      <main className="campaign-map-page">
        <section className="map-card">
          <h1>Campanha não encontrada</h1>
          <Link to="/campanhas" className="map-button">
            Voltar para campanhas
          </Link>
        </section>
      </main>
    );
  }

  const noMapaPersonagemIds = new Set(
    (mapaPrimario ? marcadoresPorMapa[mapaPrimario.id] || [] : [])
      .filter((m) => m.tipo === "personagem")
      .map((m) => m.personagem_id),
  );

  return (
    <main className="campaign-map-page">
      <header className="campaign-map-header">
        <nav className="map-breadcrumbs" aria-label="Navegação da campanha">
          <Link to={`/campanha/${campaign.id}`} className="map-back-link">
            Campanha
          </Link>
          <Link to={`/campanha/${campaign.id}/bestiario`} className="map-back-link">
            Bestiário
          </Link>
          <Link to={`/campanha/${campaign.id}/loja`} className="map-back-link">
            Loja
          </Link>
          {meuPersonagem && (
            <Link to={`/personagem/${meuPersonagem.id}`} className="map-back-link">
              Minha ficha
            </Link>
          )}
          <span className="map-current-page" aria-current="page">
            Mapas
          </span>
        </nav>
        <h1>Mapas da Campanha</h1>
        <p>{campaign.nome}</p>
      </header>

      {erro && (
        <div className="map-message map-error" role="alert">
          {erro}
        </div>
      )}
      {mensagem && (
        <div className="map-message map-success" role="status">
          {mensagem}
        </div>
      )}

      {/* Input oculto para upload de avatar de jogador */}
      <input
        ref={inputAvatarRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleEnviarAvatar}
      />

      {/* Nenhum mapa cadastrado ainda */}
      {mapas.length === 0 && isMaster && (
        <section className="map-card map-create-card">
          <div>
            <h2>Desenrole o primeiro mapa</h2>
            <p>Envie a imagem da região, masmorra ou cidade onde a aventura acontece.</p>
            <div className="map-create-input-group">
              <input
                type="text"
                placeholder="Nome do mapa (ex: Vila Inicial, Masmorra...)"
                value={novoMapaNome}
                onChange={(e) => setNovoMapaNome(e.target.value)}
                className="map-text-input"
              />
              <label className="map-upload-button">
                {salvando ? "Enviando..." : "Escolher imagem do mapa"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleEnviarNovoMapa}
                  disabled={salvando}
                  hidden
                />
              </label>
            </div>
          </div>
        </section>
      )}

      {mapas.length === 0 && !isMaster && (
        <section className="map-card">
          <h2>O mapa ainda está enrolado</h2>
          <p>O Mestre ainda não revelou nenhum mapa para esta campanha.</p>
        </section>
      )}

      {/* Mapas disponíveis */}
      {mapas.length > 0 && (
        <>
          {/* Barra de Seleção de Mapas por Abas e Modos de Exibição */}
          <div className="map-tabs-header-bar">
            <div className="map-navigation-tabs" role="tablist" aria-label="Abas de mapas">
              {mapas.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={mapaAtivoId === m.id}
                  className={`map-nav-tab ${mapaAtivoId === m.id ? "active" : ""}`}
                  onClick={() => setMapaAtivoId(m.id)}
                >
                  🗺️ {m.nome}
                  {!m.ativo && isMaster && <span className="tab-badge-hidden">oculto</span>}
                </button>
              ))}

              {isMaster && (
                <button
                  type="button"
                  className="map-nav-tab map-nav-add-btn"
                  title="Adicionar novo mapa"
                  onClick={() => inputNovoMapaRef.current?.click()}
                >
                  ➕ Novo mapa
                </button>
              )}
              {isMaster && (
                <input
                  ref={inputNovoMapaRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={handleEnviarNovoMapa}
                />
              )}
            </div>

            <div className="map-view-controls">
              {mapas.length > 1 && (
                <button
                  type="button"
                  className={`map-button secondary ${splitView ? "active" : ""}`}
                  onClick={() => {
                    const novoModo = !splitView;
                    setSplitView(novoModo);
                    if (novoModo && (!mapaSecundarioId || mapaSecundarioId === mapaAtivoId)) {
                      const outro = mapas.find((m) => m.id !== mapaAtivoId);
                      if (outro) setMapaSecundarioId(outro.id);
                    }
                  }}
                  title="Visualizar dois mapas lado a lado"
                >
                  👁️ {splitView ? "Visualização Única" : "Visualizar 2 Mapas Lado a Lado"}
                </button>
              )}
            </div>
          </div>

          <div
            className={`map-layout ${isMaster ? "has-sidebar" : ""} ${
              splitView && mapaSecundario ? "is-split-layout" : ""
            }`}
          >
            {/* Área de Visualização do(s) Mapa(s) */}
            <div className={`map-viewport-container ${splitView && mapaSecundario ? "split-mode" : ""}`}>
              {mapaPrimario && renderizarPainelMapa(mapaPrimario, false)}
              {splitView && mapaSecundario && renderizarPainelMapa(mapaSecundario, true)}
            </div>

            {/* Painel Lateral do Mestre */}
            {isMaster && (
              <aside className="map-card map-sidebar" aria-label="Painel do Mestre">
                <div className="map-tabs" role="tablist">
                  {(
                    [
                      { id: "jogadores", label: "Jogadores" },
                      { id: "bestiario", label: "Bestiário" },
                      { id: "marcadores", label: "Marcadores" },
                      { id: "gerenciarMapas", label: "Mapas" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={aba === item.id}
                      className={aba === item.id ? "map-tab active" : "map-tab"}
                      onClick={() => setAba(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Aba Jogadores */}
                {aba === "jogadores" && (
                  <div className="map-tab-content">
                    <p className="sidebar-tab-desc">
                      Clique no jogador para posicioná-lo no mapa ativo ou use a câmera para alterar a foto do avatar.
                    </p>
                    <ul className="map-list">
                      {personagens.length === 0 && (
                        <li className="map-empty">Nenhum personagem entrou na campanha ainda.</li>
                      )}
                      {personagens.map((p) => {
                        const naMesa = noMapaPersonagemIds.has(p.id);
                        const isArmed =
                          armado?.kind === "personagem" && armado.personagem.id === p.id;
                        return (
                          <li key={p.id} className="map-player-list-item">
                            <button
                              type="button"
                              className={isArmed ? "map-list-item armed" : "map-list-item"}
                              onClick={() => setArmado({ kind: "personagem", personagem: p })}
                            >
                              <span
                                className={`map-marker-token small ${
                                  p.portraitUrl ? "has-image" : ""
                                }`}
                              >
                                <TokenFace nome={p.nome} imagemUrl={p.portraitUrl} />
                              </span>
                              <span>
                                <strong>{p.nome}</strong>
                                <small>
                                  {naMesa ? "No mapa · clique para mover" : "Fora do mapa"}
                                </small>
                              </span>
                            </button>
                            <button
                              type="button"
                              className="map-avatar-upload-btn"
                              title={`Alterar foto/avatar de ${p.nome}`}
                              onClick={() => {
                                setPersonagemParaFoto(p);
                                inputAvatarRef.current?.click();
                              }}
                            >
                              📷
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Aba Bestiário */}
                {aba === "bestiario" && (
                  <div className="map-tab-content">
                    <ul className="map-list">
                      {criaturas.length === 0 && (
                        <li className="map-empty">
                          Nenhuma criatura cadastrada.{" "}
                          <Link to={`/campanha/${campaign.id}/bestiario`}>Abrir Bestiário</Link>
                        </li>
                      )}
                      {criaturas.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className={
                              armado?.kind === "criatura" && armado.criatura.id === c.id
                                ? "map-list-item armed"
                                : "map-list-item"
                            }
                            onClick={() => setArmado({ kind: "criatura", criatura: c })}
                          >
                            <span
                              className={`map-marker-token small tipo-${c.tipo}${
                                c.imagem_url ? " has-image" : ""
                              }`}
                            >
                              <TokenFace nome={c.nome} imagemUrl={c.imagem_url} />
                            </span>
                            <span>
                              <strong>{c.nome}</strong>
                              <small>
                                {c.tipo === "boss" ? "Chefe" : c.tipo === "npc" ? "NPC" : "Inimigo"}
                                {c.nivel_ameaca ? ` · ameaça ${c.nivel_ameaca}` : ""}
                              </small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Aba Marcadores Livres */}
                {aba === "marcadores" && (
                  <div className="map-marker-form">
                    <label>
                      Tipo
                      <select
                        value={livreTipo}
                        onChange={(e) => setLivreTipo(e.target.value as MarkerType)}
                      >
                        {LIVRE_OPTIONS.map((o) => (
                          <option key={o.type} value={o.type}>
                            {ICONE_TIPO[o.type]} {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nome
                      <input
                        value={livreNome}
                        onChange={(e) => setLivreNome(e.target.value)}
                        placeholder="Ex.: Ruínas do Carvalho Antigo"
                      />
                    </label>
                    <label>
                      Descrição
                      <textarea
                        rows={3}
                        value={livreDescricao}
                        onChange={(e) => setLivreDescricao(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="map-button"
                      onClick={() => {
                        if (!livreNome.trim()) {
                          setErro("Informe um nome para o marcador.");
                          return;
                        }
                        setErro("");
                        setArmado({ kind: "livre" });
                      }}
                    >
                      Escolher ponto no mapa ativo
                    </button>
                  </div>
                )}

                {/* Aba Gerenciar Mapas */}
                {aba === "gerenciarMapas" && (
                  <div className="map-manage-tab">
                    <div className="map-add-box">
                      <h4>Importar / Adicionar Mapa</h4>
                      <input
                        type="text"
                        placeholder="Nome do novo mapa"
                        value={novoMapaNome}
                        onChange={(e) => setNovoMapaNome(e.target.value)}
                        className="map-text-input"
                      />
                      <label className="map-upload-button" style={{ width: "100%", marginTop: "6px" }}>
                        {salvando ? "Enviando..." : "Carregar Imagem"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleEnviarNovoMapa}
                          disabled={salvando}
                          hidden
                        />
                      </label>
                    </div>

                    <div className="map-list-title">Mapas da Campanha ({mapas.length})</div>
                    <ul className="map-manage-list">
                      {mapas.map((m) => (
                        <li key={m.id} className="map-manage-item">
                          {renomeandoMapaId === m.id ? (
                            <div className="map-rename-row">
                              <input
                                type="text"
                                value={nomeEmEdicao}
                                onChange={(e) => setNomeEmEdicao(e.target.value)}
                                autoFocus
                                className="map-text-input small"
                              />
                              <button
                                type="button"
                                className="map-btn-icon save"
                                title="Salvar"
                                onClick={() => void handleSalvarNomeMapa(m.id)}
                              >
                                ✔
                              </button>
                              <button
                                type="button"
                                className="map-btn-icon"
                                title="Cancelar"
                                onClick={() => setRenomeandoMapaId(null)}
                              >
                                ✖
                              </button>
                            </div>
                          ) : (
                            <div className="map-manage-info">
                              <span className="map-manage-name">{m.nome}</span>
                              <div className="map-manage-sub">
                                <button
                                  type="button"
                                  className="link-btn"
                                  onClick={() => {
                                    setRenomeandoMapaId(m.id);
                                    setNomeEmEdicao(m.nome);
                                  }}
                                >
                                  Renomear
                                </button>
                                <span>·</span>
                                <button
                                  type="button"
                                  className="link-btn"
                                  onClick={() => void handleAlternarAtivoMapa(m.id, m.ativo)}
                                >
                                  {m.ativo ? "Ocultar" : "Revelar"}
                                </button>
                                <span>·</span>
                                <button
                                  type="button"
                                  className="link-btn danger"
                                  onClick={() => void handleExcluirMapa(m.id, m.nome)}
                                >
                                  Excluir
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>
            )}
          </div>
        </>
      )}
    </main>
  );
}
