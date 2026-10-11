import { Link } from "react-router-dom";
import type { Character } from "../../types/character";
import { calculateDerivedCharacterStats, type CharacterRulesContext } from "../../domain/characterRules";
import { StatBar } from "../ui/StatBar";
import "./CharacterCard.css";

export function CharacterCard({
  character,
  rulesContext,
}: {
  character: Character;
  rulesContext?: CharacterRulesContext;
}) {
  const stats = calculateDerivedCharacterStats(character, rulesContext);
  const hpAtual = Math.min(character.hp.atual, stats.hpMax);

  return (
    <Link to={"/personagem/" + character.id} className="character-card">
      <div className="character-card-portrait">
        {character.portraitUrl ? (
          <img
            src={character.portraitUrl}
            alt={character.nome}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "inherit",
              display: "block",
            }}
          />
        ) : (
          character.nome.charAt(0)
        )}
      </div>

      <div className="character-card-body">
        <h3>{character.nome}</h3>

        <p className="character-card-meta">
          {character.raca} · {character.classe} · Nível {character.nivel} · {character.xp ?? 0} XP
        </p>

        {character.campanhaId === null && (
          <p className="character-card-meta">Sem campanha</p>
        )}

        <StatBar
          label="Vida"
          atual={hpAtual}
          max={stats.hpMax}
          tone="wine"
        />
      </div>
    </Link>
  );
}
