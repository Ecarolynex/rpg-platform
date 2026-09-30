import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getCampaignAccess,
  getCharacters,
  listarMinhasCampanhas,
  listarPersonagensDaCampanha,
  vincularPersonagem,
  type Campaign,
} from "../../services/api";
import type { Character } from "../../types/character";
import { CharacterCard } from "../../components/character/CharacterCard";

export default function Campaign() {
  const { id } = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);

  const [meusNaCampanha, setMeusNaCampanha] = useState<Character[]>([]);
  const [outrosPersonagens, setOutrosPersonagens] = useState<Character[]>([]);
  const [semCampanha, setSemCampanha] = useState<Character[]>([]);
  const [escolhido, setEscolhido] = useState("");

  const [vinculando, setVinculando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!id) return;

    async function carregar(campanhaId: string) {
      try {
        const [campanhas, acesso, daCampanha, meus] = await Promise.all([
          listarMinhasCampanhas(),
          getCampaignAccess(campanhaId),
          listarPersonagensDaCampanha(campanhaId),
          getCharacters(),
        ]);

        const meusIds = new Set(meus.map((personagem) => personagem.id));
        const livres = meus.filter((personagem) => personagem.campanhaId === null);

        setCampaign(campanhas.find((item) => item.id === campanhaId) ?? null);
        setIsMaster(acesso.isMaster);
        setMeusNaCampanha(
          meus.filter((personagem) => personagem.campanhaId === campanhaId),
        );
        setOutrosPersonagens(
          daCampanha.filter((personagem) => !meusIds.has(personagem.id)),
        );
        setSemCampanha(livres);
        setEscolhido((atual) =>
          livres.some((personagem) => personagem.id === atual)
            ? atual
            : (livres[0]?.id ?? ""),
        );
      } catch (error) {
        console.error("Erro ao carregar campanha:", error);
      } finally {
        setLoading(false);
      }
    }

    void carregar(id);
  }, [id, versao]);

  async function handleVincular(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!id || !escolhido) return;

    setVinculando(true);
    setMensagem("");

    try {
      await vincularPersonagem(escolhido, id);
      setMensagem("Personagem vinculado à campanha.");
      setVersao((atual) => atual + 1);
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível vincular o personagem.",
      );
    } finally {
      setVinculando(false);
    }
  }

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
      <p>
        <Link to="/campanhas">← Campanhas</Link>
      </p>

      <span>Aventura</span>

      <h1>{campaign.nome}</h1>

      <p>{campaign.descricao || "Nenhuma descrição cadastrada."}</p>

      <hr />

      <h2>Meu personagem</h2>

      {meusNaCampanha.length > 0 ? (
        <div className="dashboard-grid">
          {meusNaCampanha.map((personagem) => (
            <CharacterCard key={personagem.id} character={personagem} />
          ))}
        </div>
      ) : semCampanha.length > 0 ? (
        <form onSubmit={handleVincular}>
          <p>Escolha qual personagem vai participar desta campanha.</p>

          <label className="field">
            <span>Personagem</span>

            <select
              value={escolhido}
              onChange={(event) => setEscolhido(event.target.value)}
            >
              {semCampanha.map((personagem) => (
                <option key={personagem.id} value={personagem.id}>
                  {personagem.nome} · {personagem.raca} · {personagem.classe}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="btn-primary"
            disabled={vinculando || !escolhido}
          >
            {vinculando ? "Vinculando..." : "Vincular à campanha"}
          </button>
        </form>
      ) : (
        <p>
          Você ainda não tem um personagem livre para esta campanha.{" "}
          <Link to="/">Crie um em Meus personagens</Link> e volte aqui.
        </p>
      )}

      {mensagem && <p>{mensagem}</p>}

      {isMaster && outrosPersonagens.length > 0 && (
        <>
          <hr />

          <h2>Personagens dos jogadores</h2>

          <div className="dashboard-grid">
            {outrosPersonagens.map((personagem) => (
              <CharacterCard key={personagem.id} character={personagem} />
            ))}
          </div>
        </>
      )}

      <hr />

      <h2>Dados da campanha</h2>

      <p>
        <strong>Código:</strong> {campaign.codigo_convite}
      </p>

      <p>
        <strong>Sistema:</strong> {campaign.sistema || "Não informado"}
      </p>

      <p>
        <strong>Moeda:</strong> {campaign.moeda_principal || "Não informada"}
      </p>

      <p>
        <strong>Ouro inicial por jogador:</strong>{" "}
        {campaign.ouro_inicial ?? 1250} PO
      </p>

      <p>
        <strong>Status:</strong> {campaign.status}
      </p>

      <hr />

      <Link className="btn-primary" to={"/campanha/" + campaign.id + "/loja"}>
        Ir para a Loja
      </Link>{" "}
      <button type="button" disabled title="Em breve">
        Recompensas
      </button>
      <button type="button" disabled title="Em breve">
        Histórico
      </button>
    </div>
  );
}
