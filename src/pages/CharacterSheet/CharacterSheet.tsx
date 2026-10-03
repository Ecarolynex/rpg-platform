import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Attributes, Character, InventoryItem, Spell, Wallet } from "../../types/character";
import {
  atualizarPersonagem,
  enviarRetrato,
  getCatalogoGlobalClasses,
  getCharacterAccess,
  getCharacterById,
  listarConteudosClasseCampanha,
} from "../../services/api";
import { StatBar } from "../../components/ui/StatBar";
import {
  ClassInfoBox,
  montarInfoClasse,
  type ClassInfo,
} from "../../components/character/ClassInfoBox";
import type { ClassDefinition } from "../../data/personaRules";
import { OptionField } from "../../components/ui/OptionField";
import {
  ALINHAMENTOS,
  CLASSES,
  RACAS,
  formatarModificador,
  modificador,
} from "../../data/dnd";
import "./CharacterSheet.css";
import "./CharacterSheetExtras.css";
import "./CharacterSheetLayout.css";

const ATTRIBUTE_LABELS: Record<keyof Attributes, string> = {
  forca: "Força",
  destreza: "Destreza",
  constituicao: "Constituição",
  inteligencia: "Inteligência",
  carisma: "Carisma",
};

// Vida e Mana totais de todo personagem (valor fixo)
const VIDA_MANA_TOTAL = 200;

/** Deixa o total em 200. Se o recurso estava cheio, continua cheio. */
function normalizarRecurso<T extends { atual: number; max: number }>(r: T): T {
  const cheio = r.atual >= r.max;

  return {
    ...r,
    max: VIDA_MANA_TOTAL,
    atual: cheio
      ? VIDA_MANA_TOTAL
      : Math.max(0, Math.min(r.atual, VIDA_MANA_TOTAL)),
  };
}

const TABS = [
  "Classe",
  "Inventário",
  "Magias",
  "História",
  "Notas",
] as const;

type Tab = (typeof TABS)[number];

const HISTORIA_CAMPOS = [
  ["historia", "História"],
  ["aparencia", "Aparência"],
  ["defeito", "Defeito"],
] as const;

const CARTEIRA_VAZIA: Wallet = {
  po: 0,
  pc: 0,
  pp: 0,
  pe: 0,
  pl: 0,
};

/** Garante que valores de moedas não fiquem negativos ou estourem em Number.MAX_SAFE_INTEGER */
function sanitizarMoeda(valor?: number | null): number {
  if (valor === undefined || valor === null || isNaN(valor) || valor < 0) return 0;
  // Bugfix: se estiver corrompido com Number.MAX_SAFE_INTEGER (9007199254740991), recupera para valor sensato
  if (valor >= 9000000000000000) return 1250;
  return Math.min(9999999, Math.floor(valor));
}

/* ---------- componentes auxiliares ---------- */

