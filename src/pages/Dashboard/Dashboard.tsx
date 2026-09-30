import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Attributes, Character } from "../../types/character";
import {
  buscarCampanhaPorCodigo,
  criarPersonagem,
  enviarRetrato,
  entrarNaCampanha,
  excluirPersonagem,
  getCharacters,
  listarMinhasCampanhas,
  vincularPersonagem,
  type Campaign,
} from "../../services/api";
import { CharacterCard } from "../../components/character/CharacterCard";
import { OptionField } from "../../components/ui/OptionField";
import {
  ALINHAMENTOS,
  CLASSES,
  RACAS,
  calcularManaMaxima,
  calcularVidaMaxima,
  carteiraInicial,
} from "../../data/dnd";
import "./Dashboard.css";
import "./DashboardActions.css";

const initialDraft = {
  nome: "",
  raca: "",
  classe: "",
  origem: "",
  alinhamento: "",
  idade: "",
  nivel: 1,
  historia: "",
  aparencia: "",
  objetivo: "",
  defeito: "",
  forca: 10,
  destreza: 10,
  constituicao: 10,
  inteligencia: 10,
  sabedoria: 10,
  carisma: 10,
};

type TextField =
  | "nome"
  | "origem"
  | "idade"
  | "historia"
  | "aparencia"
  | "objetivo"
  | "defeito";

