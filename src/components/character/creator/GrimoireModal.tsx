import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  RACAS,
  bonusProficiencia,
  formatarModificador,
  modificador,
} from "../../../data/dnd";
import {
  ATTRIBUTE_CONFIG,
  CLASS_BONUSES,
  RACE_BONUSES,
  type ClassDefinition,
} from "../../../data/personaRules";
import type { DerivedCharacterStats } from "../../../domain/characterRules";
import type { Campaign } from "../../../services/api";
import type { Attributes, Skill } from "../../../types/character";
import { ClassInfoBox } from "../ClassInfoBox";
import type { montarInfoClasse } from "../classInfoUtils";
import {
  playMagicSealSound,
  playScrollRollUpSound,
  playScrollUnrollSound,
} from "./grimoireSound";

export interface CharacterDraftState {
  nome: string;
  raca: string;
  classe: string;
  origem: string;
  qualidades: string;
  idade: string;
  nivel: number;
  historia: string;
  aparencia: string;
  defeito: string;
  forca: number;
  destreza: number;
  constituicao: number;
  inteligencia: number;
  sabedoria?: number;
  carisma: number;
}

export type DraftTextField =
  | "nome"
  | "origem"
  | "qualidades"
  | "idade"
  | "historia"
  | "aparencia"
  | "defeito";

export interface CampaignRulesStatus {
  campaignId: string;
  status: "idle" | "loading" | "ready" | "error";
  message?: string;
}

export interface GrimoireModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  saving: boolean;
  draft: CharacterDraftState;
  updateDraft: <K extends keyof CharacterDraftState>(
    field: K,
    value: CharacterDraftState[K],
  ) => void;
  updateAttribute: (field: keyof Attributes, value: number) => void;
  textProps: (field: DraftTextField) => {
    value: string;
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  };
  eligibleCampaigns: Campaign[];
  campaigns: Campaign[];
  selectedCampaignId: string;
  onSelectCampaign: (campaignId: string) => void;
  campaignRulesState: CampaignRulesStatus;
  campaignRulesReady: boolean;
  onRetryCampaignRules: () => void;
  creatorJoinCode: string;
  onChangeJoinCode: (value: string) => void;
  creatorCodeBusy: boolean;
  creatorCodeError: string;
  creatorCodeSuccess: string;
  onJoinCampaignByCode: () => Promise<boolean | void> | boolean | void;
  classesParaCriacao: ClassDefinition[];
  onSelectClass: (nome: string) => void;
  infoClasse: ReturnType<typeof montarInfoClasse>;
  liveCharacterStats: DerivedCharacterStats;
  hpMaxInicial: number;
  mpMaxInicial: number;
  classHpBonus: number;
  classMpBonus: number;
  customHpMax: number | null;
  setCustomHpMax: (value: number | null) => void;
  customMpMax: number | null;
  setCustomMpMax: (value: number | null) => void;
  skillsDraft: Skill[];
  onToggleSkill: (skillId: string) => void;
  selectedAbilities: string[];
  onToggleAbility: (nome: string) => void;
  classRevalidationNotice: string;
  portraitPreview: string;
  onPortraitChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPortraitFileDrop?: (file: File) => void;
}

type ScrollSectionMode = 1 | 2 | 3 | "all";

const SCROLL_SECTIONS: {
  page: 1 | 2 | 3;
  roman: string;
  title: string;
  subtitle: string;
}[] = [
  {
    page: 1,
    roman: "I",
    title: "Campanha & Identidade",
    subtitle: "Pacto de mesa, linhagem, retrato em cera e crônica",
  },
  {
    page: 2,
    roman: "II",
    title: "Atributos & Vitalidade",
    subtitle: "Medalhões de pedra/metal e reservas vitais em madeira e bronze",
  },
  {
    page: 3,
    roman: "III",
    title: "Perícias & Selo",
    subtitle: "Runas de proficiência, talentos de classe e selo real",
  },
];

const SPARK_PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const distance = 58 + (i % 3) * 26;
  return {
    id: i,
    tx: `${Math.cos(angle) * distance}px`,
    ty: `${Math.sin(angle) * distance}px`,
  };
});

const RUSTLE_PARTICLES = Array.from({ length: 22 }, (_, i) => {
  const side = i % 2 === 0 ? -1 : 1;
  return {
    id: i,
    left: `${8 + ((i * 19) % 84)}%`,
    top: `${12 + ((i * 29) % 76)}%`,
    dx: `${side * (28 + (i % 5) * 14)}px`,
    dy: `${(i % 2 === 0 ? -1 : 1) * (18 + (i % 4) * 12)}px`,
    delay: `${(i % 6) * 0.04}s`,
    size: `${3 + (i % 4)}px`,
  };
});

function rotuloAtributo(valor: string): string {
  const porChave = ATTRIBUTE_CONFIG.find((item) => String(item.key) === valor);
  return porChave ? porChave.label : valor;
}