function ControleVital({
  titulo,
  atual,
  max,
  tom,
  passos,
  desabilitado,
  onAtualizarAtual,
  onRestaurar,
  textoRestaurar,
}: {
  titulo: string;
  atual: number;
  max: number;
  tom: "wine" | "forest";
  passos: number[];
  desabilitado: boolean;
  onAtualizarAtual: (val: number) => void;
  onRestaurar: () => void;
  textoRestaurar: string;
}) {
  return (
    <div className={"cs-vital-card cs-vital-card--" + tom}>
      <div className="cs-vital-head">
        <span className="cs-vital-title">{titulo}</span>

        <button
          type="button"
          className="cs-btn-action"
          disabled={desabilitado || atual === max}
          onClick={onRestaurar}
        >
          {textoRestaurar}
        </button>
      </div>

      <StatBar label={titulo} atual={atual} max={max} tone={tom} />

      <div className="cs-vital-direct">
        <div className="cs-vital-fields">
          <div className="cs-vital-field">
            <label>{titulo} atual</label>

            <input
              type="number"
              className="cs-vital-input"
              min={0}
              max={max}
              value={atual}
              disabled={desabilitado}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onAtualizarAtual(isNaN(val) ? 0 : Math.max(0, Math.min(max, val)));
              }}
            />
          </div>

          <span className="cs-vital-total">de {max}</span>
        </div>

        <div className="cs-vital-quick-btns">
          {passos.map((p) => (
            <button
              key={p}
              type="button"
              className="cs-btn-stepper"
              disabled={desabilitado}
              onClick={() => {
                const novo = Math.max(0, Math.min(max, atual + p));
                onAtualizarAtual(novo);
              }}
            >
              {p > 0 ? `+${p}` : p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ControleCarteira({
  carteira,
  desabilitado,
  onAlterarMoeda,
}: {
  carteira: Wallet;
  desabilitado: boolean;
  onAlterarMoeda: (chave: keyof Wallet, valor: number) => void;
}) {
  const poLimpo = sanitizarMoeda(carteira.po);

  const ajustarPO = (delta: number) => {
    const proximo = Math.max(0, Math.min(9999999, poLimpo + delta));
    onAlterarMoeda("po", proximo);
  };

  return (
    <div className="cs-wallet-container">
      <div className="cs-wallet-main">
        <div className="cs-wallet-gold-head">
          <div className="cs-wallet-gold-title">
            <strong>Peças de Ouro</strong>
            <span>PO · moeda do personagem</span>
          </div>

          <div className="cs-wallet-direct-gold">
            <input
              type="number"
              className="cs-wallet-input"
              min={0}
              max={9999999}
              value={poLimpo}
              disabled={desabilitado}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onAlterarMoeda("po", isNaN(val) ? 0 : Math.max(0, Math.min(9999999, val)));
              }}
            />
            <span className="cs-wallet-unit">PO</span>
          </div>
        </div>

        <div className="cs-wallet-steppers">
          {[-100, -50, -10, -1, 1, 10, 50, 100].map((delta) => (
            <button
              key={delta}
              type="button"
              className="cs-btn-stepper"
              disabled={desabilitado}
              onClick={() => ajustarPO(delta)}
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Campo numérico de perícia: o valor digitado é o valor final da perícia. */
function CampoPericia({
  valor,
  desabilitado,
  nome,
  onChange,
}: {
  valor: number;
  desabilitado: boolean;
  nome: string;
  onChange: (valor: number) => void;
}) {
  const [texto, setTexto] = useState(String(valor));

  useEffect(() => {
    setTexto(String(valor));
  }, [valor]);

  return (
    <input
      type="text"
      inputMode="numeric"
      className="cs-skill-input"
      aria-label={"Valor de " + nome}
      value={texto}
      disabled={desabilitado}
      onChange={(e) => {
        const bruto = e.target.value;
        setTexto(bruto);

        if (/^-?\d{1,3}$/.test(bruto)) {
          onChange(parseInt(bruto, 10));
        }
      }}
      onBlur={() => setTexto(String(valor))}
    />
  );
}

function Campo({
  rotulo,
  valor,
  onChange,
  tipo = "text",
  largo,
  multilinha,
}: {
  rotulo: string;
  valor: string | number;
  onChange: (valor: string) => void;
  tipo?: string;
  largo?: boolean;
  multilinha?: boolean;
}) {
  return (
    <label className={largo ? "field field-wide" : "field"}>
      <span>{rotulo}</span>

      {multilinha ? (
        <textarea
          rows={4}
          value={valor}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type={tipo}
          value={valor}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

/* ---------- página principal ---------- */

export default function CharacterSheet() {
  const { id } = useParams();

  const idRef = useRef(id);
  idRef.current = id;

  const [character, setCharacter] = useState<Character | null>(null);

  const [acesso, setAcesso] = useState({
    canEdit: false,
    isMaster: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("Classe");
  const [status, setStatus] = useState("");

  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<Character | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Estados locais para adição de novos itens/magias
  const [novoItemNome, setNovoItemNome] = useState("");
  const [novoItemQtd, setNovoItemQtd] = useState(1);
  const [mostrarFormItem, setMostrarFormItem] = useState(false);

  const [novaMagiaNome, setNovaMagiaNome] = useState("");
  const [novaMagiaCusto, setNovaMagiaCusto] = useState(1);
  const [novaMagiaDesc, setNovaMagiaDesc] = useState("");
  const [mostrarFormMagia, setMostrarFormMagia] = useState(false);

  const [catalogoClasses, setCatalogoClasses] = useState<ClassDefinition[]>([]);
  const [infoClasse, setInfoClasse] = useState<ClassInfo | null>(null);

  const timer = useRef<number | null>(null);
  const pendente = useRef<Character | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError(null);

    Promise.all([
      getCharacterById(id),
      getCharacterAccess(id),
    ])
      .then(([c, a]) => {
        if (c) {
          // Auto-sanitiza carteira caso esteja com Number.MAX_SAFE_INTEGER
          const carteiraLimpa: Wallet = {
            pc: sanitizarMoeda(c.carteira?.pc),
            pp: sanitizarMoeda(c.carteira?.pp),
            pe: sanitizarMoeda(c.carteira?.pe),
            po: sanitizarMoeda(c.carteira?.po),
            pl: sanitizarMoeda(c.carteira?.pl),
          };
          setCharacter({
            ...c,
            hp: normalizarRecurso(c.hp),
            mp: normalizarRecurso(c.mp),
            carteira: carteiraLimpa,
          });
        } else {
          setCharacter(null);
        }
        setAcesso(a);
      })
      .catch((e) => {
        console.error("Erro ao buscar personagem:", e);
        setError(e?.message ?? "Erro ao carregar a ficha.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Descrição, bônus e habilidades da classe (catálogo global + conteúdo da campanha)
  const classeNome = character?.classe;
  const classeId = character?.classeId;
  const campanhaDoPersonagem = character?.campanhaId;

  useEffect(() => {
    if (!classeNome) {
      setInfoClasse(null);
      return;
    }

    let ativo = true;

    async function carregarClasse() {
      try {
        const catalogo = await getCatalogoGlobalClasses();
        const conteudos = campanhaDoPersonagem
          ? await listarConteudosClasseCampanha(campanhaDoPersonagem)
          : [];

        if (!ativo) return;

        setCatalogoClasses(catalogo);
        setInfoClasse(
          montarInfoClasse(classeNome, classeId ?? undefined, catalogo, conteudos),
        );
      } catch (e) {
        console.error("Erro ao carregar a classe:", e);
        if (ativo) setInfoClasse(null);
      }
    }

    void carregarClasse();

    return () => {
      ativo = false;
    };
  }, [classeNome, classeId, campanhaDoPersonagem]);

  const salvarPendente = async () => {
    const alvo = pendente.current;
    const alvoId = idRef.current;

    if (!alvo || !alvoId) return;

    pendente.current = null;
    setStatus("Salvando alterações...");

    try {
      await atualizarPersonagem(alvoId, alvo);
      setStatus("Alterações salvas com sucesso.");
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar as alterações.",
      );
    }
  };

  const cancelarPendente = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    pendente.current = null;
  };

  const agendarSalvamento = (proximo: Character) => {
    setCharacter(proximo);
    pendente.current = proximo;

    if (timer.current) {
      window.clearTimeout(timer.current);
    }

    timer.current = window.setTimeout(() => {
      timer.current = null;
      void salvarPendente();
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
        void salvarPendente();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <p className="sheet-status">Carregando ficha do personagem...</p>;
  }

  if (error) {
    return <p className="sheet-status">Erro: {error}</p>;
  }

  if (!character) {
    return <p className="sheet-status">Personagem não encontrado.</p>;
  }

  const podeEditar = acesso.canEdit;

  const view: Character = editando && rascunho ? rascunho : character;

  const carteira: Wallet = {
    pc: sanitizarMoeda(view.carteira?.pc),
    pp: sanitizarMoeda(view.carteira?.pp),
    pe: sanitizarMoeda(view.carteira?.pe),
    po: sanitizarMoeda(view.carteira?.po),
    pl: sanitizarMoeda(view.carteira?.pl),
  };

  const opcoesClasse = Array.from(
    new Set([
      view.classe,
      ...(catalogoClasses.length > 0
        ? catalogoClasses.map((item) => item.nome)
        : CLASSES),
    ]),
  ).filter(Boolean);

  /* ---------- ações de vida, mana e dinheiro ---------- */

  const alterarHp = (atual: number) => {
    const max = character.hp.max;
    const valido = Math.max(0, Math.min(max, atual));
    agendarSalvamento({
      ...character,
      hp: {
        ...character.hp,
        atual: valido,
      },
    });
  };

  const alterarMp = (atual: number) => {
    const max = character.mp.max;
    const valido = Math.max(0, Math.min(max, atual));
    agendarSalvamento({
      ...character,
      mp: {
        ...character.mp,
        atual: valido,
      },
    });
  };

  const curarTudo = () => {
    agendarSalvamento({
      ...character,
      hp: {
        ...character.hp,
        atual: character.hp.max,
      },
    });
  };

  const restaurarMana = () => {
    agendarSalvamento({
      ...character,
      mp: {
        ...character.mp,
        atual: character.mp.max,
      },
    });
  };

  const alterarMoeda = (chave: keyof Wallet, valor: number) => {
    const carteiraAtual = character.carteira ?? CARTEIRA_VAZIA;
    agendarSalvamento({
      ...character,
      carteira: {
        ...carteiraAtual,
        [chave]: sanitizarMoeda(valor),
      },
    });
  };

  /* ---------- modo edição completa ---------- */

  const iniciarEdicao = () => {
    setRascunho(structuredClone(character));
    setEditando(true);
    setStatus("");
  };

  const cancelarEdicao = () => {
    setEditando(false);
    setRascunho(null);
  };

  const atualizarRascunho = <K extends keyof Character>(
    chave: K,
    valor: Character[K],
  ) => {
    setRascunho((prev) =>
      prev ? { ...prev, [chave]: valor } : prev,
    );
  };

  const salvarEdicao = async () => {
    if (!rascunho || !id) return;

    const ajustado: Character = {
      ...rascunho,
      nome: rascunho.nome.trim() || character.nome,
      hp: {
        max: VIDA_MANA_TOTAL,
        atual: Math.max(0, Math.min(rascunho.hp.atual, VIDA_MANA_TOTAL)),
      },
      mp: {
        max: VIDA_MANA_TOTAL,
        atual: Math.max(0, Math.min(rascunho.mp.atual, VIDA_MANA_TOTAL)),
      },
      carteira: {
        pc: sanitizarMoeda(rascunho.carteira?.pc),
        pp: sanitizarMoeda(rascunho.carteira?.pp),
        pe: sanitizarMoeda(rascunho.carteira?.pe),
        po: sanitizarMoeda(rascunho.carteira?.po),
        pl: sanitizarMoeda(rascunho.carteira?.pl),
      },
    };

    cancelarPendente();
    setSalvandoEdicao(true);
    setStatus("Salvando ficha...");

    try {
      const salvo = await atualizarPersonagem(id, ajustado);
      setCharacter(salvo);
      setEditando(false);
      setRascunho(null);
      setStatus("Ficha atualizada com sucesso.");
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar a ficha.",
      );
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const trocarFoto = async (arquivo: File) => {
    if (!id) return;

    cancelarPendente();
    setStatus("Enviando foto...");

    try {
      const url = await enviarRetrato(arquivo);
      const salvo = await atualizarPersonagem(id, {
        ...character,
        portraitUrl: url,
      });

      setCharacter(salvo);
      setStatus("Foto atualizada.");
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Não foi possível enviar a foto.",
      );
    }
  };

  /* ---------- gerenciamento de itens, magias e perícias ---------- */

  const handleAdicionarItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoItemNome.trim()) return;

    const novoItem: InventoryItem = {
      id: "item-" + Date.now(),
      nome: novoItemNome.trim(),
      quantidade: Math.max(1, novoItemQtd),
    };

    const proximoInventario = [...character.inventory, novoItem];
    agendarSalvamento({
      ...character,
      inventory: proximoInventario,
    });

    setNovoItemNome("");
    setNovoItemQtd(1);
    setMostrarFormItem(false);
  };

  const handleAlterarQtdItem = (itemId: string, delta: number) => {
    const proximoInventario = character.inventory
      .map((item) => {
        if (item.id === itemId) {
          const novaQtd = item.quantidade + delta;
          return novaQtd > 0 ? { ...item, quantidade: novaQtd } : null;
        }
        return item;
      })
      .filter((item): item is InventoryItem => item !== null);

    agendarSalvamento({
      ...character,
      inventory: proximoInventario,
    });
  };

  const handleRemoverItem = (itemId: string) => {
    const proximoInventario = character.inventory.filter((item) => item.id !== itemId);
    agendarSalvamento({
      ...character,
      inventory: proximoInventario,
    });
  };

  const handleAdicionarMagia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaMagiaNome.trim()) return;

    const novaMagia: Spell = {
      id: "spell-" + Date.now(),
      nome: novaMagiaNome.trim(),
      custo: Math.max(0, novaMagiaCusto),
      descricao: novaMagiaDesc.trim(),
    };

    agendarSalvamento({
      ...character,
      spells: [...character.spells, novaMagia],
    });

    setNovaMagiaNome("");
    setNovaMagiaCusto(1);
    setNovaMagiaDesc("");
    setMostrarFormMagia(false);
  };

  const handleRemoverMagia = (spellId: string) => {
    agendarSalvamento({
      ...character,
      spells: character.spells.filter((s) => s.id !== spellId),
    });
  };

  const handleDefinirValorPericia = (skillId: string, valor: number) => {
    const proximasSkills = character.skills.map((skill) =>
      skill.id === skillId
        ? { ...skill, bonus: valor, treinada: valor > 0 }
        : skill,
    );

    agendarSalvamento({
      ...character,
      skills: proximasSkills,
    });
  };

  /* ---------- tela ---------- */

  const linhaExtra = [
    view.alinhamento,
    view.origem,
    view.idade,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="sheet">
      {/* Banner de permissão do Mestre */}
      {acesso.isMaster && (
        <div className="cs-master-banner">
          <span>Mestre da Campanha: você tem permissão total para alterar vida, mana, dinheiro e atributos desta ficha.</span>
        </div>
      )}

      <nav className="cs-nav">
        {character.campanhaId ? (
          <Link to={"/campanha/" + character.campanhaId} className="cs-back-link">
            ← Voltar para a campanha
          </Link>
        ) : (
          <Link to="/">← Meus personagens</Link>
        )}

        {character.campanhaId && (
          <>
            <Link to={"/campanha/" + character.campanhaId + "/loja"}>
              Loja da Campanha
            </Link>
            <Link to="/">Meus personagens</Link>
          </>
        )}
      </nav>

      <header className="cs-hero">
        <div className="cs-portrait-wrap">
          <div className="sheet-portrait">
            {view.portraitUrl ? (
              <img
                className="cs-portrait-img"
                src={view.portraitUrl}
                alt={view.nome}
              />
            ) : (
              view.nome.charAt(0)
            )}
          </div>

          {podeEditar && (
            <>
              <button
                type="button"
                className="btn-ghost cs-photo-btn"
                onClick={() => inputFoto.current?.click()}
              >
                Alterar foto
              </button>

              <input
                ref={inputFoto}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const arquivo = event.target.files?.[0];
                  if (arquivo) {
                    void trocarFoto(arquivo);
                  }
                  event.target.value = "";
                }}
              />
            </>
          )}
        </div>

        <div className="cs-hero-main">
          <h1>{view.nome}</h1>

          <p className="cs-hero-line">
            {view.raca} · {view.classe} · Nível {view.nivel}
          </p>

          {linhaExtra && <p className="cs-hero-sub">{linhaExtra}</p>}
        </div>
      </header>

      {podeEditar && (
        <div className="cs-editbar">
          <span className="cs-status">
            {status ||
              (acesso.isMaster
                ? "Você pode alterar esta ficha livremente como Mestre."
                : "Você pode editar sua ficha.")}
          </span>

          {editando ? (
            <>
              <button
                type="button"
                className="btn-ghost"
                onClick={cancelarEdicao}
                disabled={salvandoEdicao}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={salvarEdicao}
                disabled={salvandoEdicao}
              >
                {salvandoEdicao ? "Salvando..." : "Salvar ficha"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-ghost"
              onClick={iniciarEdicao}
            >
              Editar ficha completa
            </button>
          )}
        </div>
      )}

      {/* Formulário de edição completa */}
      {editando && rascunho && (
        <section className="cs-panel">
          <div className="cs-panel-header">
            <h3>Editar ficha completa</h3>
          </div>

          <div className="cs-edit-grid">
            <Campo
              rotulo="Nome"
              valor={rascunho.nome}
              onChange={(v) => atualizarRascunho("nome", v)}
            />

            <OptionField
              label="Raça"
              value={rascunho.raca}
              options={RACAS}
              onChange={(v) => atualizarRascunho("raca", v)}
            />

            <OptionField
              label="Classe"
              value={rascunho.classe}
              options={opcoesClasse}
              onChange={(v) => {
                atualizarRascunho("classe", v);
                const definicao = catalogoClasses.find((item) => item.nome === v);
                atualizarRascunho("classeId", definicao?.id);
              }}
            />

            <Campo
              rotulo="Nível"
              tipo="number"
              valor={rascunho.nivel}
              onChange={(v) =>
                atualizarRascunho(
                  "nivel",
                  Math.min(20, Math.max(1, Number(v) || 1)),
                )
              }
            />

            <OptionField
              label="Alinhamento"
              value={rascunho.alinhamento ?? ""}
              options={ALINHAMENTOS}
              onChange={(v) => atualizarRascunho("alinhamento", v)}
            />

            <Campo
              rotulo="Origem"
              valor={rascunho.origem ?? ""}
              onChange={(v) => atualizarRascunho("origem", v)}
            />

            <Campo
              rotulo="Idade"
              valor={rascunho.idade ?? ""}
              onChange={(v) => atualizarRascunho("idade", v)}
            />

            <Campo
              rotulo="Vida atual"
              tipo="number"
              valor={rascunho.hp.atual}
              onChange={(v) =>
                atualizarRascunho("hp", {
                  ...rascunho.hp,
                  atual: Math.min(VIDA_MANA_TOTAL, Math.max(0, Number(v) || 0)),
                })
              }
            />

            <Campo
              rotulo="Mana atual"
              tipo="number"
              valor={rascunho.mp.atual}
              onChange={(v) =>
                atualizarRascunho("mp", {
                  ...rascunho.mp,
                  atual: Math.min(VIDA_MANA_TOTAL, Math.max(0, Number(v) || 0)),
                })
              }
            />

            <Campo
              rotulo="Ouro (PO)"
              tipo="number"
              valor={sanitizarMoeda(rascunho.carteira?.po)}
              onChange={(v) =>
                atualizarRascunho("carteira", {
                  ...(rascunho.carteira ?? CARTEIRA_VAZIA),
                  po: sanitizarMoeda(Number(v) || 0),
                })
              }
            />
          </div>
        </section>
      )}

      <div className="cs-board">
        <aside className="cs-side">
          <section className="cs-panel">
            <div className="cs-panel-header">
              <h3>Atributos</h3>
            </div>

            <div className="cs-attr-list">
              {(Object.keys(view.attributes) as (keyof Attributes)[]).map((attr) => (
                <div key={attr} className="cs-attr-card">
                  <span className="cs-attr-name">{ATTRIBUTE_LABELS[attr]}</span>

                  <strong className="cs-attr-mod">
                    {formatarModificador(modificador(view.attributes[attr]))}
                  </strong>

                  {editando && rascunho ? (
                    <input
                      className="cs-attr-input"
                      type="number"
                      min={1}
                      max={30}
                      value={rascunho.attributes[attr]}
                      onChange={(event) =>
                        atualizarRascunho("attributes", {
                          ...rascunho.attributes,
                          [attr]: Number(event.target.value) || 1,
                        })
                      }
                    />
                  ) : (
                    <span className="cs-attr-value">{view.attributes[attr]}</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="cs-panel">
            <div className="cs-panel-header">
              <h3>Perícias</h3>
              {podeEditar && !editando && view.skills.length > 0 && (
                <small>Digite o valor de cada perícia.</small>
              )}
            </div>

            <ul className="cs-skill-table">
              {view.skills.map((skill) => (
                <li
                  key={skill.id}
                  className="cs-skill-line"
                  title={skill.descricao || undefined}
                >
                  <span className="cs-skill-label">
                    <strong>{skill.nome}</strong>
                    <small>{ATTRIBUTE_LABELS[skill.atributo]}</small>
                  </span>

                  <CampoPericia
                    valor={skill.bonus}
                    nome={skill.nome}
                    desabilitado={!podeEditar || editando}
                    onChange={(valor) =>
                      handleDefinirValorPericia(skill.id, valor)
                    }
                  />
                </li>
              ))}

              {view.skills.length === 0 && (
                <li className="sheet-empty">Nenhuma perícia registrada.</li>
              )}
            </ul>
          </section>
        </aside>

        <div className="cs-main">
          <section className="cs-panel cs-panel--vitals">
            <div className="cs-panel-header">
              <h3>Vida e mana</h3>
              {podeEditar && (
                <small>Digite o valor atual ou use os botões.</small>
              )}
            </div>

            <div className="cs-vitals-grid">
              <ControleVital
                titulo="Vida"
                atual={character.hp.atual}
                max={character.hp.max}
                tom="wine"
                passos={[-10, -5, -1, 1, 5, 10]}
                desabilitado={!podeEditar}
                onAtualizarAtual={alterarHp}
                onRestaurar={curarTudo}
                textoRestaurar="Curar tudo"
              />

              <ControleVital
                titulo="Mana"
                atual={character.mp.atual}
                max={character.mp.max}
                tom="forest"
                passos={[-5, -1, 1, 5]}
                desabilitado={!podeEditar}
                onAtualizarAtual={alterarMp}
                onRestaurar={restaurarMana}
                textoRestaurar="Recuperar mana"
              />
            </div>
          </section>

          <section className="cs-panel cs-panel--wallet">
            <div className="cs-panel-header">
              <h3>Carteira</h3>
              {podeEditar && (
                <small>Digite a quantia ou use os botões.</small>
              )}
            </div>

            <ControleCarteira
              carteira={carteira}
              desabilitado={!podeEditar}
              onAlterarMoeda={alterarMoeda}
            />
          </section>

          <section className="cs-panel cs-tabs-panel">
            <nav className="sheet-tabs">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={
                    t === tab
                      ? "sheet-tab sheet-tab--active"
                      : "sheet-tab"
                  }
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>

            <div className="sheet-content">
            {tab === "Classe" && (
              <ClassInfoBox
                info={infoClasse}
                mensagemVazia="Não encontramos os detalhes desta classe no catálogo."
              />
            )}

            {tab === "Inventário" && (
              <div>
                {podeEditar && !editando && (
                  <div style={{ marginBottom: 12 }}>
                    {!mostrarFormItem ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ fontSize: "0.82rem", padding: "4px 10px" }}
                        onClick={() => setMostrarFormItem(true)}
                      >
                        + Adicionar item ao inventário
                      </button>
                    ) : (
                      <form onSubmit={handleAdicionarItem} className="cs-inline-form">
                        <input
                          placeholder="Nome do item (ex: Poção de Cura)"
                          value={novoItemNome}
                          onChange={(e) => setNovoItemNome(e.target.value)}
                          required
                        />
                        <input
                          type="number"
                          placeholder="Qtd"
                          min={1}
                          style={{ width: "70px" }}
                          value={novoItemQtd}
                          onChange={(e) => setNovoItemQtd(Number(e.target.value) || 1)}
                        />
                        <button type="submit" className="btn-primary" style={{ fontSize: "0.8rem", padding: "4px 10px" }}>
                          Adicionar
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                          onClick={() => setMostrarFormItem(false)}
                        >
                          Cancelar
                        </button>
                      </form>
                    )}
                  </div>
                )}

                <ul className="sheet-list">
                  {view.inventory.map((item) => (
                    <li key={item.id}>
                      <span>{item.nome}</span>

                      <span className="sheet-list-tag">
                        x{item.quantidade}
                      </span>

                      {podeEditar && !editando && (
                        <div className="cs-list-actions">
                          <button
                            type="button"
                            className="cs-btn-icon"
                            onClick={() => handleAlterarQtdItem(item.id, -1)}
                            title="Reduzir quantidade"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            className="cs-btn-icon"
                            onClick={() => handleAlterarQtdItem(item.id, 1)}
                            title="Aumentar quantidade"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="cs-btn-icon cs-btn-icon-del"
                            onClick={() => handleRemoverItem(item.id)}
                            title="Remover do inventário"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </li>
                  ))}

                  {view.inventory.length === 0 && (
                    <p className="sheet-empty">Inventário vazio.</p>
                  )}
                </ul>
              </div>
            )}

            {tab === "Magias" && (
              <div>
                {podeEditar && !editando && (
                  <div style={{ marginBottom: 12 }}>
                    {!mostrarFormMagia ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ fontSize: "0.82rem", padding: "4px 10px" }}
                        onClick={() => setMostrarFormMagia(true)}
                      >
                        + Conhecer nova magia
                      </button>
                    ) : (
                      <form onSubmit={handleAdicionarMagia} className="cs-inline-form">
                        <input
                          placeholder="Nome da magia (ex.: Bola de Fogo)"
                          value={novaMagiaNome}
                          onChange={(e) => setNovaMagiaNome(e.target.value)}
                          required
                        />
                        <input
                          type="number"
                          placeholder="Custo PM"
                          min={0}
                          style={{ width: "90px" }}
                          value={novaMagiaCusto}
                          onChange={(e) => setNovaMagiaCusto(Number(e.target.value) || 0)}
                        />
                        <input
                          placeholder="Descrição / Efeito"
                          style={{ flex: "1 1 200px" }}
                          value={novaMagiaDesc}
                          onChange={(e) => setNovaMagiaDesc(e.target.value)}
                        />
                        <button type="submit" className="btn-primary" style={{ fontSize: "0.8rem", padding: "4px 10px" }}>
                          Aprender
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                          onClick={() => setMostrarFormMagia(false)}
                        >
                          Cancelar
                        </button>
                      </form>
                    )}
                  </div>
                )}

                <ul className="sheet-list sheet-list--spells">
                  {view.spells.map((spell) => (
                    <li key={spell.id}>
                      <div className="sheet-spell-head">
                        <span>{spell.nome}</span>
                        <span className="sheet-list-tag">{spell.custo} PM</span>

                        {podeEditar && !editando && (
                          <button
                            type="button"
                            className="cs-btn-icon cs-btn-icon-del"
                            style={{ marginLeft: "auto" }}
                            onClick={() => handleRemoverMagia(spell.id)}
                            title="Esquecer magia"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {spell.descricao && <p>{spell.descricao}</p>}
                    </li>
                  ))}

                  {view.spells.length === 0 && (
                    <p className="sheet-empty">Este personagem não conhece magias.</p>
                  )}
                </ul>
              </div>
            )}

            {tab === "História" && (
              <div className="cs-story">
                {editando && rascunho ? (
                  <div className="cs-edit-grid">
                    {HISTORIA_CAMPOS.map(([chave, rotulo]) => (
                      <Campo
                        key={chave}
                        rotulo={rotulo}
                        largo
                        multilinha
                        valor={rascunho[chave] ?? ""}
                        onChange={(v) => atualizarRascunho(chave, v)}
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    {HISTORIA_CAMPOS.filter(([chave]) => view[chave]).map(
                      ([chave, rotulo]) => (
                        <div key={chave}>
                          <h4>{rotulo}</h4>
                          <p className="sheet-notes">{view[chave]}</p>
                        </div>
                      ),
                    )}

                    {HISTORIA_CAMPOS.every(([chave]) => !view[chave]) && (
                      <p className="sheet-empty">Nenhuma história registrada.</p>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === "Notas" &&
              (editando && rascunho ? (
                <Campo
                  rotulo="Notas"
                  largo
                  multilinha
                  valor={rascunho.notas}
                  onChange={(v) => atualizarRascunho("notas", v)}
                />
              ) : (
                <p className="sheet-notes">
                  {view.notas || "Nenhuma anotação ainda."}
                </p>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}