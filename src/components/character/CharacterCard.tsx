import { Link } from "react-router-dom";
import type { Character } from "../../types/character";
import { StatBar } from "../ui/StatBar";
import "./CharacterCard.css";

export function CharacterCard({ character }: { character: Character }) {
  return (
    <Link to={`/personagem/${character.id}`} className="character-card">
      <div className="character-card-portrait">
        {character.nome.charAt(0)}
      </div>
      <div className="character-card-body">
        <h3>{character.nome}</h3>
        <p className="character-card-meta">
          {character.raca} · {character.classe} · Nível {character.nivel}
        </p>
        <StatBar label="Vida" atual={character.hp.atual} max={character.hp.max} tone="wine" />
      </div>
    </Link>
  );
}
