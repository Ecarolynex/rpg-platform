import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Attributes, Character } from "../../types/character";
import { getCharacterById } from "../../services/api";
import { StatBar } from "../../components/ui/StatBar";
import "./CharacterSheet.css";

const ATTRIBUTE_LABELS: Record<keyof Attributes, string> = {
  forca: "Força",
  destreza: "Destreza",
  constituicao: "Constituição",
  inteligencia: "Inteligência",
  sabedoria: "Sabedoria",
  carisma: "Carisma",
};

const TABS = ["Atributos", "Perícias", "Inventário", "Magias", "Notas"] as const;
type Tab = (typeof TABS)[number];

export default function CharacterSheet() {
  const { id } = useParams();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Atributos");

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError(null);

    getCharacterById(id)
      .then((c) => {
        console.log("Personagem carregado:", c);
        setCharacter(c ?? null);
      })
      .catch((e) => {
        console.error("Erro ao buscar personagem:", e);
        setError(e?.message ?? "Erro ao carregar a ficha.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="sheet-status">Carregando ficha...</p>;
  if (error) return <p className="sheet-status">Erro: {error}</p>;
  if (!character) return <p className="sheet-status">Personagem não encontrado.</p>;

  return (
    <div className="sheet">
      <div className="sheet-banner">
        <div className="sheet-portrait">{character.nome.charAt(0)}</div>
        <div className="sheet-heading">
          <h1>{character.nome}</h1>
          <p>
            {character.raca} · {character.classe} · Nível {character.nivel}
          </p>
        </div>
        <div className="sheet-vitals">
          <StatBar label="Vida" atual={character.hp.atual} max={character.hp.max} tone="wine" />
          <StatBar label="Mana" atual={character.mp.atual} max={character.mp.max} tone="forest" />
        </div>
      </div>

      <nav className="sheet-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={t === tab ? "sheet-tab sheet-tab--active" : "sheet-tab"}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="sheet-content">
        {tab === "Atributos" && (
          <div className="attribute-grid">
            {(Object.keys(character.attributes) as (keyof Attributes)[]).map((attr) => (
              <div key={attr} className="attribute-block">
                <span className="attribute-label">{ATTRIBUTE_LABELS[attr]}</span>
                <span className="attribute-value">{character.attributes[attr]}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "Perícias" && (
          <ul className="sheet-list">
            {character.skills.map((skill) => (
              <li key={skill.id}>
                <span>{skill.nome}</span>
                <span className="sheet-list-tag">
                  {ATTRIBUTE_LABELS[skill.atributo]} · {skill.treinada ? "Treinada" : "Não treinada"}
                </span>
                <span className="sheet-list-bonus">+{skill.bonus}</span>
              </li>
            ))}
            {character.skills.length === 0 && <p className="sheet-empty">Nenhuma perícia registrada.</p>}
          </ul>
        )}

        {tab === "Inventário" && (
          <ul className="sheet-list">
            {character.inventory.map((item) => (
              <li key={item.id}>
                <span>{item.nome}</span>
                <span className="sheet-list-tag">x{item.quantidade}</span>
              </li>
            ))}
            {character.inventory.length === 0 && <p className="sheet-empty">Inventário vazio.</p>}
          </ul>
        )}

        {tab === "Magias" && (
          <ul className="sheet-list sheet-list--spells">
            {character.spells.map((spell) => (
              <li key={spell.id}>
                <div className="sheet-spell-head">
                  <span>{spell.nome}</span>
                  <span className="sheet-list-tag">{spell.custo} PM</span>
                </div>
                <p>{spell.descricao}</p>
              </li>
            ))}
            {character.spells.length === 0 && (
              <p className="sheet-empty">Este personagem não conhece magias.</p>
            )}
          </ul>
        )}

        {tab === "Notas" && (
          <p className="sheet-notes">{character.notas || "Nenhuma anotação ainda."}</p>
        )}
      </div>
    </div>
  );
}
