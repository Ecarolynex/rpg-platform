import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Attributes, Character, Spell, Wallet } from "../../types/character";
import {
  atualizarPersonagem,
  enviarRetrato,
  getCatalogoGlobalClasses,
  getCharacterAccess,
  getCharacterById,
  listarConteudosClasseCampanha,
} from "../../services/api";
import InventoryItems from "../../components/inventory/InventoryItems";
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
} from "../../data/dnd";
import "./CharacterSheet.css";
import "./CharacterSheetExtras.css";
import "./CharacterSheetLayout.css";
import "./CharacterSheetEpic.css";

const ATTRIBUTE_LABELS: Record<keyof Attributes, string> = {
  forca: "Força",
  destreza: "Destreza",
  constituicao: "Constituição",
  inteligencia: "Inteligência",
  carisma: "Carisma",
};

// Vida e Mana totais de todo personagem
const VIDA_MANA_TOTAL = 200;

// Se a criação do personagem já soma o bônus da classe nos atributos salvos,
// mantenha false para não contar o bônus duas vezes.
const SOMAR_BONUS_DE_CLASSE = true;

const NIVEL_MAXIMO = 20;

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

/** Garante que valores de moedas não fiquem negativos ou estourem. */
function sanitizarMoeda(valor?: number | null): number {
  if (valor === undefined || valor === null || isNaN(valor) || valor < 0) {
    return 0;
  }

  if (valor >= 9000000000000000) {
    return 1250;
  }

  return Math.min(9999999, Math.floor(valor));
}

type BonusAtributos = Partial<Record<keyof Attributes, number>>;

type ItemComBonus = {
  equipado?: boolean;
  bonus?: BonusAtributos;
};

/**
 * Soma os bônus SOMENTE dos itens equipados.
 */
function calcularBonusItens(c: Character): BonusAtributos {
  const itens = (c.inventory ?? []) as unknown as ItemComBonus[];
  const soma: BonusAtributos = {};

  for (const item of itens) {
    if (!item?.equipado || !item.bonus) continue;

    for (const attr of Object.keys(item.bonus) as (keyof Attributes)[]) {
      soma[attr] = (soma[attr] ?? 0) + (item.bonus[attr] ?? 0);
    }
  }

  return soma;
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

                onAtualizarAtual(
                  isNaN(val) ? 0 : Math.max(0, Math.min(max, val)),
                );
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
              {p > 0 ? "+" + p : p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Bolsa de moedas. */
function BolsaMoedas({
  po,
  desabilitado,
  onAlterarPO,
}: {
  po: number;
  desabilitado: boolean;
  onAlterarPO: (valor: number) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [valor, setValor] = useState("");

  const aplicar = (sentido: 1 | -1) => {
    const n = parseInt(valor, 10);

    if (isNaN(n) || n <= 0) return;

    onAlterarPO(Math.max(0, Math.min(9999999, po + sentido * n)));
    setValor("");
  };

  return (
    <div className="ep-bolsa">
      <button
        type="button"
        className="ep-bolsa-botao"
        aria-expanded={aberta}
        aria-controls="ep-bolsa-painel"
        aria-label="Abrir bolsa de moedas"
        onClick={() => setAberta((v) => !v)}
      >
        <svg width="40" height="44" viewBox="0 0 28 32" aria-hidden="true">
          <path
            d="M10 7 L7 3 Q14 6 21 3 L18 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />

          <path
            d="M10 7 C6 11 3 16 3 22 C3 28 8 31 14 31 C20 31 25 28 25 22 C25 16 22 11 18 7 Z"
            fill="#17382f"
            stroke="currentColor"
            strokeWidth="1.4"
          />

          <path
            d="M9.5 8.5 Q14 11 18.5 8.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
          />

          <circle
            cx="14"
            cy="21"
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
          />

          <path d="M14 19 V23" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </button>

      <div className="ep-bolsa-saldo">
        <input
          type="number"
          className="ep-bolsa-input"
          min={0}
          max={9999999}
          value={po}
          disabled={desabilitado}
          aria-label="Peças de ouro"
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);

            onAlterarPO(
              isNaN(val) ? 0 : Math.max(0, Math.min(9999999, val)),
            );
          }}
        />

        <span>PO</span>
      </div>

      {aberta && (
        <div className="ep-bolsa-painel" id="ep-bolsa-painel">
          <input
            type="number"
            className="ep-bolsa-input"
            min={0}
            value={valor}
            placeholder="Valor"
            disabled={desabilitado}
            aria-label="Valor a receber ou gastar"
            onChange={(e) => setValor(e.target.value)}
          />

          <button
            type="button"
            className="cs-btn-stepper"
            disabled={desabilitado}
            onClick={() => aplicar(1)}
          >
            Receber
          </button>

          <button
            type="button"
            className="cs-btn-stepper"
            disabled={desabilitado}
            onClick={() => aplicar(-1)}
          >
            Gastar
          </button>
        </div>
      )}
    </div>
  );
}

