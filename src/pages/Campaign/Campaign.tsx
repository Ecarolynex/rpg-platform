import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  atualizarPersonagem,
  excluirCampanha,
  getCampaignAccess,
  getCharacters,
  listarMinhasCampanhas,
  listarPersonagensDaCampanha,
  vincularPersonagem,
  type Campaign,
} from "../../services/api";
import type { Character } from "../../types/character";
import { CharacterCard } from "../../components/character/CharacterCard";
import { StatBar } from "../../components/ui/StatBar";
import "./Campaign.css";

export default function Campaign() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);

  const [todosDaCampanha, setTodosDaCampanha] = useState<Character[]>([]);
  const [meusNaCampanha, setMeusNaCampanha] = useState<Character[]>([]);
  const [outrosPersonagens, setOutrosPersonagens] = useState<Character[]>([]);
  const [semCampanha, setSemCampanha] = useState<Character[]>([]);
  const [escolhido, setEscolhido] = useState("");

  const [vinculando, setVinculando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [versao, setVersao] = useState(0);

  // Ferramenta do Mestre: Distribuição de Ouro
  const [ouroDistribuir, setOuroDistribuir] = useState("50");
  const [destinatarioOuro, setDestinatarioOuro] = useState("TODOS");
  const [distribuindoOuro, setDistribuindoOuro] = useState(false);
  const [ouroMensagem, setOuroMensagem] = useState("");

  // Feedback de cópia do código
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function carregar(campanhaId: string) {
      try {
        const [campanhas, acesso, daCampanha, meus] = await Promise.all([
          listarMinhasCampanhas(),
          getCampaignAccess(campanhaId),
          listarPersonagensDaCampanha(campanhaId),
          getCharacters(),
        ]);

        const meusIds = new Set(meus.map((personagem) => personagem.id));
        const livres = meus.filter((personagem) => personagem.campanhaId === null);

        setCampaign(campanhas.find((item) => item.id === campanhaId) ?? null);
        setIsMaster(acesso.isMaster);
        setTodosDaCampanha(daCampanha);
        setMeusNaCampanha(
          meus.filter((personagem) => personagem.campanhaId === campanhaId),
        );
        setOutrosPersonagens(
          daCampanha.filter((personagem) => !meusIds.has(personagem.id)),
        );
        setSemCampanha(livres);
        setEscolhido((atual) =>
          livres.some((personagem) => personagem.id === atual)
            ? atual
            : (livres[0]?.id ?? ""),
        );
      } catch (error) {
        console.error("Erro ao carregar campanha:", error);
      } finally {
        setLoading(false);
      }
    }

    void carregar(id);
  }, [id, versao]);

  async function handleVincular(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!id || !escolhido) return;

    setVinculando(true);
    setMensagem("");

    try {
      await vincularPersonagem(escolhido, id);
      setMensagem("Personagem vinculado à campanha com sucesso!");
      setVersao((atual) => atual + 1);
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível vincular o personagem.",
      );
    } finally {
      setVinculando(false);
    }
  }

  async function handleDistribuirOuro(event: React.FormEvent) {
    event.preventDefault();
    const quantia = parseInt(ouroDistribuir, 10);
    if (isNaN(quantia) || quantia <= 0 || todosDaCampanha.length === 0) return;

    setDistribuindoOuro(true);
    setOuroMensagem("");

    try {
      if (destinatarioOuro === "TODOS") {
        for (const char of todosDaCampanha) {
          const carteiraAtual = char.carteira ?? { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 };
          const novoOuro = Math.min(9999999, (carteiraAtual.po || 0) + quantia);
          await atualizarPersonagem(char.id, {
            ...char,
            carteira: {
              ...carteiraAtual,
              po: novoOuro,
            },
          });
        }
        setOuroMensagem(
          `Concluído! ${quantia} PO foram distribuídos para todos os ${todosDaCampanha.length} personagens do grupo.`,
        );
      } else {
        const alvo = todosDaCampanha.find((c) => c.id === destinatarioOuro);
        if (!alvo) {
          throw new Error("Personagem selecionado não foi encontrado.");
        }
        const carteiraAtual = alvo.carteira ?? { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 };
        const novoOuro = Math.min(9999999, (carteiraAtual.po || 0) + quantia);
        await atualizarPersonagem(alvo.id, {
          ...alvo,
          carteira: {
            ...carteiraAtual,
            po: novoOuro,
          },
        });
        setOuroMensagem(
          `Concluído! ${quantia} PO foram entregues para ${alvo.nome}.`,
        );
      }

      setVersao((v) => v + 1);
    } catch (err) {
      setOuroMensagem(
        err instanceof Error ? err.message : "Erro ao entregar ouro.",
      );
    } finally {
      setDistribuindoOuro(false);
    }
  }

  const handleCopiarCodigo = () => {
    if (!campaign?.codigo_convite) return;
    navigator.clipboard.writeText(campaign.codigo_convite);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  async function handleExcluirCampanha() {
    if (!id || !isMaster || excluindo) return;

    setExcluindo(true);
    setErroExclusao("");

    try {
      await excluirCampanha(id);
      navigate("/campanhas", { replace: true });
    } catch (error) {
      setErroExclusao(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a campanha.",
      );
    } finally {
      setExcluindo(false);
    }
  }

  if (loading) {
    return (
      <div className="campaign-detail-page">
        <p>Carregando aventura e dados da mesa...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="campaign-detail-page">
        <div className="campaign-empty-banner">
          <h1>Campanha não encontrada</h1>
          <p>Você não participa desta aventura ou ela foi arquivada.</p>
          <Link to="/campanhas" className="btn-primary">
            Voltar para Minhas Campanhas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="campaign-detail-page">
      {/* Cabeçalho da Campanha */}
      <header className="campaign-detail-header">
        <div className="campaign-detail-nav">
          <Link to="/campanhas" className="campaign-back-link">
            ← Minhas Campanhas
          </Link>

          <div className="campaign-header-badges">
            <span className="campaign-badge">{campaign.status}</span>
            {isMaster && (
              <span className="campaign-badge campaign-badge-master">
                👑 Mestre da Campanha
              </span>
            )}
          </div>
        </div>

        <h1 className="campaign-detail-title">{campaign.nome}</h1>

        <p className="campaign-detail-desc">
          {campaign.descricao || "Nenhuma descrição cadastrada para esta aventura."}
        </p>

        <div className="campaign-actions-bar">
          <Link className="btn-primary" to={"/campanha/" + campaign.id + "/loja"}>
            Mercado & Loja da Campanha
          </Link>

          <button
            type="button"
            className="btn-ghost campaign-copy-btn"
            onClick={handleCopiarCodigo}
            title="Copiar código de convite da campanha"
          >
            {copiado ? "✓ Código Copiado!" : `Código: ${campaign.codigo_convite} 📋`}
          </button>
        </div>
      </header>

      {/* Grid de Metadados da Campanha */}
      <div className="campaign-meta-grid">
        <div className="campaign-meta-card">
          <span>Sistema de Regras</span>
          <strong>{campaign.sistema || "D&D 5e / Custom"}</strong>
        </div>

        <div className="campaign-meta-card">
          <span>Moeda Principal</span>
          <strong>{campaign.moeda_principal || "Ouro (PO)"}</strong>
        </div>

        <div className="campaign-meta-card">
          <span>Ouro Inicial por Jogador</span>
          <strong>{campaign.ouro_inicial ?? 1250} PO</strong>
        </div>

        <div className="campaign-meta-card">
          <span>Código de Convite</span>
          <div className="campaign-code-highlight">
            <strong>{campaign.codigo_convite}</strong>
            <button
              type="button"
              className="btn-ghost campaign-copy-btn"
              onClick={handleCopiarCodigo}
            >
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      </div>

      {/* PAINEL DO MESTRE: Visível apenas se o usuário for o Mestre */}
      {isMaster && (
        <section className="campaign-section">
          <div className="campaign-section-header">
            <div className="campaign-section-title">
              <h2>👑 Painel de Controle do Mestre</h2>
              <span className="campaign-section-badge">
                {todosDaCampanha.length} {todosDaCampanha.length === 1 ? "Personagem" : "Personagens"} na Mesa
              </span>
            </div>
          </div>

          <p style={{ color: "var(--muted)", margin: "0 0 16px" }}>
            Como Mestre, você pode visualizar e alterar livremente a vida, mana, dinheiro e atributos de todos os personagens da aventura.
          </p>

          {todosDaCampanha.length > 0 ? (
            <div className="party-overview-grid">
              {todosDaCampanha.map((personagem) => {
                const po = personagem.carteira?.po ?? 0;
                return (
                  <article key={personagem.id} className="party-char-card">
                    <div className="party-char-head">
                      <div className="party-char-portrait">
                        {personagem.portraitUrl ? (
                          <img src={personagem.portraitUrl} alt={personagem.nome} />
                        ) : (
                          personagem.nome.charAt(0)
                        )}
                      </div>

                      <div className="party-char-info">
                        <h3>{personagem.nome}</h3>
                        <p className="party-char-meta">
                          {personagem.raca} · {personagem.classe} · Nvl {personagem.nivel}
                        </p>
                      </div>
                    </div>

                    <div className="party-char-stats-row">
                      <div className="party-stat-mini">
                        <span>Vida</span>
                        <strong>{personagem.hp.atual} / {personagem.hp.max}</strong>
                      </div>
                      <div className="party-stat-mini">
                        <span>Mana</span>
                        <strong>{personagem.mp.atual} / {personagem.mp.max}</strong>
                      </div>
                      <div className="party-stat-mini">
                        <span>Ouro</span>
                        <strong style={{ color: "var(--gold-bright)" }}>{po} PO</strong>
                      </div>
                    </div>

                    <div className="party-char-vitals">
                      <StatBar
                        label="Vida"
                        atual={personagem.hp.atual}
                        max={personagem.hp.max}
                        tone="wine"
                      />
                      <StatBar
                        label="Mana"
                        atual={personagem.mp.atual}
                        max={personagem.mp.max}
                        tone="forest"
                      />
                    </div>

                    <div className="party-char-actions">
                      <Link
                        className="btn-primary"
                        to={"/personagem/" + personagem.id}
                      >
                        Abrir / Alterar Ficha
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="campaign-empty-banner">
              <p>Nenhum personagem de jogador entrou na campanha ainda.</p>
              <p>
                Compartilhe o código <strong>{campaign.codigo_convite}</strong> com seus jogadores para que eles possam vincular seus personagens.
              </p>
            </div>
          )}

          {/* Ferramenta de Recompensa do Mestre: Distribuir Ouro */}
          {todosDaCampanha.length > 0 && (
            <div className="master-reward-box">
              <div className="master-reward-info">
                <h4>Entregar Recompensa em Ouro</h4>
                <p>Distribua moedas de ouro para todo o grupo ou para um jogador específico da mesa.</p>
              </div>

              <form onSubmit={handleDistribuirOuro} className="master-reward-form">
                <div className="master-reward-field">
                  <label htmlFor="master-gold-input">Quantia</label>
                  <div className="master-reward-amount-wrap">
                    <input
                      id="master-gold-input"
                      type="number"
                      className="master-reward-input"
                      min="1"
                      max="100000"
                      value={ouroDistribuir}
                      onChange={(e) => setOuroDistribuir(e.target.value)}
                      disabled={distribuindoOuro}
                    />
                    <span className="master-reward-unit">PO</span>
                  </div>
                </div>

                <div className="master-reward-field">
                  <label htmlFor="master-target-select">Destinatário</label>
                  <select
                    id="master-target-select"
                    className="master-reward-select"
                    value={destinatarioOuro}
                    onChange={(e) => setDestinatarioOuro(e.target.value)}
                    disabled={distribuindoOuro}
                  >
                    <option value="TODOS">✦ Todos os Jogadores ({todosDaCampanha.length})</option>
                    <optgroup label="Jogador Específico">
                      {todosDaCampanha.map((char) => (
                        <option key={char.id} value={char.id}>
                          {char.nome} ({char.classe} · Nvl {char.nivel})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn-primary master-reward-submit"
                  disabled={distribuindoOuro || !ouroDistribuir}
                >
                  {distribuindoOuro ? "Entregando..." : "Entregar Recompensa"}
                </button>
              </form>
            </div>
          )}

          {ouroMensagem && (
            <p style={{ marginTop: 12, color: "var(--gold-bright)", fontWeight: 600 }}>
              {ouroMensagem}
            </p>
          )}
        </section>
      )}

      {/* ÁREA DO JOGADOR: Meu Personagem na Campanha */}
      <section className="campaign-section">
        <div className="campaign-section-header">
          <div className="campaign-section-title">
            <h2>Meu personagem nesta aventura</h2>
          </div>
        </div>

        {meusNaCampanha.length > 0 ? (
          <div className="dashboard-grid">
            {meusNaCampanha.map((personagem) => (
              <CharacterCard key={personagem.id} character={personagem} />
            ))}
          </div>
        ) : isMaster ? (
          <div>
            <p style={{ color: "var(--muted)" }}>
              Você está atuando como <strong>Mestre</strong> nesta campanha. Mestres não precisam de um personagem de jogador para narrar.
            </p>
            {semCampanha.length > 0 && (
              <details style={{ marginTop: 12, cursor: "pointer" }}>
                <summary style={{ color: "var(--gold-bright)", fontSize: "0.9rem" }}>
                  Deseja vincular um personagem ou NPC próprio a esta campanha?
                </summary>
                <form onSubmit={handleVincular} style={{ marginTop: 12 }}>
                  <label className="field">
                    <span>Escolher personagem</span>
                    <select
                      value={escolhido}
                      onChange={(event) => setEscolhido(event.target.value)}
                    >
                      {semCampanha.map((personagem) => (
                        <option key={personagem.id} value={personagem.id}>
                          {personagem.nome} · {personagem.raca} · {personagem.classe}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ marginTop: 8 }}
                    disabled={vinculando || !escolhido}
                  >
                    {vinculando ? "Vinculando..." : "Vincular à campanha"}
                  </button>
                </form>
              </details>
            )}
          </div>
        ) : semCampanha.length > 0 ? (
          <form onSubmit={handleVincular}>
            <p>Escolha qual personagem vai participar desta campanha.</p>

            <label className="field">
              <span>Personagem</span>
              <select
                value={escolhido}
                onChange={(event) => setEscolhido(event.target.value)}
              >
                {semCampanha.map((personagem) => (
                  <option key={personagem.id} value={personagem.id}>
                    {personagem.nome} · {personagem.raca} · {personagem.classe}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="btn-primary"
              disabled={vinculando || !escolhido}
            >
              {vinculando ? "Vinculando..." : "Vincular à campanha"}
            </button>
          </form>
        ) : (
          <p>
            Você ainda não tem um personagem livre para esta campanha.{" "}
            <Link to="/">Crie um em Meus personagens</Link> e volte aqui.
          </p>
        )}

        {mensagem && (
          <p style={{ marginTop: 12, color: "var(--gold-bright)" }}>
            {mensagem}
          </p>
        )}
      </section>

      {/* Companheiros de Aventura (visão para jogadores quando não são mestre) */}
      {!isMaster && outrosPersonagens.length > 0 && (
        <section className="campaign-section">
          <div className="campaign-section-header">
            <div className="campaign-section-title">
              <h2>Companheiros de Grupo</h2>
              <span className="campaign-section-badge">
                {outrosPersonagens.length} Aventureiros
              </span>
            </div>
          </div>

          <div className="dashboard-grid">
            {outrosPersonagens.map((personagem) => (
              <CharacterCard key={personagem.id} character={personagem} />
            ))}
          </div>
        </section>
      )}
      <nav className="campaign-overview-actions" aria-label="Ações da campanha">
        <Link className="btn-primary" to={"/campanha/" + campaign.id + "/loja"}>
          Ir para a loja
        </Link>
      </nav>

      {isMaster && (
        <section className="campaign-danger-zone" aria-labelledby="campaign-danger-title">
          <div>
            <h2 id="campaign-danger-title">Zona de perigo</h2>
            <p>A exclusão remove a campanha e não pode ser desfeita.</p>
          </div>

          {!confirmandoExclusao ? (
            <button
              type="button"
              className="campaign-delete-trigger"
              onClick={() => {
                setErroExclusao("");
                setConfirmandoExclusao(true);
              }}
            >
              Excluir campanha
            </button>
          ) : (
            <div
              className="campaign-delete-confirmation"
              role="alertdialog"
              aria-labelledby="campaign-delete-confirm-title"
              aria-describedby="campaign-delete-confirm-description"
            >
              <div>
                <h3 id="campaign-delete-confirm-title">Excluir “{campaign.nome}”?</h3>
                <p id="campaign-delete-confirm-description">
                  Esta ação é permanente. Confirme somente se deseja apagar esta campanha.
                </p>
              </div>
              {erroExclusao && <p className="campaign-delete-error" role="alert">{erroExclusao}</p>}
              <div className="campaign-delete-confirm-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setConfirmandoExclusao(false)}
                  disabled={excluindo}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="campaign-delete-confirm-button"
                  onClick={() => void handleExcluirCampanha()}
                  disabled={excluindo}
                >
                  {excluindo ? "Excluindo..." : "Confirmar exclusão"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
