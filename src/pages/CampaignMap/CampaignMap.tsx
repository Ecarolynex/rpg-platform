import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent, PointerEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { getCampaignAccess } from "../../services/api";
import { listarBestiario } from "../../services/bestiario";
import type { Criatura } from "../../services/bestiario";
import "./CampaignMap.css";

type Campaign = { id: string; nome: string; created_by: string };

type MapData = {
  id: string;
  campanha_id: string;
  nome: string;
  descricao: string | null;
  imagem_path: string;
  ativo: boolean;
};

type MarkerType =
  | "boss"
  | "inimigo"
  | "personagem"
  | "local"
  | "tesouro"
  | "portal"
  | "secreto";

type Marker = {
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

type Character = {
  id: string;
  nome: string;
  campanha_id: string | null;
  user_id: string;
};

// O que o Mestre "segurou" para colocar no mapa com o próximo clique.
type Armado =
  | { kind: "personagem"; personagem: Character }
  | { kind: "criatura"; criatura: Criatura }
  | { kind: "livre" };

type Aba = "jogadores" | "bestiario" | "marcadores";

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
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    id: string;
    moved: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  const [userId, setUserId] = useState("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [mapa, setMapa] = useState<MapData | null>(null);
  const [marcadores, setMarcadores] = useState<Marker[]>([]);
  const [personagens, setPersonagens] = useState<Character[]>([]);
  const [criaturas, setCriaturas] = useState<Criatura[]>([]);
  const [imagemUrl, setImagemUrl] = useState("");
  const [isMaster, setIsMaster] = useState(false);

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [aba, setAba] = useState<Aba>("jogadores");
  const [armado, setArmado] = useState<Armado | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [posLocal, setPosLocal] = useState<Record<string, { x: number; y: number }>>({});

  const [livreTipo, setLivreTipo] = useState<MarkerType>("local");
  const [livreNome, setLivreNome] = useState("");
  const [livreDescricao, setLivreDescricao] = useState("");

  const meuPersonagem = useMemo(
    () => personagens.find((p) => p.user_id === userId) ?? null,
    [personagens, userId],
  );

  const visiveis = useMemo(
    () => marcadores.filter((m) => isMaster || m.visivel),
    [marcadores, isMaster],
  );

  const selecionado = visiveis.find((m) => m.id === selecionadoId) ?? null;

  // Acesso rápido à criatura de cada peça (para exibir a foto)
  const criaturaPorId = useMemo(() => {
    const mapaCriaturas = new Map<string, Criatura>();
    criaturas.forEach((c) => mapaCriaturas.set(c.id, c));
    return mapaCriaturas;
  }, [criaturas]);

  function imagemDoMarcador(marker: Marker) {
    if (!marker.criatura_id) return null;
    return criaturaPorId.get(marker.criatura_id)?.imagem_url ?? null;
  }

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
      setMarcadores((data ?? []) as Marker[]);
    },
    [],
  );

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

        // Jogadores (personagens vinculados) — o Mestre enxerga todos pela RLS.
        const { data: personagensData, error: personagensError } = await supabase
          .from("personagens")
          .select("id, nome, campanha_id, user_id")
          .eq("campanha_id", campanhaId)
          .order("nome", { ascending: true });
        if (personagensError) throw personagensError;
        setPersonagens((personagensData ?? []) as Character[]);

        // Mestre vê todas as criaturas; jogadores só as reveladas (RLS).
        // Falhar aqui não pode derrubar o mapa: sem a lista, as peças mostram a inicial.
        setCriaturas(await listarBestiario(campanhaId!).catch(() => []));

        const { data: mapaData, error: mapaError } = await supabase
          .from("mapas")
          .select("id, campanha_id, nome, descricao, imagem_path, ativo")
          .eq("campanha_id", campanhaId)
          .eq("ativo", true)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (mapaError) throw mapaError;

        if (mapaData) {
          setMapa(mapaData);
          await recarregarMarcadores(mapaData.id, mestre);

          const { data: signed, error: signedError } = await supabase.storage
            .from("mapas-campanha")
            .createSignedUrl(mapaData.imagem_path, 3600);
          if (signedError) throw signedError;
          setImagemUrl(signed.signedUrl);
        }
      } catch (error) {
        console.error("Erro ao carregar mapa:", error);
        setErro(erroMensagem(error, "Não foi possível carregar o mapa."));
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, [campanhaId, recarregarMarcadores]);

  /* ---------- Tempo real: todos veem as peças se moverem ---------- */
  useEffect(() => {
    if (!mapa) return;
    const canal = supabase
      .channel(`mapa-${mapa.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mapa_marcadores",
          filter: `mapa_id=eq.${mapa.id}`,
        },
        () => {
          if (dragRef.current) return; // não interrompe um arraste em andamento
          void recarregarMarcadores(mapa.id, isMaster).catch(() => undefined);
          // Uma criatura pode ter acabado de ser revelada: atualiza as fotos também
          if (campanhaId) {
            void listarBestiario(campanhaId)
              .then(setCriaturas)
              .catch(() => undefined);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [mapa, isMaster, campanhaId, recarregarMarcadores]);

  /* ---------- Utilidades ---------- */
  function posicaoDoPonteiro(clientX: number, clientY: number) {
    if (!mapRef.current) return null;
    const rect = mapRef.current.getBoundingClientRect();
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

  function avisar(texto: string) {
    setMensagem(texto);
    setErro("");
  }

  /* ---------- Mapa (upload) ---------- */
  async function handleEnviarMapa(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo || !campanhaId || !userId || !isMaster) return;

    if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type)) {
      setErro("Use uma imagem PNG, JPG ou WEBP.");
      return;
    }
    if (arquivo.size > 10 * 1024 * 1024) {
      setErro("A imagem do mapa deve ter no máximo 10 MB.");
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

      const { data: novoMapa, error: mapaError } = await supabase
        .from("mapas")
        .insert({
          campanha_id: campanhaId,
          nome: arquivo.name.replace(/\.[^/.]+$/, ""),
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

      const { data: signed, error: signedError } = await supabase.storage
        .from("mapas-campanha")
        .createSignedUrl(caminho, 3600);
      if (signedError) throw signedError;

      setMapa(novoMapa);
      setImagemUrl(signed.signedUrl);
      setMarcadores([]);
      avisar("Mapa enviado.");
    } catch (error) {
      console.error("Erro ao enviar mapa:", error);
      setErro(erroMensagem(error, "Não foi possível enviar o mapa."));
    } finally {
      setSalvando(false);
    }
  }

  /* ---------- Marcadores ---------- */
  async function inserirMarcador(
    campos: Partial<Marker> & { tipo: MarkerType; nome: string },
    x: number,
    y: number,
  ) {
    if (!mapa || !campanhaId || !userId) return;
    const { error } = await supabase.from("mapa_marcadores").insert({
      mapa_id: mapa.id,
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

  async function posicionar(x: number, y: number) {
    if (!mapa) return;
    setSalvando(true);
    try {
      if (armado?.kind === "personagem") {
        const existente = marcadores.find(
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
          {
            tipo: c.tipo === "boss" ? "boss" : "inimigo",
            nome: c.nome,
            criatura_id: c.id,
            descricao: c.descricao,
            visivel: false, // nasce oculta; o Mestre revela quando quiser
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

      await recarregarMarcadores(mapa.id, isMaster);
      if (armado?.kind !== "criatura" && armado?.kind !== "livre") setArmado(null);
    } catch (error) {
      console.error("Erro ao posicionar:", error);
      setErro(erroMensagem(error, "Não foi possível posicionar no mapa."));
    } finally {
      setSalvando(false);
    }
  }

  function handleCliqueMapa(event: MouseEvent<HTMLDivElement>) {
    if (!armado) {
      setSelecionadoId(null);
      return;
    }
    const pos = posicaoDoPonteiro(event.clientX, event.clientY);
    if (pos) void posicionar(pos.x, pos.y);
  }

  /* ---------- Arrastar peças ---------- */
  function iniciarArraste(event: PointerEvent<HTMLDivElement>, marker: Marker) {
    event.stopPropagation();
    setSelecionadoId(marker.id);
    if (!podeMover(marker)) return;
    dragRef.current = {
      id: marker.id,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moverArraste(event: PointerEvent<HTMLDivElement>, marker: Marker) {
    const drag = dragRef.current;
    if (!drag || drag.id !== marker.id) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <
        DRAG_THRESHOLD_PX
    ) {
      return;
    }
    drag.moved = true;
    const pos = posicaoDoPonteiro(event.clientX, event.clientY);
    if (pos) setPosLocal({ [marker.id]: pos });
  }

  async function soltarArraste(event: PointerEvent<HTMLDivElement>, marker: Marker) {
    const drag = dragRef.current;
    if (!drag || drag.id !== marker.id) return;
    dragRef.current = null;
    if (!drag.moved) return;

    const pos = posicaoDoPonteiro(event.clientX, event.clientY) ?? posLocal[marker.id];
    setPosLocal({});
    if (!pos || !mapa) return;

    // Atualização otimista; volta ao estado do banco se falhar.
    setMarcadores((atual) =>
      atual.map((m) => (m.id === marker.id ? { ...m, pos_x: pos.x, pos_y: pos.y } : m)),
    );
    const { error } = await supabase
      .from("mapa_marcadores")
      .update({ pos_x: pos.x, pos_y: pos.y })
      .eq("id", marker.id);
    if (error) {
      setErro(erroMensagem(error, "Não foi possível mover a peça."));
      await recarregarMarcadores(mapa.id, isMaster).catch(() => undefined);
    }
  }

  async function alternarVisibilidade(marker: Marker) {
    if (!isMaster || !mapa) return;
    const { error } = await supabase
      .from("mapa_marcadores")
      .update({ visivel: !marker.visivel })
      .eq("id", marker.id);
    if (error) {
      setErro(erroMensagem(error, "Não foi possível alterar a visibilidade."));
      return;
    }
    await recarregarMarcadores(mapa.id, isMaster);
    avisar(marker.visivel ? "Peça oculta dos jogadores." : "Peça revelada aos jogadores.");
  }

  async function removerMarcador(marker: Marker) {
    if (!isMaster || !mapa) return;
    if (!window.confirm(`Remover "${marker.nome}" do mapa?`)) return;
    const { error } = await supabase.from("mapa_marcadores").delete().eq("id", marker.id);
    if (error) {
      setErro(erroMensagem(error, "Não foi possível remover o marcador."));
      return;
    }
    setSelecionadoId(null);
    await recarregarMarcadores(mapa.id, isMaster);
    avisar("Marcador removido.");
  }

  /* ---------- Render ---------- */
  if (loading) {
    return (
      <main className="campaign-map-page">
        <p role="status">Abrindo o mapa da campanha...</p>
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
    marcadores.filter((m) => m.tipo === "personagem").map((m) => m.personagem_id),
  );

  const imagemSelecionado = selecionado ? imagemDoMarcador(selecionado) : null;

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
            Mapa
          </span>
        </nav>
        <h1>Mapa da Campanha</h1>
        <p>{campaign.nome}</p>
      </header>

      {erro && <div className="map-message map-error" role="alert">{erro}</div>}
      {mensagem && <div className="map-message map-success" role="status">{mensagem}</div>}

      {!mapa && isMaster && (
        <section className="map-card map-create-card">
          <div>
            <h2>Desenrole o primeiro mapa</h2>
            <p>Envie a imagem da região, masmorra ou cidade onde a aventura acontece.</p>
          </div>
          <label className="map-upload-button">
            {salvando ? "Enviando..." : "Escolher imagem do mapa"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleEnviarMapa}
              disabled={salvando}
              hidden
            />
          </label>
        </section>
      )}

      {!mapa && !isMaster && (
        <section className="map-card">
          <h2>O mapa ainda está enrolado</h2>
          <p>O Mestre ainda não revelou um mapa para esta campanha.</p>
        </section>
      )}

      {mapa && (
        <div className={isMaster ? "map-layout has-sidebar" : "map-layout"}>
          <section className="map-card map-viewer-card">
            <div className="map-toolbar">
              <div>
                <strong>{mapa.nome}</strong>
                <span>{isMaster ? "Visão do Mestre" : "Visão do Aventureiro"}</span>
              </div>
              <div className="map-toolbar-actions">
                {armado && (
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
                    onClick={() => setArmado({ kind: "personagem", personagem: meuPersonagem })}
                  >
                    Posicionar meu personagem
                  </button>
                )}
                {isMaster && (
                  <label className="map-button secondary">
                    Trocar mapa
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={handleEnviarMapa}
                      disabled={salvando}
                    />
                  </label>
                )}
              </div>
            </div>

            {armado && (
              <p className="map-hint">
                {armado.kind === "personagem" &&
                  `Clique no mapa para colocar ${armado.personagem.nome}.`}
                {armado.kind === "criatura" &&
                  `Clique no mapa para colocar ${armado.criatura.nome}. Você pode repetir para criar várias.`}
                {armado.kind === "livre" && "Preencha o marcador e clique no ponto desejado."}
              </p>
            )}

            <div
              ref={mapRef}
              className={armado ? "campaign-map active-placement" : "campaign-map"}
              onClick={handleCliqueMapa}
            >
              <img src={imagemUrl} alt={`Mapa da campanha ${campaign.nome}`} draggable={false} />

              {visiveis.map((marker) => {
                const pos = posLocal[marker.id] ?? { x: marker.pos_x, y: marker.pos_y };
                const movel = podeMover(marker);
                const fotoMarcador = imagemDoMarcador(marker);
                const classes = [
                  "map-marker",
                  `marker-${marker.tipo}`,
                  marker.id === selecionadoId ? "selected" : "",
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
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => iniciarArraste(event, marker)}
                    onPointerMove={(event) => moverArraste(event, marker)}
                    onPointerUp={(event) => void soltarArraste(event, marker)}
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

            {selecionado && (
              <aside className="map-selected" aria-label="Peça selecionada">
                <div className="map-selected-info">
                  {imagemSelecionado && (
                    <img
                      className="map-selected-img"
                      src={imagemSelecionado}
                      alt={`Imagem de ${selecionado.nome}`}
                    />
                  )}
                  <div>
                    <strong>{selecionado.nome}</strong>
                    <small>
                      {ICONE_TIPO[selecionado.tipo] ? `${ICONE_TIPO[selecionado.tipo]} ` : ""}
                      {TIPO_LABEL[selecionado.tipo]}
                      {isMaster && !selecionado.visivel && " · oculto dos jogadores"}
                    </small>
                    {selecionado.descricao && <p>{selecionado.descricao}</p>}
                  </div>
                </div>
                {isMaster && (
                  <div className="map-selected-actions">
                    <button
                      type="button"
                      className="map-button secondary"
                      onClick={() => void alternarVisibilidade(selecionado)}
                    >
                      {selecionado.visivel ? "Ocultar" : "Revelar"}
                    </button>
                    <button
                      type="button"
                      className="map-button danger"
                      onClick={() => void removerMarcador(selecionado)}
                    >
                      Remover
                    </button>
                  </div>
                )}
              </aside>
            )}
          </section>

          {isMaster && (
            <aside className="map-card map-sidebar" aria-label="Painel do Mestre">
              <div className="map-tabs" role="tablist">
                {(["jogadores", "bestiario", "marcadores"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={aba === id}
                    className={aba === id ? "map-tab active" : "map-tab"}
                    onClick={() => setAba(id)}
                  >
                    {id === "jogadores" ? "Jogadores" : id === "bestiario" ? "Bestiário" : "Marcadores"}
                  </button>
                ))}
              </div>

              {aba === "jogadores" && (
                <ul className="map-list">
                  {personagens.length === 0 && (
                    <li className="map-empty">Nenhum personagem entrou na campanha ainda.</li>
                  )}
                  {personagens.map((p) => {
                    const naMesa = noMapaPersonagemIds.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={
                            armado?.kind === "personagem" && armado.personagem.id === p.id
                              ? "map-list-item armed"
                              : "map-list-item"
                          }
                          onClick={() => setArmado({ kind: "personagem", personagem: p })}
                        >
                          <span className="map-marker-token small">{inicial(p.nome)}</span>
                          <span>
                            <strong>{p.nome}</strong>
                            <small>{naMesa ? "No mapa · clique para mover" : "Fora do mapa"}</small>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {aba === "bestiario" && (
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
              )}

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
                    Escolher ponto no mapa
                  </button>
                </div>
              )}
            </aside>
          )}
        </div>
      )}
    </main>
  );
}