/** Campo numérico de perícia. */
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
          montarInfoClasse(
            classeNome,
            classeId ?? undefined,
            catalogo,
            conteudos,
          ),
        );
      } catch (e) {
        console.error("Erro ao carregar a classe:", e);

        if (ativo) {
          setInfoClasse(null);
        }
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

  // Bônus da classe
  const definicaoClasse = catalogoClasses.find(
    (item) =>
      (view.classeId && item.id === view.classeId) ||
      item.nome === view.classe,
  );

  const bonusClasse: BonusAtributos | undefined = SOMAR_BONUS_DE_CLASSE
    ? definicaoClasse?.atributoBonus
    : undefined;

  // Bônus somente dos itens equipados
  const bonusItens = calcularBonusItens(view);

  /* ---------- ações ---------- */

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

  const alterarNivel = (delta: number) => {
    const novo = Math.max(1, Math.min(NIVEL_MAXIMO, character.nivel + delta));

    if (novo === character.nivel) return;

    agendarSalvamento({
      ...character,
      nivel: novo,
    });
  };

  const alterarAtributo = (attr: keyof Attributes, valor: number) => {
    agendarSalvamento({
      ...character,
      attributes: {
        ...character.attributes,
        [attr]: Math.max(1, Math.min(30, valor)),
      },
    });
  };

  /* ---------- edição ---------- */

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
        atual: Math.max(
          0,
          Math.min(rascunho.hp.atual, VIDA_MANA_TOTAL),
        ),
      },
      mp: {
        max: VIDA_MANA_TOTAL,
        atual: Math.max(
          0,
          Math.min(rascunho.mp.atual, VIDA_MANA_TOTAL),
        ),
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
        e instanceof Error
          ? e.message
          : "Não foi possível enviar a foto.",
      );
    }
  };

  /* ---------- magias ---------- */

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

  const handleDefinirValorPericia = (
    skillId: string,
    valor: number,
  ) => {
    const proximasSkills = character.skills.map((skill) =>
      skill.id === skillId
        ? {
            ...skill,
            bonus: valor,
            treinada: valor > 0,
          }
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

  const podeMudarNivel = podeEditar && !editando;

  return (
    <div className="sheet">
      {acesso.isMaster && (
        <div className="cs-master-banner">
          <span>
            Mestre da Campanha: você tem permissão total para alterar vida,
            mana, dinheiro e atributos desta ficha.
          </span>
        </div>
      )}

      <nav className="cs-nav" aria-label="Navegação do personagem">
        {character.campanhaId ? (
          <>
            <Link
              to={"/campanha/" + character.campanhaId}
              className="cs-back-link"
            >
              ← Voltar para a campanha
            </Link>

            <Link to={"/campanha/" + character.campanhaId + "/mapa"}>
              Mapa da campanha
            </Link>

            <Link to={"/campanha/" + character.campanhaId + "/loja"}>
              Loja da campanha
            </Link>
          </>
        ) : (
          <Link to="/" className="cs-back-link">
            ← Meus personagens
          </Link>
        )}

        <span className="cs-nav-current" aria-current="page">
          Ficha do personagem
        </span>
      </nav>

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

                const definicao = catalogoClasses.find(
                  (item) => item.nome === v,
                );

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
                  Math.min(
                    NIVEL_MAXIMO,
                    Math.max(1, Number(v) || 1),
                  ),
                )
              }
            />

            <OptionField
              label="Alinhamento"
              value={rascunho.alinhamento ?? ""}
              options={ALINHAMENTOS}
              onChange={(v) =>
                atualizarRascunho("alinhamento", v)
              }
            />

            <Campo
              rotulo="Origem"
              valor={rascunho.origem ?? ""}
              onChange={(v) =>
                atualizarRascunho("origem", v)
              }
            />

            <Campo
              rotulo="Idade"
              valor={rascunho.idade ?? ""}
              onChange={(v) =>
                atualizarRascunho("idade", v)
              }
            />

            <Campo
              rotulo="Vida atual"
              tipo="number"
              valor={rascunho.hp.atual}
              onChange={(v) =>
                atualizarRascunho("hp", {
                  ...rascunho.hp,
                  atual: Math.min(
                    VIDA_MANA_TOTAL,
                    Math.max(0, Number(v) || 0),
                  ),
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
                  atual: Math.min(
                    VIDA_MANA_TOTAL,
                    Math.max(0, Number(v) || 0),
                  ),
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

      <div className="ep-folio">
        <header className="ep-topo">
          <svg
            className="ep-paisagem"
            viewBox="0 0 680 130"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 95 L70 45 L110 72 L190 22 L250 68 L320 38 L390 78 L470 18 L540 64 L610 42 L680 82 L680 130 L0 130 Z"
              fill="#1d4a3e"
            />
            <path
              d="M0 112 L60 82 L120 104 L200 68 L280 102 L360 78 L440 106 L520 76 L600 102 L680 86 L680 130 L0 130 Z"
              fill="#163f34"
            />
            <path
              d="M0 130 L0 120 Q40 110 80 122 Q120 108 170 122 Q230 110 290 123 Q350 109 420 122 Q490 110 550 123 Q610 111 680 121 L680 130 Z"
              fill="#0f2a24"
            />
            <circle
              cx="570"
              cy="30"
              r="11"
              fill="none"
              stroke="#e8b923"
              strokeWidth="1.2"
            />
          </svg>

          <div className="ep-identidade">
            <div className="ep-retrato-wrap">
              <div className="ep-retrato">
                {view.portraitUrl ? (
                  <img
                    className="ep-retrato-img"
                    src={view.portraitUrl}
                    alt={"Retrato de " + view.nome}
                  />
                ) : (
                  view.nome.charAt(0)
                )}
              </div>

              {podeEditar && (
                <>
                  <button
                    type="button"
                    className="btn-ghost ep-foto-btn"
                    onClick={() => inputFoto.current?.click()}
                  >
                    Alterar foto
                  </button>

                  <input
                    ref={inputFoto}
                    type="file"
                    accept="image/*"
                    aria-label="Enviar foto do personagem"
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

            <div className="ep-nome-grupo">
              <h1>{view.nome}</h1>

              <p className="ep-linhagem">
                {view.raca} · {view.classe}
              </p>

              {linhaExtra && (
                <p className="ep-extra">{linhaExtra}</p>
              )}

              <div
                className="ep-nivel"
                role="group"
                aria-label="Nível do personagem"
              >
                {podeMudarNivel && (
                  <button
                    type="button"
                    className="ep-mini"
                    aria-label="Diminuir nível"
                    disabled={character.nivel <= 1}
                    onClick={() => alterarNivel(-1)}
                  >
                    −
                  </button>
                )}

                <span className="ep-nivel-texto">
                  Nível {view.nivel}
                </span>

                {podeMudarNivel && (
                  <button
                    type="button"
                    className="ep-mini"
                    aria-label="Aumentar nível"
                    disabled={character.nivel >= NIVEL_MAXIMO}
                    onClick={() => alterarNivel(1)}
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          </div>

          <BolsaMoedas
            po={carteira.po}
            desabilitado={!podeEditar || editando}
            onAlterarPO={(valor) => alterarMoeda("po", valor)}
          />
        </header>

        <div className="ep-divisor" aria-hidden="true">
          <span />
          <svg width="26" height="22" viewBox="0 0 26 22">
            <path
              d="M13 21 V10 M13 12 L6 6 M13 12 L20 6 M13 9 L9 3 M13 9 L17 3 M13 6 V1"
              stroke="#f0c33c"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <span />
        </div>

        <section
          className="ep-card ep-atributos"
          aria-labelledby="cs-attributes-heading"
        >
          <div className="ep-card-head">
            <h2 id="cs-attributes-heading">Atributos</h2>
          </div>

          <div className="ep-attr-grid">
            {(Object.keys(view.attributes) as (keyof Attributes)[]).map(
              (attr) => {
                const base = view.attributes[attr];
                const daClasse = bonusClasse?.[attr] ?? 0;
                const dosItens = bonusItens[attr] ?? 0;

                const total = base + daClasse + dosItens;

                return (
                  <div className="ep-attr" key={attr}>
                    <span className="ep-attr-nome">
                      {ATTRIBUTE_LABELS[attr]}
                    </span>

                    <strong className="ep-attr-total">
                      {total}
                    </strong>

                    <div className="ep-attr-soma">
                      {editando && rascunho ? (
                        <input
                          className="ep-attr-input"
                          type="number"
                          aria-label={ATTRIBUTE_LABELS[attr] + " base"}
                          min={1}
                          max={30}
                          value={rascunho.attributes[attr]}
                          onChange={(event) =>
                            atualizarRascunho("attributes", {
                              ...rascunho.attributes,
                              [attr]:
                                Number(event.target.value) || 1,
                            })
                          }
                        />
                      ) : podeEditar ? (
                        <input
                          className="ep-attr-input"
                          type="number"
                          aria-label={ATTRIBUTE_LABELS[attr] + " base"}
                          min={1}
                          max={30}
                          value={base}
                          onChange={(event) =>
                            alterarAtributo(
                              attr,
                              Number(event.target.value) || 1,
                            )
                          }
                        />
                      ) : (
                        <span className="ep-attr-base">
                          {base}
                        </span>
                      )}

                      {daClasse !== 0 && (
                        <span
                          className="ep-bonus"
                          title="Bônus da classe"
                        >
                          Classe {formatarModificador(daClasse)}
                        </span>
                      )}

                      {dosItens !== 0 && (
                        <span
                          className="ep-bonus"
                          title="Bônus dos itens equipados"
                        >
                          Itens {formatarModificador(dosItens)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>

          <p className="ep-legenda">
            Total = base + bônus da classe + itens equipados
          </p>
        </section>

        <div className="ep-blocos">
          <section
            className="ep-card ep-vitalidade"
            aria-labelledby="cs-vitals-heading"
          >
            <div className="ep-card-head">
              <h2 id="cs-vitals-heading">Vitalidade</h2>
            </div>

            <div className="ep-vitais">
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

          <section
            className="ep-card ep-pericias"
            aria-labelledby="cs-skills-heading"
          >
            <div className="ep-card-head">
              <h2 id="cs-skills-heading">Perícias</h2>
            </div>

            <ul className="ep-pericias-lista">
              {view.skills.map((skill) => (
                <li
                  key={skill.id}
                  className="ep-pericia"
                  title={skill.descricao || undefined}
                >
                  <span className="ep-pericia-nome">
                    <strong>{skill.nome}</strong>
                    <small>
                      {ATTRIBUTE_LABELS[skill.atributo]}
                    </small>
                  </span>

                  <CampoPericia
                    valor={skill.bonus}
                    nome={skill.nome}
                    desabilitado={!podeEditar || editando}
                    onChange={(valor) =>
                      handleDefinirValorPericia(
                        skill.id,
                        valor,
                      )
                    }
                  />
                </li>
              ))}

              {view.skills.length === 0 && (
                <li className="sheet-empty">
                  Nenhuma perícia registrada.
                </li>
              )}
            </ul>
          </section>
        </div>

        <section
          className="ep-card ep-abas"
          aria-label="Conteúdo do personagem"
        >
          <div
            className="sheet-tabs"
            role="tablist"
            aria-label="Seções da ficha"
          >
            {TABS.map((t, index) => (
              <button
                key={t}
                id={"character-sheet-tab-" + index}
                type="button"
                role="tab"
                aria-selected={t === tab}
                aria-controls="character-sheet-tabpanel"
                tabIndex={t === tab ? 0 : -1}
                className={
                  t === tab
                    ? "sheet-tab sheet-tab--active"
                    : "sheet-tab"
                }
                onClick={() => setTab(t)}
                onKeyDown={(event) => {
                  let nextIndex = index;

                  if (event.key === "ArrowRight") {
                    nextIndex = (index + 1) % TABS.length;
                  } else if (event.key === "ArrowLeft") {
                    nextIndex =
                      (index - 1 + TABS.length) %
                      TABS.length;
                  } else if (event.key === "Home") {
                    nextIndex = 0;
                  } else if (event.key === "End") {
                    nextIndex = TABS.length - 1;
                  } else {
                    return;
                  }

                  event.preventDefault();
                  setTab(TABS[nextIndex]);

                  event.currentTarget.parentElement
                    ?.querySelectorAll<HTMLButtonElement>(
                      "[role='tab']",
                    )
                    [nextIndex]?.focus();
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div
            className="sheet-content"
            id="character-sheet-tabpanel"
            role="tabpanel"
            aria-labelledby={`character-sheet-tab-${TABS.indexOf(tab)}`}
            tabIndex={0}
          >
            {tab === "Classe" && (
              <ClassInfoBox
                info={infoClasse}
                mensagemVazia="Não encontramos os detalhes desta classe no catálogo."
              />
            )}

            {tab === "Inventário" && (
              <InventoryItems
                key={character.id}
                characterId={character.id}
                campaignId={character.campanhaId}
              />
            )}

            {tab === "Magias" && (
              <div>
                {podeEditar && !editando && (
                  <div className="cs-spell-actions">
                    {!mostrarFormMagia ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() =>
                          setMostrarFormMagia(true)
                        }
                      >
                        + Conhecer nova magia
                      </button>
                    ) : (
                      <form
                        onSubmit={handleAdicionarMagia}
                        className="cs-inline-form"
                      >
                        <input
                          placeholder="Nome da magia (ex.: Bola de Fogo)"
                          aria-label="Nome da magia"
                          value={novaMagiaNome}
                          onChange={(e) =>
                            setNovaMagiaNome(e.target.value)
                          }
                          required
                        />

                        <input
                          type="number"
                          placeholder="Custo PM"
                          aria-label="Custo em pontos de mana"
                          min={0}
                          value={novaMagiaCusto}
                          onChange={(e) =>
                            setNovaMagiaCusto(
                              Number(e.target.value) || 0,
                            )
                          }
                        />

                        <input
                          placeholder="Descrição / Efeito"
                          aria-label="Descrição da magia"
                          value={novaMagiaDesc}
                          onChange={(e) =>
                            setNovaMagiaDesc(e.target.value)
                          }
                        />

                        <button
                          type="submit"
                          className="btn-primary"
                        >
                          Aprender
                        </button>

                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() =>
                            setMostrarFormMagia(false)
                          }
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

                        <span className="sheet-list-tag">
                          {spell.custo} PM
                        </span>

                        {podeEditar && !editando && (
                          <button
                            type="button"
                            className="cs-btn-icon cs-btn-icon-del"
                            onClick={() =>
                              handleRemoverMagia(spell.id)
                            }
                            title="Esquecer magia"
                            aria-label={
                              `Esquecer magia ${spell.nome}`
                            }
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {spell.descricao && (
                        <p>{spell.descricao}</p>
                      )}
                    </li>
                  ))}

                  {view.spells.length === 0 && (
                    <p className="sheet-empty">
                      Este personagem não conhece magias.
                    </p>
                  )}
                </ul>
              </div>
            )}

            {tab === "História" && (
              <div className="cs-story">
                {editando && rascunho ? (
                  <div className="cs-edit-grid">
                    {HISTORIA_CAMPOS.map(
                      ([chave, rotulo]) => (
                        <Campo
                          key={chave}
                          rotulo={rotulo}
                          largo
                          multilinha
                          valor={rascunho[chave] ?? ""}
                          onChange={(v) =>
                            atualizarRascunho(
                              chave,
                              v,
                            )
                          }
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <>
                    {HISTORIA_CAMPOS.filter(
                      ([chave]) => view[chave],
                    ).map(([chave, rotulo]) => (
                      <div key={chave}>
                        <h3>{rotulo}</h3>

                        <p className="sheet-notes">
                          {view[chave]}
                        </p>
                      </div>
                    ))}

                    {HISTORIA_CAMPOS.every(
                      ([chave]) => !view[chave],
                    ) && (
                      <p className="sheet-empty">
                        Nenhuma história registrada.
                      </p>
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
                  onChange={(v) =>
                    atualizarRascunho("notas", v)
                  }
                />
              ) : podeEditar ? (
                <Campo
                  rotulo="Notas"
                  largo
                  multilinha
                  valor={character.notas}
                  onChange={(notas) =>
                    agendarSalvamento({
                      ...character,
                      notas,
                    })
                  }
                />
              ) : (
                <p className="sheet-notes">
                  {view.notas ||
                    "Nenhuma anotação ainda."}
                </p>
              ))}
          </div>
        </section>

        <footer className="ep-rodape">
          <span>Ficha de personagem · Elementum</span>

          <span>
            {view.classe} · Nível {view.nivel}
          </span>
        </footer>
      </div>
    </div>
  );
}