export function GrimoireModal({
  open,
  onClose,
  onSubmit,
  saving,
  draft,
  updateDraft,
  updateAttribute,
  textProps,
  eligibleCampaigns,
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  campaignRulesState,
  campaignRulesReady,
  onRetryCampaignRules,
  creatorJoinCode,
  onChangeJoinCode,
  creatorCodeBusy,
  creatorCodeError,
  creatorCodeSuccess,
  onJoinCampaignByCode,
  classesParaCriacao,
  onSelectClass,
  infoClasse,
  liveCharacterStats,
  hpMaxInicial,
  mpMaxInicial,
  classHpBonus,
  classMpBonus,
  customHpMax,
  setCustomHpMax,
  customMpMax,
  setCustomMpMax,
  skillsDraft,
  onToggleSkill,
  selectedAbilities,
  onToggleAbility,
  classRevalidationNotice,
  portraitPreview,
  onPortraitChange,
  onPortraitFileDrop,
}: GrimoireModalProps) {
  const reduceMotion = useReducedMotion();
  const [currentSection, setCurrentSection] = useState<ScrollSectionMode>(1);
  const [sabedoriaLocal, setSabedoriaLocal] = useState<number>(draft.sabedoria ?? 10);
  const [isDraggingToken, setIsDraggingToken] = useState(false);
  const [sealBurst, setSealBurst] = useState(false);
  const [isRollingUp, setIsRollingUp] = useState(false);
  const [rustleKey, setRustleKey] = useState(0);
  const [stepGateError, setStepGateError] = useState("");
  const [hoveredRaceHint, setHoveredRaceHint] = useState(false);
  const [hoveredClassHint, setHoveredClassHint] = useState(false);
  const [scrollTheme, setScrollTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("elementum_scroll_theme") as "light" | "dark") || "light";
  });
  const toggleScrollTheme = () => {
    setScrollTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("elementum_scroll_theme", next);
      return next;
    });
  };
  const closeTimerRef = useRef<number | null>(null);
  const campaignCodeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setIsRollingUp(false);
      setCurrentSection(1);
      setStepGateError("");
      setRustleKey((prev) => prev + 1);
      playScrollUnrollSound();
    }
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (selectedCampaignId) {
      setStepGateError("");
    }
  }, [selectedCampaignId]);

  if (!open) return null;

  const nivelNum = Math.max(1, Math.min(20, Number(draft.nivel) || 1));
  const currentHpValue = customHpMax !== null ? customHpMax : hpMaxInicial;
  const currentMpValue = customMpMax !== null ? customMpMax : mpMaxInicial;
  const hpBarPercent = Math.max(8, Math.min(100, Math.round((currentHpValue / 300) * 100)));
  const mpBarPercent = Math.max(8, Math.min(100, Math.round((currentMpValue / 300) * 100)));

  const raceBonusDescription = draft.raca
    ? RACE_BONUSES[draft.raca]?.descricao ?? "Linhagem ancestral de Elementum."
    : "Selecione uma raça para inspecionar sua herança ancestral.";

  const classBonusDescription = draft.classe
    ? CLASS_BONUSES[draft.classe]?.descricao ??
      infoClasse?.descricao ??
      "Caminho marcial ou arcano de Elementum."
    : "Selecione uma classe para revelar seus bônus e talentos.";

  async function goToSection(targetSection: ScrollSectionMode) {
    if (targetSection === currentSection) return;

    if (targetSection !== 1 && !selectedCampaignId) {
      if (creatorJoinCode.trim()) {
        const linked = await onJoinCampaignByCode();
        if (linked === true) {
          setStepGateError("");
          setCurrentSection(targetSection);
          setRustleKey((prev) => prev + 1);
          playScrollUnrollSound();
          return;
        }
        setCurrentSection(1);
        campaignCodeInputRef.current?.focus();
        return;
      }

      setStepGateError(
        "Informe e vincule o código da campanha (ou selecione uma campanha ativa) antes de avançar para a próxima página.",
      );
      setCurrentSection(1);
      campaignCodeInputRef.current?.focus();
      return;
    }

    setStepGateError("");
    setCurrentSection(targetSection);
    setRustleKey((prev) => prev + 1);
    playScrollUnrollSound();
  }

  function handleRequestClose() {
    if (saving || isRollingUp) return;
    if (reduceMotion) {
      onClose();
      return;
    }
    setIsRollingUp(true);
    setRustleKey((prev) => prev + 1);
    playScrollRollUpSound();
    closeTimerRef.current = window.setTimeout(() => {
      setIsRollingUp(false);
      onClose();
    }, 560);
  }

  function stepAge(delta: number) {
    const parsed = parseInt(String(draft.idade).replace(/\D+/g, ""), 10);
    const base = Number.isFinite(parsed) ? parsed : 20;
    const next = Math.max(1, Math.min(999, base + delta));
    updateDraft("idade", `${next} anos`);
  }

  function handleTokenDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDraggingToken(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/") && onPortraitFileDrop) {
      onPortraitFileDrop(file);
    }
  }

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    setSealBurst(true);
    playMagicSealSound();
    setTimeout(() => setSealBurst(false), 900);
    await onSubmit(event);
  }

  const submitButtonLabel = saving
    ? "Salvando..."
    : !selectedCampaignId
      ? "Selecione uma campanha"
      : campaignRulesState.status === "loading"
        ? "Carregando regras..."
        : "Salvar personagem";

  const activeRoman =
    currentSection === "all"
      ? "I–III"
      : SCROLL_SECTIONS[currentSection - 1].roman;

  const isSectionVisible = (sec: 1 | 2 | 3) =>
    currentSection === "all" || currentSection === sec;

  const modalContent = (
    <div
      className={`grimoire-modal-overlay${isRollingUp ? " is-rolling-up" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="grimoire-creator-heading"
    >
      {/* ====================================================================
          SILK RIBBON & WAX SEAL ANIMATION LAYER (Unties on open, wraps on close)
         ==================================================================== */}
      <div className="scroll-ribbon-stage" aria-hidden="true">
        {/* Left Crimson & Gold Silk Ribbon Tail */}
        <motion.div
          className="scroll-ribbon-band scroll-ribbon-band--left"
          initial={reduceMotion ? { opacity: 0 } : { x: 0, scaleX: 1, opacity: 1 }}
          animate={
            isRollingUp
              ? { x: 0, scaleX: 1, opacity: [0, 1, 1, 0] }
              : { x: -520, scaleX: 1.18, opacity: 0 }
          }
          transition={{
            duration: reduceMotion ? 0.05 : isRollingUp ? 0.52 : 0.62,
            ease: [0.22, 1, 0.36, 1],
          }}
        />

        {/* Right Crimson & Gold Silk Ribbon Tail */}
        <motion.div
          className="scroll-ribbon-band scroll-ribbon-band--right"
          initial={reduceMotion ? { opacity: 0 } : { x: 0, scaleX: 1, opacity: 1 }}
          animate={
            isRollingUp
              ? { x: 0, scaleX: 1, opacity: [0, 1, 1, 0] }
              : { x: 520, scaleX: 1.18, opacity: 0 }
          }
          transition={{
            duration: reduceMotion ? 0.05 : isRollingUp ? 0.52 : 0.62,
            ease: [0.22, 1, 0.36, 1],
          }}
        />

        {/* Center Silk Knot & Royal Wax Seal */}
        <motion.div
          className="scroll-ribbon-knot"
          initial={
            reduceMotion
              ? { opacity: 0 }
              : { scale: 1.15, rotate: 0, y: 0, opacity: 1 }
          }
          animate={
            isRollingUp
              ? { scale: [0.6, 1.08, 0.9], rotate: [18, 0, -6], opacity: [0, 1, 0] }
              : { scale: 0.45, rotate: -28, y: 80, opacity: 0 }
          }
          transition={{
            duration: reduceMotion ? 0.05 : isRollingUp ? 0.54 : 0.56,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <span className="scroll-ribbon-knot__emblem">⚜</span>
        </motion.div>
      </div>

      {/* Soft Parchment Rustling & Fiber Particles */}
      <div key={`rustle-${rustleKey}`} className="scroll-rustle-particles" aria-hidden="true">
        {RUSTLE_PARTICLES.map((p) => (
          <span
            key={p.id}
            className="scroll-rustle-mote"
            style={
              {
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                animationDelay: p.delay,
                "--dx": p.dx,
                "--dy": p.dy,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* ====================================================================
          ANCIENT MAGICAL PARCHMENT SCROLL CONTAINER (Rolls Out & Rolls Up)
         ==================================================================== */}
      <motion.div
        className={`grimoire-book-shell scroll-manuscript-shell scroll-theme--${scrollTheme}`}
        initial={
          reduceMotion
            ? { opacity: 0 }
            : {
                opacity: 0,
                scaleY: 0.05,
                scaleX: 0.78,
                y: 12,
              }
        }
        animate={
          isRollingUp
            ? {
                opacity: 0,
                scaleY: 0.04,
                scaleX: 0.74,
                y: 16,
              }
            : {
                opacity: 1,
                scaleY: 1,
                scaleX: 1,
                y: 0,
              }
        }
        transition={{
          duration: reduceMotion ? 0.12 : isRollingUp ? 0.52 : 0.68,
          delay: reduceMotion || isRollingUp ? 0 : 0.12,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {/* TOP WOOD & BRONZE SCROLL ROLLER WITH CARVED GOLD FINIALS */}
        <div className="scroll-roller scroll-roller--top" aria-hidden="true"><div className="scroll-roller__trim" /></div>

        {/* UNROLLED PARCHMENT SHEET BODY */}
        <div className="scroll-parchment-body">
          {/* Decorative Corner Accents */}

          <form className="character-creator grimoire-form" onSubmit={handleFormSubmit}>
            {/* Deep Emerald & Gold Illuminated Scroll Header */}
            <header className="creator-banner grimoire-header scroll-manuscript-header">
              <div className="grimoire-header__top">
                <div className="grimoire-header__titles">
                  <span className="creator-kicker">
                    Pergaminho Ancestral de Linhagens · Seção {activeRoman}
                  </span>
                  <h2 id="grimoire-creator-heading">Criação de personagem</h2>
                  {selectedCampaignId && (
                    <p className="creator-subtitle">
                      Campanha vinculada:{" "}
                      <strong>
                        {campaigns.find((c) => c.id === selectedCampaignId)?.nome}
                      </strong>
                    </p>
                  )}
                </div>

                <div className="grimoire-header__actions">
                  <div
                    className="grimoire-wax-clasp"
                    aria-hidden="true"
                    title="Selo Real de Elementum"
                  >
                    <div className="grimoire-wax-clasp__medal">
                      <span>⚜</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="grimoire-theme-toggle-btn"
                    onClick={toggleScrollTheme}
                    title={scrollTheme === "light" ? "Mudar para Grimório (Modo Escuro)" : "Mudar para Pergaminho (Modo Claro)"}
                    aria-label="Alternar tema do pergaminho"
                  >
                    <span aria-hidden="true">{scrollTheme === "light" ? "Grimório" : "Pergaminho"}</span>
                  </button>
                  <span className="creator-badge">Elementum</span>
                  <button
                    type="button"
                    className="grimoire-close-btn scroll-wax-close-btn"
                    onClick={handleRequestClose}
                    disabled={saving}
                    aria-label="Fechar pergaminho"
                    title="Enrolar e fechar pergaminho"
                  >
                    <span aria-hidden="true">✕</span>
                    <span className="scroll-wax-close-btn__text">Fechar</span>
                  </button>
                </div>
              </div>

              {/* Scroll Section Seals Navigation */}
              <nav className="grimoire-bookmarks scroll-section-nav" aria-label="Seções do Pergaminho">
                {SCROLL_SECTIONS.map((item) => {
                  const active = currentSection === item.page;
                  const locked = item.page !== 1 && !selectedCampaignId;
                  return (
                    <button
                      key={item.page}
                      type="button"
                      className={`grimoire-bookmark${active ? " is-active" : ""}${
                        locked ? " is-locked" : ""
                      }`}
                      onClick={() => void goToSection(item.page)}
                      aria-current={active ? "step" : undefined}
                      title={
                        locked
                          ? "Vincule o código da campanha na Seção I para desbloquear"
                          : item.subtitle
                      }
                    >
                      <span className="grimoire-bookmark__roman">
                        Seção {item.roman} {locked ? " (bloqueado)" : ""}
                      </span>
                      <span className="grimoire-bookmark__label">{item.title}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`grimoire-bookmark grimoire-bookmark--all${
                    currentSection === "all" ? " is-active" : ""
                  }${!selectedCampaignId ? " is-locked" : ""}`}
                  onClick={() => void goToSection("all")}
                  aria-current={currentSection === "all" ? "step" : undefined}
                  title={
                    !selectedCampaignId
                      ? "Vincule o código da campanha na Seção I para desbloquear"
                      : "Visualizar todas as seções desenroladas"
                  }
                >
                  <span className="grimoire-bookmark__roman">
                    Pergaminho {!selectedCampaignId ? " (bloqueado)" : ""}
                  </span>
                  <span className="grimoire-bookmark__label">Visão Completa</span>
                </button>
              </nav>
            </header>

            {/* Unrolled Manuscript Viewport */}
            <div className="grimoire-book-viewport scroll-manuscript-viewport">
              <AnimatePresence mode="sync" initial={false}>
                <motion.div
                  key={`scroll-wave-${String(currentSection)}`}
                  className="scroll-unroll-wave-fx"
                  initial={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0.65, scaleY: 0.12, transformOrigin: "top center" }
                  }
                  animate={{ opacity: 0, scaleY: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: reduceMotion ? 0.05 : 0.48,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  aria-hidden="true"
                />
              </AnimatePresence>

              {/* ============================================================
                  SECTION 1: CAMPANHA & IDENTIDADE
                 ============================================================ */}
              <div
                className={`grimoire-spread${
                  isSectionVisible(1)
                    ? " grimoire-spread--active"
                    : " grimoire-spread--hidden"
                }`}
                data-page="1"
              >
                {/* LEFT COLUMN: Campaign & Core Identity */}
                <section className="grimoire-leaf grimoire-leaf--left">
                  <div className="grimoire-leaf__header">
                    <span className="grimoire-leaf__folio">Seção I · Parte A</span>
                    <h3>1. Campanha & Identidade</h3>
                  </div>

                  {/* Campaign Code + Selection */}
                  <div className="grimoire-section-box">
                    <p className="creator-skill-hint">
                      Selecione uma campanha ativa ou vincule o código real fornecido pelo Mestre.
                    </p>

                    <div className="creator-code-join-box">
                      <label className="field">
                        <span>Vincular por código de convite</span>
                        <div className="creator-code-input-row">
                          <input
                            ref={campaignCodeInputRef}
                            id="creator-campaign-code-input"
                            type="text"
                            placeholder="Ex.: ABC12345"
                            value={creatorJoinCode}
                            aria-label="Código de convite da campanha"
                            onChange={(e) => {
                              setStepGateError("");
                              onChangeJoinCode(e.target.value.toUpperCase());
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (creatorJoinCode.trim() && !creatorCodeBusy) {
                                  void onJoinCampaignByCode();
                                }
                              }
                            }}
                            disabled={creatorCodeBusy}
                          />
                          <button
                            type="button"
                            className="btn-primary grimoire-gold-btn"
                            disabled={creatorCodeBusy || !creatorJoinCode.trim()}
                            onClick={() => void onJoinCampaignByCode()}
                          >
                            {creatorCodeBusy ? "Vinculando..." : "Vincular Código"}
                          </button>
                        </div>
                      </label>
                      {stepGateError && (
                        <p className="creator-code-error grimoire-step-gate-alert" role="alert">
                          {stepGateError}
                        </p>
                      )}
                      {creatorCodeError && (
                        <p className="creator-code-error" role="alert">
                          {creatorCodeError}
                        </p>
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
                            onChange={(event) => onSelectCampaign(event.target.value)}
                          >
                            <option value="">Selecione a campanha antes de criar...</option>
                            {eligibleCampaigns.map((campaign) => (
                              <option key={campaign.id} value={campaign.id}>
                                {campaign.nome}
                              </option>
                            ))}
                          </select>

                          {selectedCampaignId &&
                            campaignRulesState.campaignId === selectedCampaignId &&
                            campaignRulesState.status === "loading" && (
                              <span role="status" className="grimoire-rules-loading">
                                Carregando regras da campanha...
                              </span>
                            )}
                          {selectedCampaignId &&
                            campaignRulesState.campaignId === selectedCampaignId &&
                            campaignRulesState.status === "error" && (
                              <span className="dashboard-status" role="alert">
                                {campaignRulesState.message}{" "}
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  onClick={onRetryCampaignRules}
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
                                className={
                                  isSelected
                                    ? "creator-camp-card creator-camp-card--selected"
                                    : "creator-camp-card"
                                }
                                onClick={() => onSelectCampaign(camp.id)}
                              >
                                <div className="creator-camp-card-top">
                                  <strong>{camp.nome}</strong>
                                  <span className="creator-camp-tag">
                                    {camp.sistema || "Elementum"}
                                  </span>
                                </div>
                                {camp.descricao && <p>{camp.descricao}</p>}
                                <small>Ouro inicial: {camp.ouro_inicial ?? 0} PO</small>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="creator-campaign-alert" role="alert">
                        <p>
                          Você ainda não participa de nenhuma campanha ativa. Digite o código de
                          convite acima para ingressar na mesa do seu Mestre.
                        </p>
                        <Link to="/campanhas" className="btn-ghost">
                          Ver minhas campanhas
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Core Identity Fields */}
                  <div className="field-grid grimoire-identity-grid">
                    <label className="field field-wide">
                      <span>Nome do personagem</span>
                      <input
                        id="nome-personagem"
                        className="grimoire-name-input"
                        placeholder="Ex.: Elira Fenra, Sor Vaelen..."
                        {...textProps("nome")}
                      />
                    </label>

                    {/* Race Dropdown with Custom Scroll Tooltip */}
                    <div
                      className="field grimoire-select-field"
                      onMouseEnter={() => setHoveredRaceHint(true)}
                      onMouseLeave={() => setHoveredRaceHint(false)}
                    >
                      <label htmlFor="grimoire-raca-select">
                        <span>Raça</span>
                      </label>
                      <div className="grimoire-select-wrap">
                        <select
                          id="grimoire-raca-select"
                          aria-label="Raça"
                          value={draft.raca}
                          onChange={(e) => updateDraft("raca", e.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {RACAS.map((raca) => (
                            <option key={raca} value={raca}>
                              {raca}
                            </option>
                          ))}
                        </select>
                      </div>
                      {hoveredRaceHint && (
                        <div className="grimoire-select-tooltip" role="tooltip">
                          <strong>{draft.raca || "Linhagens do Reino"}:</strong>{" "}
                          {raceBonusDescription}
                        </div>
                      )}
                    </div>

                    {/* Class Dropdown with Custom Scroll Tooltip */}
                    <div
                      className="field grimoire-select-field"
                      onMouseEnter={() => setHoveredClassHint(true)}
                      onMouseLeave={() => setHoveredClassHint(false)}
                    >
                      <label htmlFor="grimoire-classe-select">
                        <span>Classe</span>
                      </label>
                      <div className="grimoire-select-wrap">
                        <select
                          id="grimoire-classe-select"
                          aria-label="Classe"
                          value={draft.classe}
                          onChange={(e) => onSelectClass(e.target.value)}
                        >
                          <option value="">
                            {!selectedCampaignId
                              ? "Vincule uma campanha primeiro..."
                              : campaignRulesState.status === "loading" &&
                                  classesParaCriacao.length === 0
                                ? "Carregando classes liberadas..."
                                : classesParaCriacao.length === 0
                                  ? "Nenhuma classe liberada pelo Mestre"
                                  : "Selecione..."}
                          </option>
                          {classesParaCriacao.map((classe) => (
                            <option key={classe.id} value={classe.nome}>
                              {classe.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      {hoveredClassHint && (
                        <div className="grimoire-select-tooltip" role="tooltip">
                          <strong>{draft.classe || "Vocação Heroica"}:</strong>{" "}
                          {classBonusDescription}
                        </div>
                      )}
                    </div>

                    <div className="field field-wide">
                      <span>Sobre a classe</span>
                      <ClassInfoBox
                        info={infoClasse}
                        mensagemVazia="Escolha uma classe para ver a descrição e os bônus."
                      />
                    </div>

                    {/* Level with Medieval +/- Increment Arrows */}
                    <div className="field">
                      <label htmlFor="nivel-personagem">
                        <span>Nível</span>
                      </label>
                      <div className="grimoire-stepper">
                        <button
                          type="button"
                          className="grimoire-stepper__btn"
                          aria-label="Diminuir nível"
                          onClick={() => updateDraft("nivel", Math.max(1, nivelNum - 1))}
                        >
                          −
                        </button>
                        <input
                          id="nivel-personagem"
                          aria-label="Nível"
                          type="number"
                          min={1}
                          max={20}
                          value={draft.nivel}
                          onChange={(event) =>
                            updateDraft("nivel", Number(event.target.value) || 1)
                          }
                        />
                        <button
                          type="button"
                          className="grimoire-stepper__btn"
                          aria-label="Aumentar nível"
                          onClick={() => updateDraft("nivel", Math.min(20, nivelNum + 1))}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Age with Medieval +/- Increment Arrows */}
                    <div className="field">
                      <label htmlFor="idade-personagem">
                        <span>Idade</span>
                      </label>
                      <div className="grimoire-stepper">
                        <button
                          type="button"
                          className="grimoire-stepper__btn"
                          aria-label="Diminuir idade"
                          onClick={() => stepAge(-1)}
                        >
                          −
                        </button>
                        <input
                          id="idade-personagem"
                          aria-label="Idade"
                          placeholder="24 anos"
                          {...textProps("idade")}
                        />
                        <button
                          type="button"
                          className="grimoire-stepper__btn"
                          aria-label="Aumentar idade"
                          onClick={() => stepAge(1)}
                        >
                          +
                        </button>
                      </div>
                    </div>

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
                  </div>
                </section>

                {/* RIGHT COLUMN: Wax-Seal Avatar Frame & Handwritten Ink Notes */}
                <section className="grimoire-leaf grimoire-leaf--right">
                  <div className="grimoire-leaf__header">
                    <span className="grimoire-leaf__folio">Seção I · Parte B</span>
                    <h3>2. Retrato, Feições e Crônica</h3>
                  </div>

                  {/* Character Avatar Upload Frame with Wax-Seal Border */}
                  <div className="field field-wide">
                    <span>Foto do personagem (opcional)</span>
                    <label
                      className={`grimoire-token-dropzone${
                        isDraggingToken ? " is-dragging" : ""
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingToken(true);
                      }}
                      onDragLeave={() => setIsDraggingToken(false)}
                      onDrop={handleTokenDrop}
                    >
                      <div className="grimoire-wax-frame">
                        {portraitPreview ? (
                          <img
                            className="creator-photo-preview grimoire-wax-frame__img"
                            src={portraitPreview}
                            alt="Prévia da foto"
                          />
                        ) : (
                          <div className="grimoire-wax-frame__placeholder" aria-hidden="true">
                            <span>⚜</span>
                            <small>Selo</small>
                          </div>
                        )}
                      </div>
                      <div className="grimoire-token-dropzone__copy">
                        <strong>Retrato ou Token do Aventureiro</strong>
                        <p>
                          Arraste uma iluminura para esta moldura de selo de cera ou clique
                          para escolher dos seus pergaminhos.
                        </p>
                        <span className="grimoire-file-trigger-badge" aria-hidden="true">
                          ✦ Escolher Iluminura
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="grimoire-file-input-sr"
                          onChange={onPortraitChange}
                        />
                      </div>
                    </label>
                  </div>

                  <div className="grimoire-parchment-notes">
                    <label className="field field-wide">
                      <span>Qualidades</span>
                      <textarea
                        className="grimoire-script-textarea"
                        rows={2}
                        placeholder="Corajoso, leal, curioso, juramentado..."
                        {...textProps("qualidades")}
                      />
                    </label>

                    <label className="field field-wide">
                      <span>Aparência</span>
                      <textarea
                        className="grimoire-script-textarea"
                        rows={3}
                        placeholder="Olhos, cicatrizes, manto de viagem, insígnias..."
                        {...textProps("aparencia")}
                      />
                    </label>

                    <label className="field field-wide">
                      <span>História do personagem</span>
                      <textarea
                        id="historia-personagem"
                        className="grimoire-script-textarea grimoire-script-textarea--tall"
                        rows={5}
                        placeholder="Descreva como ele chegou ao mundo de Elementum..."
                        {...textProps("historia")}
                      />
                    </label>
                  </div>

                  {currentSection !== "all" && (
                    <div className="grimoire-leaf__footer">
                      <button
                        type="button"
                        className="btn-ghost scroll-stone-btn"
                        onClick={handleRequestClose}
                        disabled={saving}
                      >
                        ✕ Enrolar e Fechar
                      </button>
                      <button
                        type="button"
                        className="btn-primary grimoire-next-page-btn"
                        disabled={creatorCodeBusy}
                        onClick={() => void goToSection(2)}
                      >
                        {creatorCodeBusy
                          ? "Validando Código..."
                          : "Desenrolar Seção II: Atributos & Vitalidade ➔"}
                      </button>
                    </div>
                  )}
                </section>
              </div>

              {/* ============================================================
                  SECTION 2: ATRIBUTOS & VITALIDADE
                 ============================================================ */}
              <div
                className={`grimoire-spread${
                  isSectionVisible(2)
                    ? " grimoire-spread--active"
                    : " grimoire-spread--hidden"
                }`}
                data-page="2"
              >
                {/* LEFT COLUMN: Circular Stone/Metallic Attribute Slots */}
                <section className="grimoire-leaf grimoire-leaf--left">
                  <div className="grimoire-leaf__header">
                    <span className="grimoire-leaf__folio">Seção II · Parte A</span>
                    <h3>3. Atributos Primários</h3>
                  </div>
                  <p className="creator-skill-hint">
                    Forje os pilares físicos e mentais do seu personagem. Os engastes circulares
                    de pedra e bronze exibem o valor total e o modificador de teste.
                  </p>

                  <div className="grimoire-medallion-grid">
                    {ATTRIBUTE_CONFIG.map(({ key, label, abbr }) => {
                      const baseVal = Number(draft[key]) || 10;
                      const finalVal = liveCharacterStats.attributesFinal[key];
                      const bonusVal = liveCharacterStats.attributeBonuses[key];
                      const modStr = formatarModificador(modificador(finalVal));

                      return (
                        <div key={key} className="grimoire-medallion">
                          <div className="grimoire-medallion__ring">
                            <span className="grimoire-medallion__abbr">{abbr}</span>
                            <span className="grimoire-medallion__mod">{modStr}</span>
                          </div>

                          <label htmlFor={`attr-${key}`} className="grimoire-medallion__label">
                            <span>{label}</span>
                          </label>

                          <div className="grimoire-medallion__controls">
                            <button
                              type="button"
                              className="grimoire-stepper__btn"
                              aria-label={`Diminuir ${label}`}
                              onClick={() =>
                                updateAttribute(key, Math.max(1, baseVal - 1))
                              }
                            >
                              −
                            </button>
                            <input
                              id={`attr-${key}`}
                              aria-label={label}
                              type="number"
                              min={1}
                              max={20}
                              value={draft[key]}
                              onChange={(event) =>
                                updateAttribute(key, Number(event.target.value) || 1)
                              }
                            />
                            <button
                              type="button"
                              className="grimoire-stepper__btn"
                              aria-label={`Aumentar ${label}`}
                              onClick={() =>
                                updateAttribute(key, Math.min(20, baseVal + 1))
                              }
                            >
                              +
                            </button>
                          </div>

                          <small className="grimoire-medallion__meta">
                            Total: {finalVal} ({modStr})
                            {bonusVal !== 0
                              ? ` · Bônus ${bonusVal > 0 ? "+" : ""}${bonusVal}`
                              : ""}
                          </small>
                        </div>
                      );
                    })}

                    {/* 6th Classical Tabletop Medallion: Sabedoria */}
                    <div className="grimoire-medallion">
                      <div className="grimoire-medallion__ring">
                        <span className="grimoire-medallion__abbr">SAB</span>
                        <span className="grimoire-medallion__mod">
                          {formatarModificador(modificador(sabedoriaLocal))}
                        </span>
                      </div>

                      <label htmlFor="attr-sabedoria" className="grimoire-medallion__label">
                        <span>Sabedoria</span>
                      </label>

                      <div className="grimoire-medallion__controls">
                        <button
                          type="button"
                          className="grimoire-stepper__btn"
                          aria-label="Diminuir Sabedoria"
                          onClick={() =>
                            setSabedoriaLocal((val) => Math.max(1, val - 1))
                          }
                        >
                          −
                        </button>
                        <input
                          id="attr-sabedoria"
                          aria-label="Sabedoria"
                          type="number"
                          min={1}
                          max={20}
                          value={sabedoriaLocal}
                          onChange={(event) =>
                            setSabedoriaLocal(
                              Math.max(1, Math.min(20, Number(event.target.value) || 10)),
                            )
                          }
                        />
                        <button
                          type="button"
                          className="grimoire-stepper__btn"
                          aria-label="Aumentar Sabedoria"
                          onClick={() =>
                            setSabedoriaLocal((val) => Math.min(20, val + 1))
                          }
                        >
                          +
                        </button>
                      </div>

                      <small className="grimoire-medallion__meta">
                        Total: {sabedoriaLocal} ({formatarModificador(modificador(sabedoriaLocal))}) · Espírito
                      </small>
                    </div>
                  </div>
                </section>

                {/* RIGHT COLUMN: Life (PV) & Mana (PM) in Aged Wood & Bronze Frames */}
                <section className="grimoire-leaf grimoire-leaf--right">
                  <div className="grimoire-leaf__header">
                    <span className="grimoire-leaf__folio">Seção II · Parte B</span>
                    <h3>4. Vitalidade e Mana</h3>
                  </div>
                  <p className="creator-skill-hint">
                    Os valores máximos sugeridos iniciam em 200 PV / 200 PM mais bônus de
                    classe, engastados em molduras de madeira nobre e bronze antigo.
                  </p>

                  <div className="grimoire-vitals-stack">
                    {/* HP METER */}
                    <div className="creator-vital-card creator-vital-card--hp grimoire-vital-forged">
                      <div className="creator-vital-header">
                        <span>Pontos de Vida (PV Máximo)</span>
                        <div className="grimoire-vital-input-group">
                          <button
                            type="button"
                            className="grimoire-stepper__btn"
                            aria-label="Reduzir PV em 10"
                            onClick={() =>
                              setCustomHpMax(Math.max(1, currentHpValue - 10))
                            }
                          >
                            −10
                          </button>
                          <input
                            id="hp-max-input"
                            type="number"
                            className="creator-vital-input"
                            min={1}
                            max={9999}
                            value={currentHpValue}
                            aria-label="Pontos de Vida (PV Máximo)"
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomHpMax(
                                val === "" ? null : Math.max(1, Number(val)),
                              );
                            }}
                          />
                          <button
                            type="button"
                            className="grimoire-stepper__btn"
                            aria-label="Aumentar PV em 10"
                            onClick={() =>
                              setCustomHpMax(Math.min(9999, currentHpValue + 10))
                            }
                          >
                            +10
                          </button>
                        </div>
                      </div>

                      {/* Aged Wood & Bronze Progress Bar (Crimson Red) */}
                      <div className="grimoire-meter-frame" aria-hidden="true">
                        <div
                          className="grimoire-meter-fill grimoire-meter-fill--hp"
                          style={{ width: `${hpBarPercent}%` }}
                        />
                        <span className="grimoire-meter-text">
                          {currentHpValue} / {currentHpValue} PV
                        </span>
                      </div>

                      <p className="creator-vital-breakdown">
                        Base: 200 PV{" "}
                        {classHpBonus !== 0
                          ? `· Ajuste da Classe: ${
                              classHpBonus > 0 ? `+${classHpBonus}` : classHpBonus
                            }`
                          : "· Sem ajuste adicional de classe"}
                      </p>
                      <small className="creator-vital-cap">
                        Moldura em carvalho e bronze · Editável na ficha
                      </small>
                    </div>

                    {/* MP METER */}
                    <div className="creator-vital-card creator-vital-card--mp grimoire-vital-forged">
                      <div className="creator-vital-header">
                        <span>Pontos de Mana (PM Máximo)</span>
                        <div className="grimoire-vital-input-group">
                          <button
                            type="button"
                            className="grimoire-stepper__btn"
                            aria-label="Reduzir PM em 10"
                            onClick={() =>
                              setCustomMpMax(Math.max(0, currentMpValue - 10))
                            }
                          >
                            −10
                          </button>
                          <input
                            id="mp-max-input"
                            type="number"
                            className="creator-vital-input"
                            min={0}
                            max={9999}
                            value={currentMpValue}
                            aria-label="Pontos de Mana (PM Máximo)"
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomMpMax(
                                val === "" ? null : Math.max(0, Number(val)),
                              );
                            }}
                          />
                          <button
                            type="button"
                            className="grimoire-stepper__btn"
                            aria-label="Aumentar PM em 10"
                            onClick={() =>
                              setCustomMpMax(Math.min(9999, currentMpValue + 10))
                            }
                          >
                            +10
                          </button>
                        </div>
                      </div>

                      {/* Aged Wood & Bronze Progress Bar (Arcane Sapphire Blue) */}
                      <div className="grimoire-meter-frame" aria-hidden="true">
                        <div
                          className="grimoire-meter-fill grimoire-meter-fill--mp"
                          style={{ width: `${mpBarPercent}%` }}
                        />
                        <span className="grimoire-meter-text">
                          {currentMpValue} / {currentMpValue} PM
                        </span>
                      </div>

                      <p className="creator-vital-breakdown">
                        Base: 200 PM{" "}
                        {classMpBonus !== 0
                          ? `· Ajuste da Classe: ${
                              classMpBonus > 0 ? `+${classMpBonus}` : classMpBonus
                            }`
                          : "· Sem ajuste adicional de classe"}
                      </p>
                      <small className="creator-vital-cap">
                        Moldura em carvalho e bronze · Editável na ficha
                      </small>
                    </div>
                  </div>

                  {currentSection !== "all" && (
                    <div className="grimoire-leaf__footer">
                      <button
                        type="button"
                        className="btn-ghost grimoire-prev-page-btn scroll-stone-btn"
                        onClick={() => void goToSection(1)}
                      >
                        ⬅ Seção Anterior
                      </button>
                      <button
                        type="button"
                        className="btn-primary grimoire-next-page-btn"
                        onClick={() => void goToSection(3)}
                      >
                        Desenrolar Seção III: Perícias & Selo ➔
                      </button>
                    </div>
                  )}
                </section>
              </div>

              {/* ============================================================
                  SECTION 3: PERÍCIAS & FINALIZAÇÃO
                 ============================================================ */}
              <div
                className={`grimoire-spread${
                  isSectionVisible(3)
                    ? " grimoire-spread--active"
                    : " grimoire-spread--hidden"
                }`}
                data-page="3"
              >
                {/* LEFT COLUMN: Skill Checkboxes with Custom Runes */}
                <section className="grimoire-leaf grimoire-leaf--left">
                  <div className="grimoire-leaf__header">
                    <span className="grimoire-leaf__folio">Seção III · Parte A</span>
                    <h3>5. Perícias</h3>
                  </div>

                  <p className="creator-skill-hint">
                    Marque as runas de proficiência treinadas (+{bonusProficiencia(nivelNum)}{" "}
                    de bônus no nível {nivelNum}):
                  </p>

                  <div className="creator-skill-grid grimoire-rune-skill-grid">
                    {skillsDraft.map((skill) => (
                      <label
                        className={
                          skill.treinada
                            ? "creator-skill-option creator-skill-option--on grimoire-rune-skill"
                            : "creator-skill-option grimoire-rune-skill"
                        }
                        key={skill.id}
                        title={skill.descricao || undefined}
                      >
                        <input
                          type="checkbox"
                          checked={skill.treinada}
                          onChange={() => onToggleSkill(skill.id)}
                        />
                        <span className="grimoire-rune-checkbox" aria-hidden="true">
                          {skill.treinada ? "✦" : "◇"}
                        </span>

                        <span className="creator-skill-text">
                          <span className="creator-skill-name">{skill.nome}</span>
                          <small>{rotuloAtributo(String(skill.atributo))}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>

                {/* RIGHT COLUMN: Class Abilities, Oath Summary & Stone/Wax Seal Submit */}
                <section className="grimoire-leaf grimoire-leaf--right">
                  <div className="grimoire-leaf__header">
                    <span className="grimoire-leaf__folio">Seção III · Parte B</span>
                    <h3>6. Habilidades & Selo Real</h3>
                  </div>

                  {classRevalidationNotice && (
                    <p className="creator-revalidation-alert" role="status">
                      {classRevalidationNotice}
                    </p>
                  )}

                  <div className="grimoire-abilities-block">
                    {infoClasse?.habilidadesIniciais &&
                    infoClasse.habilidadesIniciais.length > 0 ? (
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
                                className={
                                  isSelected
                                    ? "creator-skill-option creator-skill-option--on grimoire-rune-skill"
                                    : "creator-skill-option grimoire-rune-skill"
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => onToggleAbility(hab.nome)}
                                />
                                <span className="grimoire-rune-checkbox" aria-hidden="true">
                                  {isSelected ? "✦" : "◇"}
                                </span>
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

                    {infoClasse?.desbloqueiosFuturos &&
                      infoClasse.desbloqueiosFuturos.length > 0 && (
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
                  </div>

                  {/* Review Summary */}
                  <div className="creator-panel creator-review-panel grimoire-review-scroll">
                    <h4>Resumo do Juramento</h4>
                    <div className="creator-review-grid">
                      <div>
                        <strong>Campanha:</strong>{" "}
                        {campaigns.find((c) => c.id === selectedCampaignId)?.nome || (
                          <span style={{ color: "#e58282" }}>Nenhuma selecionada</span>
                        )}
                      </div>
                      <div>
                        <strong>Personagem:</strong> {draft.nome || "Novo personagem"} (Nível{" "}
                        {nivelNum})
                      </div>
                      <div>
                        <strong>Raça e Classe:</strong> {draft.raca || "Humano"} ·{" "}
                        {draft.classe || "Aventureiro"}
                      </div>
                      <div>
                        <strong>Recursos Iniciais:</strong> {currentHpValue} PV ·{" "}
                        {currentMpValue} PM ·{" "}
                        {campaigns.find((c) => c.id === selectedCampaignId)?.ouro_inicial ?? 0}{" "}
                        PO
                      </div>
                      <div>
                        <strong>
                          Perícias Treinadas ({skillsDraft.filter((s) => s.treinada).length}):
                        </strong>{" "}
                        {skillsDraft
                          .filter((s) => s.treinada)
                          .map((s) => s.nome)
                          .join(", ") || "Nenhuma"}
                      </div>
                      <div>
                        <strong>
                          Habilidades ({selectedAbilities.length}):
                        </strong>{" "}
                        {selectedAbilities.join(", ") || "Nenhuma"}
                      </div>
                    </div>
                  </div>

                  {/* Carved Stone Tablet & Royal Wax Seal Action Buttons */}
                  <div className="grimoire-leaf__footer grimoire-leaf__footer--final">
                    <div className="scroll-final-left-actions">
                      {currentSection !== "all" && (
                        <button
                          type="button"
                          className="btn-ghost grimoire-prev-page-btn scroll-stone-btn"
                          onClick={() => void goToSection(2)}
                          disabled={saving}
                        >
                          ⬅ Seção Anterior
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-ghost scroll-stone-btn"
                        onClick={handleRequestClose}
                        disabled={saving}
                      >
                        ✕ Fechar
                      </button>
                    </div>

                    <div className="grimoire-finalize-wrap">
                      {sealBurst && (
                        <div className="grimoire-spark-burst" aria-hidden="true">
                          {SPARK_PARTICLES.map((sp) => (
                            <span
                              key={sp.id}
                              style={
                                {
                                  "--tx": sp.tx,
                                  "--ty": sp.ty,
                                } as React.CSSProperties
                              }
                            />
                          ))}
                        </div>
                      )}
                      <button
                        type="submit"
                        className="btn-primary grimoire-finalize-btn scroll-wax-seal-submit"
                        aria-label={submitButtonLabel}
                        disabled={saving || !selectedCampaignId || !campaignRulesReady}
                      >
                        <span className="grimoire-finalize-btn__icon" aria-hidden="true">
                          ⚜
                        </span>
                        <span>{submitButtonLabel}</span>
                        {selectedCampaignId && campaignRulesReady && !saving && (
                          <small className="grimoire-finalize-btn__sub" aria-hidden="true">
                            Finalizar Personagem
                          </small>
                        )}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </form>
        </div>

        {/* BOTTOM WOOD & BRONZE SCROLL ROLLER WITH CARVED GOLD FINIALS */}
        <div className="scroll-roller scroll-roller--bottom" aria-hidden="true"><div className="scroll-roller__trim" /></div>
      </motion.div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
