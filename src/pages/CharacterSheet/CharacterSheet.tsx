import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Character, InventoryItem, Spell } from "../../types/character";
import { getCharacterById, saveCharacter } from "../../services/api";
import { StatBar } from "../../components/ui/StatBar";
import {
  ATTRIBUTE_CONFIG,
  FIXED_SKILLS,
  calculateAttributeModifier,
  formatModifier,
  getActivePersonaBonuses,
} from "../../data/personaRules";
import "./CharacterSheet.css";

const TABS = ["Persona", "Atributos", "Perícias", "Inventário", "Habilidades", "Notas"] as const;
type Tab = (typeof TABS)[number];

export default function CharacterSheet() {
  const { id } = useParams();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Persona");

  // Estados para edição de Inventário
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemDesc, setNewItemDesc] = useState("");

  // Estados para edição de Habilidades / Magias
  const [showAddSpell, setShowAddSpell] = useState(false);
  const [newSpellName, setNewSpellName] = useState("");
  const [newSpellCost, setNewSpellCost] = useState(0);
  const [newSpellDesc, setNewSpellDesc] = useState("");

  // Estados para edição de Notas
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaveStatus, setNotesSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getCharacterById(id)
      .then((c) => {
        if (c) {
          setCharacter(c);
          setNotesDraft(c.notas || "");
        } else {
          setCharacter(null);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar ficha:", err);
        setCharacter(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Função auxiliar para atualizar e persistir o personagem
  const updateAndSave = (updated: Character) => {
    setCharacter(updated);
    saveCharacter(updated);
  };

  // Controle de Vida (PV)
  const handleAdjustHp = (amount: number) => {
    if (!character) return;
    const nextAtual = Math.max(0, Math.min(character.hp.max, character.hp.atual + amount));
    const updated: Character = {
      ...character,
      hp: { ...character.hp, atual: nextAtual },
    };
    updateAndSave(updated);
  };

  // Controle de Pontos de Vida Temporários (PV Temp)
  const handleAdjustTempHp = (amount: number) => {
    if (!character) return;
    const currentTemp = character.hp.temp || 0;
    const nextTemp = Math.max(0, currentTemp + amount);
    const updated: Character = {
      ...character,
      hp: { ...character.hp, temp: nextTemp },
    };
    updateAndSave(updated);
  };

  // Controle de Mana (PM)
  const handleAdjustMana = (amount: number) => {
    if (!character) return;
    const nextAtual = Math.max(0, Math.min(character.mp.max, character.mp.atual + amount));
    const updated: Character = {
      ...character,
      mp: { ...character.mp, atual: nextAtual },
    };
    updateAndSave(updated);
  };

  // Gerenciamento de Inventário / Equipamentos
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!character || !newItemName.trim()) return;

    const newItem: InventoryItem = {
      id: "item-" + Date.now(),
      nome: newItemName.trim(),
      quantidade: Math.max(1, newItemQty || 1),
      descricao: newItemDesc.trim() || undefined,
    };

    const updated: Character = {
      ...character,
      inventory: [...character.inventory, newItem],
    };

    updateAndSave(updated);
    setNewItemName("");
    setNewItemQty(1);
    setNewItemDesc("");
    setShowAddItem(false);
  };

  const handleAdjustItemQty = (itemId: string, delta: number) => {
    if (!character) return;
    const updatedList = character.inventory
      .map((item) => {
        if (item.id === itemId) {
          const nextQty = item.quantidade + delta;
          return nextQty > 0 ? { ...item, quantidade: nextQty } : null;
        }
        return item;
      })
      .filter((item): item is InventoryItem => item !== null);

    const updated: Character = {
      ...character,
      inventory: updatedList,
    };
    updateAndSave(updated);
  };

  const handleRemoveItem = (itemId: string) => {
    if (!character) return;
    const updated: Character = {
      ...character,
      inventory: character.inventory.filter((item) => item.id !== itemId),
    };
    updateAndSave(updated);
  };

  // Gerenciamento de Habilidades / Magias
  const handleAddSpell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!character || !newSpellName.trim()) return;

    const newSpell: Spell = {
      id: "spell-" + Date.now(),
      nome: newSpellName.trim(),
      custo: Math.max(0, newSpellCost || 0),
      descricao: newSpellDesc.trim() || "Sem descrição.",
    };

    const updated: Character = {
      ...character,
      spells: [...character.spells, newSpell],
    };

    updateAndSave(updated);
    setNewSpellName("");
    setNewSpellCost(0);
    setNewSpellDesc("");
    setShowAddSpell(false);
  };

  const handleRemoveSpell = (spellId: string) => {
    if (!character) return;
    const updated: Character = {
      ...character,
      spells: character.spells.filter((spell) => spell.id !== spellId),
    };
    updateAndSave(updated);
  };

  const handleUseSpell = (spell: Spell) => {
    if (!character) return;
    if (spell.custo > 0) {
      if (character.mp.atual < spell.custo) {
        alert(`Mana insuficiente para usar ${spell.nome}! Custo: ${spell.custo} PM, Atual: ${character.mp.atual} PM.`);
        return;
      }
      handleAdjustMana(-spell.custo);
    }
  };

  // Gerenciamento de Notas
  const handleSaveNotes = () => {
    if (!character) return;
    const updated: Character = {
      ...character,
      notas: notesDraft,
    };
    updateAndSave(updated);
    setNotesSaveStatus("Anotações salvas com sucesso!");
    setTimeout(() => setNotesSaveStatus(null), 3000);
  };

  if (loading) {
    return (
      <div className="sheet-loading-box">
        <p className="sheet-status">Carregando ficha do personagem...</p>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="sheet-not-found">
        <h2>Personagem não encontrado</h2>
        <p>A ficha solicitada não foi encontrada ou ainda não foi criada.</p>
        <Link to="/" className="btn-primary">
          ← Voltar para meus personagens
        </Link>
      </div>
    );
  }

  const personaBonuses = getActivePersonaBonuses(
    character.raca,
    character.classe,
    character.filiacao
  );

  const tempHp = character.hp.temp || 0;

  return (
    <div className="sheet">
      <div className="sheet-banner">
        <div className="sheet-portrait-frame">
          {character.portraitUrl ? (
            <img
              src={character.portraitUrl}
              alt={character.nome}
              className="sheet-portrait-image"
            />
          ) : (
            <div className="sheet-portrait-fallback">{character.nome.charAt(0)}</div>
          )}
        </div>

        <div className="sheet-heading">
          <div className="sheet-title-row">
            <h1>{character.nome}</h1>
            <span className="sheet-level-badge">Nível {character.nivel}</span>
          </div>
          <p className="sheet-meta-info">
            <strong>{character.raca}</strong> · <strong>{character.classe}</strong>
            {character.filiacao && (
              <>
                {" "}· <span className="sheet-meta-filiacao">{character.filiacao}</span>
              </>
            )}
            {character.altura && (
              <>
                {" "}· <span>{character.altura} cm</span>
              </>
            )}
          </p>
        </div>

        <div className="sheet-vitals">
          {/* BARRA DE VIDA */}
          <div className="vital-control-wrapper">
            <StatBar
              label={tempHp > 0 ? `Vida (+${tempHp} Temp)` : "Vida (PV)"}
              atual={character.hp.atual}
              max={character.hp.max}
              tone="wine"
            />
            <div className="vital-mini-buttons">
              <button
                type="button"
                className="btn-vital-action"
                onClick={() => handleAdjustHp(-1)}
                title="Gastar 1 PV"
              >
                -1
              </button>
              <button
                type="button"
                className="btn-vital-action"
                onClick={() => handleAdjustHp(1)}
                title="Curar 1 PV"
              >
                +1
              </button>
            </div>
          </div>

          {/* PONTOS DE VIDA TEMPORÁRIOS (PV TEMP) */}
          <div className="temp-hp-card">
            <div className="temp-hp-info">
              <span className="temp-hp-label">PV Temporários</span>
              <span className="temp-hp-value">+{tempHp}</span>
            </div>
            <div className="temp-hp-buttons">
              <button
                type="button"
                className="btn-temp-hp"
                onClick={() => handleAdjustTempHp(-1)}
                title="Diminuir 1 PV Temp"
              >
                -1
              </button>
              <button
                type="button"
                className="btn-temp-hp"
                onClick={() => handleAdjustTempHp(1)}
                title="Adicionar 1 PV Temp"
              >
                +1
              </button>
              {tempHp > 0 && (
                <button
                  type="button"
                  className="btn-temp-hp btn-temp-clear"
                  onClick={() => handleAdjustTempHp(-tempHp)}
                  title="Zerar PV Temporários"
                >
                  Zerar
                </button>
              )}
            </div>
          </div>

          {/* BARRA DE MANA */}
          <div className="vital-control-wrapper">
            <StatBar
              label="Mana (PM)"
              atual={character.mp.atual}
              max={character.mp.max}
              tone="forest"
            />
            <div className="vital-mini-buttons">
              <button
                type="button"
                className="btn-vital-action btn-mana"
                onClick={() => handleAdjustMana(-1)}
                title="Gastar 1 PM"
              >
                -1
              </button>
              <button
                type="button"
                className="btn-vital-action btn-mana"
                onClick={() => handleAdjustMana(1)}
                title="Recuperar 1 PM"
              >
                +1
              </button>
            </div>
          </div>
        </div>
      </div>

      <nav className="sheet-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={t === tab ? "sheet-tab sheet-tab--active" : "sheet-tab"}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="sheet-content">
        {/* ABA PERSONA: CLASSIFICAÇÕES, BÔNUS, PERSONALIDADE E APARÊNCIA */}
        {tab === "Persona" && (
          <div className="persona-tab-layout">
            <section className="sheet-panel">
              <div className="sheet-panel-head">
                <h3>Classificações da Persona</h3>
              </div>
              <div className="persona-classification-grid">
                <div className="classification-card">
                  <span className="class-label">Classe</span>
                  <span className="class-value">{character.classe}</span>
                </div>
                <div className="classification-card">
                  <span className="class-label">Raça</span>
                  <span className="class-value">{character.raca}</span>
                </div>
                <div className="classification-card">
                  <span className="class-label">Filiação</span>
                  <span className="class-value">{character.filiacao || "Nenhuma"}</span>
                </div>
                <div className="classification-card">
                  <span className="class-label">Altura</span>
                  <span className="class-value">{character.altura ? `${character.altura} cm` : "Não informada"}</span>
                </div>
              </div>
            </section>

            <section className="sheet-panel">
              <div className="sheet-panel-head">
                <h3>Bônus Automáticos Aplicados</h3>
                <span className="sheet-tag-sub">Classe · Raça · Filiação</span>
              </div>
              <div className="persona-bonuses-container">
                {personaBonuses.length > 0 ? (
                  personaBonuses.map((b) => (
                    <div key={`${b.origem}-${b.categoria}`} className="persona-sheet-bonus-card">
                      <div className="bonus-card-head">
                        <span className="bonus-origin">{b.origem}</span>
                        <strong className="bonus-name">{b.nome}</strong>
                      </div>
                      <p className="bonus-desc">{b.descricao}</p>
                    </div>
                  ))
                ) : (
                  <p className="sheet-empty">Nenhum bônus automático registrado.</p>
                )}
              </div>
            </section>

            <section className="sheet-panel">
              <div className="sheet-panel-head">
                <h3>Personalidade e Aparência</h3>
              </div>
              <div className="persona-narrative-grid">
                <div className="narrative-block">
                  <span className="narrative-label">Traços de Personalidade</span>
                  <p className="narrative-content">
                    {character.tracos || "Nenhum traço definido ainda."}
                  </p>
                </div>
                <div className="narrative-block">
                  <span className="narrative-label">Defeitos / Fraquezas</span>
                  <p className="narrative-content">
                    {character.defeitos || "Nenhum defeito registrado."}
                  </p>
                </div>
                <div className="narrative-block narrative-block-full">
                  <span className="narrative-label">Aparência</span>
                  <p className="narrative-content">
                    {character.aparencia || "Nenhuma descrição de aparência registrada."}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ABA ATRIBUTOS: OS 5 ATRIBUTOS BASE COM BÔNUS CALCULADO EMBAIXO */}
        {tab === "Atributos" && (
          <div className="attribute-grid">
            {ATTRIBUTE_CONFIG.map(({ key, label, abbr }) => {
              const val = character.attributes[key] ?? 10;
              const mod = calculateAttributeModifier(val);

              return (
                <div key={key} className="attribute-block">
                  <span className="attribute-label">{label} ({abbr})</span>
                  <span className="attribute-value">{val}</span>
                  <div className="attribute-bonus-sub">
                    <span className="bonus-sub-label">Bônus:</span>
                    <span className="bonus-sub-value">{formatModifier(mod)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ABA PERÍCIAS: 11 PERÍCIAS OFICIAIS COM ATRIBUTO, STATUS E BÔNUS */}
        {tab === "Perícias" && (
          <ul className="sheet-list">
            {FIXED_SKILLS.map((skDef) => {
              const charSkill = character.skills.find(
                (s) => s.id === skDef.id || s.nome.toLowerCase() === skDef.nome.toLowerCase()
              );
              const isTrained = charSkill ? charSkill.treinada : false;
              const attrVal = character.attributes[skDef.atributo] ?? 10;
              const attrMod = calculateAttributeModifier(attrVal);
              const bonusTotal = attrMod + (isTrained ? 2 : 0);

              return (
                <li key={skDef.id} className={isTrained ? "sheet-skill-trained" : ""}>
                  <div className="skill-sheet-row">
                    <span className="skill-check-mark">{isTrained ? "✦" : "✧"}</span>
                    <span className="skill-sheet-name">{skDef.nome}</span>
                  </div>
                  <span className="sheet-list-tag">
                    {skDef.atributoSigla} · {isTrained ? "Treinada (+2)" : "Não treinada"}
                  </span>
                  <span className="sheet-list-bonus">{formatModifier(bonusTotal)}</span>
                </li>
              );
            })}
          </ul>
        )}

        {/* ABA INVENTÁRIO (COM MODIFICAÇÃO DE EQUIPAMENTOS) */}
        {tab === "Inventário" && (
          <div className="sheet-inventory-section">
            <div className="section-toolbar">
              <h3>Equipamentos & Itens</h3>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAddItem((prev) => !prev)}
              >
                {showAddItem ? "✕ Fechar" : "+ Adicionar Item / Equipamento"}
              </button>
            </div>

            {showAddItem && (
              <form className="add-subform" onSubmit={handleAddItem}>
                <h4>Novo Item ou Equipamento</h4>
                <div className="add-subform-grid">
                  <label className="field">
                    <span>Nome do Item</span>
                    <input
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Ex.: Espada Longa Élfica, Poção de Vida..."
                      required
                    />
                  </label>
                  <label className="field field-narrow">
                    <span>Quantidade</span>
                    <input
                      type="number"
                      min={1}
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(Number(e.target.value) || 1)}
                    />
                  </label>
                  <label className="field field-wide">
                    <span>Descrição / Efeitos (opcional)</span>
                    <input
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      placeholder="Ex.: +1d8 dano cortante, item sintonizado..."
                    />
                  </label>
                </div>
                <div className="add-subform-actions">
                  <button type="submit" className="btn-primary">
                    Salvar Item
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowAddItem(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <ul className="sheet-list sheet-list-interactive">
              {character.inventory.map((item) => (
                <li key={item.id} className="inventory-item-row">
                  <div className="item-main-info">
                    <span className="item-title">{item.nome}</span>
                    {item.descricao && <p className="item-desc">{item.descricao}</p>}
                  </div>
                  <div className="item-qty-controls">
                    <button
                      type="button"
                      className="btn-qty"
                      onClick={() => handleAdjustItemQty(item.id, -1)}
                      title="Diminuir quantidade"
                    >
                      -
                    </button>
                    <span className="sheet-list-tag">x{item.quantidade}</span>
                    <button
                      type="button"
                      className="btn-qty"
                      onClick={() => handleAdjustItemQty(item.id, 1)}
                      title="Aumentar quantidade"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="btn-delete-item"
                      onClick={() => handleRemoveItem(item.id)}
                      title="Remover item"
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              ))}
              {character.inventory.length === 0 && (
                <p className="sheet-empty">Nenhum equipamento ou item no inventário.</p>
              )}
            </ul>
          </div>
        )}

        {/* ABA HABILIDADES & MAGIAS (COM MODIFICAÇÃO) */}
        {tab === "Habilidades" && (
          <div className="sheet-spells-section">
            <div className="section-toolbar">
              <div>
                <h3>Habilidades & Magias</h3>
                <p className="section-subtext">Gerencie poderes, técnicas e magias conhecidas.</p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAddSpell((prev) => !prev)}
              >
                {showAddSpell ? "✕ Fechar" : "+ Adicionar Habilidade / Magia"}
              </button>
            </div>

            {showAddSpell && (
              <form className="add-subform" onSubmit={handleAddSpell}>
                <h4>Nova Habilidade ou Magia</h4>
                <div className="add-subform-grid">
                  <label className="field">
                    <span>Nome da Habilidade / Magia</span>
                    <input
                      value={newSpellName}
                      onChange={(e) => setNewSpellName(e.target.value)}
                      placeholder="Ex.: Golpe Certeiro, Raio Congelante..."
                      required
                    />
                  </label>
                  <label className="field field-narrow">
                    <span>Custo em PM</span>
                    <input
                      type="number"
                      min={0}
                      value={newSpellCost}
                      onChange={(e) => setNewSpellCost(Number(e.target.value) || 0)}
                    />
                  </label>
                  <label className="field field-wide">
                    <span>Descrição / Efeito</span>
                    <textarea
                      value={newSpellDesc}
                      onChange={(e) => setNewSpellDesc(e.target.value)}
                      rows={2}
                      placeholder="Descreva o que a habilidade faz, alcance, dados de dano..."
                      required
                    />
                  </label>
                </div>
                <div className="add-subform-actions">
                  <button type="submit" className="btn-primary">
                    Salvar Habilidade
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowAddSpell(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <ul className="sheet-list sheet-list--spells">
              {character.spells.map((spell) => (
                <li key={spell.id} className="spell-item-row">
                  <div className="sheet-spell-head">
                    <span className="spell-name-title">{spell.nome}</span>
                    <div className="spell-meta-actions">
                      <span className="sheet-list-tag">{spell.custo} PM</span>
                      {spell.custo > 0 && (
                        <button
                          type="button"
                          className="btn-use-spell"
                          onClick={() => handleUseSpell(spell)}
                          title={`Usar habilidade (gasta ${spell.custo} PM)`}
                        >
                          Conjurar / Usar
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-delete-item"
                        onClick={() => handleRemoveSpell(spell.id)}
                        title="Remover habilidade"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <p>{spell.descricao}</p>
                </li>
              ))}
              {character.spells.length === 0 && (
                <p className="sheet-empty">Nenhuma habilidade ou magia registrada.</p>
              )}
            </ul>
          </div>
        )}

        {/* ABA NOTAS (COM EDIÇÃO DIRETA) */}
        {tab === "Notas" && (
          <div className="sheet-notes-section">
            <div className="section-toolbar">
              <h3>Anotações da Campanha</h3>
              <button type="button" className="btn-primary" onClick={handleSaveNotes}>
                💾 Salvar Anotações
              </button>
            </div>
            {notesSaveStatus && (
              <div className="save-status-banner">{notesSaveStatus}</div>
            )}
            <textarea
              className="notes-editor"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={12}
              placeholder="Escreva anotações de sessões, pistas, objetivos, relacionamentos, tesouros..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
