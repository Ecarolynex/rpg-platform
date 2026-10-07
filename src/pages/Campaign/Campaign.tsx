import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  atualizarPersonagem,
  excluirCampanha,
  getCatalogoGlobalClasses,
  getCampaignAccess,
  getCharacters,
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

  // Ferramenta do Mestre: Distribuição de Ouro
  const [ouroDistribuir, setOuroDistribuir] = useState("50");
  const [destinatarioOuro, setDestinatarioOuro] = useState("TODOS");
  const [distribuindoOuro, setDistribuindoOuro] = useState(false);
  const [ouroMensagem, setOuroMensagem] = useState("");

  // Feedback de cópia do código
  const [copiado, setCopiado] = useState(false);

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
    const quantia = parseInt(ouroDistribuir, 10);
    if (isNaN(quantia) || quantia <= 0 || todosDaCampanha.length === 0) return;

    setDistribuindoOuro(true);
    setOuroMensagem("");

    try {
      if (destinatarioOuro === "TODOS") {
        for (const char of todosDaCampanha) {
          const carteiraAtual = char.carteira ?? { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 };
          const novoOuro = Math.min(9999999, (carteiraAtual.po || 0) + quantia);
          await atualizarPersonagem(char.id, {
            ...char,
            carteira: {
              ...carteiraAtual,
              po: novoOuro,
            },
          });
        }
        setOuroMensagem(
          `Concluído! ${quantia} PO foram distribuídos para todos os ${todosDaCampanha.length} personagens do grupo.`,
        );
      } else {
        const alvo = todosDaCampanha.find((c) => c.id === destinatarioOuro);
        if (!alvo) {
          throw new Error("Personagem selecionado não foi encontrado.");
        }
        const carteiraAtual = alvo.carteira ?? { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 };
        const novoOuro = Math.min(9999999, (carteiraAtual.po || 0) + quantia);
        await atualizarPersonagem(alvo.id, {
          ...alvo,
          carteira: {
            ...carteiraAtual,
            po: novoOuro,
          },
        });
        setOuroMensagem(
          `Concluído! ${quantia} PO foram entregues para ${alvo.nome}.`,
        );
      }

      setVersao((v) => v + 1);
    } catch (err) {
      setOuroMensagem(
        err instanceof Error ? err.message : "Erro ao entregar ouro.",
      );
    } finally {
      setDistribuindoOuro(false);
    }
  }

  const handleCopiarCodigo = () => {
    if (!campaign?.codigo_convite) return;
    navigator.clipboard.writeText(campaign.codigo_convite);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
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

  return (
    <div className="campaign-detail-page">
      {/* Cabeçalho da Campanha */}
      <header className="campaign-detail-header">
        <div className="campaign-detail-nav">
          <Link to="/campanhas" className="campaign-back-link">
            ← Minhas Campanhas
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

        <nav className="campaign-context-nav" aria-label="Áreas da campanha">
          <span className="campaign-context-current" aria-current="page">Visão geral</span>
          <Link className="btn-ghost" to={"/campanha/" + campaign.id + "/mapa"}>
            Mapa
          </Link>
          <Link className="btn-ghost" to={"/campanha/" + campaign.id + "/loja"}>
            Loja
          </Link>
          <Link className="btn-ghost" to={"/campanha/" + campaign.id + "/dados"}>
            Dados
          </Link>
        </nav>
      </header>

      {/* Grid de Metadados da Campanha */}
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
        </div>
      </div>

      <section className="campaign-section campaign-content-section">
        <div className="campaign-section-header">
          <div className="campaign-section-title">
            <h2>Classes e conteúdos desta campanha</h2>
          </div>
        </div>
        <p className="campaign-content-intro">
          O catálogo global está disponível para todos. Aqui, qualquer participante
          pode adicionar classes, perícias e habilidades exclusivas desta aventura.
        </p>
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
              <button
                type="button"
                className="campaign-content-remove"
                onClick={() => void handleRemoverConteudoClasse(conteudo)}
              >
                Remover
              </button>
            </article>
          ))}
          {conteudosClasses.length === 0 && (
            <p className="campaign-content-empty">
              Ainda não há conteúdo personalizado nesta campanha.
            </p>
          )}
        </div>
      </section>

      {/* PAINEL DO MESTRE: Visível apenas se o usuário for o Mestre */}
      {isMaster && (
        <section className="campaign-section">
          <div className="campaign-section-header">
            <div className="campaign-section-title">
              <h2>👑 Painel de Controle do Mestre</h2>
              <span className="campaign-section-badge">
                {todosDaCampanha.length} {todosDaCampanha.length === 1 ? "Personagem" : "Personagens"} na Mesa
              </span>
            </div>
          </div>

          <p style={{ color: "var(--muted)", margin: "0 0 16px" }}>
            Como Mestre, você pode visualizar e alterar livremente a vida, mana, dinheiro e atributos de todos os personagens da aventura.
          </p>

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

          {todosDaCampanha.length > 0 ? (
            <div className="party-overview-grid">
              {todosDaCampanha.map((personagem) => {
                const po = personagem.carteira?.po ?? 0;
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
                        <strong>{personagem.hp.atual} / {personagem.hp.max}</strong>
                      </div>
                      <div className="party-stat-mini">
                        <span>Mana</span>
                        <strong>{personagem.mp.atual} / {personagem.mp.max}</strong>
                      </div>
                      <div className="party-stat-mini">
                        <span>Ouro</span>
                        <strong style={{ color: "var(--gold-bright)" }}>{po} PO</strong>
                      </div>
                    </div>

                    <div className="party-char-vitals">
                      <StatBar
                        label="Vida"
                        atual={personagem.hp.atual}
                        max={personagem.hp.max}
                        tone="wine"
                      />
                      <StatBar
                        label="Mana"
                        atual={personagem.mp.atual}
                        max={personagem.mp.max}
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
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="campaign-empty-banner">
              <p>Nenhum personagem de jogador entrou na campanha ainda.</p>
              <p>
                Compartilhe o código <strong>{campaign.codigo_convite}</strong> com seus jogadores para que eles possam vincular seus personagens.
              </p>
            </div>
          )}

          {/* Ferramenta de Recompensa do Mestre: Distribuir Ouro */}
          {todosDaCampanha.length > 0 && (
            <div className="master-reward-box">
              <div className="master-reward-info">
                <h4>Entregar Recompensa em Ouro</h4>
                <p>Distribua moedas de ouro para todo o grupo ou para um jogador específico da mesa.</p>
              </div>

              <form onSubmit={handleDistribuirOuro} className="master-reward-form">
                <div className="master-reward-field">
                  <label htmlFor="master-gold-input">Quantia</label>
                  <div className="master-reward-amount-wrap">
                    <input
                      id="master-gold-input"
                      type="number"
                      className="master-reward-input"
                      min="1"
                      max="100000"
                      value={ouroDistribuir}
                      onChange={(e) => setOuroDistribuir(e.target.value)}
                      disabled={distribuindoOuro}
                    />
                    <span className="master-reward-unit">PO</span>
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
                          {char.nome} ({char.classe} · Nvl {char.nivel})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn-primary master-reward-submit"
                  disabled={distribuindoOuro || !ouroDistribuir}
                >
                  {distribuindoOuro ? "Entregando..." : "Entregar Recompensa"}
                </button>
              </form>
            </div>
          )}

          {ouroMensagem && (
            <p style={{ marginTop: 12, color: "var(--gold-bright)", fontWeight: 600 }}>
              {ouroMensagem}
            </p>
          )}
        </section>
      )}

      {/* ÁREA DO JOGADOR: Meu Personagem na Campanha */}
      <section className="campaign-section">
        <div className="campaign-section-header">
          <div className="campaign-section-title">
            <h2>Meu personagem nesta aventura</h2>
          </div>
        </div>

        {meusNaCampanha.length > 0 ? (
          <div className="dashboard-grid">
            {meusNaCampanha.map((personagem) => (
              <CharacterCard key={personagem.id} character={personagem} />
            ))}
          </div>
        ) : isMaster ? (
          <div>
            <p style={{ color: "var(--muted)" }}>
              Você está atuando como <strong>Mestre</strong> nesta campanha. Mestres não precisam de um personagem de jogador para narrar.
            </p>
            {semCampanha.length > 0 && (
              <details style={{ marginTop: 12, cursor: "pointer" }}>
                <summary style={{ color: "var(--gold-bright)", fontSize: "0.9rem" }}>
                  Deseja vincular um personagem ou NPC próprio a esta campanha?
                </summary>
                <form onSubmit={handleVincular} style={{ marginTop: 12 }}>
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
                    style={{ marginTop: 8 }}
                    disabled={vinculando || !escolhido}
                  >
                    {vinculando ? "Vinculando..." : "Vincular à campanha"}
                  </button>
                </form>
              </details>
            )}
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

        {mensagem && (
          <p style={{ marginTop: 12, color: "var(--gold-bright)" }}>
            {mensagem}
          </p>
        )}
      </section>

      {/* Companheiros de Aventura (visão para jogadores quando não são mestre) */}
      {!isMaster && outrosPersonagens.length > 0 && (
        <section className="campaign-section">
          <div className="campaign-section-header">
            <div className="campaign-section-title">
              <h2>Companheiros de Grupo</h2>
              <span className="campaign-section-badge">
                {outrosPersonagens.length} Aventureiros
              </span>
            </div>
          </div>

          <div className="dashboard-grid">
            {outrosPersonagens.map((personagem) => (
              <CharacterCard key={personagem.id} character={personagem} />
            ))}
          </div>
        </section>
      )}
      {isMaster && (
        <section className="campaign-danger-zone" aria-labelledby="campaign-danger-title">
          <div>
            <h2 id="campaign-danger-title">Zona de perigo</h2>
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
        </section>
      )}
    </div>
  );
}
