import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DiceRoller } from "./DiceRoller";

export default function DiceRollerPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const [modifierValue, setModifierValue] = useState("0");

  if (!campaignId) {
    return (
      <main className="dice-page">
        <section className="dice-panel dice-page-error">
          <h1>Campanha não encontrada</h1>
          <Link className="btn-primary" to="/campanhas">Voltar para campanhas</Link>
        </section>
      </main>
    );
  }

  return (
    <DiceRoller
      campaignId={campaignId}
      modifierValue={modifierValue}
      onModifierChange={setModifierValue}
    />
  );
}
