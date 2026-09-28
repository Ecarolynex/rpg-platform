import { useEffect, useState } from "react";
import type { Attributes, Character } from "../../types/character";
import { getCharacters } from "../../services/api";
import { CharacterCard } from "../../components/character/CharacterCard";
import "./Dashboard.css";

const initialDraft = {
  nome: "",
  raca: "",
  classe: "",
  origem: "",
  alinhamento: "",
  idade: "",
  nivel: 1,
  historia: "",
  aparencia: "",
  objetivo: "",
  defeito: "",
  forca: 10,
  destreza: 10,
  constituicao: 10,
  inteligencia: 10,
  sabedoria: 10,
  carisma: 10,
};

export default function Dashboard() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [draft, setDraft] = useState(initialDraft);

  useEffect(() => {
    getCharacters()
      .then(setCharacters)
      .finally(() => setLoading(false));
  }, []);

  const updateDraft = <K extends keyof typeof initialDraft>(field: K, value: (typeof initialDraft)[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateAttribute = (field: keyof Attributes, value: number) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const createdCharacter: Character = {
      id: String(Date.now()),
      nome: draft.nome || "Novo personagem",
      raca: draft.raca || "Humano",
      classe: draft.classe || "Aventureiro",
      nivel: Number(draft.nivel) || 1,
      hp: { atual: 12 + Number(draft.constituicao), max: 12 + Number(draft.constituicao) },
      mp: { atual: 8 + Number(draft.inteligencia), max: 8 + Number(draft.inteligencia) },
      attributes: {
        forca: Number(draft.forca),
        destreza: Number(draft.destreza),
        constituicao: Number(draft.constituicao),
        inteligencia: Number(draft.inteligencia),
        sabedoria: Number(draft.sabedoria),
        carisma: Number(draft.carisma),
      },
      skills: [],
      inventory: [],
      spells: [],
      notas: [
        draft.origem ? `Origem: ${draft.origem}` : null,
        draft.alinhamento ? `Alinhamento: ${draft.alinhamento}` : null,
        draft.idade ? `Idade: ${draft.idade}` : null,
        draft.historia ? `História: ${draft.historia}` : null,
        draft.aparencia ? `Aparência: ${draft.aparencia}` : null,
        draft.objetivo ? `Objetivo: ${draft.objetivo}` : null,
        draft.defeito ? `Defeito: ${draft.defeito}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };

    setCharacters((prev) => [createdCharacter, ...prev]);
    setDraft(initialDraft);
    setShowCreator(false);
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Meus personagens</h1>
          <p>Escolha uma ficha para continuar sua jornada.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreator((open) => !open)}>
          {showCreator ? "Fechar" : "+ Novo personagem"}
        </button>
      </header>

      <hr className="hairline" />

      {showCreator && (
        <form className="character-creator" onSubmit={handleSubmit}>
          <div className="creator-banner">
            <div>
              <span className="creator-kicker">Ficha de aventura</span>
              <h2>Criação de personagem</h2>
            </div>
            <span className="creator-badge">Aldermoor</span>
          </div>

          <div className="creator-layout">
            <section className="creator-panel">
              <h3>Identidade</h3>
              <div className="field-grid">
                <label className="field">
                  <span>Nome do personagem</span>
                  <input
                    id="nome-personagem"
                    value={draft.nome}
                    onChange={(event) => updateDraft("nome", event.target.value)}
                    placeholder="Ex.: Elira Fenra"
                  />
                </label>
                <label className="field">
                  <span>Raça</span>
                  <input
                    id="raca-personagem"
                    value={draft.raca}
                    onChange={(event) => updateDraft("raca", event.target.value)}
                    placeholder="Humano, elfo..."
                  />
                </label>
                <label className="field">
                  <span>Classe</span>
                  <input
                    id="classe-personagem"
                    value={draft.classe}
                    onChange={(event) => updateDraft("classe", event.target.value)}
                    placeholder="Guerreiro, maga..."
                  />
                </label>
                <label className="field">
                  <span>Nível</span>
                  <input
                    id="nivel-personagem"
                    type="number"
                    min={1}
                    max={20}
                    value={draft.nivel}
                    onChange={(event) => updateDraft("nivel", Number(event.target.value) || 1)}
                  />
                </label>
                <label className="field">
                  <span>Origem</span>
                  <input
                    value={draft.origem}
                    onChange={(event) => updateDraft("origem", event.target.value)}
                    placeholder="Peste, guilda, reino..."
                  />
                </label>
                <label className="field">
                  <span>Idade</span>
                  <input
                    value={draft.idade}
                    onChange={(event) => updateDraft("idade", event.target.value)}
                    placeholder="24 anos"
                  />
                </label>
                <label className="field field-wide">
                  <span>Alinhamento</span>
                  <input
                    value={draft.alinhamento}
                    onChange={(event) => updateDraft("alinhamento", event.target.value)}
                    placeholder="Leal, caótico, neutro..."
                  />
                </label>
              </div>
            </section>

            <aside className="creator-panel creator-panel-side">
              <h3>Atributos</h3>
              <div className="attribute-grid">
                {[
                  ["forca", "Força"],
                  ["destreza", "Destreza"],
                  ["constituicao", "Constituição"],
                  ["inteligencia", "Inteligência"],
                  ["sabedoria", "Sabedoria"],
                  ["carisma", "Carisma"],
                ].map(([key, label]) => (
                  <label key={key} className="attribute-field">
                    <span>{label}</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={draft[key as keyof typeof draft] as number}
                      onChange={(event) => updateAttribute(key as keyof Attributes, Number(event.target.value) || 1)}
                    />
                  </label>
                ))}
              </div>
            </aside>
          </div>

          <div className="creator-layout creator-layout-bottom">
            <section className="creator-panel">
              <h3>História e personalidade</h3>
              <div className="field-grid story-grid">
                <label className="field field-wide">
                  <span>História do personagem</span>
                  <textarea
                    id="historia-personagem"
                    value={draft.historia}
                    onChange={(event) => updateDraft("historia", event.target.value)}
                    rows={4}
                    placeholder="Descreva como ele chegou ao mundo de Aldermoor..."
                  />
                </label>
                <label className="field field-wide">
                  <span>Aparência</span>
                  <textarea
                    value={draft.aparencia}
                    onChange={(event) => updateDraft("aparencia", event.target.value)}
                    rows={3}
                    placeholder="Olhos, cabelo, marcas, roupas, presença..."
                  />
                </label>
                <label className="field field-half">
                  <span>Objetivo</span>
                  <input
                    value={draft.objetivo}
                    onChange={(event) => updateDraft("objetivo", event.target.value)}
                    placeholder="O que move o personagem?"
                  />
                </label>
                <label className="field field-half">
                  <span>Defeito</span>
                  <input
                    value={draft.defeito}
                    onChange={(event) => updateDraft("defeito", event.target.value)}
                    placeholder="Qual fraqueza o acompanha?"
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="creator-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowCreator(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Salvar personagem
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="dashboard-status">Carregando fichas...</p>
      ) : characters.length === 0 ? (
        <p className="dashboard-status">
          Você ainda não tem personagens. Crie o primeiro para começar.
        </p>
      ) : (
        <div className="dashboard-grid">
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      )}
    </div>
  );
}
