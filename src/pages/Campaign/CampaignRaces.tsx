import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { ATTRIBUTE_CONFIG, type BaseAttributeKey } from "../../data/personaRules";
import { salvarRacasCampanha } from "../../services/api";
import {
  chaveDeRaca,
  racasDaCampanha,
  type CampaignRaceConfig,
  type CampaignRaceOverride,
  type RaceDefinition,
  type RaceResolvida,
} from "../../data/raceCatalog";
import "./CampaignRaces.css";

interface CampaignRacesProps {
  campanhaId: string;
  isMaster: boolean;
  catalogo: RaceDefinition[];
  config: CampaignRaceConfig;
  /** true quando a configuração não pôde ser lida: bloqueia o salvamento para não apagar o que já existe. */
  falhaCarga: boolean;
  onSaved: (config: CampaignRaceConfig) => void;
}

type Filtro = "TODAS" | "DISPONIVEIS" | "BLOQUEADAS";

function criarId() {
  const uuid = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `raca-campanha-${uuid}`;
}

function bonusZerado(): Record<BaseAttributeKey, number> {
  return Object.fromEntries(
    ATTRIBUTE_CONFIG.map(({ key }) => [key, 0]),
  ) as Record<BaseAttributeKey, number>;
}

function formatar(valor: number) {
  return valor > 0 ? `+${valor}` : `${valor}`;
}

function resumoAtributos(raca: RaceResolvida) {
  const partes = ATTRIBUTE_CONFIG
    .filter(({ key }) => raca.atributoBonus[key] !== 0)
    .map(({ key, abbr }) => `${abbr} ${formatar(raca.atributoBonus[key])}`);
  return partes.length > 0 ? partes.join(" · ") : "Sem bônus";
}

function limparOverrides(overrides: Record<string, CampaignRaceOverride>) {
  return Object.fromEntries(
    Object.entries(overrides).filter(
      ([, o]) =>
        o.bloqueada
        || o.atributoBonus !== undefined
        || o.hpBonus !== undefined
        || o.mpBonus !== undefined,
    ),
  );
}

