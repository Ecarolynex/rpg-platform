import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Attributes, Character, InventoryItem, Spell, Wallet } from "../../types/character";
import {
  alterarItemEquipado,
  atualizarPersonagem,
  enviarRetrato,
  getCatalogoGlobalClasses,
  getCampaignClassBonuses,
  getCharacterAccess,
  getCharacterById,
  getInventory,
  listarConteudosClasseCampanha,
  type CampaignClassContent,
} from "../../services/api";
import { StatBar } from "../../components/ui/StatBar";
import { OptionField } from "../../components/ui/OptionField";
import {
  RACAS,
  LIMITE_RECURSO,
  bonusProficiencia,
  formatarModificador,
} from "../../data/dnd";
import "./CharacterSheet.css";
import "./CharacterSheetExtras.css";
import {
  ATTRIBUTE_CONFIG,
  DEFAULT_CLASS_CATALOG,
  FIXED_SKILLS,
  obterBonusClasse,
  type ClassDefinition,
  type ClassSkillDefinition,
  type CampaignClassBonuses,
} from "../../data/personaRules";

const ATTRIBUTE_LABELS: Record<keyof Attributes, string> = {
  forca: "Força",
  destreza: "Destreza",
  constituicao: "Constituição",
  inteligencia: "Inteligência",
  carisma: "Carisma",
};

const TABS = [
  "Atributos",
  "Perícias",
  "Habilidades",
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

function completarPericias(
  skills: Character["skills"] = [],
  periciasClasse: ClassSkillDefinition[] = [],
): Character["skills"] {
  const periciasFixas = [...FIXED_SKILLS, ...periciasClasse].map((definition) => {
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
  imagemUrl?: string;
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
    imagem_url: string | null;
  } | Array<{
    nome: string;
    descricao: string | null;
    efeito: string | null;
    imagem_url: string | null;
  }> | null;
};

function bonusAtributosDoEfeito(efeito: string | null | undefined) {
  const bonuses: Partial<Record<keyof Attributes, number>> = {};
  const pattern = /([+-]?\d+)\s*(?:em\s+)?(Força|Destreza|Constituição|Inteligência|Carisma)/gi;

  for (const match of efeito?.matchAll(pattern) ?? []) {
    const atributo = Object.entries(ATTRIBUTE_LABELS).find(
      ([, label]) => label.toLowerCase() === match[2].toLowerCase(),
    )?.[0] as keyof Attributes | undefined;
    if (atributo) bonuses[atributo] = (bonuses[atributo] ?? 0) + Number(match[1]);
  }

  return bonuses;
}

function sanitizarMoeda(valor?: number | null): number {
  if (valor === undefined || valor === null || isNaN(valor) || valor < 0) return 0;
  if (valor >= 9000000000000000) return 1250;
  return Math.min(9999999, Math.floor(valor));
}

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
            <span>Peças de Ouro</span>
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

export default function CharacterSheet() {
  const { id } = useParams<{ id: string }>();
  const [personagem, setPersonagem] = useState<Character | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<Tab>("Atributos");
  const [campaignContents, setCampaignContents] = useState<CampaignClassContent[]>([]);
  const retratoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getCharacterById(id),
      listarConteudosClasseCampanha()
    ])
      .then(([dataChar, dataCamp]) => {
        setPersonagem(dataChar);
        setCampaignContents(dataCamp || []);
      })
      .catch(console.error)
      .finally(() => setCarregando(false));
  }, [id]);

  if (carregando) return <div className="cs-loading">Carregando ficha...</div>;
  if (!personagem) return <div className="cs-error">Personagem não encontrado.</div>;

  // CORREÇÃO DO ERRO DO MAP COM AS PROPRIEDADES OBRIGATÓRIAS
  const classeCampanha = campaignContents
    .filter((item) => item.tipo === "CLASSE")
    .map((item): ClassDefinition => ({
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
      usaMagia: false, // <-- Propriedade Corrigida
      magias: [],      // <-- Propriedade Corrigida
    }));

  const handleUpdateVital = (campo: "hp" | "mp", tipo: "atual" | "max", valor: number) => {
    if (!personagem) return;
    const atualizado = {
      ...personagem,
      [campo]: { ...personagem[campo], [tipo]: valor },
    };
    setPersonagem(atualizado);