export default function Dashboard() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = useState("");

  // Entrar em campanha a partir do card
  const [joining, setJoining] = useState<Character | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [foundCampaign, setFoundCampaign] = useState<Campaign | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [notice, setNotice] = useState("");

  // Exclusão com confirmação
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [charactersData, campaignsData] = await Promise.all([
          getCharacters(),
          listarMinhasCampanhas(),
        ]);

        setCharacters(charactersData);
        setCampaigns(campaignsData);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar seus dados.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const updateDraft = <K extends keyof typeof initialDraft>(
    field: K,
    value: (typeof initialDraft)[K],
  ) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateAttribute = (field: keyof Attributes, value: number) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const textProps = (field: TextField) => ({
    value: draft[field],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => updateDraft(field, event.target.value),
  });

  const handlePortrait = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (portraitPreview) {
      URL.revokeObjectURL(portraitPreview);
    }

    setPortraitFile(file);
    setPortraitPreview(file ? URL.createObjectURL(file) : "");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");

    try {
      const portraitUrl = portraitFile
        ? await enviarRetrato(portraitFile)
        : undefined;

      const campanha = campaigns.find((c) => c.id === selectedCampaignId);
      const nivel = Number(draft.nivel) || 1;
      const classe = draft.classe || "Aventureiro";
      const vidaMaxima = calcularVidaMaxima(
        classe,
        nivel,
        Number(draft.constituicao),
      );
      const manaMaxima = calcularManaMaxima(Number(draft.inteligencia));

      const createdCharacter: Character = {
        id: "",
        nome: draft.nome || "Novo personagem",
        raca: draft.raca || "Humano",
        classe,
        nivel,
        portraitUrl,
        alinhamento: draft.alinhamento,
        origem: draft.origem,
        idade: draft.idade,
        historia: draft.historia,
        aparencia: draft.aparencia,
        objetivo: draft.objetivo,
        defeito: draft.defeito,
        hp: { atual: vidaMaxima, max: vidaMaxima },
        mp: { atual: manaMaxima, max: manaMaxima },
        attributes: {
          forca: Number(draft.forca),
          destreza: Number(draft.destreza),
          constituicao: Number(draft.constituicao),
          inteligencia: Number(draft.inteligencia),
          sabedoria: Number(draft.sabedoria),
          carisma: Number(draft.carisma),
        },
        skills: [],
        inventory: [],
        spells: [],
        carteira: carteiraInicial(campanha?.ouro_inicial ?? 0),
        notas: "",
      };

      const savedCharacter = await criarPersonagem(
        selectedCampaignId || null,
        createdCharacter,
      );

      setCharacters((prev) => [savedCharacter, ...prev]);

      setDraft(initialDraft);
      setPortraitFile(null);
      setPortraitPreview("");
      setShowCreator(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o personagem.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openJoin = (character: Character) => {
    setJoining(character);
    setJoinCode("");
    setFoundCampaign(null);
    setJoinMessage("");
    setNotice("");
    setDeletingId(null);
  };

  const closeJoin = () => {
    setJoining(null);
    setJoinCode("");
    setFoundCampaign(null);
    setJoinMessage("");
  };

  const handleSearchCampaign = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setJoinBusy(true);
    setJoinMessage("");

    try {
      setFoundCampaign(await buscarCampanhaPorCodigo(joinCode));
    } catch (error) {
      setJoinMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível buscar a campanha.",
      );
    } finally {
      setJoinBusy(false);
    }
  };

  const handleConfirmJoin = async () => {
    if (!joining || !foundCampaign) return;

    setJoinBusy(true);
    setJoinMessage("");

    try {
      await entrarNaCampanha(foundCampaign.codigo_convite);

      const linked = await vincularPersonagem(joining.id, foundCampaign.id);

      setCharacters((prev) =>
        prev.map((item) => (item.id === linked.id ? linked : item)),
      );

      try {
        setCampaigns(await listarMinhasCampanhas());
      } catch {
        // A lista de campanhas do formulário se atualiza no próximo carregamento.
      }

      setNotice(linked.nome + " entrou na campanha " + foundCampaign.nome + ".");
      closeJoin();
    } catch (error) {
      setJoinMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível colocar o personagem na campanha.",
      );
    } finally {
      setJoinBusy(false);
    }
  };

  const handleDelete = async (character: Character) => {
    setErrorMessage("");
    setNotice("");

    try {
      await excluirPersonagem(character.id);
      setCharacters((prev) => prev.filter((item) => item.id !== character.id));
      setDeletingId(null);
      setNotice(character.nome + " foi excluído.");
    } catch (error) {
      setDeletingId(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o personagem.",
      );
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Meus personagens</h1>
          <p>Escolha uma ficha para continuar sua jornada.</p>
        </div>

        <button
          className="btn-primary"
          onClick={() => {
            setErrorMessage("");
            setShowCreator((open) => !open);
          }}
        >
          {showCreator ? "Fechar" : "+ Novo personagem"}
        </button>
      </header>

      <hr className="hairline" />

      {errorMessage && <p className="dashboard-status">{errorMessage}</p>}

      {notice && <p className="dashboard-status">{notice}</p>}

      {showCreator && (
        <form className="character-creator" onSubmit={handleSubmit}>
          <div className="creator-banner">
            <div>
              <span className="creator-kicker">Ficha de aventura</span>

              <h2>Criação de personagem</h2>
            </div>

            <span className="creator-badge">Elementum</span>
          </div>

          <section className="creator-panel">
            <h3>Campanha</h3>

            <label className="field">
              <span>Vincular a uma campanha (opcional)</span>

              <select
                value={selectedCampaignId}
                onChange={(event) =>
                  setSelectedCampaignId(event.target.value)
                }
              >
                <option value="">
                  Vincular depois, com o código da campanha
                </option>

                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.nome}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <div className="creator-layout">
            <section className="creator-panel">
              <h3>Identidade</h3>

              <div className="field-grid">
                <label className="field">
                  <span>Nome do personagem</span>

                  <input
                    id="nome-personagem"
                    placeholder="Ex.: Elira Fenra"
                    {...textProps("nome")}
                  />
                </label>

                <OptionField
                  label="Raça"
                  value={draft.raca}
                  options={RACAS}
                  onChange={(value) => updateDraft("raca", value)}
                />

                <OptionField
                  label="Classe"
                  value={draft.classe}
                  options={CLASSES}
                  onChange={(value) => updateDraft("classe", value)}
                />

                <label className="field">
                  <span>Nível</span>

                  <input
                    id="nivel-personagem"
                    type="number"
                    min={1}
                    max={20}
                    value={draft.nivel}
                    onChange={(event) =>
                      updateDraft("nivel", Number(event.target.value) || 1)
                    }
                  />
                </label>

                <label className="field">
                  <span>Origem</span>

                  <input
                    placeholder="Peste, guilda, reino..."
                    {...textProps("origem")}
                  />
                </label>

                <label className="field">
                  <span>Idade</span>

                  <input placeholder="24 anos" {...textProps("idade")} />
                </label>

                <OptionField
                  label="Alinhamento"
                  value={draft.alinhamento}
                  options={ALINHAMENTOS}
                  onChange={(value) => updateDraft("alinhamento", value)}
                  wide
                />

                <label className="field field-wide">
                  <span>Foto do personagem (opcional)</span>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePortrait}
                  />

                  {portraitPreview && (
                    <img
                      src={portraitPreview}
                      alt="Prévia da foto"
                      style={{
                        width: 96,
                        height: 96,
                        objectFit: "cover",
                        borderRadius: 8,
                        marginTop: 8,
                      }}
                    />
                  )}
                </label>
              </div>
            </section>

            <aside className="creator-panel creator-panel-side">
              <h3>Atributos</h3>

              <div className="attribute-grid">
                {[
                  ["forca", "Força"],
                  ["destreza", "Destreza"],
                  ["constituicao", "Constituição"],
                  ["inteligencia", "Inteligência"],
                  ["sabedoria", "Sabedoria"],
                  ["carisma", "Carisma"],
                ].map(([key, label]) => (
                  <label key={key} className="attribute-field">
                    <span>{label}</span>

                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={draft[key as keyof typeof draft] as number}
                      onChange={(event) =>
                        updateAttribute(
                          key as keyof Attributes,
                          Number(event.target.value) || 1,
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </aside>
          </div>

          <div className="creator-layout creator-layout-bottom">
            <section className="creator-panel">
              <h3>História e personalidade</h3>

              <div className="field-grid story-grid">
                <label className="field field-wide">
                  <span>História do personagem</span>

                  <textarea
                    id="historia-personagem"
                    rows={4}
                    placeholder="Descreva como ele chegou ao mundo de Elementum..."
                    {...textProps("historia")}
                  />
                </label>

                <label className="field field-wide">
                  <span>Aparência</span>

                  <textarea
                    rows={3}
                    placeholder="Olhos, cabelo, marcas, roupas, presença..."
                    {...textProps("aparencia")}
                  />
                </label>

                <label className="field field-half">
                  <span>Objetivo</span>

                  <input
                    placeholder="O que move o personagem?"
                    {...textProps("objetivo")}
                  />
                </label>

                <label className="field field-half">
                  <span>Defeito</span>

                  <input
                    placeholder="Qual fraqueza o acompanha?"
                    {...textProps("defeito")}
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="creator-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowCreator(false)}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar personagem"}
            </button>
          </div>
        </form>
      )}

      {joining && (
        <section className="creator-panel dashboard-join">
          <h3>Entrar em campanha com {joining.nome}</h3>

          {!foundCampaign ? (
            <form onSubmit={handleSearchCampaign}>
              <label className="field">
                <span>Código da campanha</span>

                <input
                  value={joinCode}
                  onChange={(event) =>
                    setJoinCode(event.target.value.toUpperCase())
                  }
                  placeholder="Ex.: ALD7K9"
                  maxLength={6}
                  required
                />
              </label>

              {joinMessage && <p className="dashboard-status">{joinMessage}</p>}

              <div className="creator-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={closeJoin}
                  disabled={joinBusy}
                >
                  Cancelar
                </button>

                <button type="submit" className="btn-primary" disabled={joinBusy}>
                  {joinBusy ? "Buscando..." : "Buscar campanha"}
                </button>
              </div>
            </form>
          ) : (
            <div>
              <p>
                Campanha encontrada: <strong>{foundCampaign.nome}</strong>
              </p>

              <p>
                {foundCampaign.sistema || "Sistema não informado"}
                {foundCampaign.descricao ? " · " + foundCampaign.descricao : ""}
              </p>

              <p>
                Você deseja colocar <strong>{joining.nome}</strong> nesta
                campanha?
              </p>

              {joinMessage && <p className="dashboard-status">{joinMessage}</p>}

              <div className="creator-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={closeJoin}
                  disabled={joinBusy}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleConfirmJoin}
                  disabled={joinBusy}
                >
                  {joinBusy ? "Entrando..." : "Confirmar"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {loading ? (
        <p className="dashboard-status">Carregando fichas...</p>
      ) : characters.length === 0 ? (
        <p className="dashboard-status">
          Você ainda não tem personagens. Crie o primeiro e depois entre em uma
          campanha com o código do Mestre.
        </p>
      ) : (
        <div className="dashboard-grid">
          {characters.map((character) => {
            const campanha = campaigns.find(
              (item) => item.id === character.campanhaId,
            );

            return (
              <div key={character.id} className="dashboard-card-wrap">
                <CharacterCard character={character} />

                <div className="card-actions">
                  {character.campanhaId ? (
                    <>
                      <Link
                        className="btn-ghost card-campaign-link"
                        to={"/campanha/" + character.campanhaId}
                      >
                        {campanha ? campanha.nome : "Em campanha"}
                      </Link>

                      <Link
                        className="btn-ghost"
                        to={"/campanha/" + character.campanhaId + "/loja"}
                      >
                        Loja
                      </Link>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => openJoin(character)}
                    >
                      Entrar em campanha
                    </button>
                  )}

                  {deletingId === character.id ? (
                    <>
                      <span className="card-campaign-name">
                        Excluir esta ficha?
                      </span>

                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setDeletingId(null)}
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleDelete(character)}
                      >
                        Excluir
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setDeletingId(character.id);
                        setNotice("");
                      }}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
