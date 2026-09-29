import { Link } from "react-router-dom";
import type { Character } from "../../types/character";
import { StatBar } from "../ui/StatBar";
import "./CharacterCard.css";

export function CharacterCard({ character }: { character: Character }) {
  return (
    <Link to={`/personagem/${character.id}`} className="character-card">
      <div className="character-card-portrait">
        {character.portraitUrl ? (
          <img src={character.portraitUrl} alt={character.nome} className="character-card-image" />
        ) : (
          character.nome.charAt(0)
        )}
      </div>
      <div className="character-card-body">
        <h3>{character.nome}</h3>
        <p className="character-card-meta">
          {character.raca} · {character.classe} · Nv. {character.nivel}
        </p>
        {character.filiacao && (
          <span className="character-card-affiliation">{character.filiacao}</span>
        )}
        <div className="character-card-vitals">
          <StatBar label="Vida" atual={character.hp.atual} max={character.hp.max} tone="wine" />
          <StatBar label="Mana" atual={character.mp.atual} max={character.mp.max} tone="forest" />
        </div>
      </div>
    </Link>
  );
}
