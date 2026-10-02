import { useEffect, useState } from "react";
import {
  getCatalogoGlobalClasses,
  salvarCatalogoGlobalClasses,
} from "../../services/api";
import {
  ATTRIBUTE_CONFIG,
  type BaseAttributeKey,
  type ClassAbilityDefinition,
  type ClassDefinition,
  type ClassSkillDefinition,
  type ClassSpellDefinition,
} from "../../data/personaRules";
import "./ClassCatalog.css";

function criarId(prefixo: string) {
  const uuid = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefixo}-${uuid}`;
}

export default function ClassCatalog() {
  const [classes, setClasses] = useState<ClassDefinition[]>([]);
  const [nomeNovaClasse, setNomeNovaClasse] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    getCatalogoGlobalClasses()
      .then((dados) => setClasses(dados))
      .catch((error: unknown) => {
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o catálogo.",
        );
      })
      .finally(() => setCarregando(false));
  }, []);

  function atualizarClasse(
    id: string,
    alterar: (classe: ClassDefinition) => ClassDefinition,
  ) {
    setClasses((atuais) =>
      atuais.map((classe) => (classe.id === id ? alterar(classe) : classe)),
    );
  }

  function atualizarPericia(
    classeId: string,
    periciaId: string,
    alterar: (pericia: ClassSkillDefinition) => ClassSkillDefinition,
  ) {
    atualizarClasse(classeId, (classe) => ({
      ...classe,
      pericias: classe.pericias.map((pericia) =>
        pericia.id === periciaId ? alterar(pericia) : pericia,
      ),
    }));
  }

  function atualizarHabilidade(
    classeId: string,
    habilidadeId: string,
    alterar: (habilidade: ClassAbilityDefinition) => ClassAbilityDefinition,
  ) {
    atualizarClasse(classeId, (classe) => ({
      ...classe,
      habilidades: classe.habilidades.map((habilidade) =>
        habilidade.id === habilidadeId ? alterar(habilidade) : habilidade,
      ),
    }));
  }

  function atualizarMagia(
    classeId: string,
    magiaId: string,
    alterar: (magia: ClassSpellDefinition) => ClassSpellDefinition,
  ) {
    atualizarClasse(classeId, (classe) => ({
      ...classe,
      magias: classe.magias.map((magia) =>
        magia.id === magiaId ? alterar(magia) : magia,
      ),
    }));
  }

  function adicionarClasse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nome = nomeNovaClasse.trim();
    if (!nome) return;
    const id = criarId("classe");
    const atributoBonus = Object.fromEntries(
      ATTRIBUTE_CONFIG.map(({ key }) => [key, 0]),
    ) as Record<BaseAttributeKey, number>;
    setClasses((atuais) => [
      ...atuais,
      {
        id,
        nome,
        aliases: [],
        atributoBonus,
        hpBonus: 0,
        mpBonus: 0,
        pericias: [],
        habilidades: [],
        magias: [],
        usaMagia: false,
      },
    ]);
    setNomeNovaClasse("");
    setMensagem("");
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const salvas = await salvarCatalogoGlobalClasses(classes);
      setClasses(salvas);
      setMensagem("Catálogo compartilhado atualizado.");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as alterações.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <main className="class-catalog-page"><p>Carregando regras...</p></main>;
  }

  return (
    <main className="class-catalog-page">
      <header className="class-catalog-header">
        <span className="class-catalog-kicker">Regras compartilhadas</span>
        <h1>Classes, perícias e habilidades</h1>
        <p>
          Catálogo global colaborativo. As classes cadastradas ficam disponíveis
          na criação de personagens e em todas as campanhas.
        </p>
      </header>

      <div>
        <div className="class-catalog-toolbar">
          <form onSubmit={adicionarClasse} className="class-catalog-add">
            <label>
              <span>Nova classe</span>
              <input
                value={nomeNovaClasse}
                onChange={(event) => setNomeNovaClasse(event.target.value)}
                placeholder="Nome da classe"
                maxLength={100}
                required
              />
            </label>
            <button type="submit" className="btn-ghost" disabled={Boolean(erro)}>
              Adicionar classe
            </button>
          </form>
          <button
            type="button"
            className="btn-primary"
            disabled={salvando || Boolean(erro)}
            onClick={() => void salvar()}
          >
            {salvando ? "Salvando..." : "Salvar catálogo"}
          </button>
        </div>

        {erro && <p className="class-catalog-message class-catalog-error" role="alert">{erro}</p>}
        {mensagem && <p className="class-catalog-message" role="status">{mensagem}</p>}

        <div className="class-catalog-grid">
          {classes.map((classe) => (
            <ClassEditor
              key={classe.id}
              classe={classe}
              onChange={(alterar) => atualizarClasse(classe.id, alterar)}
              onDelete={() =>
                setClasses((atuais) => atuais.filter((item) => item.id !== classe.id))
              }
              onUpdateSkill={(id, alterar) => atualizarPericia(classe.id, id, alterar)}
              onUpdateAbility={(id, alterar) => atualizarHabilidade(classe.id, id, alterar)}
              onUpdateSpell={(id, alterar) => atualizarMagia(classe.id, id, alterar)}
            />
          ))}
        </div>

        {classes.length === 0 && (
          <p className="class-catalog-empty">Adicione uma classe para começar a montar o catálogo.</p>
        )}
      </div>
    </main>
  );
}

function ClassEditor({
  classe,
  onChange,
  onDelete,
  onUpdateSkill,
  onUpdateAbility,
  onUpdateSpell,
}: {
  classe: ClassDefinition;
  onChange: (alterar: (classe: ClassDefinition) => ClassDefinition) => void;
  onDelete: () => void;
  onUpdateSkill: (
    id: string,
    alterar: (pericia: ClassSkillDefinition) => ClassSkillDefinition,
  ) => void;
  onUpdateAbility: (
    id: string,
    alterar: (habilidade: ClassAbilityDefinition) => ClassAbilityDefinition,
  ) => void;
  onUpdateSpell: (
    id: string,
    alterar: (magia: ClassSpellDefinition) => ClassSpellDefinition,
  ) => void;
}) {
  const [nomeInicial] = useState(classe.nome);
  const [nomePericia, setNomePericia] = useState("");
  const [atributoPericia, setAtributoPericia] = useState<BaseAttributeKey>("forca");
  const [descricaoPericia, setDescricaoPericia] = useState("");
  const [nomeHabilidade, setNomeHabilidade] = useState("");
  const [descricaoHabilidade, setDescricaoHabilidade] = useState("");
  const [nivelHabilidade, setNivelHabilidade] = useState(1);
  const [nomeMagia, setNomeMagia] = useState("");
  const [descricaoMagia, setDescricaoMagia] = useState("");
  const [custoMagia, setCustoMagia] = useState(1);
  const [nivelMagia, setNivelMagia] = useState(1);

  function adicionarPericia(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nomePericia.trim()) return;
    const nova: ClassSkillDefinition = {
      id: criarId("pericia"),
      nome: nomePericia.trim(),
      atributo: atributoPericia,
      descricao: descricaoPericia.trim(),
    };
    onChange((atual) => ({ ...atual, pericias: [...atual.pericias, nova] }));
    setNomePericia("");
    setDescricaoPericia("");
  }

  function adicionarHabilidade(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nomeHabilidade.trim()) return;
    const nova: ClassAbilityDefinition = {
      id: criarId("habilidade"),
      nome: nomeHabilidade.trim(),
      descricao: descricaoHabilidade.trim(),
      nivel: nivelHabilidade,
    };
    onChange((atual) => ({ ...atual, habilidades: [...atual.habilidades, nova] }));
    setNomeHabilidade("");
    setDescricaoHabilidade("");
    setNivelHabilidade(1);
  }

  function adicionarMagia(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nomeMagia.trim()) return;
    const nova: ClassSpellDefinition = {
      id: criarId("magia"),
      nome: nomeMagia.trim(),
      descricao: descricaoMagia.trim(),
      custo: Math.max(0, custoMagia),
      nivel: Math.max(1, Math.min(20, nivelMagia)),
    };
    onChange((atual) => ({ ...atual, magias: [...atual.magias, nova] }));
    setNomeMagia("");
    setDescricaoMagia("");
    setCustoMagia(1);
    setNivelMagia(1);
  }

  return (
    <fieldset className="class-editor-card">
      <legend>
        <input
          aria-label="Nome da classe"
          value={classe.nome}
          maxLength={100}
          required
          onChange={(event) => {
            const nome = event.target.value;
            onChange((atual) => ({
              ...atual,
              aliases: nomeInicial !== nome
                ? [...new Set([...atual.aliases, nomeInicial])]
                : atual.aliases.filter((alias) => alias !== nomeInicial),
              nome,
            }));
          }}
        />
      </legend>
      <button type="button" className="class-editor-delete" onClick={onDelete}>
        Remover classe
      </button>

      <div className="class-editor-bonuses">
        {ATTRIBUTE_CONFIG.map(({ key, label }) => (
          <label key={key}>
            <span>{label}</span>
            <input
              type="number"
              aria-label={`${classe.nome} - ${label}`}
              value={classe.atributoBonus[key]}
              onChange={(event) =>
                onChange((atual) => ({
                  ...atual,
                  atributoBonus: {
                    ...atual.atributoBonus,
                    [key]: Number(event.target.value) || 0,
                  },
                }))
              }
            />
          </label>
        ))}
        <label>
          <span>Vida (PV)</span>
          <input
            type="number"
            aria-label={`${classe.nome} - Vida`}
            value={classe.hpBonus}
            onChange={(event) =>
              onChange((atual) => ({ ...atual, hpBonus: Number(event.target.value) || 0 }))
            }
          />
        </label>
        <label>
          <span>Mana (PM)</span>
          <input
            type="number"
            aria-label={`${classe.nome} - Mana`}
            value={classe.mpBonus}
            onChange={(event) =>
              onChange((atual) => ({ ...atual, mpBonus: Number(event.target.value) || 0 }))
            }
          />
        </label>
      </div>

      <label className="class-editor-magic-toggle">
        <input
          type="checkbox"
          checked={classe.usaMagia}
          onChange={(event) =>
            onChange((atual) => ({ ...atual, usaMagia: event.target.checked }))
          }
        />
        <span>Esta classe pode usar magias</span>
      </label>

      <section className="class-editor-section">
        <h3>Perícias da classe</h3>
        {classe.pericias.map((pericia) => (
          <div className="class-editor-entry" key={pericia.id}>
            <input
              aria-label={`${pericia.nome} - Nome da perícia`}
              value={pericia.nome}
              onChange={(event) =>
                onUpdateSkill(pericia.id, (atual) => ({ ...atual, nome: event.target.value }))
              }
            />
            <select
              aria-label={`${pericia.nome} - Atributo`}
              value={pericia.atributo}
              onChange={(event) =>
                onUpdateSkill(pericia.id, (atual) => ({
                  ...atual,
                  atributo: event.target.value as BaseAttributeKey,
                }))
              }
            >
              {ATTRIBUTE_CONFIG.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <input
              aria-label={`${pericia.nome} - Descrição`}
              value={pericia.descricao}
              placeholder="Descrição"
              onChange={(event) =>
                onUpdateSkill(pericia.id, (atual) => ({
                  ...atual,
                  descricao: event.target.value,
                }))
              }
            />
            <button
              type="button"
              aria-label={`Remover perícia ${pericia.nome}`}
              onClick={() =>
                onChange((atual) => ({
                  ...atual,
                  pericias: atual.pericias.filter((item) => item.id !== pericia.id),
                }))
              }
            >
              ×
            </button>
          </div>
        ))}
        <form className="class-editor-new-entry" onSubmit={adicionarPericia}>
          <input
            aria-label="Nova perícia"
            value={nomePericia}
            onChange={(event) => setNomePericia(event.target.value)}
            placeholder="Nome da perícia"
            required
          />
          <select
            aria-label="Atributo da nova perícia"
            value={atributoPericia}
            onChange={(event) => setAtributoPericia(event.target.value as BaseAttributeKey)}
          >
            {ATTRIBUTE_CONFIG.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input
            aria-label="Descrição da nova perícia"
            value={descricaoPericia}
            onChange={(event) => setDescricaoPericia(event.target.value)}
            placeholder="Descrição"
          />
          <button type="submit">Adicionar perícia</button>
        </form>
      </section>

      <section className="class-editor-section">
        <h3>Habilidades da classe</h3>
        {classe.habilidades.map((habilidade) => (
          <div className="class-editor-ability" key={habilidade.id}>
            <div className="class-editor-entry">
              <input
                aria-label={`${habilidade.nome} - Nome da habilidade`}
                value={habilidade.nome}
                onChange={(event) =>
                  onUpdateAbility(habilidade.id, (atual) => ({
                    ...atual,
                    nome: event.target.value,
                  }))
                }
              />
              <label>
                <span>Nível</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  aria-label={`${habilidade.nome} - Nível`}
                  value={habilidade.nivel}
                  onChange={(event) =>
                    onUpdateAbility(habilidade.id, (atual) => ({
                      ...atual,
                      nivel: Math.max(1, Math.min(20, Number(event.target.value) || 1)),
                    }))
                  }
                />
              </label>
              <button
                type="button"
                aria-label={`Remover habilidade ${habilidade.nome}`}
                onClick={() =>
                  onChange((atual) => ({
                    ...atual,
                    habilidades: atual.habilidades.filter((item) => item.id !== habilidade.id),
                  }))
                }
              >
                ×
              </button>
            </div>
            <textarea
              aria-label={`${habilidade.nome} - Descrição`}
              value={habilidade.descricao}
              placeholder="Descrição da habilidade"
              rows={2}
              onChange={(event) =>
                onUpdateAbility(habilidade.id, (atual) => ({
                  ...atual,
                  descricao: event.target.value,
                }))
              }
            />
          </div>
        ))}
        <form className="class-editor-new-ability" onSubmit={adicionarHabilidade}>
          <input
            aria-label="Nova habilidade"
            value={nomeHabilidade}
            onChange={(event) => setNomeHabilidade(event.target.value)}
            placeholder="Nome da habilidade"
            required
          />
          <input
            type="number"
            min={1}
            max={20}
            aria-label="Nível de desbloqueio"
            value={nivelHabilidade}
            onChange={(event) =>
              setNivelHabilidade(Math.max(1, Math.min(20, Number(event.target.value) || 1)))
            }
          />
          <textarea
            aria-label="Descrição da nova habilidade"
            value={descricaoHabilidade}
            onChange={(event) => setDescricaoHabilidade(event.target.value)}
            placeholder="Descrição"
            rows={2}
          />
          <button type="submit">Adicionar habilidade</button>
        </form>
      </section>

      {classe.usaMagia && (
        <section className="class-editor-section">
          <h3>Magias da classe</h3>
          {classe.magias.map((magia) => (
            <div className="class-editor-ability" key={magia.id}>
              <div className="class-editor-entry class-editor-spell-entry">
                <input
                  aria-label={`${magia.nome} - Nome da magia`}
                  value={magia.nome}
                  onChange={(event) =>
                    onUpdateSpell(magia.id, (atual) => ({
                      ...atual,
                      nome: event.target.value,
                    }))
                  }
                />
                <label>
                  <span>Custo (PM)</span>
                  <input
                    type="number"
                    min={0}
                    aria-label={`${magia.nome} - Custo em PM`}
                    value={magia.custo}
                    onChange={(event) =>
                      onUpdateSpell(magia.id, (atual) => ({
                        ...atual,
                        custo: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Nível</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    aria-label={`${magia.nome} - Nível`}
                    value={magia.nivel}
                    onChange={(event) =>
                      onUpdateSpell(magia.id, (atual) => ({
                        ...atual,
                        nivel: Math.max(1, Math.min(20, Number(event.target.value) || 1)),
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remover magia ${magia.nome}`}
                  onClick={() =>
                    onChange((atual) => ({
                      ...atual,
                      magias: atual.magias.filter((item) => item.id !== magia.id),
                    }))
                  }
                >
                  ×
                </button>
              </div>
              <textarea
                aria-label={`${magia.nome} - Descrição`}
                value={magia.descricao}
                placeholder="Descrição da magia"
                rows={2}
                onChange={(event) =>
                  onUpdateSpell(magia.id, (atual) => ({
                    ...atual,
                    descricao: event.target.value,
                  }))
                }
              />
            </div>
          ))}
          <form className="class-editor-new-ability" onSubmit={adicionarMagia}>
            <input
              aria-label="Nova magia"
              value={nomeMagia}
              onChange={(event) => setNomeMagia(event.target.value)}
              placeholder="Nome da magia"
              required
            />
            <input
              type="number"
              min={0}
              aria-label="Custo da nova magia em PM"
              value={custoMagia}
              onChange={(event) =>
                setCustoMagia(Math.max(0, Number(event.target.value) || 0))
              }
            />
            <input
              type="number"
              min={1}
              max={20}
              aria-label="Nível de desbloqueio da nova magia"
              value={nivelMagia}
              onChange={(event) =>
                setNivelMagia(Math.max(1, Math.min(20, Number(event.target.value) || 1)))
              }
            />
            <textarea
              aria-label="Descrição da nova magia"
              value={descricaoMagia}
              onChange={(event) => setDescricaoMagia(event.target.value)}
              placeholder="Descrição"
              rows={2}
            />
            <button type="submit">Adicionar magia</button>
          </form>
        </section>
      )}
    </fieldset>
  );
}
