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
import { GrimoireEnvironment } from "../../components/character/creator/GrimoireEnvironment";
import {
  GrimoireModal,
  type CharacterDraftState,
  type DraftTextField,
} from "../../components/character/creator/GrimoireModal";
import { montarInfoClasse } from "../../components/character/classInfoUtils";
import {
  bonusProficiencia,
  carteiraInicial,
} from "../../data/dnd";
import {
  DEFAULT_CLASS_CATALOG,
  FIXED_SKILLS,
  normalizarBonusClassesCampanha,
  type CampaignClassBonuses,
  type ClassDefinition,
} from "../../data/personaRules";
import { calculateDerivedCharacterStats, type CharacterRulesContext } from "../../domain/characterRules";
import "./Dashboard.css";
import "./DashboardActions.css";
import "../../components/character/creator/GrimoireCreator.css";

const initialDraft: CharacterDraftState = {
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
  sabedoria: 10,
  carisma: 10,
};

type CampaignRulesState = {
  campaignId: string;
  status: "idle" | "loading" | "ready" | "error";
  message?: string;
};

function chaveNomePericia(nome?: string): string {
  if (!nome) return "";
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
}

function normalizarChaveClasse(valor?: string): string {
  if (!valor) return "";
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

function isClasseBloqueadaNaCampanha(
  classe: ClassDefinition,
  bonuses: CampaignClassBonuses,
): boolean {
  if (classe.bloqueada) return true;
  const direct = bonuses[classe.nome] ?? bonuses[classe.id];
  if (direct && typeof direct.bloqueada === "boolean") {
    return direct.bloqueada;
  }
  const targetNome = normalizarChaveClasse(classe.nome);
  const targetId = normalizarChaveClasse(classe.id);
  for (const [key, config] of Object.entries(bonuses)) {
    const normKey = normalizarChaveClasse(key);
    if (normKey === targetNome || normKey === targetId) {
      return Boolean(config?.bloqueada);
    }
  }
  return false;
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
  const [draft, setDraft] = useState<CharacterDraftState>(initialDraft);
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

        const activeCampaigns = campaignsData.filter((item) => item.status === "ATIVA");
        if (activeCampaigns.length === 1) {
          const singleCampaign = activeCampaigns[0];
          setSelectedCampaignId((current) => {
            if (current) return current;
            setCampaignRulesState({ campaignId: singleCampaign.id, status: "loading" });
            if (
              singleCampaign.bonus_classes &&
              typeof singleCampaign.bonus_classes === "object" &&
              Object.keys(singleCampaign.bonus_classes).length > 0
            ) {
              setCampaignBonuses(
                normalizarBonusClassesCampanha(singleCampaign.bonus_classes, false),
              );
            }
            return singleCampaign.id;
          });
        }

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
  const eligibleCampaigns = campaigns.filter((campaign) => campaign.status === "ATIVA");
  const selectedCampaign =
    campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;

  const effectiveCampaignBonuses: CampaignClassBonuses = {
    ...(selectedCampaign?.bonus_classes &&
    typeof selectedCampaign.bonus_classes === "object" &&
    Object.keys(selectedCampaign.bonus_classes).length > 0
      ? normalizarBonusClassesCampanha(selectedCampaign.bonus_classes, false)
      : {}),
    ...campaignBonuses,
  };

  const hasResolvedCampaignRules =
    Boolean(selectedCampaignId) &&
    ((campaignRulesState.campaignId === selectedCampaignId &&
      campaignRulesState.status === "ready") ||
      Boolean(
        selectedCampaign?.bonus_classes &&
          typeof selectedCampaign.bonus_classes === "object" &&
          Object.keys(selectedCampaign.bonus_classes).length > 0,
      ));

  const classesParaCriacao = !hasResolvedCampaignRules
    ? []
    : [
        ...classCatalog,
        ...campaignCustomClasses.filter(
          (classe) =>
            !classCatalog.some(
              (item) =>
                normalizarChaveClasse(item.nome) === normalizarChaveClasse(classe.nome),
            ),
        ),
      ].filter(
        (classe) => !isClasseBloqueadaNaCampanha(classe, effectiveCampaignBonuses),
      );

  useEffect(() => {
    if (!hasResolvedCampaignRules || !draft.classe) return;
    const disponivel = classesParaCriacao.some((item) => item.nome === draft.classe);
    if (!disponivel) {
      setDraft((prev) => ({ ...prev, classe: "" }));
      setSkillsDraft(createUntrainedSkills(undefined, campaignClassContents));
      setSelectedAbilities([]);
      setClassRevalidationNotice(
        "A classe selecionada anteriormente não está liberada pelo Mestre nesta campanha.",
      );
    }
  }, [hasResolvedCampaignRules, classesParaCriacao, draft.classe, campaignClassContents]);

  const infoClasse = montarInfoClasse(
    draft.classe,
    classesParaCriacao.find((item) => item.nome === draft.classe)?.id,
    classesParaCriacao,
    campaignClassContents,
    selectedCampaignId ? effectiveCampaignBonuses : {},
  );

  function handleSelectCampaign(campaignId: string, campaignOverride?: Campaign) {
    if (campaignId === selectedCampaignId) return;
    const targetCampaign =
      campaignOverride ?? campaigns.find((item) => item.id === campaignId) ?? null;
    setSelectedCampaignId(campaignId);
    setCampaignClassContents([]);
    setCampaignBonuses(
      targetCampaign?.bonus_classes &&
        typeof targetCampaign.bonus_classes === "object" &&
        Object.keys(targetCampaign.bonus_classes).length > 0
        ? normalizarBonusClassesCampanha(targetCampaign.bonus_classes, false)
        : {},
    );
    setCampaignRulesState(campaignId
      ? { campaignId, status: "loading" }
      : { campaignId: "", status: "idle" });
    setErrorMessage("");
    setCreatorCodeError("");

    const classeAtual = draft.classe;
    if (classeAtual && !campaignId) {
      updateDraft("classe", "");
      setSkillsDraft(createUntrainedSkills(undefined, []));
      setSelectedAbilities([]);
      setClassRevalidationNotice("A classe customizada anterior não está disponível nesta campanha.");
    }
  }

  const handleJoinCampaignByCodeInCreator = async (): Promise<boolean> => {
    const code = creatorJoinCode.trim().toUpperCase();
    if (!code) {
      setCreatorCodeError("Informe o código de convite da campanha.");
      return false;
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
      handleSelectCampaign(campaign.id, campaign);
      setCreatorCodeSuccess(`Campanha "${campaign.nome}" vinculada com sucesso!`);
      return true;
    } catch (err) {
      setCreatorCodeError(
        err instanceof Error ? err.message : "Não foi possível vincular a campanha pelo código.",
      );
      return false;
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

  const updateDraft = <K extends keyof CharacterDraftState>(
    field: K,
    value: CharacterDraftState[K],
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

  const textProps = (field: DraftTextField) => ({
    value: draft[field],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => updateDraft(field, event.target.value),
  });

  const applyPortraitFile = (file: File | null) => {
    if (portraitPreview) {
      URL.revokeObjectURL(portraitPreview);
    }
    setPortraitFile(file);
    setPortraitPreview(file ? URL.createObjectURL(file) : "");
  };

  const handlePortrait = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    applyPortraitFile(file);
  };

  const closeCreatorModal = () => {
    setShowCreator(false);
    setSelectedCampaignId("");
    setSelectedAbilities([]);
    setClassRevalidationNotice("");
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
      <GrimoireEnvironment />

      <header className="dashboard-header">
        <div>
          <h1>Meus personagens</h1>
          <p>Escolha uma ficha para continuar sua jornada.</p>
        </div>

        <button
          className="btn-primary grimoire-trigger-btn"
          aria-label={showCreator ? "Fechar" : "+ Novo personagem · Criar Personagem"}
          onClick={() => {
            setErrorMessage("");
            setShowCreator((open) => !open);
          }}
        >
          <span className="grimoire-trigger-btn__seal" aria-hidden="true">
            ⚜
          </span>
          <span>{showCreator ? "Fechar" : "Criar Personagem"}</span>
        </button>
      </header>

      <hr className="hairline" />

      {errorMessage && <p className="dashboard-status">{errorMessage}</p>}

      {notice && <p className="dashboard-status">{notice}</p>}

      <GrimoireModal
        open={showCreator}
        onClose={closeCreatorModal}
        onSubmit={handleSubmit}
        saving={saving}
        draft={draft}
        updateDraft={updateDraft}
        updateAttribute={updateAttribute}
        textProps={textProps}
        eligibleCampaigns={eligibleCampaigns}
        campaigns={campaigns}
        selectedCampaignId={selectedCampaignId}
        onSelectCampaign={handleSelectCampaign}
        campaignRulesState={campaignRulesState}
        campaignRulesReady={campaignRulesReady}
        onRetryCampaignRules={() => {
          setErrorMessage("");
          setCampaignRulesState({ campaignId: selectedCampaignId, status: "loading" });
          setCampaignRulesRetry((attempt) => attempt + 1);
        }}
        creatorJoinCode={creatorJoinCode}
        onChangeJoinCode={(val) => {
          setCreatorJoinCode(val);
          setCreatorCodeError("");
          setCreatorCodeSuccess("");
        }}
        creatorCodeBusy={creatorCodeBusy}
        creatorCodeError={creatorCodeError}
        creatorCodeSuccess={creatorCodeSuccess}
        onJoinCampaignByCode={handleJoinCampaignByCodeInCreator}
        classesParaCriacao={classesParaCriacao}
        onSelectClass={selecionarClasse}
        infoClasse={infoClasse}
        liveCharacterStats={liveCharacterStats}
        hpMaxInicial={hpMaxInicial}
        mpMaxInicial={mpMaxInicial}
        classHpBonus={classHpBonus}
        classMpBonus={classMpBonus}
        customHpMax={customHpMax}
        setCustomHpMax={setCustomHpMax}
        customMpMax={customMpMax}
        setCustomMpMax={setCustomMpMax}
        skillsDraft={skillsDraft}
        onToggleSkill={toggleSkillDraft}
        selectedAbilities={selectedAbilities}
        onToggleAbility={toggleAbility}
        classRevalidationNotice={classRevalidationNotice}
        portraitPreview={portraitPreview}
        onPortraitChange={handlePortrait}
        onPortraitFileDrop={(file) => applyPortraitFile(file)}
      />

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
