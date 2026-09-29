import { useState } from "react";
import "./Campaigns.css";

export default function Campaigns() {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [sistema, setSistema] = useState("");
  const [moeda, setMoeda] = useState("");

  const [codigo, setCodigo] = useState("");

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    console.log("Campanha criada:", {
      nome,
      descricao,
      sistema,
      moeda,
    });

    alert("Formulário de criação funcionando!");
  }

  function handleJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    console.log("Código informado:", codigo);

    alert(`Código informado: ${codigo}`);
  }

  return (
    <div className="campaigns-page">
      <header className="campaigns-header">
        <div>
          <span className="campaigns-kicker">Aventuras</span>
          <h1>Minhas campanhas</h1>
          <p>
            Crie uma nova campanha ou entre em uma aventura usando o código
            fornecido pelo Mestre.
          </p>
        </div>

        <div className="campaigns-actions">
          <button
            className="btn-primary"
            onClick={() => {
              setShowCreate(true);
              setShowJoin(false);
            }}
          >
            + Criar campanha
          </button>

          <button
            className="btn-ghost"
            onClick={() => {
              setShowJoin(true);
              setShowCreate(false);
            }}
          >
            Entrar com código
          </button>
        </div>
      </header>

      <hr className="hairline" />

      {showCreate && (
        <section className="campaign-panel">
          <div className="campaign-panel-header">
            <div>
              <span className="campaigns-kicker">Nova aventura</span>
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
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Ex.: As Ruínas de Aldermoor"
                  required
                />
              </label>

              <label className="campaign-field">
                <span>Sistema</span>
                <input
                  value={sistema}
                  onChange={(event) => setSistema(event.target.value)}
                  placeholder="Ex.: D&D 5e"
                />
              </label>

              <label className="campaign-field">
                <span>Moeda principal</span>
                <input
                  value={moeda}
                  onChange={(event) => setMoeda(event.target.value)}
                  placeholder="Ex.: Ouro"
                />
              </label>

              <label className="campaign-field campaign-field-wide">
                <span>Descrição</span>
                <textarea
                  value={descricao}
                  onChange={(event) => setDescricao(event.target.value)}
                  placeholder="Conte um pouco sobre a aventura..."
                  rows={5}
                />
              </label>
            </div>

            <div className="campaign-form-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </button>

              <button type="submit" className="btn-primary">
                Criar campanha
              </button>
            </div>
          </form>
        </section>
      )}

      {showJoin && (
        <section className="campaign-panel">
          <div className="campaign-panel-header">
            <div>
              <span className="campaigns-kicker">Entrar em aventura</span>
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
                  setCodigo(event.target.value.toUpperCase())
                }
                placeholder="Ex.: ALD7K9"
                maxLength={6}
                required
              />
            </label>

            <div className="campaign-form-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowJoin(false)}
              >
                Cancelar
              </button>

              <button type="submit" className="btn-primary">
                Entrar na campanha
              </button>
            </div>
          </form>
        </section>
      )}

      {!showCreate && !showJoin && (
        <section className="campaign-empty">
          <div className="campaign-empty-symbol">✦</div>

          <h2>Nenhuma campanha selecionada</h2>

          <p>
            Crie sua própria aventura como Mestre ou use um código para entrar
            na campanha de outro Mestre.
          </p>

          <div className="campaign-empty-actions">
            <button
              className="btn-primary"
              onClick={() => setShowCreate(true)}
            >
              Criar minha campanha
            </button>

            <button
              className="btn-ghost"
              onClick={() => setShowJoin(true)}
            >
              Tenho um código
            </button>
          </div>
        </section>
      )}
    </div>
  );
}