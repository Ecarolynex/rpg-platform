import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Attributes, Character, Skill } from "../../types/character";
import {
  buscarCampanhaPorCodigo,
  criarPersonagem,
  getCatalogoGlobalClasses,
  enviarRetrato,
  entrarNaCampanha,
  excluirPersonagem,
  getCharacters,
  listarConteudosClasseCampanha,
  listarMinhasCampanhas,
  vincularPersonagem,
  type Campaign,
  type CampaignClassContent,
} from "../../services/api";
import { CharacterCard } from "../../components/character/CharacterCard";
import { OptionField } from "../../components/ui/OptionField";
import {
  ClassInfoBox,
  montarInfoClasse,
} from "../../components/character/ClassInfoBox";
import {
  RACAS,
  bonusProficiencia,
  carteiraInicial,
  formatarModificador,
  modificador,
} from "../../data/dnd";
import {
  ATTRIBUTE_CONFIG,
  DEFAULT_CLASS_CATALOG,
  FIXED_SKILLS,
  type ClassDefinition,
} from "../../data/personaRules";
import "./Dashboard.css";
import "./DashboardActions.css";

const initialDraft = {
  nome: "",
  raca: "",
  classe: "",
  origem: "",
  qualidades: "",
  idade: "",
  nivel: 1,
  historia: "",
  aparencia: "",
  defeito: "",
  forca: 10,
  destreza: 10,
  constituicao: 10,
  inteligencia: 10,
  carisma: 10,
};

type TextField =
  | "nome"
  | "origem"
  | "qualidades"
  | "idade"
  | "historia"
  | "aparencia"
  | "defeito";

// Vida e Mana totais de todo personagem
const VIDA_MANA_TOTAL = 200;

function rotuloAtributo(valor: string): string {
  const porChave = ATTRIBUTE_CONFIG.find((item) => String(item.key) === valor);
  return porChave ? porChave.label : valor;
}

function createUntrainedSkills(
  classe: ClassDefinition | undefined,
  campaignSkills: CampaignClassContent[],
): Skill[] {
  const classSkills = [
    ...(classe?.pericias ?? []).map((skill) => ({
      id: skill.id,
      nome: skill.nome,
      atributo: skill.atributo,
      descricao: skill.descricao,
    })),
    ...campaignSkills
      .filter((skill) => skill.tipo === "PERICIA" && skill.classe_id === classe?.id)
      .map((skill) => ({
        id: skill.id,
        nome: skill.nome,
        atributo: skill.atributo as NonNullable<Skill["atributo"]>,
        descricao: skill.descricao,
      })),
  ];
  const definitions = [...FIXED_SKILLS, ...classSkills].filter(
    (skill, index, skills) => skills.findIndex((item) => item.id === skill.id) === index,
  );
  return definitions.map((skill) => ({
    id: skill.id,
    nome: skill.nome,
    atributo: skill.atributo,
    descricao: "descricao" in skill ? skill.descricao : undefined,
    treinada: false,
    bonus: 0,
  }));
}

