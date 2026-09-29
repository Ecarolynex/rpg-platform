import { useEffect, useState, useRef } from "react";
import type { Character, Skill } from "../../types/character";
import { getCharacters, saveCharacter } from "../../services/api";
import { CharacterCard } from "../../components/character/CharacterCard";
import {
  CLASSES,
  RACES,
  AFFILIATIONS,
  ATTRIBUTE_CONFIG,
  FIXED_SKILLS,
  calculateAttributeModifier,
  formatModifier,
  getActivePersonaBonuses,
  calculateTotalPersonaBonuses,
  type BaseAttributeKey,
} from "../../data/personaRules";
import "./Dashboard.css";

interface CharacterDraft {
  nome: string;
  raca: string;
  classe: string;
  filiacao: string;
  altura: number;
  nivel: number;
  origem: string;
  idade: string;
  alinhamento: string;
  historia: string;
  aparencia: string;
  tracos: string;
  defeitos: string;
  portraitUrl: string;
  forca: number;
  destreza: number;
  constituicao: number;
  inteligencia: number;
  carisma: number;
  mp: number;
  selectedSkills: string[];
}

const initialDraft: CharacterDraft = {
  nome: "",
  raca: RACES[0],
  classe: CLASSES[8], // Guerreiro por padrão
  filiacao: AFFILIATIONS[0],
  altura: 175,
  nivel: 1,
  origem: "",
  idade: "",
  alinhamento: "",
  historia: "",
  aparencia: "",
  tracos: "",
  defeitos: "",
  portraitUrl: "",
  forca: 10,
  destreza: 10,
  constituicao: 10,
  inteligencia: 10,
  carisma: 10,
  mp: 10,
  selectedSkills: ["atletismo", "intimidacao"],
};

