import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Campaigns.css";
import {
  criarCampanha,
  listarMinhasCampanhas,
  entrarNaCampanha,
  type Campaign,
} from "../../services/api";

export default function Campaigns() {
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [sistema, setSistema] = useState("");
  const [moeda, setMoeda] = useState("");
  const [ouroInicial, setOuroInicial] = useState("1250");

  const [codigo, setCodigo] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  const [mensagem, setMensagem] = useState("");
  const [codigoCriado, setCodigoCriado] = useState("");

  const [campanhas, setCampanhas] = useState<Campaign[]>([]);

  async function carregarCampanhas() {
    try {
      setLoadingCampaigns(true);

      const resultado = await listarMinhasCampanhas();

      setCampanhas(resultado);
    } catch (error) {
      console.error("Erro ao carregar campanhas:", error);
    } finally {
      setLoadingCampaigns(false);
    }
  }

  useEffect(() => {
    carregarCampanhas();
  }, []);

  async function handleCreate(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setMensagem("");
    setCodigoCriado("");

    try {
      const campanha = await criarCampanha({
        nome,
        descricao,
        sistema,
        moeda_principal: moeda,
        ouro_inicial: Number(ouroInicial),
      });

      setCodigoCriado(campanha.codigo_convite);
      setMensagem("Campanha criada com sucesso!");

      setNome("");
      setDescricao("");
      setSistema("");
      setMoeda("");
      setOuroInicial("1250");

      await carregarCampanhas();
    } catch (error) {
      console.error("Erro ao criar campanha:", error);

      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a campanha.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setMensagem("");

    try {
      const campanha = await entrarNaCampanha(codigo);

      await carregarCampanhas();

      setCodigo("");

      navigate(`/campanha/${campanha.id}`);
    } catch (error) {
      console.error("Erro ao entrar na campanha:", error);

      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar na campanha.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="campaigns-page">
      <header className="campaigns-header">
        <div>
          <span className="campaigns-kicker">Aventuras</span>

          <h1>Minhas campanhas</h1>

          <p>
            Crie uma nova campanha ou entre em uma aventura usando o
            código fornecido pelo Mestre.
          </p>
        </div>

        <div className="campaigns-actions">
          <button
            className="btn-primary"
            onClick={() => {
              setShowCreate(true);
              setShowJoin(false);
              setMensagem("");
              setCodigoCriado("");
            }}
          >
            + Criar campanha
          </button>

          <button
            className="btn-ghost"
            onClick={() => {
              setShowJoin(true);
              setShowCreate(false);
              setMensagem("");
            }}
          >
            Entrar com código
          </button>
        </div>
      </header>

      <hr className="hairline" />

      {!showCreate && !showJoin && (
        <section className="campaign-list">
          {loadingCampaigns ? (
            <p>Carregando campanhas...</p>
          ) : campanhas.length > 0 ? (
            <>
              <div className="campaign-list-header">
                <span className="campaigns-kicker">
                  Suas aventuras
                </span>

                <h2>Campanhas</h2>
              </div>

              <div className="campaign-grid">
                {campanhas.map((campanha) => (
                  <article
                    key={campanha.id}
                    className="campaign-card"
                  >
                    <span className="campaigns-kicker">
                      {campanha.status}
                    </span>

                    <h2>{campanha.nome}</h2>

                    <p>
                      {campanha.descricao ||
                        "Nenhuma descrição cadastrada."}
                    </p>

                    <div className="campaign-card-info">
                      <span>
                        Sistema:{" "}
                        {campanha.sistema || "Não informado"}
                      </span>

                      <span>
                        Código:{" "}
                        <strong>
                          {campanha.codigo_convite}
                        </strong>
                      </span>

                      <span>
                        Moeda:{" "}
                        {campanha.moeda_principal ||
                          "Não informada"}
                      </span>

                      <span>
                        Ouro inicial por jogador:{" "}
                        {campanha.ouro_inicial ?? 1250} PO
                      </span>
                    </div>

                    <button
                      className="btn-primary"
                      onClick={() =>
                        navigate(
                          `/campanha/${campanha.id}`,
                        )
                      }
                    >
                      Abrir campanha
                    </button>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <section className="campaign-empty">
              <div className="campaign-empty-symbol">
                ✦
              </div>

              <h2>Nenhuma campanha selecionada</h2>

              <p>
                Crie sua própria aventura como Mestre ou use um
                código para entrar na campanha de outro Mestre.
              </p>

              <div className="campaign-empty-actions">
                <button
                  className="btn-primary"
                  onClick={() => {
                    setShowCreate(true);
                    setShowJoin(false);
                  }}
                >
                  Criar minha campanha
                </button>

                <button
                  className="btn-ghost"
                  onClick={() => {
                    setShowJoin(true);
                    setShowCreate(false);
                  }}
                >
                  Tenho um código
                </button>
              </div>
            </section>
          )}
        </section>
      )}

      {showCreate && (
        <section className="campaign-panel">
          <div className="campaign-panel-header">
            <div>
              <span className="campaigns-kicker">
                Nova aventura
              </span>

              <h2>Criar campanha</h2>
            </div>

            <button
              className="btn-ghost"
              type="button"
              onClick={() => setShowCreate(false)}
            >
              Fechar
            </button>
          </div>

          <form onSubmit={handleCreate}>
            <div className="campaign-field-grid">
              <label className="campaign-field">
                <span>Nome da campanha</span>

                <input
                  value={nome}
                  onChange={(event) =>
                    setNome(event.target.value)
                  }
                  placeholder="Ex.: As Ruínas de Elementum"
                  required
                />
              </label>

              <label className="campaign-field">
                <span>Sistema</span>

                <input
                  value={sistema}
                  onChange={(event) =>
                    setSistema(event.target.value)
                  }
                  placeholder="Ex.: D&D 5e"
                />
              </label>

              <label className="campaign-field">
                <span>Moeda principal</span>

                <input
                  value={moeda}
                  onChange={(event) =>
                    setMoeda(event.target.value)
                  }
                  placeholder="Ex.: Ouro"
                />
              </label>

              <label className="campaign-field">
                <span>Ouro inicial por jogador</span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={ouroInicial}
                  onChange={(event) =>
                    setOuroInicial(event.target.value)
                  }
                  required
                />
              </label>

              <label className="campaign-field campaign-field-wide">
                <span>Descrição</span>

                <textarea
                  value={descricao}
                  onChange={(event) =>
                    setDescricao(event.target.value)
                  }
                  placeholder="Conte um pouco sobre a aventura..."
                  rows={5}
                />
              </label>
            </div>

            {mensagem && (
              <div className="campaign-message">
                {mensagem}
              </div>
            )}

            {codigoCriado && (
              <div className="campaign-code-result">
                <span>Código da campanha</span>

                <strong>{codigoCriado}</strong>

                <p>
                  Compartilhe este código com os jogadores que
                  participarão da aventura.
                </p>
              </div>
            )}

            <div className="campaign-form-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading
                  ? "Criando..."
                  : "Criar campanha"}
              </button>
            </div>
          </form>
        </section>
      )}

      {showJoin && (
        <section className="campaign-panel">
          <div className="campaign-panel-header">
            <div>
              <span className="campaigns-kicker">
                Entrar em aventura
              </span>

              <h2>Usar código da campanha</h2>
            </div>

            <button
              className="btn-ghost"
              type="button"
              onClick={() => setShowJoin(false)}
            >
              Fechar
            </button>
          </div>

          <form onSubmit={handleJoin}>
            <label className="campaign-field">
              <span>Código da campanha</span>

              <input
                value={codigo}
                onChange={(event) =>
                  setCodigo(
                    event.target.value.toUpperCase(),
                  )
                }
                placeholder="Ex.: ALD7K9"
                maxLength={6}
                required
              />
            </label>

            {mensagem && (
              <div className="campaign-message">
                {mensagem}
              </div>
            )}

            <div className="campaign-form-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowJoin(false)}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading
                  ? "Entrando..."
                  : "Entrar na campanha"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