export default function Dashboard() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [classCatalog, setClassCatalog] = useState<ClassDefinition[]>(DEFAULT_CLASS_CATALOG);
  const [campaignClassContents, setCampaignClassContents] = useState<CampaignClassContent[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [skillsDraft, setSkillsDraft] = useState<Skill[]>(() =>
    createUntrainedSkills(undefined, []),
  );
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
        const [charactersData, campaignsData, classesData] = await Promise.all([
          getCharacters(),
          listarMinhasCampanhas(),
          getCatalogoGlobalClasses(),
        ]);

        setCharacters(charactersData);
        setCampaigns(campaignsData);
        setClassCatalog(classesData);
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

  useEffect(() => {
    if (!selectedCampaignId) {
      setCampaignClassContents([]);
      return;
    }

    listarConteudosClasseCampanha(selectedCampaignId)
      .then(setCampaignClassContents)
      .catch((error: unknown) => {
        setCampaignClassContents([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as regras da campanha.",
        );
      });
  }, [selectedCampaignId]);

  const campaignCustomClasses: ClassDefinition[] = campaignClassContents
    .filter((item) => item.tipo === "CLASSE")
    .map((item) => ({
      id: item.classe_id,
      nome: item.nome,
      aliases: [],
      atributoBonus: {
        forca: item.bonus_atributos.forca ?? 0,
        destreza: item.bonus_atributos.destreza ?? 0,
        constituicao: item.bonus_atributos.constituicao ?? 0,
        inteligencia: item.bonus_atributos.inteligencia ?? 0,
        carisma: item.bonus_atributos.carisma ?? 0,
      },
      hpBonus: item.bonus_hp,
      mpBonus: item.bonus_mp,
      pericias: [],
      habilidades: [],
      magias: [],
      usaMagia: false,
    }));
  const classesParaCriacao = [
    ...classCatalog,
    ...campaignCustomClasses.filter(
      (classe) => !classCatalog.some((item) => item.nome === classe.nome),
    ),
  ];

  const infoClasse = montarInfoClasse(
    draft.classe,
    undefined,
    classesParaCriacao,
    campaignClassContents,
  );

  function selecionarClasse(nome: string) {
    updateDraft("classe", nome);
    const classe = classesParaCriacao.find((item) => item.nome === nome);
    setSkillsDraft(createUntrainedSkills(classe, campaignClassContents));
  }

  const updateDraft = <K extends keyof typeof initialDraft>(
    field: K,
    value: (typeof initialDraft)[K],
  ) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateAttribute = (field: keyof Attributes, value: number) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSkillDraft = (skillId: string) => {
    const proficiency = bonusProficiencia(Number(draft.nivel) || 1);
    setSkillsDraft((current) => current.map((skill) => {
      if (skill.id !== skillId) return skill;
      const treinada = !skill.treinada;
      return { ...skill, treinada, bonus: treinada ? proficiency : 0 };
    }));
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

      const nivel = Number(draft.nivel) || 1;
      const classe = draft.classe || "Aventureiro";
      const definicaoClasse = classesParaCriacao.find(
        (item) => item.nome === classe,
      );
      const createdCharacter: Character = {
        id: "",
        nome: draft.nome || "Novo personagem",
        raca: draft.raca || "Humano",
        classe,
        classeId: definicaoClasse?.id,
        nivel,
        portraitUrl,
        qualidades: draft.qualidades,
        origem: draft.origem,
        idade: draft.idade,
        historia: draft.historia,
        aparencia: draft.aparencia,
        defeito: draft.defeito,
        hp: { atual: VIDA_MANA_TOTAL, max: VIDA_MANA_TOTAL },
        mp: { atual: VIDA_MANA_TOTAL, max: VIDA_MANA_TOTAL },
        attributes: {
          forca: Number(draft.forca),
          destreza: Number(draft.destreza),
          constituicao: Number(draft.constituicao),
          inteligencia: Number(draft.inteligencia),
          carisma: Number(draft.carisma),
        },
        skills: skillsDraft.map((skill) => ({
          ...skill,
          bonus: skill.treinada ? bonusProficiencia(nivel) : 0,
        })),
        inventory: [],
        spells: [],
        carteira: carteiraInicial(0),
        notas: "",
      };

      const savedCharacter = await criarPersonagem(
        selectedCampaignId || null,
        createdCharacter,
      );

      setCharacters((prev) => [savedCharacter, ...prev]);

      setDraft(initialDraft);
      setSkillsDraft(createUntrainedSkills(undefined, []));
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

          <div className="creator-body">
            <section className="creator-panel">
              <h3>Campanha</h3>

              <label className="field">
                <span>Vincular a uma campanha (opcional)</span>

                <select
                  value={selectedCampaignId}
                  onChange={(event) => {
                    setSelectedCampaignId(event.target.value);
                    updateDraft("classe", "");
                    setSkillsDraft(createUntrainedSkills(undefined, []));
                  }}
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
                  <label className="field field-wide">
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
                    options={classesParaCriacao.map((classe) => classe.nome)}
                    onChange={selecionarClasse}
                  />

                  <div className="field field-wide">
                    <span>Sobre a classe</span>

                    <ClassInfoBox
                      info={infoClasse}
                      mensagemVazia="Escolha uma classe para ver a descrição e os bônus."
                    />
                  </div>

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
                    <span>Idade</span>

                    <input placeholder="24 anos" {...textProps("idade")} />
                  </label>

                  <label className="field field-wide">
                    <span>Origem</span>

                    <input
                      placeholder="Peste, guilda, reino..."
                      {...textProps("origem")}
                    />
                  </label>

                  <label className="field field-wide">
                    <span>Qualidades</span>
                    <textarea
                      rows={3}
                      placeholder="Corajoso, leal, curioso..."
                      {...textProps("qualidades")}
                    />
                  </label>

                  <div className="field field-wide">
                    <span>Foto do personagem (opcional)</span>

                    <div className="creator-photo">
                      {portraitPreview && (
                        <img
                          className="creator-photo-preview"
                          src={portraitPreview}
                          alt="Prévia da foto"
                        />
                      )}

                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePortrait}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <aside className="creator-panel creator-panel-side">
                <h3>Atributos</h3>

                <div className="creator-attr-grid">
                  {ATTRIBUTE_CONFIG.map(({ key, label }) => (
                    <label key={key} className="creator-attr-field">
                      <span>{label}</span>

                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={draft[key]}
                        onChange={(event) =>
                          updateAttribute(
                            key,
                            Number(event.target.value) || 1,
                          )
                        }
                      />

                      <small>
                        Mod. {formatarModificador(modificador(Number(draft[key]) || 10))}
                      </small>
                    </label>
                  ))}
                </div>
              </aside>
            </div>

            <section className="creator-panel">
              <h3>Perícias</h3>

              <p className="creator-skill-hint">
                Selecione as perícias treinadas. Você poderá alterá-las na ficha depois.
              </p>

              <div className="creator-skill-grid">
                {skillsDraft.map((skill) => (
                  <label
                    className={
                      skill.treinada
                        ? "creator-skill-option creator-skill-option--on"
                        : "creator-skill-option"
                    }
                    key={skill.id}
                    title={skill.descricao || undefined}
                  >
                    <input
                      type="checkbox"
                      checked={skill.treinada}
                      onChange={() => toggleSkillDraft(skill.id)}
                    />

                    <span className="creator-skill-text">
                      <span className="creator-skill-name">{skill.nome}</span>
                      <small>{rotuloAtributo(String(skill.atributo))}</small>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="creator-panel">
              <h3>História e personalidade</h3>

              <div className="field-grid story-grid">
                <label className="field">
                  <span>História do personagem</span>

                  <textarea
                    id="historia-personagem"
                    rows={5}
                    placeholder="Descreva como ele chegou ao mundo de Elementum..."
                    {...textProps("historia")}
                  />
                </label>

                <label className="field">
                  <span>Aparência</span>

                  <textarea
                    rows={5}
                    placeholder="Olhos, cabelo, marcas, roupas, presença..."
                    {...textProps("aparencia")}
                  />
                </label>

                <label className="field field-wide">
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