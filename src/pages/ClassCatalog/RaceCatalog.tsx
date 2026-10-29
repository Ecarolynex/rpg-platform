import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  canManageGlobalRaceCatalog,
  getCatalogoGlobalRacas,
  salvarCatalogoGlobalRacas,
} from "../../services/api";
import { ATTRIBUTE_CONFIG, type BaseAttributeKey } from "../../data/personaRules";
import {
  chaveDeRaca,
  type RaceDefinition,
  type RaceTraitDefinition,
} from "../../data/raceCatalog";
// Reaproveita os estilos do catálogo de classes (mesma pasta) e acrescenta os da raça.
import "./ClassCatalog.css";
import "./RaceCatalog.css";

function criarId(prefixo: string) {
  const uuid = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefixo}-${uuid}`;
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

export default function RaceCatalog() {
  const [racas, setRacas] = useState<RaceDefinition[]>([]);
  const [snapshot, setSnapshot] = useState("[]");
  const [nomeNovaRaca, setNomeNovaRaca] = useState("");
  const [erroNovaRaca, setErroNovaRaca] = useState("");
  const [busca, setBusca] = useState("");
  const [recolhidas, setRecolhidas] = useState<Set<string>>(() => new Set());
  const [novaRacaId, setNovaRacaId] = useState<string | null>(null);
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
        getCatalogoGlobalRacas(),
        canManageGlobalRaceCatalog(),
      ]);
      setRacas(dados);
      setSnapshot(JSON.stringify(dados));
      setPodeAdministrar(podeEditar);
    } catch (error: unknown) {
      setFalhaCarga(true);
      setErro(mensagemDeErro(error, "Não foi possível carregar o catálogo de raças."));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const alterado = useMemo(
    () => !falhaCarga && JSON.stringify(racas) !== snapshot,
    [racas, snapshot, falhaCarga],
  );

  const nomesRepetidos = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const raca of racas) {
      const chave = chaveDeRaca(raca.nome);
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    return new Set(
      [...contagem].filter(([, total]) => total > 1).map(([chave]) => chave),
    );
  }, [racas]);

  const temNomeVazio = racas.some((raca) => !raca.nome.trim());
  const semRacas = racas.length === 0;
  const invalido = nomesRepetidos.size > 0 || temNomeVazio || semRacas;

  const termo = chaveDeRaca(busca);
  const visiveis = termo
    ? racas.filter(
        (raca) =>
          chaveDeRaca(raca.nome).includes(termo)
          || raca.aliases.some((alias) => chaveDeRaca(alias).includes(termo)),
      )
    : racas;

  useEffect(() => {
    if (!alterado) return;
    function avisar(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [alterado]);

  useEffect(() => {
    if (!novaRacaId) return;
    document
      .getElementById(`raca-${novaRacaId}`)
      ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    setNovaRacaId(null);
  }, [novaRacaId]);

  async function salvar() {
    if (!podeAdministrar || falhaCarga || invalido || salvando) return;
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const salvas = await salvarCatalogoGlobalRacas(racas);
      setRacas(salvas);
      setSnapshot(JSON.stringify(salvas));
      setMensagem("Catálogo de raças atualizado.");
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível salvar as alterações."));
    } finally {
      setSalvando(false);
    }
  }

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

  function atualizarRaca(id: string, alterar: (raca: RaceDefinition) => RaceDefinition) {
    setMensagem("");
    setRacas((atuais) => atuais.map((raca) => (raca.id === id ? alterar(raca) : raca)));
  }

  function atualizarTraco(
    racaId: string,
    tracoId: string,
    alterar: (traco: RaceTraitDefinition) => RaceTraitDefinition,
  ) {
    atualizarRaca(racaId, (raca) => ({
      ...raca,
      tracos: raca.tracos.map((traco) => (traco.id === tracoId ? alterar(traco) : traco)),
    }));
  }

  function adicionarRaca(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nome = nomeNovaRaca.trim();
    if (!nome) return;
    if (racas.some((raca) => chaveDeRaca(raca.nome) === chaveDeRaca(nome))) {
      setErroNovaRaca(`Já existe uma raça chamada "${nome}". Escolha outro nome.`);
      return;
    }
    const id = criarId("raca");
    const atributoBonus = Object.fromEntries(
      ATTRIBUTE_CONFIG.map(({ key }) => [key, 0]),
    ) as Record<BaseAttributeKey, number>;
    setRacas((atuais) => [
      ...atuais,
      { id, nome, aliases: [], descricao: "", atributoBonus, hpBonus: 0, mpBonus: 0, tracos: [] },
    ]);
    setBusca("");
    setNomeNovaRaca("");
    setErroNovaRaca("");
    setMensagem("");
    setNovaRacaId(id);
  }

  function duplicarRaca(origem: RaceDefinition) {
    const id = criarId("raca");
    const existentes = new Set(racas.map((raca) => chaveDeRaca(raca.nome)));
    const base = `${origem.nome} (cópia)`;
    let nome = base;
    let contador = 2;
    while (existentes.has(chaveDeRaca(nome))) {
      nome = `${base} ${contador}`;
      contador += 1;
    }
    const copia: RaceDefinition = {
      ...origem,
      id,
      nome,
      aliases: [],
      atributoBonus: { ...origem.atributoBonus },
      tracos: origem.tracos.map((traco) => ({ ...traco, id: criarId("traco") })),
    };
    setMensagem("");
    setBusca("");
    setRacas((atuais) => [...atuais, copia]);
    setNovaRacaId(id);
  }

  function removerRaca(raca: RaceDefinition) {
    const confirmado = window.confirm(
      `Remover a raça "${raca.nome}"?\n\nPersonagens que já usam essa raça mantêm o nome, mas deixam de receber os bônus dela. A remoção só vale depois de salvar o catálogo.`,
    );
    if (!confirmado) return;
    setMensagem("");
    setRacas((atuais) => atuais.filter((item) => item.id !== raca.id));
  }

  function descartarAlteracoes() {
    if (!window.confirm("Descartar todas as alterações que ainda não foram salvas?")) return;
    setRacas(JSON.parse(snapshot) as RaceDefinition[]);
    setErro("");
    setMensagem("");
  }

  function alternarRaca(id: string) {
    setRecolhidas((atuais) => {
      const proximas = new Set(atuais);
      if (proximas.has(id)) proximas.delete(id);
      else proximas.add(id);
      return proximas;
    });
  }

  if (carregando) {
    return <main className="class-catalog-page"><p>Carregando raças...</p></main>;
  }

  const totalTracos = racas.reduce((soma, raca) => soma + raca.tracos.length, 0);

  return (
    <main className="class-catalog-page">
      <header className="class-catalog-header">
        <span className="class-catalog-kicker">Regras compartilhadas</span>
        <h1>Raças e traços raciais</h1>
        <p>
          Catálogo global administrado por operadores autorizados. As raças cadastradas
          aparecem na criação de personagens e dão seus bônus automaticamente em todas as campanhas.
        </p>
        <dl className="class-catalog-stats">
          <div><dt>Raças</dt><dd>{racas.length}</dd></div>
          <div><dt>Traços</dt><dd>{totalTracos}</dd></div>
        </dl>
      </header>

      <div className="class-catalog-actionbar">
        <div className="class-catalog-state">
          {podeAdministrar && (
            <span className={`class-catalog-badge${alterado ? " is-dirty" : ""}`}>
              {alterado ? "Alterações não salvas" : "Tudo salvo"}
            </span>
          )}
          {podeAdministrar && invalido && !falhaCarga && (
            <span className="class-catalog-badge is-error">
              {semRacas
                ? "Cadastre pelo menos uma raça para salvar"
                : "Corrija nomes vazios ou repetidos para salvar"}
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
          <form onSubmit={adicionarRaca} className="class-catalog-add">
            <label>
              <span>Nova raça</span>
              <input
                value={nomeNovaRaca}
                onChange={(event) => {
                  setNomeNovaRaca(event.target.value);
                  setErroNovaRaca("");
                }}
                placeholder="Ex.: Anão das Profundezas"
                maxLength={100}
                required
              />
            </label>
            <button type="submit" className="btn-ghost" disabled={!nomeNovaRaca.trim()}>
              Adicionar raça
            </button>
            {erroNovaRaca && (
              <p className="class-catalog-inline-error" role="alert">{erroNovaRaca}</p>
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
              placeholder="Nome da raça"
              aria-label="Buscar raça"
            />
          </label>
          {racas.length > 1 && (
            <div className="class-catalog-collapse">
              <button type="button" onClick={() => setRecolhidas(new Set())}>
                Expandir todas
              </button>
              <button
                type="button"
                onClick={() => setRecolhidas(new Set(racas.map((raca) => raca.id)))}
              >
                Recolher todas
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="class-catalog-grid">
        {visiveis.map((raca) => (
          <RaceEditor
            key={raca.id}
            readOnly={!podeAdministrar}
            raca={raca}
            aberta={!recolhidas.has(raca.id)}
            repetida={nomesRepetidos.has(chaveDeRaca(raca.nome))}
            onToggle={() => alternarRaca(raca.id)}
            onChange={(alterar) => atualizarRaca(raca.id, alterar)}
            onDelete={() => removerRaca(raca)}
            onDuplicate={() => duplicarRaca(raca)}
            onUpdateTrait={(id, alterar) => atualizarTraco(raca.id, id, alterar)}
          />
        ))}
      </div>

      {racas.length === 0 && !falhaCarga && (
        <p className="class-catalog-empty">
          {podeAdministrar
            ? "Nenhuma raça cadastrada. Digite um nome em “Nova raça” para começar."
            : "Nenhuma raça cadastrada ainda."}
        </p>
      )}
      {racas.length > 0 && visiveis.length === 0 && (
        <p className="class-catalog-empty">
          Nenhuma raça encontrada para “{busca.trim()}”.{" "}
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

function RaceEditor({
  raca,
  readOnly,
  aberta,
  repetida,
  onToggle,
  onChange,
  onDelete,
  onDuplicate,
  onUpdateTrait,
}: {
  raca: RaceDefinition;
  readOnly: boolean;
  aberta: boolean;
  repetida: boolean;
  onToggle: () => void;
  onChange: (alterar: (raca: RaceDefinition) => RaceDefinition) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdateTrait: (
    id: string,
    alterar: (traco: RaceTraitDefinition) => RaceTraitDefinition,
  ) => void;
}) {
  const [nomeInicial] = useState(raca.nome);
  const [nomeTraco, setNomeTraco] = useState("");
  const [descricaoTraco, setDescricaoTraco] = useState("");

  const corpoId = `corpo-${raca.id}`;
  const nomeVazio = !raca.nome.trim();

  function adicionarTraco(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nomeTraco.trim()) return;
    const novo: RaceTraitDefinition = {
      id: criarId("traco"),
      nome: nomeTraco.trim(),
      descricao: descricaoTraco.trim(),
    };
    onChange((atual) => ({ ...atual, tracos: [...atual.tracos, novo] }));
    setNomeTraco("");
    setDescricaoTraco("");
  }

  return (
    <article className="class-editor-card" id={`raca-${raca.id}`}>
      <button
        type="button"
        className="class-editor-toggle"
        aria-expanded={aberta}
        aria-controls={corpoId}
        onClick={onToggle}
      >
        <span className="class-editor-chevron" aria-hidden="true" data-aberta={aberta} />
        <span className="class-editor-title">{raca.nome.trim() || "Raça sem nome"}</span>
        <span className="class-editor-chips">
          <span className="class-editor-chip" data-sinal={sinalDoBonus(raca.hpBonus)}>
            PV {formatarBonus(raca.hpBonus)}
          </span>
          <span className="class-editor-chip" data-sinal={sinalDoBonus(raca.mpBonus)}>
            PM {formatarBonus(raca.mpBonus)}
          </span>
          {ATTRIBUTE_CONFIG.filter(({ key }) => raca.atributoBonus[key] !== 0).map(
            ({ key, abbr }) => (
              <span
                key={key}
                className="class-editor-chip"
                data-sinal={sinalDoBonus(raca.atributoBonus[key])}
              >
                {abbr} {formatarBonus(raca.atributoBonus[key])}
              </span>
            ),
          )}
          <span className="class-editor-chip">{raca.tracos.length} traços</span>
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
            <span>Nome da raça</span>
            <input
              aria-label="Nome da raça"
              aria-invalid={repetida || nomeVazio}
              value={raca.nome}
              maxLength={100}
              required
              onChange={(event) => {
                const nome = event.target.value;
                onChange((atual) => ({
                  ...atual,
                  // Personagens guardam a raça pelo nome: o nome antigo vira apelido para continuar valendo.
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
              Remover raça
            </button>
          </div>
        </div>

        <label className="race-editor-description">
          <span>Descrição da raça</span>
          <textarea
            aria-label="Descrição da raça"
            value={raca.descricao}
            placeholder="Origem, aparência e costumes desta raça"
            rows={3}
            maxLength={500}
            onChange={(event) =>
              onChange((atual) => ({ ...atual, descricao: event.target.value }))
            }
          />
        </label>

        {raca.aliases.length > 0 && (
          <p className="class-editor-hint">
            Também reconhecida como: {raca.aliases.join(", ")}.
          </p>
        )}

        <div className="class-editor-bonuses" role="group" aria-label="Bônus da raça">
          {ATTRIBUTE_CONFIG.map(({ key, label }) => (
            <label key={key} data-sinal={sinalDoBonus(raca.atributoBonus[key])}>
              <span>{label}</span>
              <input
                type="number"
                aria-label={`${raca.nome} - ${label}`}
                value={raca.atributoBonus[key]}
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
          <label data-sinal={sinalDoBonus(raca.hpBonus)}>
            <span>Vida (PV)</span>
            <input
              type="number"
              aria-label={`${raca.nome} - Vida`}
              value={raca.hpBonus}
              onChange={(event) =>
                onChange((atual) => ({ ...atual, hpBonus: Number(event.target.value) || 0 }))
              }
            />
          </label>
          <label data-sinal={sinalDoBonus(raca.mpBonus)}>
            <span>Mana (PM)</span>
            <input
              type="number"
              aria-label={`${raca.nome} - Mana`}
              value={raca.mpBonus}
              onChange={(event) =>
                onChange((atual) => ({ ...atual, mpBonus: Number(event.target.value) || 0 }))
              }
            />
          </label>
        </div>

        <Secao titulo="Traços raciais" total={raca.tracos.length}>
          {raca.tracos.length === 0 && (
            <p className="class-editor-empty">Nenhum traço cadastrado.</p>
          )}
          {raca.tracos.map((traco) => (
            <div className="class-editor-ability" key={traco.id}>
              <div className="class-editor-entry is-trait">
                <input
                  aria-label={`${traco.nome} - Nome do traço`}
                  value={traco.nome}
                  onChange={(event) =>
                    onUpdateTrait(traco.id, (atual) => ({ ...atual, nome: event.target.value }))
                  }
                />
                <button
                  type="button"
                  className="class-editor-remove"
                  aria-label={`Remover traço ${traco.nome}`}
                  onClick={() =>
                    onChange((atual) => ({
                      ...atual,
                      tracos: atual.tracos.filter((item) => item.id !== traco.id),
                    }))
                  }
                >
                  ×
                </button>
              </div>
              <textarea
                aria-label={`${traco.nome} - Descrição`}
                value={traco.descricao}
                placeholder="Descrição do traço"
                rows={2}
                onChange={(event) =>
                  onUpdateTrait(traco.id, (atual) => ({
                    ...atual,
                    descricao: event.target.value,
                  }))
                }
              />
            </div>
          ))}
          <form className="class-editor-new is-trait" onSubmit={adicionarTraco}>
            <label>
              <span>Novo traço</span>
              <input
                aria-label="Novo traço racial"
                value={nomeTraco}
                onChange={(event) => setNomeTraco(event.target.value)}
                placeholder="Nome do traço"
                required
              />
            </label>
            <label className="is-wide">
              <span>Descrição</span>
              <textarea
                aria-label="Descrição do novo traço"
                value={descricaoTraco}
                onChange={(event) => setDescricaoTraco(event.target.value)}
                placeholder="O que este traço permite ou muda"
                rows={2}
              />
            </label>
            <button type="submit">Adicionar traço</button>
          </form>
        </Secao>
      </fieldset>
    </article>
  );
}
