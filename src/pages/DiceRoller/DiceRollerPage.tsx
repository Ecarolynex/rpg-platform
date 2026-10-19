import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { DiceRoller } from "./DiceRoller";
import { listarMinhasCampanhas } from "../../services/api";
import type { Campaign } from "../../services/api";

export default function DiceRollerPage() {
  const { id: routeCampaignId } = useParams<{ id: string }>();
  const [modifierValue, setModifierValue] = useState("0");
  const [campanhas, setCampanhas] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("geral");

  useEffect(() => {
    if (routeCampaignId) return;

    let ativo = true;
    listarMinhasCampanhas()
      .then((lista) => {
        if (!ativo) return;
        setCampanhas(lista);
      })
      .catch(() => {
        if (!ativo) return;
        setCampanhas([]);
      });

    return () => {
      ativo = false;
    };
  }, [routeCampaignId]);

  const effectiveCampaignId = routeCampaignId || selectedCampaignId;

  return (
    <div className="dice-page-wrapper">
      {!routeCampaignId && campanhas.length > 0 && (
        <div className="dice-campaign-selector-bar">
          <label htmlFor="dice-campaign-select">Vincular rolagens à campanha:</label>
          <select
            id="dice-campaign-select"
            aria-label="Vincular rolagens à campanha"
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
          >
            <option value="geral">Rolagem Livre (Geral)</option>
            {campanhas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}
      <DiceRoller
        campaignId={effectiveCampaignId}
        modifierValue={modifierValue}
        onModifierChange={setModifierValue}
      />
    </div>
  );
}
