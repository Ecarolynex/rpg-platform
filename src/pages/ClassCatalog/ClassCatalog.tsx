import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  canManageGlobalClassCatalog,
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

function normalizarNome(nome: string) {
  return nome.trim().toLocaleLowerCase();
}

function formatarBonus(valor: number) {
  return valor > 0 ? `+${valor}` : `${valor}`;
}

function sinalDoBonus(valor: number) {
  if (valor > 0) return "positivo";
  if (valor < 0) return "negativo";
  return "neutro";
}

function mensagemDeErro(error: unknown, padrao: string) {
  return error instanceof Error && error.message ? error.message : padrao;
}

export default function ClassCatalog() {
  const [classes, setClasses] = useState<ClassDefinition[]>([]);
  const [snapshot, setSnapshot] = useState("[]");
  const [nomeNovaClasse, setNomeNovaClasse] = useState("");
  const [erroNovaClasse, setErroNovaClasse] = useState("");
  const [busca, setBusca] = useState("");
  const [recolhidas, setRecolhidas] = useState<Set<string>>(() => new Set());
  const [novaClasseId, setNovaClasseId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falhaCarga, setFalhaCarga] = useState(false);
  const [podeAdministrar, setPodeAdministrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    setFalhaCarga(false);
    try {
      const [dados, podeEditar] = await Promise.all([
        getCatalogoGlobalClasses(),
        canManageGlobalClassCatalog(),
      ]);
      setClasses(dados);
      setSnapshot(JSON.stringify(dados));
      setPodeAdministrar(podeEditar);
    } catch (error: unknown) {
      setFalhaCarga(true);
      setErro(mensagemDeErro(error, "Não foi possível carregar o catálogo."));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const alterado = useMemo(
    () => !falhaCarga && JSON.stringify(classes) !== snapshot,
    [classes, snapshot, falhaCarga],
  );

  const nomesRepetidos = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const classe of classes) {
      const chave = normalizarNome(classe.nome);
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    return new Set(
      [...contagem].filter(([, total]) => total > 1).map(([chave]) => chave),
    );
  }, [classes]);

  const temNomeVazio = classes.some((classe) => !classe.nome.trim());
  const invalido = nomesRepetidos.size > 0 || temNomeVazio;

  const termo = normalizarNome(busca);
  const visiveis = termo
    ? classes.filter(
        (classe) =>
          normalizarNome(classe.nome).includes(termo)
          || classe.aliases.some((alias) => normalizarNome(alias).includes(termo)),
      )
    : classes;

  // Avisa antes de fechar a aba com alterações pendentes.
  useEffect(() => {
    if (!alterado) return;
    function avisar(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [alterado]);

  // Leva o foco visual até a classe recém-criada ou duplicada.
  useEffect(() => {
    if (!novaClasseId) return;
    document
      .getElementById(`classe-${novaClasseId}`)
      ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    setNovaClasseId(null);
  }, [novaClasseId]);

  async function salvar() {
    if (!podeAdministrar || falhaCarga || invalido || salvando) return;
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const salvas = await salvarCatalogoGlobalClasses(classes);
      setClasses(salvas);
      setSnapshot(JSON.stringify(salvas));
      setMensagem("Catálogo compartilhado atualizado.");
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível salvar as alterações."));
    } finally {
      setSalvando(false);
    }
  }

  // Atalho Ctrl+S / Cmd+S para salvar.
  useEffect(() => {
    function aoTeclar(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (alterado) void salvar();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  });

  function atualizarClasse(
    id: string,
    alterar: (classe: ClassDefinition) => ClassDefinition,
  ) {
    setMensagem("");
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

  function adicionarClasse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nome = nomeNovaClasse.trim();
    if (!nome) return;
    if (classes.some((classe) => normalizarNome(classe.nome) === normalizarNome(nome))) {
      setErroNovaClasse(`Já existe uma classe chamada "${nome}". Escolha outro nome.`);
      return;
    }
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
    setBusca("");
    setNomeNovaClasse("");
    setErroNovaClasse("");
    setMensagem("");
    setNovaClasseId(id);
  }

  function duplicarClasse(origem: ClassDefinition) {
    const id = criarId("classe");
    const existentes = new Set(classes.map((classe) => normalizarNome(classe.nome)));
    const base = `${origem.nome} (cópia)`;
    let nome = base;
    let contador = 2;
    while (existentes.has(normalizarNome(nome))) {
      nome = `${base} ${contador}`;
      contador += 1;
    }
    const copia: ClassDefinition = {
      ...origem,
      id,
      nome,
      aliases: [],
      atributoBonus: { ...origem.atributoBonus },
      pericias: origem.pericias.map((item) => ({ ...item, id: criarId("pericia") })),
      habilidades: origem.habilidades.map((item) => ({ ...item, id: criarId("habilidade") })),
      magias: origem.magias.map((item) => ({ ...item, id: criarId("magia") })),
    };
    setMensagem("");
    setBusca("");
    setClasses((atuais) => [...atuais, copia]);
    setNovaClasseId(id);
  }

  function removerClasse(classe: ClassDefinition) {
    const confirmado = window.confirm(
      `Remover a classe "${classe.nome}"?\n\nA remoção só vale depois de salvar o catálogo e afeta a criação de personagens em todas as campanhas.`,
    );
    if (!confirmado) return;
    setMensagem("");
    setClasses((atuais) => atuais.filter((item) => item.id !== classe.id));
  }

  function descartarAlteracoes() {
    if (!window.confirm("Descartar todas as alterações que ainda não foram salvas?")) return;
    setClasses(JSON.parse(snapshot) as ClassDefinition[]);
    setErro("");
    setMensagem("");
  }

  function alternarClasse(id: string) {
    setRecolhidas((atuais) => {
      const proximas = new Set(atuais);
      if (proximas.has(id)) proximas.delete(id);
      else proximas.add(id);
      return proximas;
    });
  }

  if (carregando) {
    return <main className="class-catalog-page"><p>Carregando regras...</p></main>;
  }

  const totalHabilidades = classes.reduce((soma, classe) => soma + classe.habilidades.length, 0);

  return (
    <main className="class-catalog-page">
      <header className="class-catalog-header">
        <span className="class-catalog-kicker">Regras compartilhadas</span>
        <h1>Classes, perícias e habilidades</h1>
        <p>
          Catálogo global administrado por operadores autorizados. As classes
          cadastradas ficam disponíveis na criação de personagens e em todas as campanhas.
        </p>
        <dl className="class-catalog-stats">
          <div><dt>Classes</dt><dd>{classes.length}</dd></div>
          <div><dt>Habilidades</dt><dd>{totalHabilidades}</dd></div>
        </dl>
      </header>

      <div className="class-catalog-actionbar">
        <div className="class-catalog-state">
          {podeAdministrar && (
            <span className={`class-catalog-badge${alterado ? " is-dirty" : ""}`}>
              {alterado ? "Alterações não salvas" : "Tudo salvo"}
            </span>
          )}
          {podeAdministrar && invalido && (
            <span className="class-catalog-badge is-error">
              Corrija nomes vazios ou repetidos para salvar
            </span>
          )}
          {!podeAdministrar && (
            <p className="class-catalog-readonly">Catálogo somente leitura.</p>
          )}
        </div>
        <div className="class-catalog-actions">
          {podeAdministrar && alterado && (
            <button
              type="button"
              className="btn-ghost"
              disabled={salvando}
              onClick={descartarAlteracoes}
            >
              Descartar
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            title={podeAdministrar ? "Atalho: Ctrl+S" : undefined}
            disabled={!podeAdministrar || salvando || falhaCarga || invalido || !alterado}
            onClick={() => void salvar()}
          >
            {salvando ? "Salvando..." : "Salvar catálogo"}
          </button>
        </div>
      </div>

      {erro && (
        <div className="class-catalog-message class-catalog-error" role="alert">
          <span>{erro}</span>
          {falhaCarga && (
            <button type="button" className="btn-ghost" onClick={() => void carregar()}>
              Tentar novamente
            </button>
          )}
        </div>
      )}
      {mensagem && <p className="class-catalog-message" role="status">{mensagem}</p>}

      <div className="class-catalog-toolbar">
        {podeAdministrar && (
          <form onSubmit={adicionarClasse} className="class-catalog-add">
            <label>
              <span>Nova classe</span>
              <input
                value={nomeNovaClasse}
                onChange={(event) => {
                  setNomeNovaClasse(event.target.value);
                  setErroNovaClasse("");
                }}
                placeholder="Ex.: Guardião das Sombras"
                maxLength={100}
                required
              />
            </label>
            <button type="submit" className="btn-ghost" disabled={!nomeNovaClasse.trim()}>
              Adicionar classe
            </button>
            {erroNovaClasse && (
              <p className="class-catalog-inline-error" role="alert">{erroNovaClasse}</p>
            )}
          </form>
        )}

        <div className="class-catalog-find">
          <label>
            <span>Buscar</span>
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Nome da classe"
              aria-label="Buscar classe"
            />
          </label>
          {classes.length > 1 && (
            <div className="class-catalog-collapse">
              <button type="button" onClick={() => setRecolhidas(new Set())}>
                Expandir todas
              </button>
              <button
                type="button"
                onClick={() => setRecolhidas(new Set(classes.map((classe) => classe.id)))}
              >
                Recolher todas
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="class-catalog-grid">
        {visiveis.map((classe) => (
          <ClassEditor
            key={classe.id}
            readOnly={!podeAdministrar}
            classe={classe}
            aberta={!recolhidas.has(classe.id)}
            repetida={nomesRepetidos.has(normalizarNome(classe.nome))}
            onToggle={() => alternarClasse(classe.id)}
            onChange={(alterar) => atualizarClasse(classe.id, alterar)}
            onDelete={() => removerClasse(classe)}
            onDuplicate={() => duplicarClasse(classe)}
            onUpdateSkill={(id, alterar) => atualizarPericia(classe.id, id, alterar)}
            onUpdateAbility={(id, alterar) => atualizarHabilidade(classe.id, id, alterar)}
            onUpdateSpell={(id, alterar) => atualizarMagia(classe.id, id, alterar)}
          />
        ))}
      </div>

      {classes.length === 0 && !falhaCarga && (
        <p className="class-catalog-empty">
          {podeAdministrar
            ? "Nenhuma classe cadastrada. Digite um nome em “Nova classe” para começar."
            : "Nenhuma classe cadastrada ainda."}
        </p>
      )}
      {classes.length > 0 && visiveis.length === 0 && (
        <p className="class-catalog-empty">
          Nenhuma classe encontrada para “{busca.trim()}”.{" "}
          <button type="button" className="class-catalog-link" onClick={() => setBusca("")}>
            Limpar busca
          </button>
        </p>
      )}
    </main>
  );
}

function Secao({
  titulo,
  total,
  children,
}: {
  titulo: string;
  total: number;
  children: ReactNode;
}) {
  return (
    <details className="class-editor-section" open>
      <summary>
        <span>{titulo}</span>
        <span className="class-editor-count">{total}</span>
      </summary>
      <div className="class-editor-section-body">{children}</div>
    </details>
  );
}

function ClassEditor({
  classe,
  readOnly,
  aberta,
  repetida,
  onToggle,
  onChange,
  onDelete,
  onDuplicate,
  onUpdateSkill,
  onUpdateAbility,
  onUpdateSpell,
}: {
  classe: ClassDefinition;
  readOnly: boolean;
  aberta: boolean;
  repetida: boolean;
  onToggle: () => void;
  onChange: (alterar: (classe: ClassDefinition) => ClassDefinition) => void;
  onDelete: () => void;
  onDuplicate: () => void;
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

  const corpoId = `corpo-${classe.id}`;
  const nomeVazio = !classe.nome.trim();

  function adicionarPericia(event: FormEvent<HTMLFormElement>) {
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

  function adicionarHabilidade(event: FormEvent<HTMLFormElement>) {
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

  function adicionarMagia(event: FormEvent<HTMLFormElement>) {
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
    <article className="class-editor-card" id={`classe-${classe.id}`}>
      <button
        type="button"
        className="class-editor-toggle"
        aria-expanded={aberta}
        aria-controls={corpoId}
        onClick={onToggle}
      >
        <span className="class-editor-chevron" aria-hidden="true" data-aberta={aberta} />
        <span className="class-editor-title">{classe.nome.trim() || "Classe sem nome"}</span>
        <span className="class-editor-chips">
          <span className="class-editor-chip" data-sinal={sinalDoBonus(classe.hpBonus)}>
            PV {formatarBonus(classe.hpBonus)}
          </span>
          <span className="class-editor-chip" data-sinal={sinalDoBonus(classe.mpBonus)}>
            PM {formatarBonus(classe.mpBonus)}
          </span>
          <span className="class-editor-chip">{classe.pericias.length} perícias</span>
          <span className="class-editor-chip">{classe.habilidades.length} habilidades</span>
          {classe.usaMagia && (
            <span className="class-editor-chip is-magic">{classe.magias.length} magias</span>
          )}
          {(repetida || nomeVazio) && (
            <span className="class-editor-chip is-error">
              {nomeVazio ? "Nome vazio" : "Nome repetido"}
            </span>
          )}
        </span>
      </button>

      <fieldset className="class-editor-body" id={corpoId} hidden={!aberta} disabled={readOnly}>
        <div className="class-editor-head">
          <label className="class-editor-name">
            <span>Nome da classe</span>
            <input
              aria-label="Nome da classe"
              aria-invalid={repetida || nomeVazio}
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
          </label>
          <div className="class-editor-tools">
            <button type="button" className="class-editor-duplicate" onClick={onDuplicate}>
              Duplicar
            </button>
            <button type="button" className="class-editor-delete" onClick={onDelete}>
              Remover classe
            </button>
          </div>
        </div>

        <div className="class-editor-bonuses" role="group" aria-label="Bônus da classe">
          {ATTRIBUTE_CONFIG.map(({ key, label }) => (
            <label key={key} data-sinal={sinalDoBonus(classe.atributoBonus[key])}>
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
          <label data-sinal={sinalDoBonus(classe.hpBonus)}>
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
          <label data-sinal={sinalDoBonus(classe.mpBonus)}>
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
        {!classe.usaMagia && classe.magias.length > 0 && (
          <p className="class-editor-hint">
            {classe.magias.length} magia(s) continuam guardadas e voltam a aparecer
            se você reativar esta opção.
          </p>
        )}

        <Secao titulo="Perícias da classe" total={classe.pericias.length}>
          {classe.pericias.length === 0 && (
            <p className="class-editor-empty">Nenhuma perícia cadastrada.</p>
          )}
          {classe.pericias.map((pericia) => (
            <div className="class-editor-entry is-skill" key={pericia.id}>
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
                className="class-editor-remove"
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
          <form className="class-editor-new is-skill" onSubmit={adicionarPericia}>
            <label>
              <span>Nova perícia</span>
              <input
                aria-label="Nova perícia"
                value={nomePericia}
                onChange={(event) => setNomePericia(event.target.value)}
                placeholder="Nome da perícia"
                required
              />
            </label>
            <label>
              <span>Atributo</span>
              <select
                aria-label="Atributo da nova perícia"
                value={atributoPericia}
                onChange={(event) => setAtributoPericia(event.target.value as BaseAttributeKey)}
              >
                {ATTRIBUTE_CONFIG.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Descrição</span>
              <input
                aria-label="Descrição da nova perícia"
                value={descricaoPericia}
                onChange={(event) => setDescricaoPericia(event.target.value)}
                placeholder="O que a perícia permite fazer"
              />
            </label>
            <button type="submit">Adicionar perícia</button>
          </form>
        </Secao>

        <Secao titulo="Habilidades da classe" total={classe.habilidades.length}>
          {classe.habilidades.length === 0 && (
            <p className="class-editor-empty">Nenhuma habilidade cadastrada.</p>
          )}
          {classe.habilidades.map((habilidade) => (
            <div className="class-editor-ability" key={habilidade.id}>
              <div className="class-editor-entry is-ability">
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
                <label className="class-editor-level">
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
                  className="class-editor-remove"
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
          <form className="class-editor-new is-ability" onSubmit={adicionarHabilidade}>
            <label>
              <span>Nova habilidade</span>
              <input
                aria-label="Nova habilidade"
                value={nomeHabilidade}
                onChange={(event) => setNomeHabilidade(event.target.value)}
                placeholder="Nome da habilidade"
                required
              />
            </label>
            <label>
              <span>Nível</span>
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
            </label>
            <label className="is-wide">
              <span>Descrição</span>
              <textarea
                aria-label="Descrição da nova habilidade"
                value={descricaoHabilidade}
                onChange={(event) => setDescricaoHabilidade(event.target.value)}
                placeholder="O que acontece quando a habilidade é usada"
                rows={2}
              />
            </label>
            <button type="submit">Adicionar habilidade</button>
          </form>
        </Secao>

        {classe.usaMagia && (
          <Secao titulo="Magias da classe" total={classe.magias.length}>
            {classe.magias.length === 0 && (
              <p className="class-editor-empty">Nenhuma magia cadastrada.</p>
            )}
            {classe.magias.map((magia) => (
              <div className="class-editor-ability" key={magia.id}>
                <div className="class-editor-entry is-spell">
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
                  <label className="class-editor-level">
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
                  <label className="class-editor-level">
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
                    className="class-editor-remove"
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
            <form className="class-editor-new is-spell" onSubmit={adicionarMagia}>
              <label>
                <span>Nova magia</span>
                <input
                  aria-label="Nova magia"
                  value={nomeMagia}
                  onChange={(event) => setNomeMagia(event.target.value)}
                  placeholder="Nome da magia"
                  required
                />
              </label>
              <label>
                <span>Custo (PM)</span>
                <input
                  type="number"
                  min={0}
                  aria-label="Custo da nova magia em PM"
                  value={custoMagia}
                  onChange={(event) =>
                    setCustoMagia(Math.max(0, Number(event.target.value) || 0))
                  }
                />
              </label>
              <label>
                <span>Nível</span>
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
              </label>
              <label className="is-wide">
                <span>Descrição</span>
                <textarea
                  aria-label="Descrição da nova magia"
                  value={descricaoMagia}
                  onChange={(event) => setDescricaoMagia(event.target.value)}
                  placeholder="Efeito da magia"
                  rows={2}
                />
              </label>
              <button type="submit">Adicionar magia</button>
            </form>
          </Secao>
        )}
      </fieldset>
    </article>
  );
}