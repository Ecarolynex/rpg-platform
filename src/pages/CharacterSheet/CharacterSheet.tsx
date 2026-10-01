import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Attributes, Character, InventoryItem, Spell, Wallet } from "../../types/character";
import {
  alterarItemEquipado,
  atualizarPersonagem,
  enviarRetrato,
  getCharacterAccess,
  getCharacterById,
  getInventory,
} from "../../services/api";
import { StatBar } from "../../components/ui/StatBar";
import { OptionField } from "../../components/ui/OptionField";
import {
  ALINHAMENTOS,
  CLASSES,
  RACAS,
  LIMITE_RECURSO,
  bonusProficiencia,
  formatarModificador,
  modificador,
} from "../../data/dnd";
import "./CharacterSheet.css";
import "./CharacterSheetExtras.css";
import { FIXED_SKILLS, calculateTotalPersonaBonuses } from "../../data/personaRules";
import type { BaseAttributeKey } from "../../data/personaRules";

const ATTRIBUTE_LABELS: Record<keyof Attributes, string> = {
  forca: "Força",
  destreza: "Destreza",
  constituicao: "Constituição",
  inteligencia: "Inteligência",
  sabedoria: "Sabedoria",
  carisma: "Carisma",
};

const TABS = [
  "Atributos",
  "Perícias",
  "Inventário",
  "Magias",
  "História",
  "Notas",
] as const;

type Tab = (typeof TABS)[number];

const HISTORIA_CAMPOS = [
  ["historia", "História"],
  ["aparencia", "Aparência"],
  ["objetivo", "Objetivo"],
  ["defeito", "Defeito"],
] as const;

const CARTEIRA_VAZIA: Wallet = {
  pc: 0,
  pp: 0,
  pe: 0,
  po: 0,
  pl: 0,
};

function completarPericias(skills: Character["skills"] = []): Character["skills"] {
  const periciasFixas = FIXED_SKILLS.map((definition) => {
    const existente = skills.find(
      (skill) => skill.id === definition.id || skill.nome.toLowerCase() === definition.nome.toLowerCase(),
    );
    return existente ?? {
      id: definition.id,
      nome: definition.nome,
      atributo: definition.atributo,
      treinada: false,
      bonus: 0,
    };
  });
  const periciasExtras = skills.filter(
    (skill) => !FIXED_SKILLS.some((fixed) => fixed.id === skill.id),
  );

  return [...periciasFixas, ...periciasExtras];
}

type StoreInventoryEntry = {
  personagemId: string;
  itemId: string;
  nome: string;
  quantidade: number;
  descricao?: string;
  efeito?: string;
  equipado: boolean;
  bonusAtributos: Partial<Record<keyof Attributes, number>>;
};

type StoreInventoryRow = {
  personagem_id: string;
  item_id: string;
  quantidade: number;
  equipado?: boolean;
  itens: {
    nome: string;
    descricao: string | null;
    efeito: string | null;
  } | Array<{
    nome: string;
    descricao: string | null;
    efeito: string | null;
  }> | null;
};

