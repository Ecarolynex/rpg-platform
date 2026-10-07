import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { DICE_MODELS, DICE_SIDES, type DiceRoll, type DieSides, type DiceRollerProps } from "./diceRoller.types";
import {
  createDiceRoll,
  formatDetailedRoll,
  formatDiceFormula,
  formatRollTime,
  MAX_ROLL_HISTORY,
  parseModifier,
} from "./diceLogic";
import { sessionRollHistoryStore } from "./rollHistoryStorage";
import { Dice3DStage } from "./Dice3DStage";
import { DieIcon } from "./DiceIcons";
import { DICE_COLOR_THEMES, type DiceColorTheme } from "./diceMaterials";
import "./DiceRoller.css";

const DEFAULT_ANIMATION_DURATION_MS = 1150;

export function DiceRoller({
  campaignId,
  modifierValue,
  onModifierChange,
  historyStore = sessionRollHistoryStore,
  randomSource = Math.random,
  animationDurationMs = DEFAULT_ANIMATION_DURATION_MS,
}: DiceRollerProps) {
  const [selectedDie, setSelectedDie] = useState<DieSides>(20);
  const [diceColor, setDiceColor] = useState<DiceColorTheme>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("rpg_dice_color") as DiceColorTheme | null;
        if (saved && DICE_COLOR_THEMES[saved]) return saved;
      } catch {
        // Ignore storage errors
      }
    }
    return "emerald";
  });
  const [history, setHistory] = useState<DiceRoll[]>(() => historyStore.load(campaignId));
  const [latestRoll, setLatestRoll] = useState<DiceRoll | null>(() => history[0] ?? null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollError, setRollError] = useState("");
  const animationTimer = useRef<number | null>(null);

  useEffect(() => {
    const savedRolls = historyStore.load(campaignId);
    setHistory(savedRolls);
    setLatestRoll(savedRolls[0] ?? null);
    setIsRolling(false);
    setRollError("");

    return () => {
      if (animationTimer.current !== null) {
        window.clearTimeout(animationTimer.current);
        animationTimer.current = null;
      }
    };
  }, [campaignId, historyStore]);

  function handleColorChange(newColor: DiceColorTheme) {
    setDiceColor(newColor);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("rpg_dice_color", newColor);
      } catch {
        // Ignore storage errors
      }
    }
  }

  function executeRoll() {
    if (isRolling) return;

    setIsRolling(true);
    setRollError("");

    try {
      const nextRoll = createDiceRoll(selectedDie, parseModifier(modifierValue), randomSource);
      const nextHistory = [nextRoll, ...history].slice(0, MAX_ROLL_HISTORY);

      setLatestRoll(nextRoll);
      setHistory(nextHistory);
      historyStore.save(campaignId, nextHistory);
      animationTimer.current = window.setTimeout(() => {
        setIsRolling(false);
        animationTimer.current = null;
      }, Math.max(0, animationDurationMs));
    } catch (error) {
      setIsRolling(false);
      setRollError(
        error instanceof Error ? error.message : "Não foi possível rolar o dado.",
      );
    }
  }

  function handleRoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    executeRoll();
  }

  function handleClearHistory() {
    historyStore.save(campaignId, []);
    setHistory([]);
    setLatestRoll(null);
  }

  const latestResultClass = latestRoll?.critical
    ? `dice-result--critical-${latestRoll.critical}`
    : "";

  return (
    <main className="dice-page">
      <header className="dice-page-header">
        <span className="dice-eyebrow">Ferramenta da campanha</span>
        <h1>Rolagem de Dados</h1>
        <p>Escolha um dado, aplique um modificador e acompanhe os resultados desta sessão.</p>
      </header>

      <nav className="dice-breadcrumbs" aria-label="Navegação da campanha">
        <Link to={`/campanha/${campaignId}`}>Visão geral</Link>
        <Link to={`/campanha/${campaignId}/mapa`}>Mapa</Link>
        <Link to={`/campanha/${campaignId}/loja`}>Loja</Link>
        <span aria-current="page">Dados</span>
      </nav>

      <div className="dice-workspace">
        <section className="dice-panel dice-roll-panel" aria-labelledby="dice-roller-title">
          <header className="dice-panel-heading">
            <div>
              <span className="dice-eyebrow">A sorte está lançada</span>
              <h2 id="dice-roller-title">Preparar rolagem</h2>
            </div>
            <DieIcon sides={selectedDie} size={30} className="dice-heading-icon" aria-hidden="true" />
          </header>

          {/* 3D Wooden Dice Stage Arena */}
          <Dice3DStage
            die={selectedDie}
            colorTheme={diceColor}
            isRolling={isRolling}
            latestRoll={latestRoll}
            onTriggerRoll={executeRoll}
            animationDurationMs={animationDurationMs}
          />

          {/* Dice Material / Color Customizer */}
          <div className="dice-theme-selector" role="radiogroup" aria-label="Escolha a cor do dado">
            <span className="dice-theme-label">Cor do dado</span>
            <div className="dice-theme-options">
              {(Object.keys(DICE_COLOR_THEMES) as DiceColorTheme[]).map((themeKey) => {
                const theme = DICE_COLOR_THEMES[themeKey];
                const isSelected = diceColor === themeKey;
                return (
                  <button
                    key={themeKey}
                    type="button"
                    className={`dice-theme-chip ${isSelected ? "is-selected" : ""}`}
                    onClick={() => handleColorChange(themeKey)}
                    role="radio"
                    aria-checked={isSelected}
                    title={theme.name}
                    disabled={isRolling}
                  >
                    <span className="dice-theme-dot" style={{ backgroundColor: theme.swatch }} />
                    <span className="dice-theme-name">{theme.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <fieldset className="dice-selector">
            <legend>Escolha um dado</legend>
            <div className="dice-selector-grid">
              {DICE_SIDES.map((sides) => (
                <button
                  key={sides}
                  type="button"
                  className={selectedDie === sides ? "dice-choice is-selected" : "dice-choice"}
                  aria-pressed={selectedDie === sides}
                  onClick={() => setSelectedDie(sides)}
                  disabled={isRolling}
                  aria-label={`d${sides}, ${DICE_MODELS[sides].model}, resultados ${DICE_MODELS[sides].results}`}
                  title={`${DICE_MODELS[sides].model} · ${DICE_MODELS[sides].results}`}
                >
                  <DieIcon sides={sides} size={22} className="dice-choice-icon" />
                  <span className="dice-choice-name">d{sides}</span>
                  <span className="dice-choice-details">
                    {DICE_MODELS[sides].faces} · {DICE_MODELS[sides].results}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <form className="dice-roll-form" onSubmit={handleRoll}>
            <label className="dice-modifier-field" htmlFor="dice-modifier">
              <span>Modificador</span>
              <input
                id="dice-modifier"
                type="number"
                step="1"
                inputMode="numeric"
                value={modifierValue}
                aria-describedby="dice-modifier-help"
                onChange={(event) => onModifierChange(event.target.value)}
                disabled={isRolling}
              />
            </label>
            <p className="dice-modifier-help" id="dice-modifier-help">
              Use um inteiro positivo ou negativo; deixe em 0 para rolar sem ajuste.
            </p>

            <button className="btn-primary dice-roll-button" type="submit" disabled={isRolling}>
              <DieIcon sides={selectedDie} size={22} strokeWidth={1.8} aria-hidden="true" />
              {isRolling ? "Rolando…" : `Rolar d${selectedDie}`}
            </button>
          </form>

          <div
            className={`dice-result ${latestResultClass}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className={isRolling ? "dice-result-mark is-rolling" : "dice-result-mark"} aria-hidden="true">
              <DieIcon sides={latestRoll?.die ?? selectedDie} size={48} strokeWidth={1.4} />
            </div>
            <div className="dice-result-copy">
              <span className="dice-result-label">
                {latestRoll ? `Resultado natural · d${latestRoll.die}` : "Resultado natural"}
              </span>
              <strong className="dice-result-total">{latestRoll?.total ?? "—"}</strong>
              {latestRoll ? (
                <span className="dice-result-formula">{formatDiceFormula(latestRoll)}</span>
              ) : (
                <span className="dice-result-formula">Faça sua primeira rolagem</span>
              )}
              {latestRoll?.critical && (
                <span className={`dice-critical-badge dice-critical-badge--${latestRoll.critical}`}>
                  {latestRoll.critical === "success" ? "Sucesso crítico" : "Falha crítica"}
                </span>
              )}
            </div>
          </div>
          {rollError && <p className="dice-error" role="alert">{rollError}</p>}
        </section>

        <section className="dice-panel dice-history-panel" aria-labelledby="dice-history-title">
          <header className="dice-panel-heading dice-history-heading">
            <div>
              <span className="dice-eyebrow">Registro desta campanha</span>
              <h2 id="dice-history-title">Histórico recente</h2>
            </div>
            <button
              type="button"
              className="btn-ghost dice-clear-button"
              onClick={handleClearHistory}
              disabled={history.length === 0 || isRolling}
              aria-label="Limpar histórico de rolagens"
            >
              Limpar
            </button>
          </header>

          {history.length > 0 ? (
            <ol className="dice-history-list" aria-label="Últimas rolagens">
              {history.map((roll) => (
                <li
                  className={`dice-history-entry${roll.critical ? ` dice-history-entry--${roll.critical}` : ""}`}
                  key={roll.id}
                >
                  <div className="dice-history-entry-topline">
                    <span className="dice-history-die">d{roll.die}</span>
                    <time className="dice-history-time" dateTime={roll.rolledAt}>
                      {formatRollTime(roll.rolledAt)}
                    </time>
                    {roll.critical && (
                      <span className={`dice-history-critical dice-history-critical--${roll.critical}`}>
                        {roll.critical === "success" ? "Sucesso crítico" : "Falha crítica"}
                      </span>
                    )}
                  </div>
                  <strong className="dice-history-formula">{formatDiceFormula(roll)}</strong>
                  <p className="dice-history-details">{formatDetailedRoll(roll)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="dice-history-empty">
              <DieIcon sides={selectedDie} size={34} strokeWidth={1.4} aria-hidden="true" />
              <p>Nenhuma rolagem nesta sessão ainda.</p>
              <span>Os resultados mais recentes desta campanha aparecerão aqui.</span>
            </div>
          )}
          <p className="dice-history-note">Histórico local desta sessão · até {MAX_ROLL_HISTORY} resultados</p>
        </section>
      </div>
    </main>
  );
}
