import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { listarMinhasCampanhas, type Campaign } from "../../services/api";

export default function Campaign() {
  const { id } = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCampaign() {
      try {
        const campaigns = await listarMinhasCampanhas();
        const found = campaigns.find((item) => item.id === id);

        if (found) {
          setCampaign(found);
        }
      } catch (error) {
        console.error("Erro ao carregar campanha:", error);
      } finally {
        setLoading(false);
      }
    }

    loadCampaign();
  }, [id]);

  if (loading) {
    return <div>Carregando campanha...</div>;
  }

  if (!campaign) {
    return (
      <div>
        <h1>Campanha não encontrada</h1>
        <p>Você não participa desta campanha.</p>
      </div>
    );
  }

  return (
    <div>
      <span>Aventura</span>

      <h1>{campaign.nome}</h1>

      <p>
        {campaign.descricao || "Nenhuma descrição cadastrada."}
      </p>

      <hr />

      <p>
        <strong>Código:</strong> {campaign.codigo_convite}
      </p>

      <p>
        <strong>Sistema:</strong>{" "}
        {campaign.sistema || "Não informado"}
      </p>

      <p>
        <strong>Moeda:</strong>{" "}
        {campaign.moeda_principal || "Não informada"}
      </p>

      <p>
        <strong>Ouro inicial por jogador:</strong> {campaign.ouro_inicial ?? 1250} PO
      </p>

      <p>
        <strong>Status:</strong> {campaign.status}
      </p>

      <hr />

      <Link to={`/campanha/${campaign.id}/loja`}>
        <button type="button">Loja</button>
      </Link>
      <button>Jogadores</button>
      <button>Personagens</button>
      <button>Economia</button>
      <button>Recompensas</button>
      <button>Histórico</button>
    </div>
  );
}