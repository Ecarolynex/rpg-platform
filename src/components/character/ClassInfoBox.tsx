import type { ClassInfo } from "./classInfoUtils";
import "./ClassInfoBox.css";

function sinal(valor: number) {
  return (valor > 0 ? "+" : "") + valor;
}

export function ClassInfoBox({
  info,
  mensagemVazia,
}: {
  info: ClassInfo | null;
  mensagemVazia: string;
}) {
  if (!info) {
    return <p className="class-info-empty">{mensagemVazia}</p>;
  }

  const temBonus =
    info.bonusAtributos.length > 0 || info.bonusHp !== 0 || info.bonusMp !== 0;

  return (
    <div className="class-info">
      <h4 className="class-info-name">{info.nome}</h4>

      {info.descricao ? (
        <p className="class-info-text">{info.descricao}</p>
      ) : (
        <p className="class-info-empty">
          Esta classe ainda não tem descrição cadastrada.
        </p>
      )}

      {temBonus && (
        <div className="class-info-bonuses">
          {info.bonusAtributos.map((item) => (
            <span key={item.chave} className="class-info-chip">
              {sinal(item.valor)} {item.rotulo}
            </span>
          ))}

          {info.bonusHp !== 0 && (
            <span className="class-info-chip">{sinal(info.bonusHp)} Vida</span>
          )}

          {info.bonusMp !== 0 && (
            <span className="class-info-chip">{sinal(info.bonusMp)} Mana</span>
          )}
        </div>
      )}

      {info.habilidades.length > 0 && (
        <div className="class-info-abilities">
          <h5>Habilidades</h5>

          <ul>
            {info.habilidades.map((item) => (
              <li key={item.nome}>
                <strong>{item.nome}</strong>
                {item.nivel !== undefined && <small> · Nível {item.nivel}</small>}
                {item.descricao && <p>{item.descricao}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
