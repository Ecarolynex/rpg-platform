import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  creditarOuroCampanha,
  creditarExperienciaCampanha,
  entregarItemCampanha,
  listarCatalogoItens,
  listarRecompensasCampanha,
  excluirCampanha,
  getCatalogoGlobalClasses,
  getCampaignAccess,
  getCampaignResourceMaximums,
  getCharacters,
  getEquippedAttributeBonusesByCharacter,
  listarConteudosClasseCampanha,
  listarMinhasCampanhas,
  listarPersonagensDaCampanha,
  adicionarConteudoClasseCampanha,
  removerConteudoClasseCampanha,
  salvarBonusClassesCampanha,
  type CampaignClassContent,
  vincularPersonagem,
  type Campaign,
} from "../../services/api";
import type { Character } from "../../types/character";
import {
  ATTRIBUTE_CONFIG,
  normalizarBonusClassesCampanha,
  type ClassDefinition,
  type BaseAttributeKey,
  type CampaignClassBonuses,
} from "../../data/personaRules";
import { CharacterCard } from "../../components/character/CharacterCard";
import { StatBar } from "../../components/ui/StatBar";
import "./Campaign.css";


function criarIdClasseCampanha() {
  return `camp-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

function criarRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    return (token === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

interface SecaoProps {
  id: string;
  titulo: string;
  resumo?: string;
  aberta: boolean;
  aoAlternar: (id: string) => void;
  variante?: "perigo";
  children: ReactNode;
}

// Seção expansível. O conteúdo permanece montado (apenas oculto) para que
// formulários e mensagens preservem o estado ao alternar entre seções.
function Secao({ id, titulo, resumo, aberta, aoAlternar, variante, children }: SecaoProps) {
  return (
    <section
      id={id}
      aria-labelledby={id + "-rotulo"}
      className={
        "campaign-section tav-secao" +
        (aberta ? " is-open" : "") +
        (variante === "perigo" ? " tav-secao--perigo" : "")
      }
    >
      <div className="secao-corner-accents" aria-hidden="true">
        <span className="secao-corner-dot secao-corner-dot--tl" />
        <span className="secao-corner-dot secao-corner-dot--tr" />
        <span className="secao-corner-dot secao-corner-dot--bl" />
        <span className="secao-corner-dot secao-corner-dot--br" />
      </div>
      <h2 className="tav-secao-titulo">
        <button
          type="button"
          className="tav-secao-toggle"
          aria-expanded={aberta}
          aria-controls={id + "-corpo"}
          onClick={() => aoAlternar(id)}
        >
          <span className="tav-secao-rotulo" id={id + "-rotulo"}>{titulo}</span>
          {resumo && <span className="tav-secao-resumo">{resumo}</span>}
          <span className="tav-secao-seta" aria-hidden="true" />
        </button>
      </h2>
      <div className="tav-secao-corpo" id={id + "-corpo"} hidden={!aberta}>
        {children}
      </div>
    </section>
  );
}

export default function Campaign() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [bonusClasses, setBonusClasses] = useState<CampaignClassBonuses>(
    () => normalizarBonusClassesCampanha(),
  );
  const [salvandoBonusClasses, setSalvandoBonusClasses] = useState(false);
  const [bonusClassesMensagem, setBonusClassesMensagem] = useState("");
  const [catalogoClasses, setCatalogoClasses] = useState<ClassDefinition[]>([]);
  const [conteudosClasses, setConteudosClasses] = useState<CampaignClassContent[]>([]);
  const [bonusEquipamentos, setBonusEquipamentos] = useState<Record<string, Partial<Record<BaseAttributeKey, number>>>>({});
  const [erroBonusEquipamentos, setErroBonusEquipamentos] = useState("");
  const [maximosServidor, setMaximosServidor] = useState<Record<string, { hp: number; mp: number; hpAtual: number; mpAtual: number }>>({});
  const [tipoNovoConteudo, setTipoNovoConteudo] = useState<"CLASSE" | "PERICIA" | "HABILIDADE">("HABILIDADE");
  const [classeNovoConteudo, setClasseNovoConteudo] = useState("");
  const [nomeNovoConteudo, setNomeNovoConteudo] = useState("");
  const [descricaoNovoConteudo, setDescricaoNovoConteudo] = useState("");
  const [atributoNovaPericia, setAtributoNovaPericia] = useState<BaseAttributeKey>("forca");
  const [nivelNovaHabilidade, setNivelNovaHabilidade] = useState(1);
  const [bonusNovaClasse, setBonusNovaClasse] = useState<Record<BaseAttributeKey, number>>({
    forca: 0, destreza: 0, constituicao: 0, inteligencia: 0, carisma: 0,
  });
  const [vidaNovaClasse, setVidaNovaClasse] = useState(0);
  const [manaNovaClasse, setManaNovaClasse] = useState(0);
  const [salvandoConteudo, setSalvandoConteudo] = useState(false);
  const [mensagemConteudo, setMensagemConteudo] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);

  const [todosDaCampanha, setTodosDaCampanha] = useState<Character[]>([]);
  const [meusNaCampanha, setMeusNaCampanha] = useState<Character[]>([]);
  const [outrosPersonagens, setOutrosPersonagens] = useState<Character[]>([]);
  const [semCampanha, setSemCampanha] = useState<Character[]>([]);
  const [escolhido, setEscolhido] = useState("");

  const [vinculando, setVinculando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [versao, setVersao] = useState(0);

  // Seções expansíveis da página. Começam abertas a visão geral e os
  // jogadores/personagens (o conteúdo mais usado por Mestre e jogadores);
  // as demais abrem sob demanda e cada uma alterna de forma independente.
  const [secoesAbertas, setSecoesAbertas] = useState<string[]>([
    "secao-visao",
    "secao-jogadores",
  ]);

  // Ferramenta do Mestre: Distribuição de Ouro
  const [tipoRecompensa, setTipoRecompensa] = useState<"OURO" | "XP" | "ITEM">("OURO");
  const [quantidadeRecompensa, setQuantidadeRecompensa] = useState("50");
  const [itemRecompensa, setItemRecompensa] = useState("");
  const [catalogoItens, setCatalogoItens] = useState<Awaited<ReturnType<typeof listarCatalogoItens>>>([]);
  const [historicoRecompensas, setHistoricoRecompensas] = useState<Awaited<ReturnType<typeof listarRecompensasCampanha>>>([]);
  const [destinatarioOuro, setDestinatarioOuro] = useState("TODOS");
  const [distribuindoOuro, setDistribuindoOuro] = useState(false);
  const [ouroMensagem, setOuroMensagem] = useState("");
  const rewardRequestIdsRef = useRef(new Map<string, string>());

  // Feedback de cópia do código
  const [copiado, setCopiado] = useState(false);
  const [erroCopiarConvite, setErroCopiarConvite] = useState("");

  // Filtros e controles ergonômicos da Área do Mestre
  const [buscaPersonagem, setBuscaPersonagem] = useState("");
  const [filtroClasses, setFiltroClasses] = useState("");
  const [filtroClasseCat, setFiltroClasseCat] = useState<"TODAS" | "DISPONIVEIS" | "BLOQUEADAS">("TODAS");
  const [bloqueandoClasse, setBloqueandoClasse] = useState<string | null>(null);

  function abrirRecompensaPara(personagemId?: string) {
    if (personagemId) {
      setDestinatarioOuro(personagemId);
    }
    setOuroMensagem("");
    setSecoesAbertas((atuais) =>
      atuais.includes("secao-entregas") ? atuais : [...atuais, "secao-entregas"],
    );
    setTimeout(() => {
      const el = document.getElementById("secao-entregas");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function handleToggleBloqueioClasse(nomeClasse: string) {
    if (!id || !isMaster || salvandoBonusClasses) return;
    const classeDef = classesDisponiveis.find((item) => item.nome === nomeClasse);
    const bonusAtual = bonusClasses[nomeClasse] ?? classeDef;
    if (!bonusAtual) return;

    const novoBloqueio = !bonusAtual.bloqueada;
    const novosBonus = {
      ...bonusClasses,
      [nomeClasse]: {
        ...bonusAtual,
        bloqueada: novoBloqueio,
      },
    };

    setBloqueandoClasse(nomeClasse);
    setSalvandoBonusClasses(true);
    setBonusClassesMensagem("");

    try {
      const salvo = await salvarBonusClassesCampanha(id, novosBonus);
      setBonusClasses(salvo);
      setCampaign((camp) => (camp ? { ...camp, bonus_classes: salvo } : camp));
      setBonusClassesMensagem(
        novoBloqueio
          ? `A classe “${nomeClasse}” foi bloqueada para novos personagens. Fichas existentes não são afetadas.`
          : `A classe “${nomeClasse}” foi liberada para novos personagens nesta campanha.`,
      );
    } catch (error) {
      setBonusClassesMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a disponibilidade da classe.",
      );
    } finally {
      setBloqueandoClasse(null);
      setSalvandoBonusClasses(false);
    }
  }

  async function atualizarMaximosServidor(campanhaId: string) {
    try {
      const maximums = await getCampaignResourceMaximums(campanhaId);
      setMaximosServidor(Object.fromEntries(maximums.map((row) => [row.personagem_id, {
        hp: row.hp_max,
        mp: row.mp_max,
        hpAtual: row.hp_atual,
        mpAtual: row.mp_atual,
      }])));
    } catch (error) {
      console.error("Não foi possível atualizar máximos autoritativos da campanha:", error);
      setMaximosServidor({});
    }
  }

  useEffect(() => {
    if (!id) return;

    async function carregar(campanhaId: string) {
      try {
        const [campanhas, acesso, daCampanha, meus, catalogo, conteudos] = await Promise.all([
          listarMinhasCampanhas(),
          getCampaignAccess(campanhaId),
          listarPersonagensDaCampanha(campanhaId),
          getCharacters(),
          getCatalogoGlobalClasses(),
          listarConteudosClasseCampanha(campanhaId),
        ]);

        const meusIds = new Set(meus.map((personagem) => personagem.id));
        const livres = meus.filter((personagem) => personagem.campanhaId === null);
        let equipamentoPorPersonagem: Record<string, Partial<Record<BaseAttributeKey, number>>> = {};
        try {
          equipamentoPorPersonagem = await getEquippedAttributeBonusesByCharacter(
            daCampanha.map((personagem) => personagem.id),
          );
          setErroBonusEquipamentos("");
        } catch (error) {
          console.error("Não foi possível carregar bônus de equipamento da campanha:", error);
          setErroBonusEquipamentos("Bônus de equipamento não carregaram; os máximos mostrados podem estar incompletos.");
        }
        setBonusEquipamentos(equipamentoPorPersonagem);
        try {
          const maxima = await getCampaignResourceMaximums(campanhaId);
          setMaximosServidor(Object.fromEntries(maxima.map((row) => [row.personagem_id, {
            hp: row.hp_max,
            mp: row.mp_max,
            hpAtual: row.hp_atual,
            mpAtual: row.mp_atual,
          }])));
        } catch (error) {
          console.error("Não foi possível carregar máximos autoritativos da campanha:", error);
          setMaximosServidor({});
        }
        // Catálogo e histórico são independentes: se um falhar, o outro ainda carrega.
        const [catalogoResultado, historicoResultado] = await Promise.allSettled([
          listarCatalogoItens(),
          listarRecompensasCampanha(campanhaId),
        ]);
        if (catalogoResultado.status === "fulfilled") {
          setCatalogoItens(catalogoResultado.value);
        } else {
          console.error("Não foi possível carregar o catálogo de itens:", catalogoResultado.reason);
        }
        if (historicoResultado.status === "fulfilled") {
          setHistoricoRecompensas(historicoResultado.value);
        } else {
          console.error("Não foi possível carregar o histórico de recompensas:", historicoResultado.reason);
        }

        const campanhaAtual =
          campanhas.find((item) => item.id === campanhaId) ?? null;
        setCampaign(campanhaAtual);
        setCatalogoClasses(catalogo);
        setConteudosClasses(conteudos);
        setBonusClasses({
          ...Object.fromEntries(catalogo.map((classe) => [classe.nome, classe])),
          ...Object.fromEntries(
            conteudos
              .filter((conteudo) => conteudo.tipo === "CLASSE")
              .map((conteudo) => [
                conteudo.nome,
                {
                  atributoBonus: {
                    forca: conteudo.bonus_atributos.forca ?? 0,
                    destreza: conteudo.bonus_atributos.destreza ?? 0,
                    constituicao: conteudo.bonus_atributos.constituicao ?? 0,
                    inteligencia: conteudo.bonus_atributos.inteligencia ?? 0,
                    carisma: conteudo.bonus_atributos.carisma ?? 0,
                  },
                  hpBonus: conteudo.bonus_hp,
                  mpBonus: conteudo.bonus_mp,
                },
              ]),
          ),
          ...(campanhaAtual?.bonus_classes &&
          Object.keys(campanhaAtual.bonus_classes).length > 0
            ? normalizarBonusClassesCampanha(campanhaAtual.bonus_classes, false)
            : {}),
        });
        setIsMaster(acesso.isMaster);
        setTodosDaCampanha(daCampanha);
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

  const classesDisponiveis = [
    ...catalogoClasses,
    ...conteudosClasses
      .filter((conteudo) => conteudo.tipo === "CLASSE")
      .map((conteudo) => ({
        id: conteudo.classe_id,
        nome: conteudo.nome,
        atributoBonus: {
          forca: conteudo.bonus_atributos.forca ?? 0,
          destreza: conteudo.bonus_atributos.destreza ?? 0,
          constituicao: conteudo.bonus_atributos.constituicao ?? 0,
          inteligencia: conteudo.bonus_atributos.inteligencia ?? 0,
          carisma: conteudo.bonus_atributos.carisma ?? 0,
        },
        hpBonus: conteudo.bonus_hp,
        mpBonus: conteudo.bonus_mp,
        pericias: [],
        habilidades: [],
      })),
  ];

  const classesComOrigem = classesDisponiveis.map((classe) => {
    const isExclusiva = conteudosClasses.some(
      (c) => c.tipo === "CLASSE" && c.nome === classe.nome,
    );
    const bonusAtual = bonusClasses[classe.nome] ?? classe;
    const isBloqueada = Boolean(bonusAtual.bloqueada);
    return {
      ...classe,
      origem: isExclusiva ? ("CAMPANHA" as const) : ("GLOBAL" as const),
      origemLabel: isExclusiva ? "Exclusiva da Campanha" : "Catálogo Global",
      bloqueada: isBloqueada,
    };
  });

  const totalClassesBloqueadas = classesComOrigem.filter((c) => c.bloqueada).length;
  const totalClassesDisponiveis = classesComOrigem.filter((c) => !c.bloqueada).length;

  const classesFiltradas = classesComOrigem.filter((c) => {
    if (filtroClasseCat === "DISPONIVEIS" && c.bloqueada) return false;
    if (filtroClasseCat === "BLOQUEADAS" && !c.bloqueada) return false;
    if (!filtroClasses.trim()) return true;
    return c.nome.toLowerCase().includes(filtroClasses.toLowerCase());
  });

  const personagensFiltrados = todosDaCampanha.filter((char) => {
    if (!buscaPersonagem.trim()) return true;
    const termo = buscaPersonagem.toLowerCase();
    return (
      char.nome.toLowerCase().includes(termo) ||
      (char.classe && char.classe.toLowerCase().includes(termo)) ||
      (char.raca && char.raca.toLowerCase().includes(termo))
    );
  });

  const totalOuroMesa = todosDaCampanha.reduce(
    (acc, c) => acc + (c.carteira?.po ?? 0),
    0,
  );

  const classeNovoConteudoSelecionada = classesDisponiveis.some(
    (classe) => classe.id === classeNovoConteudo,
  )
    ? classeNovoConteudo
    : (classesDisponiveis[0]?.id ?? "");

  function atualizarBonusAtributo(
    classe: string,
    atributo: BaseAttributeKey,
    valor: number,
  ) {
    setBonusClasses((atuais) => ({
      ...atuais,
      [classe]: {
        ...(atuais[classe] ?? classesDisponiveis.find((item) => item.nome === classe)),
        atributoBonus: {
          ...(atuais[classe]?.atributoBonus ??
            classesDisponiveis.find((item) => item.nome === classe)?.atributoBonus ??
            {}),
          [atributo]: valor,
        },
      },
    }));
  }

  function atualizarBonusRecurso(
    classe: string,
    recurso: "hpBonus" | "mpBonus",
    valor: number,
  ) {
    setBonusClasses((atuais) => ({
      ...atuais,
      [classe]: {
        ...(atuais[classe] ?? classesDisponiveis.find((item) => item.nome === classe)),
        [recurso]: valor,
      },
    }));
  }

  async function handleSalvarBonusClasses(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!id || !isMaster || salvandoBonusClasses) return;

    setSalvandoBonusClasses(true);
    setBonusClassesMensagem("");

    try {
      const salvo = await salvarBonusClassesCampanha(id, bonusClasses);
      setBonusClasses(salvo);
      setCampaign((atual) =>
        atual ? { ...atual, bonus_classes: salvo } : atual,
      );
      void atualizarMaximosServidor(id);
      setBonusClassesMensagem("Bônus de classe salvos para esta campanha.");
    } catch (error) {
      setBonusClassesMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar os bônus de classe.",
      );
    } finally {
      setSalvandoBonusClasses(false);
    }
  }

  async function handleAdicionarConteudoClasse(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!id || salvandoConteudo || !nomeNovoConteudo.trim()) return;

    setSalvandoConteudo(true);
    setMensagemConteudo("");
    try {
      if (
        tipoNovoConteudo === "CLASSE" &&
        classesDisponiveis.some(
          (classe) =>
            classe.nome.toLocaleLowerCase() === nomeNovoConteudo.trim().toLocaleLowerCase(),
        )
      ) {
        throw new Error("Já existe uma classe com esse nome nesta campanha.");
      }
      const classeId =
        tipoNovoConteudo === "CLASSE"
          ? criarIdClasseCampanha()
          : classeNovoConteudoSelecionada;
      if (tipoNovoConteudo !== "CLASSE" && !classeId) {
        throw new Error("Selecione a classe relacionada ao novo conteúdo.");
      }

      const novo = await adicionarConteudoClasseCampanha(id, {
        classe_id: classeId,
        tipo: tipoNovoConteudo,
        nome: nomeNovoConteudo.trim(),
        descricao: descricaoNovoConteudo.trim(),
        atributo: tipoNovoConteudo === "PERICIA" ? atributoNovaPericia : null,
        nivel: tipoNovoConteudo === "HABILIDADE" ? nivelNovaHabilidade : null,
        bonus_atributos:
          tipoNovoConteudo === "CLASSE" ? bonusNovaClasse : {},
        bonus_hp: tipoNovoConteudo === "CLASSE" ? vidaNovaClasse : 0,
        bonus_mp: tipoNovoConteudo === "CLASSE" ? manaNovaClasse : 0,
      });
      setConteudosClasses((atuais) => [...atuais, novo]);
      void atualizarMaximosServidor(id);
      if (novo.tipo === "CLASSE") {
        setBonusClasses((atuais) => ({
          ...atuais,
          [novo.nome]: {
            atributoBonus: {
              forca: novo.bonus_atributos.forca ?? 0,
              destreza: novo.bonus_atributos.destreza ?? 0,
              constituicao: novo.bonus_atributos.constituicao ?? 0,
              inteligencia: novo.bonus_atributos.inteligencia ?? 0,
              carisma: novo.bonus_atributos.carisma ?? 0,
            },
            hpBonus: novo.bonus_hp,
            mpBonus: novo.bonus_mp,
          },
        }));
      }
      setNomeNovoConteudo("");
      setDescricaoNovoConteudo("");
      setMensagemConteudo("Conteúdo adicionado a esta campanha.");
    } catch (error) {
      setMensagemConteudo(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar o conteúdo.",
      );
    } finally {
      setSalvandoConteudo(false);
    }
  }

  async function handleRemoverConteudoClasse(conteudo: CampaignClassContent) {
    try {
      await removerConteudoClasseCampanha(conteudo.id);
      setConteudosClasses((atuais) =>
        atuais.filter((item) => item.id !== conteudo.id),
      );
      if (id) void atualizarMaximosServidor(id);
      setMensagemConteudo("Conteúdo removido desta campanha.");
    } catch (error) {
      setMensagemConteudo(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o conteúdo.",
      );
    }
  }

  async function handleVincular(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!id || !escolhido) return;

    setVinculando(true);
    setMensagem("");

    try {
      await vincularPersonagem(escolhido, id);
      setMensagem("Personagem vinculado à campanha com sucesso!");
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

  async function handleDistribuirOuro(event: React.FormEvent) {
    event.preventDefault();
    const quantia = Number(quantidadeRecompensa);
    if (!Number.isSafeInteger(quantia) || quantia <= 0 || todosDaCampanha.length === 0) return;
    if (tipoRecompensa === "OURO" && quantia > 100000) return;
    if (tipoRecompensa === "ITEM" && (!itemRecompensa || quantia > 9999)) return;

    setDistribuindoOuro(true);
    setOuroMensagem("");

    const requestSignature = JSON.stringify([
      id,
      tipoRecompensa,
      quantia,
      destinatarioOuro,
      tipoRecompensa === "ITEM" ? itemRecompensa : null,
    ]);
    let requestId = rewardRequestIdsRef.current.get(requestSignature);
    if (!requestId) {
      requestId = criarRequestId();
      rewardRequestIdsRef.current.set(requestSignature, requestId);
    }

    try {
      const alvo = destinatarioOuro === "TODOS"
        ? null
        : todosDaCampanha.find((character) => character.id === destinatarioOuro);
      if (destinatarioOuro !== "TODOS" && !alvo) {
        throw new Error("Personagem selecionado não foi encontrado.");
      }

      if (tipoRecompensa === "OURO") {
        const count = await creditarOuroCampanha(id!, quantia, alvo?.id, requestId);
        setOuroMensagem(destinatarioOuro === "TODOS"
          ? `Concluído! ${quantia} PO foram distribuídos para ${count} personagens do grupo.`
          : `Concluído! ${quantia} PO foram entregues para ${alvo?.nome}.`);
      } else if (tipoRecompensa === "XP") {
        const count = await creditarExperienciaCampanha(id!, quantia, alvo?.id, requestId);
        setOuroMensagem(destinatarioOuro === "TODOS"
          ? `Concluído! ${quantia} XP foram distribuídos para ${count} personagens do grupo.`
          : `Concluído! ${quantia} XP foram entregues para ${alvo?.nome}.`);
      } else {
        const count = await entregarItemCampanha(id!, itemRecompensa, quantia, alvo?.id, requestId);
        const nomeItem = catalogoItens.find((item) => item.itemId === itemRecompensa)?.nome ?? "item";
        setOuroMensagem(destinatarioOuro === "TODOS"
          ? `Concluído! ${quantia} ${nomeItem} foram entregues para ${count} personagens do grupo.`
          : `Concluído! ${quantia} ${nomeItem} foram entregues para ${alvo?.nome}.`);
      }

      rewardRequestIdsRef.current.delete(requestSignature);
      setVersao((v) => v + 1);
    } catch (err) {
      setOuroMensagem(
        err instanceof Error ? err.message : "Erro ao entregar recompensa.",
      );
    } finally {
      setDistribuindoOuro(false);
    }
  }

  const handleCopiarCodigo = async () => {
    if (!campaign?.codigo_convite) return;

    setCopiado(false);
    setErroCopiarConvite("");
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard?.writeText) throw new Error("Clipboard API indisponível.");
      await clipboard.writeText(campaign.codigo_convite);
      setCopiado(true);
    } catch {
      setErroCopiarConvite(
        "Não foi possível copiar o convite. Selecione o código para copiá-lo manualmente.",
      );
    }
  };

  async function handleExcluirCampanha() {
    if (!id || !isMaster || excluindo) return;

    setExcluindo(true);
    setErroExclusao("");

    try {
      await excluirCampanha(id);
      navigate("/campanhas", { replace: true });
    } catch (error) {
      setErroExclusao(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a campanha.",
      );
    } finally {
      setExcluindo(false);
    }
  }

  function alternarSecao(secaoId: string) {
    setSecoesAbertas((atuais) =>
      atuais.includes(secaoId)
        ? atuais.filter((item) => item !== secaoId)
        : [...atuais, secaoId],
    );
  }

  function irParaSecao(secaoId: string) {
    setSecoesAbertas((atuais) =>
      atuais.includes(secaoId) ? atuais : [...atuais, secaoId],
    );
    window.requestAnimationFrame(() => {
      const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(secaoId)?.scrollIntoView({
        behavior: reduzir ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  if (loading) {
    return (
      <div className="campaign-detail-page">
        <p>Carregando aventura e dados da mesa...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="campaign-detail-page">
        <div className="campaign-empty-banner">
          <h1>Campanha não encontrada</h1>
          <p>Você não participa desta aventura ou ela foi arquivada.</p>
          <Link to="/campanhas" className="btn-primary">
            Voltar para Minhas Campanhas
          </Link>
        </div>
      </div>
    );
  }

  const resumoJogadores = isMaster
    ? `${todosDaCampanha.length} ${todosDaCampanha.length === 1 ? "personagem" : "personagens"} na mesa`
    : meusNaCampanha.length > 0
      ? "Seu personagem e o grupo"
      : "Escolha seu personagem";
  const mostrarEntregas = isMaster || historicoRecompensas.length > 0;
  const aberta = (secaoId: string) => secoesAbertas.includes(secaoId);

  return (
    <div className="campaign-detail-page tav-page">
      {/* Cenário imersivo e iluminação atmosférica de fundo */}
      <div className="campaign-atmosphere-backdrop" aria-hidden="true" />

      {erroBonusEquipamentos && <p className="campaign-status-message" role="alert">{erroBonusEquipamentos}</p>}

      {/* Identificação da campanha (Arquitetura Monumental) */}
      <header className="campaign-detail-header tav-header">
        <div className="campaign-header-top-runes" aria-hidden="true">
          <span className="keystone-glyph">✦</span>
          <span className="keystone-text">CRÔNICAS & RITUAIS DA MESA</span>
          <span className="keystone-glyph">✦</span>
        </div>

        <div className="campaign-detail-nav">
          <Link to="/campanhas" className="campaign-back-link">
            <span className="campaign-back-arrow" aria-hidden="true">‹</span>
            <span>Minhas Campanhas</span>
          </Link>

          <div className="campaign-header-badges">
            <span className="campaign-badge">{campaign.status}</span>
            {isMaster && (
              <span className="campaign-badge campaign-badge-master">
                👑 Mestre da Campanha
              </span>
            )}
          </div>
        </div>

        <h1 className="campaign-detail-title">{campaign.nome}</h1>

        <p className="campaign-detail-desc">
          {campaign.descricao || "Nenhuma descrição cadastrada para esta aventura."}
        </p>

        <nav className="campaign-context-nav tav-lounges" aria-label="Áreas da campanha">
          <Link className="tav-lounge" to={"/campanha/" + campaign.id + "/mapa"}>
            <span className="tav-lounge-icon" aria-hidden="true">🗺️</span>
            <div className="tav-lounge-content">
              <span className="tav-lounge-nome">Mapa</span>
              <span className="tav-lounge-desc">Terras e marcadores</span>
            </div>
            <span className="tav-lounge-glow" aria-hidden="true" />
          </Link>
          <Link className="tav-lounge" to={"/campanha/" + campaign.id + "/bestiario"}>
            <span className="tav-lounge-icon" aria-hidden="true">🐉</span>
            <div className="tav-lounge-content">
              <span className="tav-lounge-nome">Bestiário</span>
              <span className="tav-lounge-desc">Criaturas da mesa</span>
            </div>
            <span className="tav-lounge-glow" aria-hidden="true" />
          </Link>
          <Link className="tav-lounge" to={"/campanha/" + campaign.id + "/loja"}>
            <span className="tav-lounge-icon" aria-hidden="true">🪙</span>
            <div className="tav-lounge-content">
              <span className="tav-lounge-nome">Loja</span>
              <span className="tav-lounge-desc">Itens e estoque</span>
            </div>
            <span className="tav-lounge-glow" aria-hidden="true" />
          </Link>
          <Link className="tav-lounge" to={"/campanha/" + campaign.id + "/dados"}>
            <span className="tav-lounge-icon" aria-hidden="true">🎲</span>
            <div className="tav-lounge-content">
              <span className="tav-lounge-nome">Dados</span>
              <span className="tav-lounge-desc">Role e registre</span>
            </div>
            <span className="tav-lounge-glow" aria-hidden="true" />
          </Link>
        </nav>
      </header>

      {/* Navegação entre ritos e seções da página */}
      <nav className="tav-section-nav" aria-label="Seções desta página">
        <button
          type="button"
          className={aberta("secao-visao") ? "is-active" : ""}
          aria-controls="secao-visao-corpo"
          onClick={() => irParaSecao("secao-visao")}
        >
          <span className="tav-nav-glyph" aria-hidden="true">📜</span>
          <span>Visão geral</span>
        </button>
        <button
          type="button"
          className={aberta("secao-jogadores") ? "is-active" : ""}
          aria-controls="secao-jogadores-corpo"
          onClick={() => irParaSecao("secao-jogadores")}
        >
          <span className="tav-nav-glyph" aria-hidden="true">⚔️</span>
          <span>Jogadores</span>
        </button>
        <button
          type="button"
          className={aberta("secao-regras") ? "is-active" : ""}
          aria-controls="secao-regras-corpo"
          onClick={() => irParaSecao("secao-regras")}
        >
          <span className="tav-nav-glyph" aria-hidden="true">⚖️</span>
          <span>Regras</span>
        </button>
        <button
          type="button"
          className={aberta("secao-classes") ? "is-active" : ""}
          aria-controls="secao-classes-corpo"
          onClick={() => irParaSecao("secao-classes")}
        >
          <span className="tav-nav-glyph" aria-hidden="true">🛡️</span>
          <span>Classes</span>
        </button>
        {mostrarEntregas && (
          <button
            type="button"
            className={aberta("secao-entregas") ? "is-active" : ""}
            aria-controls="secao-entregas-corpo"
            onClick={() => irParaSecao("secao-entregas")}
          >
            <span className="tav-nav-glyph" aria-hidden="true">🎁</span>
            <span>Entregas</span>
          </button>
        )}
        {isMaster && (
          <button
            type="button"
            className={"tav-section-nav-perigo" + (aberta("secao-perigo") ? " is-active" : "")}
            aria-controls="secao-perigo-corpo"
            onClick={() => irParaSecao("secao-perigo")}
          >
            <span className="tav-nav-glyph" aria-hidden="true">⚠️</span>
            <span>Zona de perigo</span>
          </button>
        )}
      </nav>

      {/* Visão geral e convite */}
      <Secao
        id="secao-visao"
        titulo="Visão geral"
        resumo={`Convite ${campaign.codigo_convite}`}
        aberta={aberta("secao-visao")}
        aoAlternar={alternarSecao}
      >
        {/* Cockpit de Atalhos Rápidos do Mestre */}
        <div className="dm-cockpit-shortcuts">
          <span className="dm-cockpit-label">Ações Rápidas:</span>
          <div className="dm-cockpit-btns">
            <button
              type="button"
              className="dm-cockpit-btn"
              onClick={() => abrirRecompensaPara()}
            >
              🎁 Entregar Recompensa
            </button>
            <button
              type="button"
              className="dm-cockpit-btn"
              onClick={() => irParaSecao("secao-classes")}
            >
              🛡️ Gerenciar Classes ({totalClassesDisponiveis} ativas)
            </button>
            <Link className="dm-cockpit-btn" to={"/campanha/" + campaign.id + "/mapa"}>
              🗺️ Ver Mapa
            </Link>
            <Link className="dm-cockpit-btn" to={"/campanha/" + campaign.id + "/loja"}>
              🪙 Abrir Loja
            </Link>
          </div>
        </div>

        <div className="campaign-meta-grid">
          <div className="campaign-meta-card">
            <span>Código de Convite</span>
            <div className="campaign-code-highlight">
              <strong>{campaign.codigo_convite}</strong>
              <button
                type="button"
                className="btn-ghost campaign-copy-btn"
                onClick={handleCopiarCodigo}
              >
                {copiado ? "Copiado!" : "Copiar"}
              </button>
            </div>
            {copiado && (
              <p className="campaign-copy-feedback" role="status">
                Convite copiado!
              </p>
            )}
            {erroCopiarConvite && (
              <p className="campaign-copy-feedback campaign-copy-feedback--error" role="alert">
                {erroCopiarConvite}
              </p>
            )}
          </div>

          <div className="campaign-meta-card">
            <span>Personagens na mesa</span>
            <strong>{todosDaCampanha.length}</strong>
          </div>

          <div className="campaign-meta-card">
            <span>Classes da Campanha</span>
            <strong>{totalClassesDisponiveis} liberadas · {totalClassesBloqueadas} bloqueadas</strong>
          </div>

          <div className="campaign-meta-card">
            <span>Tesouro Acumulado</span>
            <strong>{totalOuroMesa} PO</strong>
          </div>

          <div className="campaign-meta-card">
            <span>Seu papel</span>
            <strong>{isMaster ? "Mestre" : "Jogador"}</strong>
          </div>
        </div>
      </Secao>

      {/* Jogadores e personagens */}
      <Secao
        id="secao-jogadores"
        titulo="Jogadores e personagens"
        resumo={resumoJogadores}
        aberta={aberta("secao-jogadores")}
        aoAlternar={alternarSecao}
      >
        {/* PAINEL DO MESTRE: Visível apenas se o usuário for o Mestre */}
        {isMaster && (
          <div className="tav-bloco">
            <div className="party-panel-header">
              <div className="campaign-section-title">
                <h3>👑 Painel de Controle do Mestre</h3>
                <span className="campaign-section-badge">
                  {todosDaCampanha.length} {todosDaCampanha.length === 1 ? "Personagem" : "Personagens"} na Mesa
                </span>
              </div>

              {/* Barra de Busca e Atalho de Recompensa */}
              <div className="party-toolbar">
                <input
                  type="search"
                  placeholder="Buscar personagem por nome, raça ou classe..."
                  value={buscaPersonagem}
                  onChange={(e) => setBuscaPersonagem(e.target.value)}
                  className="party-search-input"
                  aria-label="Buscar personagens na mesa"
                />
                <button
                  type="button"
                  className="btn-primary party-reward-all-btn"
                  onClick={() => abrirRecompensaPara()}
                >
                  🎁 Recompensar Grupo
                </button>
              </div>
            </div>

            <p className="tav-texto-apoio">
              Como Mestre, você pode visualizar e alterar livremente a vida, mana, dinheiro e atributos de todos os personagens da aventura.
            </p>

            {personagensFiltrados.length > 0 ? (
              <div className="party-overview-grid">
                {personagensFiltrados.map((personagem) => {
                  const po = personagem.carteira?.po ?? 0;
                  const maximosAutoritativos = maximosServidor[personagem.id];
                  const hpMax = personagem.hp?.max ?? maximosAutoritativos?.hp ?? 200;
                  const mpMax = personagem.mp?.max ?? maximosAutoritativos?.mp ?? 200;
                  const hpAtual = Math.min(personagem.hp?.atual ?? 200, hpMax);
                  const mpAtual = Math.min(personagem.mp?.atual ?? 200, mpMax);
                  return (
                    <article key={personagem.id} className="party-char-card">
                      <div className="party-char-head">
                        <div className="party-char-portrait">
                          {personagem.portraitUrl ? (
                            <img src={personagem.portraitUrl} alt={personagem.nome} />
                          ) : (
                            personagem.nome.charAt(0)
                          )}
                        </div>

                        <div className="party-char-info">
                          <h3>{personagem.nome}</h3>
                          <p className="party-char-meta">
                            {personagem.raca} · {personagem.classe} · Nvl {personagem.nivel}
                          </p>
                        </div>
                      </div>

                      <div className="party-char-stats-row">
                        <div className="party-stat-mini">
                          <span>Vida</span>
                          <strong>{hpAtual} / {hpMax}</strong>
                        </div>
                        <div className="party-stat-mini">
                          <span>Mana</span>
                          <strong>{mpAtual} / {mpMax}</strong>
                        </div>
                        <div className="party-stat-mini">
                          <span>Ouro</span>
                          <strong className="party-stat-gold">{po} PO</strong>
                        </div>
                      </div>

                      <div className="party-char-vitals">
                        <StatBar
                          label="Vida"
                          atual={hpAtual}
                          max={hpMax}
                          tone="wine"
                        />
                        <StatBar
                          label="Mana"
                          atual={mpAtual}
                          max={mpMax}
                          tone="forest"
                        />
                      </div>

                      <div className="party-char-actions">
                        <Link
                          className="btn-primary"
                          to={"/personagem/" + personagem.id}
                        >
                          Abrir / Alterar Ficha
                        </Link>
                        <button
                          type="button"
                          className="btn-ghost party-char-quick-reward"
                          onClick={() => abrirRecompensaPara(personagem.id)}
                        >
                          🎁 Recompensar
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : todosDaCampanha.length > 0 ? (
              <div className="campaign-empty-banner">
                <p>Nenhum personagem corresponde ao filtro “{buscaPersonagem}”.</p>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setBuscaPersonagem("")}
                >
                  Limpar busca
                </button>
              </div>
            ) : (
              <div className="campaign-empty-banner">
                <p>Nenhum personagem de jogador entrou na campanha ainda.</p>
                <p>
                  Compartilhe o código <strong>{campaign.codigo_convite}</strong> com seus jogadores para que eles possam vincular seus personagens.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ÁREA DO JOGADOR: Meu Personagem na Campanha */}
        <div className="tav-bloco">
          <h3 className="tav-subtitulo">Meu personagem nesta aventura</h3>

          {meusNaCampanha.length > 0 ? (
            <div className="dashboard-grid">
              {meusNaCampanha.map((personagem) => (
                <CharacterCard
                  key={personagem.id}
                  character={personagem}
                  rulesContext={{
                    classCatalog: catalogoClasses,
                    campaignClassBonuses: bonusClasses,
                    campaignClassContents: conteudosClasses,
                    equippedItemBonuses: bonusEquipamentos[personagem.id]
                      ? [bonusEquipamentos[personagem.id]]
                      : [],
                    serverResourceMaximums: maximosServidor[personagem.id]
                      ? { hpMax: maximosServidor[personagem.id].hp, mpMax: maximosServidor[personagem.id].mp }
                      : undefined,
                  }}
                />
              ))}
            </div>
          ) : isMaster ? (
            <div>
              <p className="tav-texto-apoio">
                Você está atuando como <strong>Mestre</strong> nesta campanha. Mestres não precisam de um personagem de jogador para narrar.
              </p>
              {semCampanha.length > 0 && (
                <details className="tav-detalhes">
                  <summary>
                    Deseja vincular um personagem ou NPC próprio a esta campanha?
                  </summary>
                  <form onSubmit={handleVincular} className="tav-form-vinculo">
                    <label className="field">
                      <span>Escolher personagem</span>
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
                </details>
              )}
            </div>
          ) : semCampanha.length > 0 ? (
            <form onSubmit={handleVincular} className="tav-form-vinculo">
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

          {mensagem && <p className="tav-mensagem">{mensagem}</p>}
        </div>

        {/* Companheiros de Aventura (visão para jogadores quando não são mestre) */}
        {!isMaster && outrosPersonagens.length > 0 && (
          <div className="tav-bloco">
            <div className="campaign-section-title">
              <h3>Companheiros de Grupo</h3>
              <span className="campaign-section-badge">
                {outrosPersonagens.length} Aventureiros
              </span>
            </div>

            <div className="dashboard-grid">
              {outrosPersonagens.map((personagem) => (
                <CharacterCard
                  key={personagem.id}
                  character={personagem}
                  rulesContext={{
                    classCatalog: catalogoClasses,
                    campaignClassBonuses: bonusClasses,
                    campaignClassContents: conteudosClasses,
                    equippedItemBonuses: bonusEquipamentos[personagem.id]
                      ? [bonusEquipamentos[personagem.id]]
                      : [],
                    serverResourceMaximums: maximosServidor[personagem.id]
                      ? { hpMax: maximosServidor[personagem.id].hp, mpMax: maximosServidor[personagem.id].mp }
                      : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </Secao>

      {/* Sistema de regras e bônus de classe */}
      <Secao
        id="secao-regras"
        titulo="Sistema de regras"
        resumo={campaign.sistema || "D&D 5e / Custom"}
        aberta={aberta("secao-regras")}
        aoAlternar={alternarSecao}
      >
        <div className="campaign-meta-grid">
          <div className="campaign-meta-card">
            <span>Sistema de Regras</span>
            <strong>{campaign.sistema || "D&D 5e / Custom"}</strong>
          </div>

          <div className="campaign-meta-card">
            <span>Moeda Principal</span>
            <strong>{campaign.moeda_principal || "Ouro (PO)"}</strong>
          </div>

          <div className="campaign-meta-card">
            <span>Ouro Inicial por Jogador</span>
            <strong>{campaign.ouro_inicial ?? 1250} PO</strong>
          </div>
        </div>

        {isMaster && (
          <form
            className="campaign-class-bonuses"
            onSubmit={handleSalvarBonusClasses}
          >
            <div className="campaign-class-bonuses-heading">
              <div>
                <h3>Bônus de classe desta campanha</h3>
                <p>
                  Defina bônus dos atributos disponíveis, vida e mana. Estes
                  valores substituem os padrões e são usados na criação
                  de personagens vinculados a esta campanha.
                </p>
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={salvandoBonusClasses}
              >
                {salvandoBonusClasses ? "Salvando..." : "Salvar bônus"}
              </button>
            </div>

            <div className="campaign-class-bonus-grid">
              {classesDisponiveis.map((classe) => {
                const bonusAtual = bonusClasses[classe.nome] ?? classe;
                return (
                <fieldset className="campaign-class-bonus-card" key={classe.id}>
                  <legend>{classe.nome}</legend>
                  <div className="campaign-class-bonus-fields">
                    {ATTRIBUTE_CONFIG.map((atributo) => (
                      <label key={atributo.key}>
                        <span>{atributo.label}</span>
                        <input
                          type="number"
                          step="1"
                          aria-label={`${classe.nome} - ${atributo.label}`}
                          value={bonusAtual.atributoBonus[atributo.key]}
                          disabled={salvandoBonusClasses}
                          onChange={(event) =>
                            atualizarBonusAtributo(
                              classe.nome,
                              atributo.key,
                              Number(event.target.value) || 0,
                            )
                          }
                        />
                      </label>
                    ))}
                    <label>
                      <span>Vida (PV)</span>
                      <input
                        type="number"
                        step="1"
                        aria-label={`${classe.nome} - Bônus de vida`}
                        value={bonusAtual.hpBonus}
                        disabled={salvandoBonusClasses}
                        onChange={(event) =>
                          atualizarBonusRecurso(
                            classe.nome,
                            "hpBonus",
                            Number(event.target.value) || 0,
                          )
                        }
                      />
                    </label>
                    <label>
                      <span>Mana (PM)</span>
                      <input
                        type="number"
                        step="1"
                        aria-label={`${classe.nome} - Bônus de mana`}
                        value={bonusAtual.mpBonus}
                        disabled={salvandoBonusClasses}
                        onChange={(event) =>
                          atualizarBonusRecurso(
                            classe.nome,
                            "mpBonus",
                            Number(event.target.value) || 0,
                          )
                        }
                      />
                    </label>
                  </div>
                </fieldset>
                );
              })}
            </div>
            {bonusClassesMensagem && (
              <p className="campaign-class-bonuses-message" role="status">
                {bonusClassesMensagem}
              </p>
            )}
          </form>
        )}
      </Secao>

      {/* Classes e habilidades */}
      <Secao
        id="secao-classes"
        titulo="Classes e habilidades"
        resumo={`${classesDisponiveis.length} classes · ${conteudosClasses.length} conteúdos exclusivos`}
        aberta={aberta("secao-classes")}
        aoAlternar={alternarSecao}
      >
        <div className="campaign-classes-header-intro">
          <span className="classes-exclusive-tag">Configurações exclusivas desta campanha</span>
          <p className="campaign-content-intro">
            O catálogo global está disponível para consulta e uso. Como Mestre, você pode liberar ou bloquear classes para novos personagens nesta campanha, bem como cadastrar perícias, habilidades e classes exclusivas sem afetar o catálogo global.
          </p>
        </div>

        {/* 1. Catálogo de Classes e Gestão de Disponibilidade */}
        <div className="campaign-classes-mgmt-block">
          <div className="campaign-section-title">
            <h3>Catálogo e Disponibilidade de Classes</h3>
            <span className="campaign-section-badge">
              {classesFiltradas.length} de {classesComOrigem.length}
            </span>
          </div>

          <p className="tav-texto-apoio">
            <strong>Regra fundamental:</strong> Bloquear uma classe impede que ela seja escolhida em novos personagens, mas nunca altera nem apaga personagens existentes na mesa.
          </p>

          <div className="campaign-class-filter-bar">
            <input
              type="search"
              placeholder="Filtrar classes pelo nome..."
              value={filtroClasses}
              onChange={(e) => setFiltroClasses(e.target.value)}
              className="campaign-class-search-input"
              aria-label="Filtrar classes pelo nome"
            />
            <div className="campaign-class-filter-pills">
              <button
                type="button"
                className={filtroClasseCat === "TODAS" ? "is-active" : ""}
                onClick={() => setFiltroClasseCat("TODAS")}
              >
                Todas ({classesComOrigem.length})
              </button>
              <button
                type="button"
                className={filtroClasseCat === "DISPONIVEIS" ? "is-active" : ""}
                onClick={() => setFiltroClasseCat("DISPONIVEIS")}
              >
                Disponíveis ({totalClassesDisponiveis})
              </button>
              <button
                type="button"
                className={filtroClasseCat === "BLOQUEADAS" ? "is-active" : ""}
                onClick={() => setFiltroClasseCat("BLOQUEADAS")}
              >
                Bloqueadas ({totalClassesBloqueadas})
              </button>
            </div>
          </div>

          <div className="campaign-classes-table-wrap">
            <table className="campaign-classes-table">
              <thead>
                <tr>
                  <th>Classe</th>
                  <th>Origem</th>
                  <th>Bônus de Atributos</th>
                  <th>Recursos</th>
                  <th>Disponibilidade</th>
                  {isMaster && <th>Ação do Mestre</th>}
                </tr>
              </thead>
              <tbody>
                {classesFiltradas.map((classe) => {
                  const bonusAtual = bonusClasses[classe.nome] ?? classe;
                  const bloqueada = Boolean(bonusAtual.bloqueada);
                  return (
                    <tr key={classe.id || classe.nome} className={bloqueada ? "row-blocked" : ""}>
                      <td>
                        <strong className="class-name-cell">{classe.nome}</strong>
                      </td>
                      <td>
                        <span
                          className={`class-origin-pill ${
                            classe.origem === "GLOBAL" ? "origin-global" : "origin-campaign"
                          }`}
                        >
                          {classe.origemLabel}
                        </span>
                      </td>
                      <td className="class-bonus-cell">
                        {ATTRIBUTE_CONFIG.map(({ key, abbr }) => {
                          const val = bonusAtual.atributoBonus?.[key] ?? 0;
                          return val !== 0 ? `${abbr} ${val > 0 ? `+${val}` : val}` : null;
                        })
                          .filter(Boolean)
                          .join(" · ") || "Padrão"}
                      </td>
                      <td className="class-resources-cell">
                        PV {bonusAtual.hpBonus > 0 ? `+${bonusAtual.hpBonus}` : bonusAtual.hpBonus || 0} · PM{" "}
                        {bonusAtual.mpBonus > 0 ? `+${bonusAtual.mpBonus}` : bonusAtual.mpBonus || 0}
                      </td>
                      <td>
                        <span
                          className={`class-status-badge ${
                            bloqueada ? "status-blocked" : "status-available"
                          }`}
                        >
                          {bloqueada ? "🚫 Bloqueada na Criação" : "✓ Disponível"}
                        </span>
                      </td>
                      {isMaster && (
                        <td>
                          <button
                            type="button"
                            className={`btn-action-availability ${
                              bloqueada ? "btn-unlock" : "btn-lock"
                            }`}
                            disabled={salvandoBonusClasses && bloqueandoClasse === classe.nome}
                            onClick={() => void handleToggleBloqueioClasse(classe.nome)}
                          >
                            {bloqueandoClasse === classe.nome
                              ? "Salvando..."
                              : bloqueada
                                ? "Liberar na Criação"
                                : "Bloquear na Criação"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Criação de Classe Exclusiva ou Personalização de Perícias/Habilidades */}
        <div className="campaign-classes-content-creator">
          <div className="campaign-section-title">
            <h3>Adicionar Conteúdo à Campanha</h3>
            <span className="campaign-section-badge">Exclusivo Desta Mesa</span>
          </div>

          <p className="tav-texto-apoio">
            Cadastre classes exclusivas desta aventura (sem alterar o catálogo global) ou personalize novas perícias e habilidades de classe.
          </p>

          {isMaster && (
            <form
              className="campaign-content-form"
              onSubmit={handleAdicionarConteudoClasse}
            >
          <label>
            <span>O que deseja adicionar?</span>
            <select
              value={tipoNovoConteudo}
              onChange={(event) => setTipoNovoConteudo(
                event.target.value as "CLASSE" | "PERICIA" | "HABILIDADE",
              )}
              disabled={salvandoConteudo}
            >
              <option value="CLASSE">Nova classe</option>
              <option value="PERICIA">Perícia de classe</option>
              <option value="HABILIDADE">Habilidade de classe</option>
            </select>
          </label>
          {tipoNovoConteudo !== "CLASSE" && (
            <label>
              <span>Classe</span>
              <select
                value={classeNovoConteudoSelecionada}
                onChange={(event) => setClasseNovoConteudo(event.target.value)}
                required
              >
                {classesDisponiveis.map((classe) => (
                  <option value={classe.id} key={classe.id}>{classe.nome}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>{tipoNovoConteudo === "CLASSE" ? "Nome da classe" : "Nome"}</span>
            <input
              value={nomeNovoConteudo}
              onChange={(event) => setNomeNovoConteudo(event.target.value)}
              maxLength={100}
              required
            />
          </label>
          {tipoNovoConteudo === "PERICIA" && (
            <label>
              <span>Atributo relacionado</span>
              <select
                value={atributoNovaPericia}
                onChange={(event) =>
                  setAtributoNovaPericia(event.target.value as BaseAttributeKey)
                }
              >
                {ATTRIBUTE_CONFIG.map(({ key, label }) => (
                  <option value={key} key={key}>{label}</option>
                ))}
              </select>
            </label>
          )}
          {tipoNovoConteudo === "HABILIDADE" && (
            <label>
              <span>Nível de desbloqueio</span>
              <input
                type="number"
                min={1}
                max={20}
                value={nivelNovaHabilidade}
                onChange={(event) =>
                  setNivelNovaHabilidade(
                    Math.max(1, Math.min(20, Number(event.target.value) || 1)),
                  )
                }
              />
            </label>
          )}
          {tipoNovoConteudo === "CLASSE" && (
            <>
              <div className="campaign-new-class-attributes">
                {ATTRIBUTE_CONFIG.map(({ key, label }) => (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      type="number"
                      aria-label={`Bônus de ${label}`}
                      value={bonusNovaClasse[key]}
                      onChange={(event) =>
                        setBonusNovaClasse((atual) => ({
                          ...atual,
                          [key]: Number(event.target.value) || 0,
                        }))
                      }
                    />
                  </label>
                ))}
                <label>
                  <span>PV</span>
                  <input
                    type="number"
                    aria-label="Bônus de PV"
                    value={vidaNovaClasse}
                    onChange={(event) => setVidaNovaClasse(Number(event.target.value) || 0)}
                  />
                </label>
                <label>
                  <span>PM</span>
                  <input
                    type="number"
                    aria-label="Bônus de PM"
                    value={manaNovaClasse}
                    onChange={(event) => setManaNovaClasse(Number(event.target.value) || 0)}
                  />
                </label>
              </div>
              <label className="campaign-content-description">
                <span>Descrição (opcional)</span>
                <textarea
                  rows={2}
                  value={descricaoNovoConteudo}
                  onChange={(event) => setDescricaoNovoConteudo(event.target.value)}
                />
              </label>
            </>
          )}
          {tipoNovoConteudo !== "CLASSE" && (
            <label className="campaign-content-description">
              <span>Descrição</span>
              <textarea
                rows={2}
                value={descricaoNovoConteudo}
                onChange={(event) => setDescricaoNovoConteudo(event.target.value)}
              />
            </label>
          )}
          <button className="btn-primary" type="submit" disabled={salvandoConteudo}>
            {salvandoConteudo ? "Adicionando..." : "Adicionar à campanha"}
          </button>
        </form>
        )}
        {mensagemConteudo && (
          <p className="campaign-content-message" role="status">{mensagemConteudo}</p>
        )}
        <div className="campaign-content-list">
          {conteudosClasses.map((conteudo) => (
            <article className="campaign-content-card" key={conteudo.id}>
              <div>
                <span className="campaign-content-kind">
                  {conteudo.tipo === "CLASSE"
                    ? "Classe da campanha"
                    : conteudo.tipo === "PERICIA"
                      ? "Perícia"
                      : "Habilidade"}
                  {conteudo.tipo !== "CLASSE" &&
                    ` · ${classesDisponiveis.find((classe) => classe.id === conteudo.classe_id)?.nome ?? "Classe"}`}
                </span>
                <h3>{conteudo.nome}</h3>
                {conteudo.tipo === "CLASSE" && (
                  <p>
                    Bônus: {ATTRIBUTE_CONFIG.map(({ key, abbr }) =>
                      `${abbr} ${conteudo.bonus_atributos[key] ?? 0}`,
                    ).join(" · ")} · PV {conteudo.bonus_hp} · PM {conteudo.bonus_mp}
                  </p>
                )}
                {conteudo.tipo === "PERICIA" && (
                  <p>Atributo: {ATTRIBUTE_CONFIG.find(({ key }) => key === conteudo.atributo)?.label}</p>
                )}
                {conteudo.tipo === "HABILIDADE" && <p>Desbloqueia no nível {conteudo.nivel}</p>}
                {conteudo.descricao && <p>{conteudo.descricao}</p>}
              </div>
              {isMaster && (
                <button
                  type="button"
                  className="campaign-content-remove"
                  onClick={() => void handleRemoverConteudoClasse(conteudo)}
                >
                  Remover
                </button>
              )}
            </article>
          ))}
          {conteudosClasses.length === 0 && (
            <p className="campaign-content-empty">
              Ainda não há conteúdo personalizado nesta campanha.
            </p>
          )}
        </div>
      </div>
      </Secao>

      {/* Inventário e entregas: recompensas do Mestre e histórico */}
      {mostrarEntregas && (
        <Secao
          id="secao-entregas"
          titulo="Inventário e entregas"
          resumo={`${historicoRecompensas.length} ${historicoRecompensas.length === 1 ? "entrega registrada" : "entregas registradas"}`}
          aberta={aberta("secao-entregas")}
          aoAlternar={alternarSecao}
        >
          {/* Ferramenta de Recompensa do Mestre: Distribuir Ouro */}
          {isMaster && todosDaCampanha.length > 0 && (
            <div className="master-reward-box">
              <div className="master-reward-info">
                <h4>Entregar recompensa</h4>
                <p>Distribua ouro ou XP para todo o grupo ou para um personagem específico.</p>
              </div>

              <form onSubmit={handleDistribuirOuro} className="master-reward-form">
                <div className="master-reward-field">
                  <label htmlFor="master-reward-type">Tipo de recompensa</label>
                  <select
                    id="master-reward-type"
                    className="master-reward-select"
                    value={tipoRecompensa}
                    onChange={(event) => setTipoRecompensa(event.target.value as "OURO" | "XP" | "ITEM")}
                    disabled={distribuindoOuro}
                  >
                    <option value="OURO">Ouro</option>
                    <option value="XP">Experiência (XP)</option>
                    <option value="ITEM">Item</option>
                  </select>
                </div>
                {tipoRecompensa === "ITEM" && (
                  <div className="master-reward-field">
                    <label htmlFor="master-reward-item">Item</label>
                    <select
                      id="master-reward-item"
                      className="master-reward-select"
                      value={itemRecompensa}
                      onChange={(event) => setItemRecompensa(event.target.value)}
                      disabled={distribuindoOuro}
                      required
                    >
                      <option value="">Selecione um item do catálogo</option>
                      {catalogoItens.map((item) => (
                        <option key={item.itemId} value={item.itemId}>{item.nome}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="master-reward-field">
                  <label htmlFor="master-gold-input">Quantidade</label>
                  <div className="master-reward-amount-wrap">
                    <input
                      id="master-gold-input"
                      type="number"
                      className="master-reward-input"
                      min="1"
                      max={tipoRecompensa === "OURO" ? 100000 : tipoRecompensa === "ITEM" ? 9999 : 2147483647}
                      value={quantidadeRecompensa}
                      onChange={(event) => setQuantidadeRecompensa(event.target.value)}
                      disabled={distribuindoOuro}
                    />
                    <span className="master-reward-unit">{tipoRecompensa === "OURO" ? "PO" : tipoRecompensa === "XP" ? "XP" : "un."}</span>
                  </div>
                </div>

                <div className="master-reward-field">
                  <label htmlFor="master-target-select">Destinatário</label>
                  <select
                    id="master-target-select"
                    className="master-reward-select"
                    value={destinatarioOuro}
                    onChange={(e) => setDestinatarioOuro(e.target.value)}
                    disabled={distribuindoOuro}
                  >
                    <option value="TODOS">✦ Todos os Jogadores ({todosDaCampanha.length})</option>
                    <optgroup label="Jogador Específico">
                      {todosDaCampanha.map((char) => (
                        <option key={char.id} value={char.id}>
                          {char.nome} ({char.classe} · Nvl {char.nivel} · {char.xp ?? 0} XP)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn-primary master-reward-submit"
                  disabled={distribuindoOuro || !quantidadeRecompensa || Number(quantidadeRecompensa) <= 0 || (tipoRecompensa === "OURO" && Number(quantidadeRecompensa) > 100000) || (tipoRecompensa === "ITEM" && (!itemRecompensa || Number(quantidadeRecompensa) > 9999)) || Number(quantidadeRecompensa) > 2147483647}
                >
                  {distribuindoOuro ? "Entregando..." : "Entregar Recompensa"}
                </button>
              </form>
            </div>
          )}

          {isMaster && ouroMensagem && <p className="tav-mensagem">{ouroMensagem}</p>}

          {historicoRecompensas.length > 0 && (
            <section className="tav-bloco" aria-labelledby="reward-history-title">
              <h3 id="reward-history-title" className="tav-subtitulo">Histórico de recompensas</h3>
              <ul className="campaign-content-list">
                {historicoRecompensas.map((reward) => {
                  const item = reward.item_id ? catalogoItens.find((entry) => entry.itemId === reward.item_id) : undefined;
                  const recipient = reward.personagem_id
                    ? todosDaCampanha.find((character) => character.id === reward.personagem_id)?.nome ?? "Personagem removido"
                    : `${reward.total_destinatarios} personagens`;
                  const description = reward.tipo === "OURO"
                    ? `${reward.quantidade} PO`
                    : reward.tipo === "XP"
                      ? `${reward.quantidade} XP`
                      : `${reward.quantidade_item ?? reward.quantidade} × ${item?.nome ?? "item removido"}`;
                  return (
                    <li key={reward.id} className="campaign-content-card">
                      <strong>{description}</strong>
                      <span> para {recipient}</span>
                      <time dateTime={reward.created_at}>{new Date(reward.created_at).toLocaleString()}</time>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </Secao>
      )}

      {isMaster && (
        <Secao
          id="secao-perigo"
          titulo="Zona de perigo"
          resumo="Exclusão da campanha"
          variante="perigo"
          aberta={aberta("secao-perigo")}
          aoAlternar={alternarSecao}
        >
          <div className="campaign-danger-zone">
            <div>
              <p>A exclusão remove a campanha e não pode ser desfeita.</p>
            </div>

            {!confirmandoExclusao ? (
              <button
                type="button"
                className="campaign-delete-trigger"
                onClick={() => {
                  setErroExclusao("");
                  setConfirmandoExclusao(true);
                }}
              >
                Excluir campanha
              </button>
            ) : (
              <div
                className="campaign-delete-confirmation"
                role="alertdialog"
                aria-labelledby="campaign-delete-confirm-title"
                aria-describedby="campaign-delete-confirm-description"
              >
                <div>
                  <h3 id="campaign-delete-confirm-title">Excluir “{campaign.nome}”?</h3>
                  <p id="campaign-delete-confirm-description">
                    Esta ação é permanente. Confirme somente se deseja apagar esta campanha.
                  </p>
                </div>
                {erroExclusao && <p className="campaign-delete-error" role="alert">{erroExclusao}</p>}
                <div className="campaign-delete-confirm-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setConfirmandoExclusao(false)}
                    disabled={excluindo}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="campaign-delete-confirm-button"
                    onClick={() => void handleExcluirCampanha()}
                    disabled={excluindo}
                  >
                    {excluindo ? "Excluindo..." : "Confirmar exclusão"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Secao>
      )}

      {/* Rodapé Arquitetônico de Relíquias (idêntico ao estilo monumental do portal) */}
      <footer className="campaign-pedestal-relics" aria-hidden="true">
        <div className="pedestal-glyph-row">
          <span className="pedestal-glyph">🛡️</span>
          <span className="pedestal-glyph">💰</span>
          <span className="pedestal-glyph-crest">⚜️</span>
          <span className="pedestal-glyph">⚔️</span>
          <span className="pedestal-glyph">✨</span>
        </div>
        <p className="campaign-pedestal-tag">RPG Platform · Mesa de Aventuras do Reino</p>
      </footer>
    </div>
  );
}