function bonusAtributosDoEfeito(efeito: string | null | undefined) {
  const bonuses: Partial<Record<keyof Attributes, number>> = {};
  const pattern = /([+-]?\d+)\s*(?:em\s+)?(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)/gi;

  for (const match of efeito?.matchAll(pattern) ?? []) {
    const atributo = Object.entries(ATTRIBUTE_LABELS).find(
      ([, label]) => label.toLowerCase() === match[2].toLowerCase(),
    )?.[0] as keyof Attributes | undefined;
    if (atributo) bonuses[atributo] = (bonuses[atributo] ?? 0) + Number(match[1]);
  }

  return bonuses;
}

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
  onAtualizarMax,
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
  onAtualizarMax: (val: number) => void;
  onRestaurar: () => void;
  textoRestaurar: string;
}) {
  return (
    <div className="cs-vital-card">
      <div className="cs-vital-head">
        <span className="cs-vital-title">{titulo}</span>
        <button
          type="button"
          className="cs-btn-action"
          disabled={desabilitado || atual === max}
          onClick={onRestaurar}
          title={textoRestaurar}
        >
          {textoRestaurar}
        </button>
      </div>

      <StatBar label={titulo} atual={atual} max={max} tone={tom} />

      <div className="cs-vital-direct">
        <div className="cs-vital-fields">
          <div className="cs-vital-field">
            <label>Atual</label>
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

          <span className="cs-vital-sep">/</span>

          <div className="cs-vital-field">
            <label>Máximo</label>
            <input
              type="number"
              className="cs-vital-input"
              min={1}
              max={LIMITE_RECURSO}
              value={max}
              disabled={desabilitado}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onAtualizarMax(isNaN(val) ? 1 : Math.max(1, Math.min(LIMITE_RECURSO, val)));
              }}
            />
          </div>
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
  const [mostrarOutras, setMostrarOutras] = useState(false);

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
            <strong>PO</strong>
            <span>Peças de Ouro (Moeda Principal)</span>
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

          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: "0.75rem", padding: "4px 8px", marginLeft: "auto" }}
            onClick={() => setMostrarOutras((v) => !v)}
          >
            {mostrarOutras ? "Ocultar outras moedas ▲" : "Mais moedas (PC, PP, PE, PL) ▼"}
          </button>
        </div>

        {mostrarOutras && (
          <div className="cs-wallet-extras">
            {(
              [
                ["pc", "Cobre", "PC"],
                ["pp", "Prata", "PP"],
                ["pe", "Electro", "PE"],
                ["pl", "Platina", "PL"],
              ] as const
            ).map(([chave, nome, sigla]) => (
              <div key={chave} className="cs-coin-sub">
                <div className="cs-coin-sub-label">
                  <span>{sigla}</span>
                  <small>{nome}</small>
                </div>
                <input
                  type="number"
                  className="cs-coin-sub-input"
                  min={0}
                  max={9999999}
                  value={sanitizarMoeda(carteira[chave])}
                  disabled={desabilitado}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onAlterarMoeda(chave, isNaN(val) ? 0 : Math.max(0, Math.min(9999999, val)));
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
  const [storeInventory, setStoreInventory] = useState<StoreInventoryEntry[]>([]);

  const [acesso, setAcesso] = useState({
    canEdit: false,
    isMaster: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("Atributos");
  const [status, setStatus] = useState("");

  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<Character | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Estados locais para adição de novos itens/magias
  const [novoItemNome, setNovoItemNome] = useState("");
  const [novoItemQtd, setNovoItemQtd] = useState(1);
  const [novoItemAtributo, setNovoItemAtributo] = useState<keyof Attributes | "">("");
  const [novoItemBonus, setNovoItemBonus] = useState(0);
  const [mostrarFormItem, setMostrarFormItem] = useState(false);

  const [novaMagiaNome, setNovaMagiaNome] = useState("");
  const [novaMagiaCusto, setNovaMagiaCusto] = useState(1);
  const [novaMagiaDesc, setNovaMagiaDesc] = useState("");
  const [mostrarFormMagia, setMostrarFormMagia] = useState(false);

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
      getInventory(id).catch(() => []),
    ])
      .then(([c, a, inventoryRows]) => {
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
            hp: {
              ...c.hp,
              max: Math.min(LIMITE_RECURSO, Math.max(1, c.hp.max)),
              atual: Math.min(LIMITE_RECURSO, Math.max(0, c.hp.atual)),
            },
            mp: {
              ...c.mp,
              max: Math.min(LIMITE_RECURSO, Math.max(0, c.mp.max)),
              atual: Math.min(LIMITE_RECURSO, Math.max(0, c.mp.atual)),
            },
            skills: completarPericias(c.skills ?? []),
            inventory: c.inventory ?? [],
            carteira: carteiraLimpa,
          });
          setStoreInventory((inventoryRows as StoreInventoryRow[]).flatMap((row) => {
            const item = Array.isArray(row.itens) ? row.itens[0] ?? null : row.itens;
            if (!item) return [];
            return [{
              personagemId: row.personagem_id,
              itemId: row.item_id,
              nome: item.nome,
              quantidade: row.quantidade,
              descricao: item.descricao ?? undefined,
              efeito: item.efeito ?? undefined,
              equipado: Boolean(row.equipado),
              bonusAtributos: bonusAtributosDoEfeito(item.efeito),
            }];
          }));
        } else {
          setCharacter(null);
          setStoreInventory([]);
        }
        setAcesso(a);
      })
      .catch((e) => {
        console.error("Erro ao buscar personagem:", e);
        setError(e?.message ?? "Erro ao carregar a ficha.");
      })
      .finally(() => setLoading(false));
  }, [id]);

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

  const bonusesPersona = calculateTotalPersonaBonuses(
    view.raca,
    view.classe,
    view.filiacao,
  ).attributeBonuses;
  const bonusesEquipamento: Partial<Record<keyof Attributes, number>> = {};
  for (const item of view.inventory ?? []) {
    if (!item.equipado) continue;
    for (const [atributo, bonus] of Object.entries(item.bonusAtributos ?? {})) {
      const chave = atributo as keyof Attributes;
      bonusesEquipamento[chave] = (bonusesEquipamento[chave] ?? 0) + Number(bonus || 0);
    }
  }
  for (const item of storeInventory) {
    if (!item.equipado) continue;
    for (const [atributo, bonus] of Object.entries(item.bonusAtributos)) {
      const chave = atributo as keyof Attributes;
      bonusesEquipamento[chave] = (bonusesEquipamento[chave] ?? 0) + Number(bonus || 0);
    }
  }
  const valorAtributo = (atributo: keyof Attributes) =>
    (view.attributes[atributo] ?? 10) +
    (bonusesPersona[atributo as BaseAttributeKey] ?? 0) +
    (bonusesEquipamento[atributo] ?? 0);

  const carteira: Wallet = {
    pc: sanitizarMoeda(view.carteira?.pc),
    pp: sanitizarMoeda(view.carteira?.pp),
    pe: sanitizarMoeda(view.carteira?.pe),
    po: sanitizarMoeda(view.carteira?.po),
    pl: sanitizarMoeda(view.carteira?.pl),
  };

  const modDestreza = modificador(valorAtributo("destreza"));

  /* ---------- ações de vida, mana e dinheiro ---------- */

  const alterarHp = (atual: number) => {
    const max = Math.min(LIMITE_RECURSO, character.hp.max);
    const valido = Math.max(0, Math.min(max, atual));
    agendarSalvamento({
      ...character,
      hp: {
        ...character.hp,
        atual: valido,
      },
    });
  };

  const alterarHpMax = (max: number) => {
    const maxValido = Math.max(1, Math.min(LIMITE_RECURSO, max));
    agendarSalvamento({
      ...character,
      hp: {
        max: maxValido,
        atual: Math.min(character.hp.atual, maxValido),
      },
    });
  };

  const curarTudo = () => {
    agendarSalvamento({
      ...character,
      hp: {
        ...character.hp,
        atual: Math.min(LIMITE_RECURSO, character.hp.max),
      },
    });
  };

  const alterarMp = (atual: number) => {
    const max = Math.min(LIMITE_RECURSO, character.mp.max);
    const valido = Math.max(0, Math.min(max, atual));
    agendarSalvamento({
      ...character,
      mp: {
        ...character.mp,
        atual: valido,
      },
    });
  };

  const alterarMpMax = (max: number) => {
    const maxValido = Math.max(0, Math.min(LIMITE_RECURSO, max));
    agendarSalvamento({
      ...character,
      mp: {
        max: maxValido,
        atual: Math.min(character.mp.atual, maxValido),
      },
    });
  };

  const restaurarMana = () => {
    agendarSalvamento({
      ...character,
      mp: {
        ...character.mp,
        atual: Math.min(LIMITE_RECURSO, character.mp.max),
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
        max: Math.max(1, Math.min(LIMITE_RECURSO, rascunho.hp.max)),
        atual: Math.max(0, Math.min(LIMITE_RECURSO, rascunho.hp.atual, rascunho.hp.max)),
      },
      mp: {
        max: Math.max(0, Math.min(LIMITE_RECURSO, rascunho.mp.max)),
        atual: Math.max(0, Math.min(LIMITE_RECURSO, rascunho.mp.atual, rascunho.mp.max)),
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
      equipado: false,
      bonusAtributos: novoItemAtributo && novoItemBonus !== 0
        ? { [novoItemAtributo]: novoItemBonus }
        : undefined,
    };

    const proximoInventario = [...character.inventory, novoItem];
    agendarSalvamento({
      ...character,
      inventory: proximoInventario,
    });

    setNovoItemNome("");
    setNovoItemQtd(1);
    setNovoItemAtributo("");
    setNovoItemBonus(0);
    setMostrarFormItem(false);
  };

  const handleToggleEquipamento = (itemId: string) => {
    const proximoInventario = character.inventory.map((item) =>
      item.id === itemId ? { ...item, equipado: !item.equipado } : item,
    );
    agendarSalvamento({ ...character, inventory: proximoInventario });
  };

  const handleToggleItemDaLoja = async (item: StoreInventoryEntry) => {
    try {
      await alterarItemEquipado(character.id, item.itemId, !item.equipado);
      setStoreInventory((current) => current.map((entry) =>
        entry.itemId === item.itemId
          ? { ...entry, equipado: !entry.equipado }
          : entry,
      ));
      setStatus(item.equipado ? "Equipamento removido." : "Equipamento ativado.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível alterar o equipamento.");
    }
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

  const handleTogglePericia = (skillId: string) => {
    const profBonus = bonusProficiencia(character.nivel);
    const proximasSkills = character.skills.map((skill) => {
      if (skill.id === skillId) {
        const novaTreinada = !skill.treinada;
        return {
          ...skill,
          treinada: novaTreinada,
          bonus: novaTreinada ? profBonus : 0,
        };
      }
      return skill;
    });

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
          <span>👑 Mestre da Campanha: você tem permissão total para alterar vida, mana, dinheiro e atributos desta ficha.</span>
        </div>
      )}

      <nav className="cs-nav">
        {character.campanhaId ? (
          <Link to={"/campanha/" + character.campanhaId} className="cs-back-link">
            ← Voltar para a Campanha
          </Link>
        ) : (
          <Link to="/">← Meus personagens</Link>
        )}

        {character.campanhaId && (
          <>
            <Link to={"/personagem/" + character.id + "/inventario"}>
              Inventário completo
            </Link>
            <Link to={"/campanha/" + character.campanhaId + "/loja?personagem=" + character.id}>
              Loja da Campanha
            </Link>
            <Link to="/">Meus personagens</Link>
          </>
        )}
      </nav>

      <div className="sheet-banner">
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

        <div className="sheet-heading">
          <h1>{view.nome}</h1>

          <p>
            {view.raca} · {view.classe} · Nível {view.nivel}
          </p>

          {linhaExtra && <p>{linhaExtra}</p>}
        </div>

        <div className="sheet-vitals">
          <StatBar
            label="Vida"
            atual={view.hp.atual}
            max={view.hp.max}
            tone="wine"
          />

          <StatBar
            label="Mana"
            atual={view.mp.atual}
            max={view.mp.max}
            tone="forest"
          />
        </div>
      </div>

      <div className="cs-stats">
        <div className="cs-stat">
          <strong>{10 + modDestreza}</strong>
          <span>Classe de Armadura</span>
        </div>

        <div className="cs-stat">
          <strong>{formatarModificador(modDestreza)}</strong>
          <span>Iniciativa</span>
        </div>

        <div className="cs-stat">
          <strong>{formatarModificador(bonusProficiencia(view.nivel))}</strong>
          <span>Proficiência</span>
        </div>
      </div>

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
              options={CLASSES}
              onChange={(v) => atualizarRascunho("classe", v)}
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
                  atual: Math.max(0, Number(v) || 0),
                })
              }
            />

            <Campo
              rotulo="Vida máxima"
              tipo="number"
              valor={rascunho.hp.max}
              onChange={(v) =>
                atualizarRascunho("hp", {
                  ...rascunho.hp,
                  max: Math.max(1, Number(v) || 1),
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
                  atual: Math.max(0, Number(v) || 0),
                })
              }
            />

            <Campo
              rotulo="Mana máxima"
              tipo="number"
              valor={rascunho.mp.max}
              onChange={(v) =>
                atualizarRascunho("mp", {
                  ...rascunho.mp,
                  max: Math.max(0, Number(v) || 0),
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

      {/* Seção rápida de Vida e Mana */}
      <section className="cs-panel">
        <div className="cs-panel-header">
          <h3>Vida e mana</h3>
          {podeEditar && (
            <small style={{ color: "var(--muted)" }}>
              Você pode digitar valores diretamente nos campos ou usar os atalhos.
            </small>
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
            onAtualizarMax={alterarHpMax}
            onRestaurar={curarTudo}
            textoRestaurar="✨ Curar Total"
          />

          <ControleVital
            titulo="Mana"
            atual={character.mp.atual}
            max={character.mp.max}
            tom="forest"
            passos={[-5, -1, 1, 5]}
            desabilitado={!podeEditar}
            onAtualizarAtual={alterarMp}
            onAtualizarMax={alterarMpMax}
            onRestaurar={restaurarMana}
            textoRestaurar="🧪 Restaurar Mana"
          />
        </div>
      </section>

      {/* Seção de Carteira / Dinheiro */}
      <section className="cs-panel">
        <div className="cs-panel-header">
          <h3>Carteira</h3>
          {podeEditar && (
            <small style={{ color: "var(--muted)" }}>
              Digite a quantia exata de ouro ou utilize os botões de incremento/decremento.
            </small>
          )}
        </div>

        <ControleCarteira
          carteira={carteira}
          desabilitado={!podeEditar}
          onAlterarMoeda={alterarMoeda}
        />
      </section>

      <nav className="sheet-tabs">
        {TABS.map((t) => (
          <button
            key={t}
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
        {tab === "Atributos" && (
          <div className="attribute-grid">
            {(
              Object.keys(
                view.attributes,
              ) as (keyof Attributes)[]
            ).map((attr) => (
              <div key={attr} className="attribute-block">
                <span className="attribute-label">
                  {ATTRIBUTE_LABELS[attr]}
                </span>

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
                  <span className="attribute-value">
                    {valorAtributo(attr)}
                  </span>
                )}

                <span className="attribute-mod">
                  {formatarModificador(modificador(valorAtributo(attr)))}
                </span>
                {!editando && (bonusesPersona[attr as BaseAttributeKey] || bonusesEquipamento[attr]) ? (
                  <small className="attribute-bonus-note">
                    Base {view.attributes[attr]} · Persona {formatarModificador(bonusesPersona[attr as BaseAttributeKey] ?? 0)} · Equipamento {formatarModificador(bonusesEquipamento[attr] ?? 0)}
                  </small>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {tab === "Perícias" && (
          <div>
            <ul className="sheet-list">
              {view.skills.map((skill) => (
                <li key={skill.id}>
                  <span>{skill.nome}</span>

                  <span className="sheet-list-tag">
                    {ATTRIBUTE_LABELS[skill.atributo]} ·{" "}
                    {skill.treinada ? "Treinada" : "Não treinada"}
                  </span>

                  <span className="sheet-list-bonus">
                    {formatarModificador(
                      modificador(valorAtributo(skill.atributo)) +
                      (skill.treinada ? skill.bonus : 0),
                    )}
                  </span>

                  {podeEditar && !editando && (
                    <button
                      type="button"
                      className="cs-btn-icon"
                      onClick={() => handleTogglePericia(skill.id)}
                      title={skill.treinada ? "Tirar treino" : "Treinar perícia"}
                    >
                      {skill.treinada ? "✓ Treinada" : "+ Treinar"}
                    </button>
                  )}
                </li>
              ))}

              {view.skills.length === 0 && (
                <p className="sheet-empty">Nenhuma perícia registrada.</p>
              )}
            </ul>
          </div>
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
                    <select
                      aria-label="Atributo do bônus do equipamento"
                      value={novoItemAtributo}
                      onChange={(event) => setNovoItemAtributo(event.target.value as keyof Attributes | "")}
                    >
                      <option value="">Sem bônus</option>
                      {Object.entries(ATTRIBUTE_LABELS).map(([atributo, rotulo]) => (
                        <option key={atributo} value={atributo}>{rotulo}</option>
                      ))}
                    </select>
                    <input
                      aria-label="Valor do bônus do equipamento"
                      type="number"
                      min={-20}
                      max={20}
                      placeholder="Bônus"
                      value={novoItemBonus}
                      disabled={!novoItemAtributo}
                      onChange={(event) => setNovoItemBonus(Number(event.target.value) || 0)}
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
                  <span>
                    {item.nome}
                    {item.equipado && <small className="equipped-item-tag">Equipado</small>}
                  </span>

                  {item.bonusAtributos && (
                    <span className="sheet-list-tag">
                      {Object.entries(item.bonusAtributos)
                        .filter(([, bonus]) => bonus)
                        .map(([atributo, bonus]) => `${formatarModificador(Number(bonus))} ${ATTRIBUTE_LABELS[atributo as keyof Attributes]}`)
                        .join(" · ")}
                    </span>
                  )}

                  <span className="sheet-list-tag">
                    x{item.quantidade}
                  </span>

                  {podeEditar && !editando && (
                    <div className="cs-list-actions">
                      <button
                        type="button"
                        className="cs-btn-icon"
                        onClick={() => handleToggleEquipamento(item.id)}
                        aria-pressed={Boolean(item.equipado)}
                      >
                        {item.equipado ? "Desequipar" : "Equipar"}
                      </button>
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
                        🗑
                      </button>
                    </div>
                  )}
                </li>
              ))}

              {view.inventory.length === 0 && storeInventory.length === 0 && (
                <p className="sheet-empty">Inventário vazio.</p>
              )}
            </ul>

            {storeInventory.length > 0 && (
              <section className="cs-store-inventory">
                <h3>Comprados na loja</h3>
                <ul className="sheet-list">
                  {storeInventory.map((item) => (
                    <li key={item.itemId}>
                      <span>
                        {item.nome}
                        {item.equipado && <small className="equipped-item-tag">Equipado</small>}
                        {item.efeito && <small className="store-item-effect">{item.efeito}</small>}
                      </span>
                      <span className="sheet-list-tag">x{item.quantidade}</span>
                      {Object.entries(item.bonusAtributos).some(([, bonus]) => bonus) && (
                        <span className="sheet-list-tag">
                          {Object.entries(item.bonusAtributos)
                            .filter(([, bonus]) => bonus)
                            .map(([atributo, bonus]) => `${formatarModificador(Number(bonus))} ${ATTRIBUTE_LABELS[atributo as keyof Attributes]}`)
                            .join(" · ")}
                        </span>
                      )}
                      {podeEditar && !editando && (
                        <button
                          type="button"
                          className="cs-btn-icon"
                          aria-pressed={item.equipado}
                          onClick={() => void handleToggleItemDaLoja(item)}
                        >
                          {item.equipado ? "Desequipar" : "Equipar"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
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
                        🗑
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
    </div>
  );
}