export default function CampaignRaces({
  campanhaId,
  isMaster,
  catalogo,
  config,
  falhaCarga,
  onSaved,
}: CampaignRacesProps) {
  const [rascunho, setRascunho] = useState<CampaignRaceConfig>(config);
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [nomeNova, setNomeNova] = useState("");
  const [descricaoNova, setDescricaoNova] = useState("");
  const [bonusNova, setBonusNova] = useState<Record<BaseAttributeKey, number>>(bonusZerado);
  const [hpNova, setHpNova] = useState(0);
  const [mpNova, setMpNova] = useState(0);
  const [erroNova, setErroNova] = useState("");

  // Só volta ao que está salvo quando o servidor trouxer algo diferente
  // (recarregar a página de campanha por outro motivo não apaga edições em andamento).
  const configSalva = JSON.stringify(config);
  useEffect(() => {
    setRascunho(JSON.parse(configSalva) as CampaignRaceConfig);
  }, [configSalva]);

  const alterado = JSON.stringify(rascunho) !== configSalva;
  const podeEditar = isMaster && !falhaCarga;

  const resolvidas = useMemo(() => racasDaCampanha(catalogo, rascunho), [catalogo, rascunho]);
  const totalBloqueadas = resolvidas.filter((raca) => raca.bloqueada).length;
  const totalDisponiveis = resolvidas.length - totalBloqueadas;

  const termo = chaveDeRaca(busca);
  const visiveis = resolvidas.filter((raca) => {
    if (filtro === "DISPONIVEIS" && raca.bloqueada) return false;
    if (filtro === "BLOQUEADAS" && !raca.bloqueada) return false;
    return !termo || chaveDeRaca(raca.nome).includes(termo);
  });

  function mudarOverride(id: string, alterar: (atual: CampaignRaceOverride) => CampaignRaceOverride) {
    setMensagem("");
    setRascunho((atual) => ({
      ...atual,
      overrides: limparOverrides({
        ...atual.overrides,
        [id]: alterar(atual.overrides[id] ?? {}),
      }),
    }));
  }

  function alternarBloqueio(raca: RaceResolvida) {
    mudarOverride(raca.id, (o) => {
      const proximo = { ...o };
      if (raca.bloqueada) delete proximo.bloqueada;
      else proximo.bloqueada = true;
      return proximo;
    });
  }

  function editarBonus(raca: RaceResolvida, campo: BaseAttributeKey | "hp" | "mp", valor: number) {
    setMensagem("");
    if (raca.origem === "CAMPANHA") {
      setRascunho((atual) => ({
        ...atual,
        exclusivas: atual.exclusivas.map((item) => {
          if (item.id !== raca.id) return item;
          if (campo === "hp") return { ...item, hpBonus: valor };
          if (campo === "mp") return { ...item, mpBonus: valor };
          return { ...item, atributoBonus: { ...item.atributoBonus, [campo]: valor } };
        }),
      }));
      return;
    }
    mudarOverride(raca.id, (o) => {
      if (campo === "hp") return { ...o, hpBonus: valor };
      if (campo === "mp") return { ...o, mpBonus: valor };
      return { ...o, atributoBonus: { ...raca.atributoBonus, ...o.atributoBonus, [campo]: valor } };
    });
  }

  function restaurarPadrao(raca: RaceResolvida) {
    mudarOverride(raca.id, (o) => {
      const proximo = { ...o };
      delete proximo.atributoBonus;
      delete proximo.hpBonus;
      delete proximo.mpBonus;
      return proximo;
    });
  }

  function removerExclusiva(raca: RaceResolvida) {
    const confirmado = window.confirm(
      `Remover a raça "${raca.nome}" desta campanha?\n\nPersonagens que já usam essa raça mantêm o nome, mas deixam de receber os bônus dela.`,
    );
    if (!confirmado) return;
    setMensagem("");
    setEditando((atual) => (atual === raca.id ? null : atual));
    setRascunho((atual) => ({
      overrides: limparOverrides(
        Object.fromEntries(Object.entries(atual.overrides).filter(([id]) => id !== raca.id)),
      ),
      exclusivas: atual.exclusivas.filter((item) => item.id !== raca.id),
    }));
  }

  function adicionarExclusiva(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nome = nomeNova.trim();
    if (!nome) return;
    if (resolvidas.some((raca) => chaveDeRaca(raca.nome) === chaveDeRaca(nome))) {
      setErroNova(`Já existe uma raça chamada "${nome}" nesta campanha.`);
      return;
    }
    const nova: RaceDefinition = {
      id: criarId(),
      nome,
      aliases: [],
      descricao: descricaoNova.trim(),
      atributoBonus: { ...bonusNova },
      hpBonus: hpNova,
      mpBonus: mpNova,
      tracos: [],
    };
    setMensagem("");
    setRascunho((atual) => ({ ...atual, exclusivas: [...atual.exclusivas, nova] }));
    setNomeNova("");
    setDescricaoNova("");
    setBonusNova(bonusZerado());
    setHpNova(0);
    setMpNova(0);
    setErroNova("");
  }

  async function salvar() {
    if (!podeEditar || salvando || !alterado) return;
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const salva = await salvarRacasCampanha(campanhaId, rascunho);
      onSaved(salva);
      setRascunho(salva);
      setMensagem("Raças da campanha salvas.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar as raças.");
    } finally {
      setSalvando(false);
    }
  }

  function descartar() {
    setRascunho(JSON.parse(configSalva) as CampaignRaceConfig);
    setErro("");
    setMensagem("");
  }

  return (
    <div className="cr-root">
      <p className="cr-intro">
        {isMaster
          ? "Libere ou bloqueie as raças do catálogo global para novos personagens, ajuste os bônus só para esta mesa ou crie raças exclusivas desta campanha. Bloquear uma raça nunca altera fichas que já existem."
          : "Estas são as raças que o Mestre definiu para esta campanha."}
      </p>

      {falhaCarga && (
        <p className="cr-alert" role="alert">
          Não foi possível carregar a configuração de raças desta campanha. A edição está
          desativada para não apagar o que já estava salvo. Recarregue a página para tentar de novo.
        </p>
      )}

      {isMaster && (
        <div className="cr-actionbar">
          <span className={`cr-badge${alterado ? " is-dirty" : ""}`}>
            {alterado ? "Alterações não salvas" : "Tudo salvo"}
          </span>
          <div className="cr-actions">
            {alterado && (
              <button type="button" className="btn-ghost" onClick={descartar} disabled={salvando}>
                Descartar
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={() => void salvar()}
              disabled={!podeEditar || salvando || !alterado}
            >
              {salvando ? "Salvando..." : "Salvar raças"}
            </button>
          </div>
        </div>
      )}

      {erro && <p className="cr-alert" role="alert">{erro}</p>}
      {mensagem && <p className="cr-ok" role="status">{mensagem}</p>}

      <div className="cr-filters">
        <input
          type="search"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Filtrar raças pelo nome..."
          aria-label="Filtrar raças pelo nome"
        />
        <div className="cr-pills">
          <button type="button" className={filtro === "TODAS" ? "is-active" : ""} onClick={() => setFiltro("TODAS")}>
            Todas ({resolvidas.length})
          </button>
          <button type="button" className={filtro === "DISPONIVEIS" ? "is-active" : ""} onClick={() => setFiltro("DISPONIVEIS")}>
            Disponíveis ({totalDisponiveis})
          </button>
          <button type="button" className={filtro === "BLOQUEADAS" ? "is-active" : ""} onClick={() => setFiltro("BLOQUEADAS")}>
            Bloqueadas ({totalBloqueadas})
          </button>
        </div>
      </div>

      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>Raça</th>
              <th>Origem</th>
              <th>Bônus de atributos</th>
              <th>Recursos</th>
              <th>Disponibilidade</th>
              {podeEditar && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((raca) => (
              <Fragment key={raca.id}>
                <tr className={raca.bloqueada ? "is-blocked" : ""}>
                  <td>
                    <strong>{raca.nome}</strong>
                    {raca.descricao && <small className="cr-desc">{raca.descricao}</small>}
                  </td>
                  <td>
                    <span className={`cr-pill ${raca.origem === "GLOBAL" ? "is-global" : "is-campaign"}`}>
                      {raca.origem === "GLOBAL" ? "Catálogo global" : "Exclusiva da campanha"}
                    </span>
                    {raca.personalizada && <span className="cr-pill is-custom">Bônus ajustados</span>}
                  </td>
                  <td>{resumoAtributos(raca)}</td>
                  <td>
                    PV {formatar(raca.hpBonus)} · PM {formatar(raca.mpBonus)}
                  </td>
                  <td>
                    <span className={`cr-status ${raca.bloqueada ? "is-blocked" : "is-available"}`}>
                      {raca.bloqueada ? "Bloqueada na criação" : "Disponível"}
                    </span>
                  </td>
                  {podeEditar && (
                    <td>
                      <div className="cr-row-actions">
                        <button type="button" onClick={() => alternarBloqueio(raca)}>
                          {raca.bloqueada ? "Liberar" : "Bloquear"}
                        </button>
                        <button
                          type="button"
                          aria-expanded={editando === raca.id}
                          onClick={() => setEditando((atual) => (atual === raca.id ? null : raca.id))}
                        >
                          {editando === raca.id ? "Fechar bônus" : "Editar bônus"}
                        </button>
                        {raca.origem === "CAMPANHA" && (
                          <button type="button" className="is-danger" onClick={() => removerExclusiva(raca)}>
                            Remover
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                {podeEditar && editando === raca.id && (
                  <tr className="cr-edit-row">
                    <td colSpan={6}>
                      <div className="cr-bonus-grid" role="group" aria-label={`Bônus de ${raca.nome} nesta campanha`}>
                        {ATTRIBUTE_CONFIG.map(({ key, label }) => (
                          <label key={key}>
                            <span>{label}</span>
                            <input
                              type="number"
                              aria-label={`${raca.nome} - ${label}`}
                              value={raca.atributoBonus[key]}
                              onChange={(event) => editarBonus(raca, key, Number(event.target.value) || 0)}
                            />
                          </label>
                        ))}
                        <label>
                          <span>Vida (PV)</span>
                          <input
                            type="number"
                            aria-label={`${raca.nome} - Vida`}
                            value={raca.hpBonus}
                            onChange={(event) => editarBonus(raca, "hp", Number(event.target.value) || 0)}
                          />
                        </label>
                        <label>
                          <span>Mana (PM)</span>
                          <input
                            type="number"
                            aria-label={`${raca.nome} - Mana`}
                            value={raca.mpBonus}
                            onChange={(event) => editarBonus(raca, "mp", Number(event.target.value) || 0)}
                          />
                        </label>
                      </div>
                      {raca.personalizada && (
                        <button type="button" className="cr-restore" onClick={() => restaurarPadrao(raca)}>
                          Restaurar bônus do catálogo global
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={podeEditar ? 6 : 5} className="cr-empty">
                  Nenhuma raça encontrada com esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {podeEditar && (
        <form className="cr-new" onSubmit={adicionarExclusiva}>
          <h4>Criar raça exclusiva desta campanha</h4>
          <div className="cr-new-grid">
            <label className="cr-wide">
              <span>Nome da raça</span>
              <input
                value={nomeNova}
                onChange={(event) => {
                  setNomeNova(event.target.value);
                  setErroNova("");
                }}
                maxLength={100}
                required
              />
            </label>
            <label className="cr-wide">
              <span>Descrição (opcional)</span>
              <textarea
                rows={2}
                maxLength={500}
                value={descricaoNova}
                onChange={(event) => setDescricaoNova(event.target.value)}
              />
            </label>
            {ATTRIBUTE_CONFIG.map(({ key, label }) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  aria-label={`Bônus de ${label} da nova raça`}
                  value={bonusNova[key]}
                  onChange={(event) =>
                    setBonusNova((atual) => ({ ...atual, [key]: Number(event.target.value) || 0 }))
                  }
                />
              </label>
            ))}
            <label>
              <span>Vida (PV)</span>
              <input
                type="number"
                aria-label="Bônus de PV da nova raça"
                value={hpNova}
                onChange={(event) => setHpNova(Number(event.target.value) || 0)}
              />
            </label>
            <label>
              <span>Mana (PM)</span>
              <input
                type="number"
                aria-label="Bônus de PM da nova raça"
                value={mpNova}
                onChange={(event) => setMpNova(Number(event.target.value) || 0)}
              />
            </label>
          </div>
          {erroNova && <p className="cr-alert" role="alert">{erroNova}</p>}
          <button type="submit" className="btn-ghost" disabled={!nomeNova.trim()}>
            Adicionar raça à campanha
          </button>
          <p className="cr-hint">A raça só passa a valer depois de clicar em “Salvar raças”.</p>
        </form>
      )}
    </div>
  );
}
