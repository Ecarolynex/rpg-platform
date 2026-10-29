import { useEffect, useRef, useState } from "react";
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
  getCampaignClassBonuses,
  getEquippedAttributeBonusesByCharacter,
  getCampaignResourceMaximums,
  listarMinhasCampanhas,
  vincularPersonagem,
  type Campaign,
  type CampaignClassContent,
} from "../../services/api";
import { CharacterCard } from "../../components/character/CharacterCard";
import { OptionField } from "../../components/ui/OptionField";
import { ClassInfoBox } from "../../components/character/ClassInfoBox";
import { montarInfoClasse } from "../../components/character/classInfoUtils";
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
  type CampaignClassBonuses,
  type ClassDefinition,
} from "../../data/personaRules";
import { calculateDerivedCharacterStats, type CharacterRulesContext } from "../../domain/characterRules";
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

type CampaignRulesState = {
  campaignId: string;
  status: "idle" | "loading" | "ready" | "error";
  message?: string;
};

function rotuloAtributo(valor: string): string {
  const porChave = ATTRIBUTE_CONFIG.find((item) => String(item.key) === valor);
  return porChave ? porChave.label : valor;
}

function chaveNomePericia(nome?: string): string {
  if (!nome) return "";
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
}

function createUntrainedSkills(
  classe: ClassDefinition | undefined,
  campaignSkills: CampaignClassContent[],
): Skill[] {
  const classSkills = [
    ...(classe?.pericias ?? []).map((skill: any) => {
      if (typeof skill === "string") {
        return {
          id: skill.toLowerCase(),
          nome: skill,
          atributo: "forca" as const,
          descricao: "",
        };
      }
      return {
        id: skill.id,
        nome: skill.nome,
        atributo: skill.atributo,
        descricao: skill.descricao,
      };
    }),
    ...campaignSkills
      .filter((skill) => skill.tipo === "PERICIA" && skill.classe_id === classe?.id)
      .map((skill) => ({
        id: skill.id,
        nome: skill.nome,
        atributo: skill.atributo as NonNullable<Skill["atributo"]>,
        descricao: skill.descricao,
      })),
  ];
  const nomesVistos = new Set<string>();
  const definitions = [...FIXED_SKILLS, ...classSkills].filter((skill, index, skills) => {
    if (skills.findIndex((item) => item.id === skill.id) !== index) return false;
    // Uma perícia da classe com o mesmo nome de uma fixa (ex.: Atletismo) não entra duas vezes.
    const chave = chaveNomePericia(skill.nome);
    if (nomesVistos.has(chave)) return false;
    nomesVistos.add(chave);
    return true;
  });
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
  const [campaignBonuses, setCampaignBonuses] = useState<CampaignClassBonuses>({});
  const [campaignRuleContexts, setCampaignRuleContexts] = useState<Record<string, CharacterRulesContext>>({});
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignRulesState, setCampaignRulesState] = useState<CampaignRulesState>({
    campaignId: "",
    status: "idle",
  });
  const [campaignRulesRetry, setCampaignRulesRetry] = useState(0);
  const campaignRulesRequest = useRef(0);
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
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([]);
  const [classRevalidationNotice, setClassRevalidationNotice] = useState("");

  // Código de convite e customização de vitais na criação
  const [creatorJoinCode, setCreatorJoinCode] = useState("");
  const [creatorCodeBusy, setCreatorCodeBusy] = useState(false);
  const [creatorCodeError, setCreatorCodeError] = useState("");
  const [creatorCodeSuccess, setCreatorCodeSuccess] = useState("");
  const [customHpMax, setCustomHpMax] = useState<number | null>(null);
  const [customMpMax, setCustomMpMax] = useState<number | null>(null);

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

        const linkedCampaignIds = [...new Set(
          charactersData.map((character) => character.campanhaId).filter((campaignId): campaignId is string => Boolean(campaignId)),
        )];
        const ruleEntries = await Promise.all(linkedCampaignIds.map(async (campaignId) => {
          const campaignCharacters = charactersData.filter((character) => character.campanhaId === campaignId);
          const [bonuses, contents] = await Promise.all([
            getCampaignClassBonuses(campaignId).catch(() => ({})),
            listarConteudosClasseCampanha(campaignId).catch(() => []),
          ]);
          const [equipped, serverMaximums] = await Promise.all([
            getEquippedAttributeBonusesByCharacter(campaignCharacters.map((character) => character.id)).catch(() => ({} as Record<string, Partial<Record<keyof Attributes, number>>>)),
            getCampaignResourceMaximums(campaignId).catch(() => []),
          ]);
          const maximumsByCharacter = Object.fromEntries(serverMaximums.map((row) => [row.personagem_id, row]));
          return campaignCharacters.map((character) => [character.id, {
            classCatalog: classesData,
            campaignClassBonuses: bonuses,
            campaignClassContents: contents,
            equippedItemBonuses: equipped[character.id] ? [equipped[character.id]] : [],
            serverResourceMaximums: maximumsByCharacter[character.id]
              ? { hpMax: maximumsByCharacter[character.id].hp_max, mpMax: maximumsByCharacter[character.id].mp_max }
              : undefined,
          }] as const);
        }));
        setCampaignRuleContexts(Object.fromEntries(ruleEntries.flat()));
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
    const campaignId = selectedCampaignId;
    if (!campaignId) return;

    const requestId = ++campaignRulesRequest.current;
    void Promise.all([
      listarConteudosClasseCampanha(campaignId),
      getCampaignClassBonuses(campaignId),
    ])
      .then(([contents, bonuses]) => {
        if (campaignRulesRequest.current !== requestId) return;
        setCampaignClassContents(contents);
        setCampaignBonuses(bonuses);
        setCampaignRulesState({ campaignId, status: "ready" });
      })
      .catch((error: unknown) => {
        if (campaignRulesRequest.current !== requestId) return;
        const message = error instanceof Error
          ? error.message
          : "Não foi possível carregar as regras da campanha.";
        setCampaignClassContents([]);
        setCampaignBonuses({});
        setCampaignRulesState({ campaignId, status: "error", message });
      });

    return () => {
      if (campaignRulesRequest.current === requestId) {
        campaignRulesRequest.current += 1;
      }
    };
  }, [selectedCampaignId, campaignRulesRetry]);

  const campaignRulesReady = !selectedCampaignId || (
    campaignRulesState.campaignId === selectedCampaignId && campaignRulesState.status === "ready"
  );

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
  ].filter((classe) => {
    if (!selectedCampaignId) return true;
    return !campaignBonuses[classe.nome]?.bloqueada;
  });

  const infoClasse = montarInfoClasse(
    draft.classe,
    classesParaCriacao.find((item) => item.nome === draft.classe)?.id,
    classesParaCriacao,
    campaignClassContents,
    selectedCampaignId ? campaignBonuses : {},
  );

  const eligibleCampaigns = campaigns.filter((campaign) => campaign.status === "ATIVA");

  function handleSelectCampaign(campaignId: string) {
    if (campaignId === selectedCampaignId) return;
    setSelectedCampaignId(campaignId);
    setCampaignClassContents([]);
    setCampaignBonuses({});
    setCampaignRulesState(campaignId
      ? { campaignId, status: "loading" }
      : { campaignId: "", status: "idle" });
    setErrorMessage("");
    setCreatorCodeError("");

    const classeAtual = draft.classe;
    if (classeAtual) {
      const existeNoCatalogo = classesParaCriacao.some((item) => item.nome === classeAtual);
      if (!existeNoCatalogo && !campaignId) {
        updateDraft("classe", "");
        setSkillsDraft(createUntrainedSkills(undefined, []));
        setSelectedAbilities([]);
        setClassRevalidationNotice("A classe customizada anterior não está disponível nesta campanha.");
      }
    }
  }

  const handleJoinCampaignByCodeInCreator = async () => {
    const code = creatorJoinCode.trim().toUpperCase();
    if (!code) {
      setCreatorCodeError("Informe o código de convite da campanha.");
      return;
    }

    setCreatorCodeBusy(true);
    setCreatorCodeError("");
    setCreatorCodeSuccess("");

    try {
      const campaign = await entrarNaCampanha(code);
      setCampaigns((prev) => {
        if (prev.some((c) => c.id === campaign.id)) return prev;
        return [campaign, ...prev];
      });
      handleSelectCampaign(campaign.id);
      setCreatorCodeSuccess(`Campanha "${campaign.nome}" vinculada com sucesso!`);
    } catch (err) {
      setCreatorCodeError(
        err instanceof Error ? err.message : "Não foi possível vincular a campanha pelo código.",
      );
    } finally {
      setCreatorCodeBusy(false);
    }
  };

  function selecionarClasse(nome: string) {
    updateDraft("classe", nome);
    setCustomHpMax(null);
    setCustomMpMax(null);
    const classe = classesParaCriacao.find((item) => item.nome === nome);
    const novasPericias = createUntrainedSkills(classe, campaignClassContents);

    // Revalidação suave de perícias: preserva as que já estavam treinadas
    const treinadasAnteriores = new Set(
      skillsDraft.filter((s) => s.treinada).map((s) => chaveNomePericia(s.nome))
    );
    const proficiency = bonusProficiencia(Number(draft.nivel) || 1);
    setSkillsDraft(
      novasPericias.map((skill) => {
        const estavaTreinada = treinadasAnteriores.has(chaveNomePericia(skill.nome));
        return {
          ...skill,
          treinada: estavaTreinada,
          bonus: estavaTreinada ? proficiency : 0,
        };
      })
    );

    // Revalidação suave de habilidades:
    const classeAnterior = draft.classe;
    const novaInfo = montarInfoClasse(
      nome,
      classe?.id,
      classesParaCriacao,
      campaignClassContents,
      selectedCampaignId ? campaignBonuses : {},
    );
    const nomesHabilidadesNovas = new Set(
      (novaInfo?.habilidadesIniciais ?? novaInfo?.habilidades ?? []).map((h) => h.nome)
    );
    const mantidas = selectedAbilities.filter((hNome) => nomesHabilidadesNovas.has(hNome));
    if (selectedAbilities.length > 0 && mantidas.length < selectedAbilities.length) {
      setClassRevalidationNotice(
        classeAnterior
          ? `A classe foi alterada de ${classeAnterior} para ${nome}. Por favor, revise as habilidades da nova classe.`
          : `A classe foi alterada para ${nome}. Por favor, revise as habilidades iniciais selecionadas.`
      );
    } else {
      setClassRevalidationNotice("");
    }
    setSelectedAbilities(mantidas);
  }

  function toggleAbility(nome: string) {
    setSelectedAbilities((current) =>
      current.includes(nome) ? current.filter((item) => item !== nome) : [...current, nome]
    );
  }

  const nivelNum = Math.max(1, Math.min(20, Number(draft.nivel) || 1));
  const classeAtual = draft.classe || "Aventureiro";
  const definicaoClasseAtual = classesParaCriacao.find((item) => item.nome === classeAtual);
  const liveAttributes: Attributes = {
    forca: Number(draft.forca) || 10,
    destreza: Number(draft.destreza) || 10,
    constituicao: Number(draft.constituicao) || 10,
    inteligencia: Number(draft.inteligencia) || 10,
    carisma: Number(draft.carisma) || 10,
  };
  const liveCharacterStats = calculateDerivedCharacterStats(
    {
      raca: draft.raca || "Humano",
      classe: classeAtual,
      classeId: definicaoClasseAtual?.id,
      filiacao: undefined,
      nivel: nivelNum,
      attributes: liveAttributes,
      inventory: [],
    },
    {
      classCatalog: classesParaCriacao,
      campaignClassBonuses: selectedCampaignId ? campaignBonuses : undefined,
      campaignClassContents: selectedCampaignId ? campaignClassContents : [],
    },
  );

  const classHpBonus = infoClasse?.bonusHp ?? 0;
  const classMpBonus = infoClasse?.bonusMp ?? 0;
  const hpMaxInicial = 200 + classHpBonus;
  const mpMaxInicial = 200 + classMpBonus;

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
    if (!selectedCampaignId) {
      setErrorMessage("É obrigatório selecionar uma campanha antes de criar o personagem.");
      return;
    }
    if (!campaignRulesReady) {
      setErrorMessage(campaignRulesState.status === "error"
        ? "Não foi possível carregar as regras da campanha. Tente novamente antes de criar o personagem."
        : "Aguarde o carregamento das regras da campanha antes de criar o personagem.");
      return;
    }

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
      const attributes: Attributes = {
        forca: Number(draft.forca),
        destreza: Number(draft.destreza),
        constituicao: Number(draft.constituicao),
        inteligencia: Number(draft.inteligencia),
        carisma: Number(draft.carisma),
      };

      const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
      const ouroInicial = selectedCampaign?.ouro_inicial ?? 0;
      const todasHabilidades = infoClasse?.habilidades ?? [];
      const habilidadesEscolhidas = selectedAbilities.map((hNome) => {
        const hab = todasHabilidades.find((h) => h.nome === hNome);
        return {
          nome: hNome,
          descricao: hab?.descricao,
          nivel: hab?.nivel,
        };
      });

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
        hp: { atual: 0, max: 1 },
        mp: { atual: 0, max: 0 },
        attributes,
        skills: skillsDraft.map((skill) => ({
          ...skill,
          bonus: skill.treinada ? bonusProficiencia(nivel) : 0,
        })),
        inventory: [],
        spells: [],
        habilidades: habilidadesEscolhidas,
        carteira: carteiraInicial(ouroInicial),
        notas: "",
      };
      const hpFinal = customHpMax !== null ? customHpMax : hpMaxInicial;
      const mpFinal = customMpMax !== null ? customMpMax : mpMaxInicial;
      createdCharacter.hp = { atual: hpFinal, max: hpFinal };
      createdCharacter.mp = { atual: mpFinal, max: mpFinal };

      const savedCharacter = await criarPersonagem(
        selectedCampaignId,
        createdCharacter,
      );

      setCharacters((prev) => [savedCharacter, ...prev]);

      setDraft(initialDraft);
      setSkillsDraft(createUntrainedSkills(undefined, []));
      setSelectedAbilities([]);
      setClassRevalidationNotice("");
      setPortraitFile(null);
      setPortraitPreview("");
      setShowCreator(false);
      setSelectedCampaignId("");
      setCreatorJoinCode("");
      setCreatorCodeError("");
      setCreatorCodeSuccess("");
      setCustomHpMax(null);
      setCustomMpMax(null);
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
      <div className="dashboard-backdrop" aria-hidden="true" />
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
              {selectedCampaignId && (
                <p className="creator-subtitle">
                  Campanha vinculada: <strong>{campaigns.find((c) => c.id === selectedCampaignId)?.nome}</strong>
                </p>
              )}
            </div>

            <span className="creator-badge">Elementum</span>
          </div>

          <div className="creator-body">
            {/* 1. SELEÇÃO DE CAMPANHA */}
            <section className="creator-panel">
              <h3>1. Campanha</h3>
              <p className="creator-skill-hint">
                Selecione uma campanha da lista ou insira o código de convite fornecido pelo seu Mestre para vincular o personagem.
              </p>

              {/* Inserir código de convite */}
              <div className="creator-code-join-box">
                <label className="field">
                  <span>Vincular por código de convite</span>
                  <div className="creator-code-input-row">
                    <input
                      type="text"
                      placeholder="Ex.: ABC12345"
                      value={creatorJoinCode}
                      aria-label="Código de convite da campanha"
                      onChange={(e) => {
                        setCreatorJoinCode(e.target.value.toUpperCase());
                        setCreatorCodeError("");
                        setCreatorCodeSuccess("");
                      }}
                      disabled={creatorCodeBusy}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={creatorCodeBusy || !creatorJoinCode.trim()}
                      onClick={handleJoinCampaignByCodeInCreator}
                    >
                      {creatorCodeBusy ? "Vinculando..." : "Vincular Código"}
                    </button>
                  </div>
                </label>
                {creatorCodeError && (
                  <p className="creator-code-error" role="alert">{creatorCodeError}</p>
                )}
                {creatorCodeSuccess && (
                  <p className="creator-code-success">{creatorCodeSuccess}</p>
                )}
              </div>

              {eligibleCampaigns.length > 0 ? (
                <div className="creator-campaign-list-section">
                  <label className="field">
                    <span>Vincular a uma campanha (opcional)</span>

                    <select
                      value={selectedCampaignId}
                      onChange={(event) => handleSelectCampaign(event.target.value)}
                    >
                      <option value="">
                        Selecione a campanha antes de criar...
                      </option>

                      {eligibleCampaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.nome}
                        </option>
                      ))}
                    </select>

                    {selectedCampaignId && campaignRulesState.campaignId === selectedCampaignId && campaignRulesState.status === "loading" && (
                      <span role="status">Carregando regras da campanha...</span>
                    )}
                    {selectedCampaignId && campaignRulesState.campaignId === selectedCampaignId && campaignRulesState.status === "error" && (
                      <span className="dashboard-status" role="alert">
                        {campaignRulesState.message}{" "}
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            setErrorMessage("");
                            setCampaignRulesState({ campaignId: selectedCampaignId, status: "loading" });
                            setCampaignRulesRetry((attempt) => attempt + 1);
                          }}
                        >
                          Tentar carregar novamente
                        </button>
                      </span>
                    )}
                  </label>

                  <div className="creator-campaign-cards">
                    {eligibleCampaigns.map((camp) => {
                      const isSelected = selectedCampaignId === camp.id;
                      return (
                        <button
                          key={camp.id}
                          type="button"
                          className={isSelected ? "creator-camp-card creator-camp-card--selected" : "creator-camp-card"}
                          onClick={() => handleSelectCampaign(camp.id)}
                        >
                          <div className="creator-camp-card-top">
                            <strong>{camp.nome}</strong>
                            <span className="creator-camp-tag">{camp.sistema || "Elementum"}</span>
                          </div>
                          {camp.descricao && <p>{camp.descricao}</p>}
                          <small>Ouro inicial: {camp.ouro_inicial ?? 0} PO</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="creator-campaign-alert" role="alert" style={{ marginTop: 14 }}>
                  <p>
                    Você ainda não participa de nenhuma campanha na lista. Digite o código de convite acima para ingressar na mesa do seu Mestre.
                  </p>
                  <Link to="/campanhas" className="btn-ghost">
                    Ver minhas campanhas
                  </Link>
                </div>
              )}
            </section>

            {/* 2. IDENTIDADE E ATRIBUTOS */}
            <div className="creator-layout">
              <section className="creator-panel">
                <h3>2. Identidade e História</h3>

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

                  <label className="field">
                    <span>Origem</span>

                    <input
                      placeholder="Peste, guilda, reino..."
                      {...textProps("origem")}
                    />
                  </label>

                  <label className="field">
                    <span>Defeito</span>

                    <input
                      placeholder="Qual fraqueza o acompanha?"
                      {...textProps("defeito")}
                    />
                  </label>

                  <label className="field field-wide">
                    <span>Qualidades</span>
                    <textarea
                      rows={2}
                      placeholder="Corajoso, leal, curioso..."
                      {...textProps("qualidades")}
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

                  <label className="field field-wide">
                    <span>História do personagem</span>
                    <textarea
                      id="historia-personagem"
                      rows={4}
                      placeholder="Descreva como ele chegou ao mundo de Elementum..."
                      {...textProps("historia")}
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
                <h3>3. Atributos</h3>

                <div className="creator-attr-grid">
                  {ATTRIBUTE_CONFIG.map(({ key, label }) => {
                    const finalVal = liveCharacterStats.attributesFinal[key];
                    const bonusVal = liveCharacterStats.attributeBonuses[key];
                    return (
                      <label key={key} htmlFor={`attr-${key}`} className="creator-attr-field">
                        <span>{label}</span>

                        <input
                          id={`attr-${key}`}
                          aria-label={label}
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
                          Total: {finalVal} ({formatarModificador(modificador(finalVal))})
                          {bonusVal !== 0 ? ` · Bônus ${bonusVal > 0 ? "+" : ""}${bonusVal}` : ""}
                        </small>
                      </label>
                    );
                  })}
                </div>
              </aside>
            </div>

            {/* 4. VITALIDADE E MANA */}
            <section className="creator-panel">
              <h3>4. Vitalidade e Mana</h3>
              <p className="creator-skill-hint">
                Os valores máximos sugeridos iniciam em 200 PV / 200 PM mais bônus de classe. Você pode ajustá-los manualmente abaixo conforme sua classe ou regras da campanha, e também poderá alterá-los posteriormente na ficha.
              </p>
              <div className="creator-vital-preview">
                <div className="creator-vital-card creator-vital-card--hp">
                  <div className="creator-vital-header">
                    <span>Pontos de Vida (PV Máximo)</span>
                    <input
                      id="hp-max-input"
                      type="number"
                      className="creator-vital-input"
                      min={1}
                      max={9999}
                      value={customHpMax !== null ? customHpMax : hpMaxInicial}
                      aria-label="Pontos de Vida (PV Máximo)"
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomHpMax(val === "" ? null : Math.max(1, Number(val)));
                      }}
                    />
                  </div>
                  <p className="creator-vital-breakdown">
                    Base: 200 PV {classHpBonus !== 0 ? `· Ajuste da Classe: ${classHpBonus > 0 ? `+${classHpBonus}` : classHpBonus}` : "· Sem ajuste adicional de classe"}
                  </p>
                  <small className="creator-vital-cap">Configuração manual flexível · Editável na ficha</small>
                </div>

                <div className="creator-vital-card creator-vital-card--mp">
                  <div className="creator-vital-header">
                    <span>Pontos de Mana (PM Máximo)</span>
                    <input
                      id="mp-max-input"
                      type="number"
                      className="creator-vital-input"
                      min={0}
                      max={9999}
                      value={customMpMax !== null ? customMpMax : mpMaxInicial}
                      aria-label="Pontos de Mana (PM Máximo)"
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomMpMax(val === "" ? null : Math.max(0, Number(val)));
                      }}
                    />
                  </div>
                  <p className="creator-vital-breakdown">
                    Base: 200 PM {classMpBonus !== 0 ? `· Ajuste da Classe: ${classMpBonus > 0 ? `+${classMpBonus}` : classMpBonus}` : "· Sem ajuste adicional de classe"}
                  </p>
                  <small className="creator-vital-cap">Configuração manual flexível · Editável na ficha</small>
                </div>
              </div>
            </section>

            {/* 5. PERÍCIAS */}
            <section className="creator-panel">
              <h3>5. Perícias</h3>

              <p className="creator-skill-hint">
                Selecione as perícias treinadas (+{bonusProficiencia(nivelNum)} de bônus no nível {nivelNum}):
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

            {/* 6. HABILIDADES */}
            <section className="creator-panel">
              <h3>6. Habilidades da Classe</h3>

              {classRevalidationNotice && (
                <p className="creator-revalidation-alert" role="status">
                  {classRevalidationNotice}
                </p>
              )}

              {infoClasse?.habilidadesIniciais && infoClasse.habilidadesIniciais.length > 0 ? (
                <>
                  <p className="creator-skill-hint">
                    Escolha as habilidades iniciais para seu personagem (Nível 1):
                  </p>
                  <div className="creator-ability-grid">
                    {infoClasse.habilidadesIniciais.map((hab) => {
                      const isSelected = selectedAbilities.includes(hab.nome);
                      return (
                        <label
                          key={hab.nome}
                          className={isSelected ? "creator-skill-option creator-skill-option--on" : "creator-skill-option"}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAbility(hab.nome)}
                          />
                          <span className="creator-skill-text">
                            <span className="creator-skill-name">{hab.nome}</span>
                            {hab.descricao && <small>{hab.descricao}</small>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="creator-skill-hint">
                  {draft.classe
                    ? "Esta classe não possui habilidades iniciais de nível 1 cadastradas no catálogo."
                    : "Escolha uma classe para visualizar as habilidades iniciais disponíveis."}
                </p>
              )}

              {infoClasse?.desbloqueiosFuturos && infoClasse.desbloqueiosFuturos.length > 0 && (
                <div className="creator-future-abilities">
                  <h5>Desbloqueios futuros da classe</h5>
                  <ul>
                    {infoClasse.desbloqueiosFuturos.map((hab) => (
                      <li key={hab.nome}>
                        <strong>{hab.nome}</strong> (Nível {hab.nivel})
                        {hab.descricao && <span> — {hab.descricao}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* 7. REVISÃO E CONFIRMAÇÃO */}
            <section className="creator-panel creator-review-panel">
              <h3>7. Revisão e Confirmação</h3>
              <div className="creator-review-grid">
                <div>
                  <strong>Campanha:</strong>{" "}
                  {campaigns.find((c) => c.id === selectedCampaignId)?.nome || (
                    <span style={{ color: "#e58282" }}>Nenhuma selecionada</span>
                  )}
                </div>
                <div>
                  <strong>Personagem:</strong> {draft.nome || "Novo personagem"} (Nível {nivelNum})
                </div>
                <div>
                  <strong>Raça e Classe:</strong> {draft.raca || "Humano"} · {draft.classe || "Aventureiro"}
                </div>
                <div>
                  <strong>Recursos Iniciais:</strong> {hpMaxInicial} PV · {mpMaxInicial} PM · {campaigns.find((c) => c.id === selectedCampaignId)?.ouro_inicial ?? 0} PO
                </div>
                <div>
                  <strong>Perícias Treinadas ({skillsDraft.filter((s) => s.treinada).length}):</strong>{" "}
                  {skillsDraft.filter((s) => s.treinada).map((s) => s.nome).join(", ") || "Nenhuma"}
                </div>
                <div>
                  <strong>Habilidades Selecionadas ({selectedAbilities.length}):</strong>{" "}
                  {selectedAbilities.join(", ") || "Nenhuma"}
                </div>
              </div>
            </section>
          </div>

          <div className="creator-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setShowCreator(false);
                setSelectedCampaignId("");
                setSelectedAbilities([]);
                setClassRevalidationNotice("");
              }}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !selectedCampaignId || !campaignRulesReady}
            >
              {saving
                ? "Salvando..."
                : !selectedCampaignId
                  ? "Selecione uma campanha"
                  : campaignRulesState.status === "loading"
                    ? "Carregando regras..."
                    : "Salvar personagem"}
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
                <CharacterCard
                  character={character}
                  rulesContext={character.campanhaId
                    ? campaignRuleContexts[character.id]
                    : { classCatalog }}
                />

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