export default function Dashboard() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [draft, setDraft] = useState<CharacterDraft>(initialDraft);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCharacters()
      .then(setCharacters)
      .finally(() => setLoading(false));
  }, []);

  const updateDraft = <K extends keyof CharacterDraft>(
    field: K,
    value: CharacterDraft[K]
  ) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateAttribute = (field: BaseAttributeKey, value: number) => {
    // Garante valor numérico entre 1 e 20
    const clamped = Math.max(1, Math.min(20, value || 1));
    setDraft((prev) => ({ ...prev, [field]: clamped }));
  };

  const handleSkillToggle = (skillId: string) => {
    setDraft((prev) => {
      const alreadySelected = prev.selectedSkills.includes(skillId);
      if (alreadySelected) {
        return {
          ...prev,
          selectedSkills: prev.selectedSkills.filter((id) => id !== skillId),
        };
      }
      if (prev.selectedSkills.length >= 2) {
        return prev; // Bloqueia a seleção se já tiver 2
      }
      return {
        ...prev,
        selectedSkills: [...prev.selectedSkills, skillId],
      };
    });
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result;
      if (typeof result === "string") {
        updateDraft("portraitUrl", result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    updateDraft("portraitUrl", "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Bônus automáticos calculados da Persona
  const activeBonuses = getActivePersonaBonuses(draft.raca, draft.classe, draft.filiacao);
  const bonusTotals = calculateTotalPersonaBonuses(draft.raca, draft.classe, draft.filiacao);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const conMod = calculateAttributeModifier(draft.constituicao);
    const hpMax = Math.max(1, 12 + conMod + bonusTotals.hpBonus);
    const mpMax = Math.max(0, Number(draft.mp) || 10);

    const skills: Skill[] = FIXED_SKILLS.map((sk) => {
      const isTrained = draft.selectedSkills.includes(sk.id);
      const attrKey = sk.atributo;
      const attrVal = Number(draft[attrKey]) || 10;
      const mod = calculateAttributeModifier(attrVal);
      const bonus = mod + (isTrained ? 2 : 0);
      return {
        id: sk.id,
        nome: sk.nome,
        atributo: attrKey,
        treinada: isTrained,
        bonus,
      };
    });

    const createdCharacter: Character = {
      id: String(Date.now()),
      nome: draft.nome.trim() || "Novo Personagem",
      raca: draft.raca,
      classe: draft.classe,
      filiacao: draft.filiacao,
      altura: Number(draft.altura) || undefined,
      nivel: Number(draft.nivel) || 1,
      portraitUrl: draft.portraitUrl || undefined,
      hp: { atual: hpMax, max: hpMax, temp: 0 },
      mp: { atual: mpMax, max: mpMax },
      attributes: {
        forca: Number(draft.forca),
        destreza: Number(draft.destreza),
        constituicao: Number(draft.constituicao),
        inteligencia: Number(draft.inteligencia),
        carisma: Number(draft.carisma),
      },
      skills,
      inventory: [],
      spells: [],
      tracos: draft.tracos.trim(),
      defeitos: draft.defeitos.trim(),
      aparencia: draft.aparencia.trim(),
      notas: [
        draft.filiacao ? `Filiação: ${draft.filiacao}` : null,
        draft.altura ? `Altura: ${draft.altura} cm` : null,
        draft.origem ? `Origem: ${draft.origem}` : null,
        draft.alinhamento ? `Alinhamento: ${draft.alinhamento}` : null,
        draft.idade ? `Idade: ${draft.idade}` : null,
        draft.tracos ? `Traços: ${draft.tracos}` : null,
        draft.defeitos ? `Defeitos: ${draft.defeitos}` : null,
        draft.aparencia ? `Aparência: ${draft.aparencia}` : null,
        draft.historia ? `História: ${draft.historia}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };

    saveCharacter(createdCharacter).then(() => {
      setCharacters((prev) => [createdCharacter, ...prev]);
    });
    setDraft(initialDraft);
    setShowCreator(false);
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Meus personagens</h1>
          <p>Escolha uma ficha para continuar sua jornada.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreator((open) => !open)}>
          {showCreator ? "Fechar" : "+ Novo personagem"}
        </button>
      </header>

      <hr className="hairline" />

      {showCreator && (
        <form className="character-creator" onSubmit={handleSubmit}>
          <div className="creator-banner">
            <h2>Criação de personagem</h2>
          </div>

          {/* SEÇÃO 1 & 2: DADOS GERAIS, MENUS SELECIONÁVEIS E ATRIBUTOS */}
          <div className="creator-layout">
            <section className="creator-panel">
              <h3>1. Dados Gerais e Persona</h3>
              <div className="field-grid">
                <label className="field field-wide" htmlFor="nome-personagem">
                  <span>Nome do personagem</span>
                  <input
                    id="nome-personagem"
                    value={draft.nome}
                    onChange={(e) => updateDraft("nome", e.target.value)}
                    placeholder="Ex.: Elira Fenra"
                    required
                  />
                </label>

                {/* MENUS SELECIONÁVEIS */}
                <label className="field" htmlFor="classe-personagem">
                  <span>Classe (Menu Selecionável)</span>
                  <select
                    id="classe-personagem"
                    value={draft.classe}
                    onChange={(e) => updateDraft("classe", e.target.value)}
                  >
                    {CLASSES.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" htmlFor="raca-personagem">
                  <span>Raça (Menu Selecionável)</span>
                  <select
                    id="raca-personagem"
                    value={draft.raca}
                    onChange={(e) => updateDraft("raca", e.target.value)}
                  >
                    {RACES.map((race) => (
                      <option key={race} value={race}>
                        {race}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field field-wide" htmlFor="filiacao-personagem">
                  <span>Filiação (Menu Selecionável)</span>
                  <select
                    id="filiacao-personagem"
                    value={draft.filiacao}
                    onChange={(e) => updateDraft("filiacao", e.target.value)}
                  >
                    {AFFILIATIONS.map((aff) => (
                      <option key={aff} value={aff}>
                        {aff}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" htmlFor="altura-personagem">
                  <span>Altura (Campo Numérico em cm)</span>
                  <input
                    id="altura-personagem"
                    type="number"
                    min={30}
                    max={300}
                    value={draft.altura}
                    onChange={(e) => updateDraft("altura", Number(e.target.value) || 0)}
                    placeholder="Ex.: 175"
                  />
                </label>

                <label className="field" htmlFor="mana-personagem">
                  <span>Pontos de Mana (PM)</span>
                  <input
                    id="mana-personagem"
                    type="number"
                    min={0}
                    max={100}
                    value={draft.mp}
                    onChange={(e) => updateDraft("mp", Number(e.target.value) || 0)}
                  />
                </label>

                <label className="field" htmlFor="nivel-personagem">
                  <span>Nível</span>
                  <input
                    id="nivel-personagem"
                    type="number"
                    min={1}
                    max={20}
                    value={draft.nivel}
                    onChange={(e) => updateDraft("nivel", Number(e.target.value) || 1)}
                  />
                </label>

                <label className="field" htmlFor="idade-personagem">
                  <span>Idade</span>
                  <input
                    id="idade-personagem"
                    value={draft.idade}
                    onChange={(e) => updateDraft("idade", e.target.value)}
                    placeholder="Ex.: 24 anos"
                  />
                </label>

                <label className="field field-wide" htmlFor="origem-personagem">
                  <span>Origem</span>
                  <input
                    id="origem-personagem"
                    value={draft.origem}
                    onChange={(e) => updateDraft("origem", e.target.value)}
                    placeholder="Guilda, reino, ermos..."
                  />
                </label>
              </div>

              {/* BÔNUS AUTOMÁTICOS APLICADOS */}
              <div className="persona-bonus-box">
                <div className="persona-bonus-title">
                  <span>⚠️ Regra de Negócio: Bônus Automáticos da Persona</span>
                </div>
                <div className="persona-bonus-tags">
                  {activeBonuses.map((b) => (
                    <div key={`${b.origem}-${b.categoria}`} className="persona-bonus-badge">
                      <strong>{b.origem} ({b.categoria}):</strong> {b.nome} — <em>{b.descricao}</em>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ATRIBUTOS BASE (FOR, DES, CON, INT, CAR) COM BÔNUS EMBAIXO */}
            <aside className="creator-panel creator-panel-side">
              <div className="panel-header-with-badge">
                <h3>Atributos Base</h3>
                <span className="panel-badge-small">Máx. 20</span>
              </div>
              <p className="panel-desc">Defina os valores numéricos (1 a 20). O bônus é calculado logo abaixo:</p>

              <div className="attribute-grid">
                {ATTRIBUTE_CONFIG.map(({ key, label, abbr }) => {
                  const val = draft[key as keyof typeof draft] as number;
                  const mod = calculateAttributeModifier(val);
                  const personaBonus = bonusTotals.attributeBonuses[key];

                  return (
                    <div key={key} className="attribute-card">
                      <div className="attribute-card-header">
                        <span className="attr-title">{label}</span>
                        <span className="attr-abbr">{abbr}</span>
                      </div>
                      <input
                        id={`attr-${key}`}
                        type="number"
                        min={1}
                        max={20}
                        value={val}
                        onChange={(e) => updateAttribute(key, Number(e.target.value))}
                        className="attribute-input"
                      />
                      <div className="attribute-bonus-pill">
                        <span className="bonus-label">Bônus:</span>
                        <span className="bonus-value">{formatModifier(mod)}</span>
                      </div>
                      {personaBonus > 0 && (
                        <div className="attribute-persona-hint">
                          +{personaBonus} de Persona
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>

          {/* SEÇÃO 3: PERSONALIDADE, APARÊNCIA E UPLOADER DE IMAGEM */}
          <div className="creator-layout creator-layout-middle">
            <section className="creator-panel creator-panel-full">
              <h3>2. Personalidade e Aparência</h3>
              <div className="personality-appearance-grid">
                <div className="personality-fields">
                  <label className="field" htmlFor="tracos-personagem">
                    <span>Traços de Personalidade</span>
                    <textarea
                      id="tracos-personagem"
                      value={draft.tracos}
                      onChange={(e) => updateDraft("tracos", e.target.value)}
                      rows={3}
                      placeholder="Descreva as atitudes, peculiaridades, filosofia e hábitos marcantes..."
                    />
                  </label>

                  <label className="field" htmlFor="defeitos-personagem">
                    <span>Defeitos</span>
                    <textarea
                      id="defeitos-personagem"
                      value={draft.defeitos}
                      onChange={(e) => updateDraft("defeitos", e.target.value)}
                      rows={3}
                      placeholder="Falhas, fobias, vícios, fraquezas ou pontos cegos do personagem..."
                    />
                  </label>

                  <label className="field" htmlFor="aparencia-personagem">
                    <span>Aparência Descritiva</span>
                    <textarea
                      id="aparencia-personagem"
                      value={draft.aparencia}
                      onChange={(e) => updateDraft("aparencia", e.target.value)}
                      rows={3}
                      placeholder="Cabelos, olhos, marcas, vestimentas e porte físico..."
                    />
                  </label>

                  <label className="field" htmlFor="historia-personagem">
                    <span>História do personagem</span>
                    <textarea
                      id="historia-personagem"
                      value={draft.historia}
                      onChange={(e) => updateDraft("historia", e.target.value)}
                      rows={3}
                      placeholder="Origem, jornada e motivações..."
                    />
                  </label>
                </div>

                {/* UPLOADER DE IMAGEM */}
                <div className="image-uploader-box">
                  <span className="image-uploader-title">Uploader de Imagem / Retrato</span>
                  <div className="portrait-preview-wrapper">
                    {draft.portraitUrl ? (
                      <div className="portrait-preview-container">
                        <img
                          src={draft.portraitUrl}
                          alt="Retrato do personagem"
                          className="portrait-preview-img"
                        />
                        <button
                          type="button"
                          className="btn-remove-portrait"
                          onClick={handleRemoveImage}
                          title="Remover retrato"
                        >
                          ✕ Remover imagem
                        </button>
                      </div>
                    ) : (
                      <div
                        className="portrait-placeholder-drop"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="upload-icon-graphic">📷</div>
                        <p className="upload-help-text">
                          <strong>Clique para selecionar</strong> imagem do seu dispositivo
                        </p>
                        <span className="upload-help-sub">PNG, JPG, WEBP</span>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    style={{ display: "none" }}
                    id="file-upload-input"
                  />

                  <div className="uploader-action-bar">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📁 Escolher Imagem
                    </button>
                  </div>

                  <div className="field url-field-optional">
                    <span>Ou insira a URL da imagem:</span>
                    <input
                      type="url"
                      value={draft.portraitUrl}
                      onChange={(e) => updateDraft("portraitUrl", e.target.value)}
                      placeholder="https://exemplo.com/imagem.png"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* SEÇÃO 4: LISTA DE PERÍCIAS E SELEÇÃO (MÁXIMO 2) */}
          <div className="creator-layout creator-layout-bottom">
            <section className="creator-panel creator-panel-full">
              <div className="skills-header-bar">
                <div>
                  <h3>3. Lista de Perícias e Seleção</h3>
                  <p className="skills-subtext">
                    Marque as perícias treinadas do personagem. <strong>Regra: selecione no máximo 2 perícias.</strong>
                  </p>
                </div>
                <div className={`skills-counter-badge ${draft.selectedSkills.length === 2 ? "badge-full" : ""}`}>
                  Treinadas: {draft.selectedSkills.length} / 2
                </div>
              </div>

              <div className="skills-selection-grid">
                {FIXED_SKILLS.map((skill) => {
                  const isChecked = draft.selectedSkills.includes(skill.id);
                  const isDisabled = !isChecked && draft.selectedSkills.length >= 2;
                  const attrVal = draft[skill.atributo] as number;
                  const attrMod = calculateAttributeModifier(attrVal);
                  const totalBonus = attrMod + (isChecked ? 2 : 0);

                  return (
                    <label
                      key={skill.id}
                      className={`skill-item-card ${isChecked ? "skill-checked" : ""} ${
                        isDisabled ? "skill-disabled" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={() => handleSkillToggle(skill.id)}
                        className="skill-checkbox"
                      />
                      <div className="skill-info">
                        <span className="skill-name">{skill.nome}</span>
                        <span className="skill-attr-tag">{skill.atributoSigla}</span>
                      </div>
                      <div className="skill-bonus-display">
                        {isChecked && <span className="skill-trained-flag">Treinada</span>}
                        <span className="skill-total-bonus">{formatModifier(totalBonus)}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="creator-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowCreator(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Salvar personagem
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="dashboard-status">Carregando fichas...</p>
      ) : characters.length === 0 ? (
        <p className="dashboard-status">
          Você ainda não tem personagens. Crie o primeiro para começar.
        </p>
      ) : (
        <div className="dashboard-grid">
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      )}
    </div>
  );
}
