import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import "./CampaignMap.css";

type Campaign = {
  id: string;
  nome: string;
  created_by: string;
};

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
  criado_por: string;
  tipo: MarkerType;
  nome: string;
  tag: string | null;
  pos_x: number;
  pos_y: number;
  visivel: boolean;
  descricao: string | null;
  icone: string | null;
};

type Character = {
  id: string;
  nome: string;
  campanha_id: string | null;
  user_id: string;
};

const MARKER_OPTIONS: {
  type: MarkerType;
  label: string;
  icon: string;
}[] = [
  { type: "boss", label: "Boss", icon: "🐉" },
  { type: "inimigo", label: "Inimigo", icon: "👹" },
  { type: "local", label: "Local", icon: "📍" },
  { type: "tesouro", label: "Tesouro", icon: "💰" },
  { type: "portal", label: "Portal", icon: "🌀" },
  { type: "secreto", label: "Secreto", icon: "❓" },
];

export default function CampaignMap() {
  const { id: campanhaId } = useParams<{ id: string }>();

  const mapRef = useRef<HTMLDivElement | null>(null);

  const [userId, setUserId] = useState("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [mapa, setMapa] = useState<MapData | null>(null);
  const [marcadores, setMarcadores] = useState<Marker[]>([]);
  const [meuPersonagem, setMeuPersonagem] = useState<Character | null>(null);
  const [imagemUrl, setImagemUrl] = useState("");

  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [mostrarCriacao, setMostrarCriacao] = useState(false);
  const [tipoMarcador, setTipoMarcador] =
    useState<MarkerType>("boss");
  const [nomeMarcador, setNomeMarcador] = useState("");
  const [descricaoMarcador, setDescricaoMarcador] = useState("");
  const [visivelMarcador, setVisivelMarcador] = useState(true);

  const [modoPersonagem, setModoPersonagem] = useState(false);

  useEffect(() => {
    if (!campanhaId) return;

    async function carregar() {
      setLoading(true);
      setErro("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("Usuário não autenticado.");
        }

        setUserId(user.id);

        const { data: campanhaData, error: campanhaError } =
          await supabase
            .from("campanhas")
            .select("id, nome, created_by")
            .eq("id", campanhaId)
            .single();

        if (campanhaError) {
          throw campanhaError;
        }

        setCampaign(campanhaData);
        setIsMaster(campanhaData.created_by === user.id);

        const { data: mapaData, error: mapaError } = await supabase
          .from("mapas")
          .select(
            "id, campanha_id, nome, descricao, imagem_path, ativo",
          )
          .eq("campanha_id", campanhaId)
          .eq("ativo", true)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (mapaError) {
          throw mapaError;
        }

        if (mapaData) {
          setMapa(mapaData);

          const { data: marcadorData, error: marcadorError } =
            await supabase
              .from("mapa_marcadores")
              .select("*")
              .eq("mapa_id", mapaData.id)
              .order("criado_em", { ascending: true });

          if (marcadorError) {
            throw marcadorError;
          }

          setMarcadores(marcadorData ?? []);

          const { data: signedData, error: signedError } =
            await supabase.storage
              .from("mapas-campanha")
              .createSignedUrl(mapaData.imagem_path, 3600);

          if (signedError) {
            throw signedError;
          }

          setImagemUrl(signedData.signedUrl);
        }

        const { data: personagemData, error: personagemError } =
          await supabase
            .from("personagens")
            .select("id, nome, campanha_id, user_id")
            .eq("campanha_id", campanhaId)
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (personagemError) {
          throw personagemError;
        }

        setMeuPersonagem(personagemData);
      } catch (error) {
        console.error("Erro ao carregar mapa:", error);

        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o mapa.",
        );
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, [campanhaId]);

  async function recarregarMarcadores(mapaId: string) {
    const { data, error } = await supabase
      .from("mapa_marcadores")
      .select("*")
      .eq("mapa_id", mapaId)
      .order("criado_em", { ascending: true });

    if (error) {
      throw error;
    }

    setMarcadores(data ?? []);
  }

  async function handleCriarMapa(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];

    if (!arquivo || !campanhaId || !userId || !isMaster) {
      return;
    }

    setSalvando(true);
    setErro("");
    setMensagem("");

    try {
      const extensao =
        arquivo.name.split(".").pop()?.toLowerCase() || "jpg";

      const nomeArquivo = `${crypto.randomUUID()}.${extensao}`;
      const caminho = `${campanhaId}/${nomeArquivo}`;

      const { error: uploadError } = await supabase.storage
        .from("mapas-campanha")
        .upload(caminho, arquivo, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

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
        await supabase.storage
          .from("mapas-campanha")
          .remove([caminho]);

        throw mapaError;
      }

      setMapa(novoMapa);

      const { data: signedData, error: signedError } =
        await supabase.storage
          .from("mapas-campanha")
          .createSignedUrl(caminho, 3600);

      if (signedError) {
        throw signedError;
      }

      setImagemUrl(signedData.signedUrl);
      setMarcadores([]);

      setMensagem("Mapa criado com sucesso!");
    } catch (error) {
      console.error("Erro ao criar mapa:", error);

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o mapa.",
      );
    } finally {
      setSalvando(false);
      event.target.value = "";
    }
  }

  function obterPosicao(event: React.MouseEvent<HTMLDivElement>) {
    if (!mapRef.current) {
      return null;
    }

    const rect = mapRef.current.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }

  async function criarMarcador(
    posX: number,
    posY: number,
    personagemId: string | null,
    tipo: MarkerType,
    nome: string,
    descricao: string | null,
    visivel: boolean,
  ) {
    if (!mapa || !campanhaId || !userId) {
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      const { error } = await supabase
        .from("mapa_marcadores")
        .insert({
          mapa_id: mapa.id,
          campanha_id: campanhaId,
          personagem_id: personagemId,
          criado_por: userId,
          tipo,
          nome,
          tag: null,
          pos_x: posX,
          pos_y: posY,
          visivel,
          descricao,
          icone:
            tipo === "personagem"
              ? "👤"
              : MARKER_OPTIONS.find((item) => item.type === tipo)
                  ?.icon ?? "📍",
        });

      if (error) {
        throw error;
      }

      await recarregarMarcadores(mapa.id);

      setMensagem("Marcador criado!");

      setMostrarCriacao(false);
      setModoPersonagem(false);
      setNomeMarcador("");
      setDescricaoMarcador("");
    } catch (error) {
      console.error("Erro ao criar marcador:", error);

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o marcador.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function handleCliqueMapa(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    if (!mapa) return;

    const posicao = obterPosicao(event);

    if (!posicao) return;

    if (modoPersonagem) {
      if (!meuPersonagem) {
        setErro(
          "Você ainda não possui um personagem nesta campanha.",
        );
        return;
      }

      const marcadorExistente = marcadores.find(
        (item) =>
          item.personagem_id === meuPersonagem.id &&
          item.tipo === "personagem",
      );

      try {
        setSalvando(true);
        setErro("");

        if (marcadorExistente) {
          const { error } = await supabase
            .from("mapa_marcadores")
            .update({
              pos_x: posicao.x,
              pos_y: posicao.y,
            })
            .eq("id", marcadorExistente.id);

          if (error) {
            throw error;
          }

          setMensagem("Seu personagem foi movido.");
        } else {
          await criarMarcador(
            posicao.x,
            posicao.y,
            meuPersonagem.id,
            "personagem",
            meuPersonagem.nome,
            null,
            true,
          );
        }

        await recarregarMarcadores(mapa.id);
      } catch (error) {
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível posicionar o personagem.",
        );
      } finally {
        setSalvando(false);
      }

      return;
    }

    if (isMaster && mostrarCriacao) {
      if (!nomeMarcador.trim()) {
        setErro("Informe um nome para o marcador.");
        return;
      }

      await criarMarcador(
        posicao.x,
        posicao.y,
        null,
        tipoMarcador,
        nomeMarcador.trim(),
        descricaoMarcador.trim() || null,
        visivelMarcador,
      );
    }
  }

  async function handleExcluirMarcador(markerId: string) {
    if (!mapa) return;

    if (!isMaster) return;

    try {
      setSalvando(true);

      const { error } = await supabase
        .from("mapa_marcadores")
        .delete()
        .eq("id", markerId);

      if (error) {
        throw error;
      }

      await recarregarMarcadores(mapa.id);
      setMensagem("Marcador removido.");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o marcador.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <main className="campaign-map-page">
        <p>Carregando mapa da campanha...</p>
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

  return (
    <main className="campaign-map-page">
      <header className="campaign-map-header">
        <div>
          <nav className="map-breadcrumbs" aria-label="Navegação da campanha">
            <Link to={`/campanha/${campaign.id}`} className="map-back-link">
              ← Campanha
            </Link>
            <Link to={`/campanha/${campaign.id}/loja`} className="map-back-link">
              Loja
            </Link>
            {meuPersonagem && (
              <Link to={`/personagem/${meuPersonagem.id}`} className="map-back-link">
                Ficha
              </Link>
            )}
            <span className="map-current-page" aria-current="page">Mapa</span>
          </nav>

          <h1>🗺️ Mapa da Campanha</h1>
          <p>{campaign.nome}</p>
        </div>
      </header>

      {erro && (
        <div className="map-message map-error">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="map-message map-success">
          {mensagem}
        </div>
      )}

      {isMaster && !mapa && (
        <section className="map-card map-create-card">
          <div>
            <h2>Criar mapa da campanha</h2>
            <p>
              Envie uma imagem do cenário, dungeon, cidade ou região
              da aventura.
            </p>
          </div>

          <label className="map-upload-button">
            {salvando ? "Enviando..." : "📤 Escolher imagem do mapa"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleCriarMapa}
              disabled={salvando}
              hidden
            />
          </label>
        </section>
      )}

      {!mapa && !isMaster && (
        <section className="map-card">
          <h2>Mapa ainda não disponível</h2>
          <p>
            O Mestre ainda não adicionou um mapa para esta campanha.
          </p>
        </section>
      )}

      {mapa && (
        <>
          <section className="map-toolbar">
            <div>
              <strong>{mapa.nome}</strong>
              <span>
                {isMaster ? "Modo Mestre" : "Modo Jogador"}
              </span>
            </div>

            <div className="map-toolbar-actions">
              {isMaster && (
                <>
                  <button
                    type="button"
                    className={
                      mostrarCriacao
                        ? "map-button active"
                        : "map-button"
                    }
                    onClick={() => {
                      setMostrarCriacao((value) => !value);
                      setModoPersonagem(false);
                      setErro("");
                    }}
                  >
                    {mostrarCriacao
                      ? "Cancelar marcador"
                      : "＋ Adicionar marcador"}
                  </button>

                  <label className="map-button secondary">
                    Trocar mapa
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={handleCriarMapa}
                      disabled={salvando}
                    />
                  </label>
                </>
              )}

              {!isMaster && meuPersonagem && (
                <button
                  type="button"
                  className={
                    modoPersonagem
                      ? "map-button active"
                      : "map-button"
                  }
                  onClick={() => {
                    setModoPersonagem((value) => !value);
                    setMostrarCriacao(false);
                    setErro("");
                  }}
                >
                  {modoPersonagem
                    ? "Clique no mapa para posicionar"
                    : "👤 Posicionar meu personagem"}
                </button>
              )}
            </div>
          </section>

          {isMaster && mostrarCriacao && (
            <section className="map-marker-form">
              <div>
                <label>
                  Tipo
                  <select
                    value={tipoMarcador}
                    onChange={(event) =>
                      setTipoMarcador(
                        event.target.value as MarkerType,
                      )
                    }
                  >
                    {MARKER_OPTIONS.map((option) => (
                      <option
                        key={option.type}
                        value={option.type}
                      >
                        {option.icon} {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Nome
                  <input
                    value={nomeMarcador}
                    onChange={(event) =>
                      setNomeMarcador(event.target.value)
                    }
                    placeholder="Ex.: Dragão Vermelho"
                  />
                </label>

                <label>
                  Descrição
                  <textarea
                    value={descricaoMarcador}
                    onChange={(event) =>
                      setDescricaoMarcador(event.target.value)
                    }
                    placeholder="Informações sobre este marcador..."
                    rows={3}
                  />
                </label>

                <label className="map-checkbox">
                  <input
                    type="checkbox"
                    checked={visivelMarcador}
                    onChange={(event) =>
                      setVisivelMarcador(event.target.checked)
                    }
                  />
                  Visível para os jogadores
                </label>

                <p>
                  Depois de preencher, <strong>clique no ponto do
                  mapa</strong> onde deseja colocar o marcador.
                </p>
              </div>
            </section>
          )}

          <section className="map-card map-viewer-card">
            <div
              ref={mapRef}
              className={
                modoPersonagem
                  ? "campaign-map active-placement"
                  : "campaign-map"
              }
              onClick={handleCliqueMapa}
            >
              <img
                src={imagemUrl}
                alt={`Mapa da campanha ${campaign.nome}`}
              />

              {marcadores.map((marker) => (
                <div
                  key={marker.id}
                  className={`map-marker marker-${marker.tipo}`}
                  style={{
                    left: `${marker.pos_x}%`,
                    top: `${marker.pos_y}%`,
                    transform: `translate(${marker.pos_x < 4 ? "0%" : marker.pos_x > 96 ? "-100%" : "-50%"}, ${marker.pos_y < 5 ? "0%" : marker.pos_y > 95 ? "-100%" : "-50%"})`,
                  }}
                  title={marker.nome}
                  onClick={(event) => {
                    event.stopPropagation();

                    if (
                      isMaster &&
                      window.confirm(
                        `Excluir o marcador "${marker.nome}"?`,
                      )
                    ) {
                      void handleExcluirMarcador(marker.id);
                    }
                  }}
                >
                  <span className="map-marker-icon">
                    {marker.icone ??
                      (marker.tipo === "personagem"
                        ? "👤"
                        : "📍")}
                  </span>

                  <span className="map-marker-name">
                    {marker.nome}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="map-legend">
            <h2>Marcadores</h2>

            <div className="map-legend-grid">
              {marcadores.map((marker) => (
                <div key={marker.id} className="map-legend-item">
                  <span>
                    {marker.icone ??
                      (marker.tipo === "personagem"
                        ? "👤"
                        : "📍")}
                  </span>

                  <div>
                    <strong>{marker.nome}</strong>
                    <small>{marker.tipo}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}