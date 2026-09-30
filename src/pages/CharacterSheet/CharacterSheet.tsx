import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Attributes, Character, Wallet } from "../../types/character";
import {
  atualizarPersonagem,
  enviarRetrato,
  getCharacterAccess,
  getCharacterById,
} from "../../services/api";
import { StatBar } from "../../components/ui/StatBar";
import { OptionField } from "../../components/ui/OptionField";
import {
  ALINHAMENTOS,
  CLASSES,
  RACAS,
  bonusProficiencia,
  formatarModificador,
  modificador,
} from "../../data/dnd";
import "./CharacterSheet.css";
import "./CharacterSheetExtras.css";

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

/* ---------- componentes auxiliares ---------- */

function Ajustador({
  valor,
  passos,
  maximo,
  desabilitado,
  onChange,
}: {
  valor: number;
  passos: number[];
  maximo?: number;
  desabilitado: boolean;
  onChange: (valor: number) => void;
}) {
  const limitar = (n: number) =>
    Math.min(
      maximo ?? Number.MAX_SAFE_INTEGER,
      Math.max(0, n),
    );

  return (
    <div className="cs-adjuster">
      {passos
        .filter((p) => p < 0)
        .map((p) => (
          <button
            key={p}
            type="button"
            disabled={desabilitado}
            onClick={() => onChange(limitar(valor + p))}
          >
            {p}
          </button>
        ))}

      <input
        type="number"
        min={0}
        value={valor}
        disabled={desabilitado}
        onChange={(event) =>
          onChange(
            limitar(Number(event.target.value) || 0),
          )
        }
      />

      {passos
        .filter((p) => p > 0)
        .map((p) => (
          <button
            key={p}
            type="button"
            disabled={desabilitado}
            onClick={() => onChange(limitar(valor + p))}
          >
            +{p}
          </button>
        ))}
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
          onChange={(event) =>
            onChange(event.target.value)
          }
        />
      ) : (
        <input
          type={tipo}
          value={valor}
          onChange={(event) =>
            onChange(event.target.value)
          }
        />
      )}
    </label>
  );
}

/* ---------- página ---------- */

export default function CharacterSheet() {
  const { id } = useParams();

  const idRef = useRef(id);
  idRef.current = id;

  const [character, setCharacter] =
    useState<Character | null>(null);

  const [acesso, setAcesso] = useState({
    canEdit: false,
    isMaster: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const [tab, setTab] =
    useState<Tab>("Atributos");

  const [status, setStatus] = useState("");

  const [editando, setEditando] =
    useState(false);

  const [rascunho, setRascunho] =
    useState<Character | null>(null);

  const [salvandoEdicao, setSalvandoEdicao] =
    useState(false);

  const timer = useRef<number | null>(null);

  const pendente = useRef<Character | null>(null);

  const inputFoto =
    useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError(null);

    Promise.all([
      getCharacterById(id),
      getCharacterAccess(id),
    ])
      .then(([c, a]) => {
        setCharacter(c ?? null);
        setAcesso(a);
      })
      .catch((e) => {
        console.error(
          "Erro ao buscar personagem:",
          e,
        );

        setError(
          e?.message ??
            "Erro ao carregar a ficha.",
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  const salvarPendente = async () => {
    const alvo = pendente.current;
    const alvoId = idRef.current;

    if (!alvo || !alvoId) return;

    pendente.current = null;
    setStatus("Salvando...");

    try {
      await atualizarPersonagem(alvoId, alvo);
      setStatus("Alterações salvas.");
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar.",
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

  const agendarSalvamento = (
    proximo: Character,
  ) => {
    setCharacter(proximo);
    pendente.current = proximo;

    if (timer.current) {
      window.clearTimeout(timer.current);
    }

    timer.current = window.setTimeout(() => {
      timer.current = null;
      void salvarPendente();
    }, 700);
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
    return (
      <p className="sheet-status">
        Carregando ficha...
      </p>
    );
  }

  if (error) {
    return (
      <p className="sheet-status">
        Erro: {error}
      </p>
    );
  }

  if (!character) {
    return (
      <p className="sheet-status">
        Personagem não encontrado.
      </p>
    );
  }

  const podeEditar = acesso.canEdit;

  const view: Character =
    editando && rascunho
      ? rascunho
      : character;

  const carteira =
    character.carteira ?? CARTEIRA_VAZIA;

  const modDestreza = modificador(
    view.attributes.destreza,
  );

  /* ---------- ações ---------- */

  const alterarHp = (atual: number) =>
    agendarSalvamento({
      ...character,
      hp: {
        ...character.hp,
        atual,
      },
    });

  const alterarMp = (atual: number) =>
    agendarSalvamento({
      ...character,
      mp: {
        ...character.mp,
        atual,
      },
    });

  const alterarOuro = (valor: number) =>
    agendarSalvamento({
      ...character,
      carteira: {
        ...carteira,
        po: valor,
      },
    });

  const iniciarEdicao = () => {
    setRascunho(
      structuredClone(character),
    );

    setEditando(true);
    setStatus("");
  };

  const cancelarEdicao = () => {
    setEditando(false);
    setRascunho(null);
  };

  const atualizarRascunho = <
    K extends keyof Character
  >(
    chave: K,
    valor: Character[K],
  ) => {
    setRascunho((prev) =>
      prev
        ? {
            ...prev,
            [chave]: valor,
          }
        : prev,
    );
  };

  const salvarEdicao = async () => {
    if (!rascunho || !id) return;

    const ajustado: Character = {
      ...rascunho,

      nome:
        rascunho.nome.trim() ||
        character.nome,

      hp: {
        max: rascunho.hp.max,
        atual: Math.min(
          rascunho.hp.atual,
          rascunho.hp.max,
        ),
      },

      mp: {
        max: rascunho.mp.max,
        atual: Math.min(
          rascunho.mp.atual,
          rascunho.mp.max,
        ),
      },
    };

    cancelarPendente();

    setSalvandoEdicao(true);
    setStatus("Salvando...");

    try {
      const salvo =
        await atualizarPersonagem(
          id,
          ajustado,
        );

      setCharacter(salvo);
      setEditando(false);
      setRascunho(null);
      setStatus("Ficha atualizada.");
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar.",
      );
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const trocarFoto = async (
    arquivo: File,
  ) => {
    if (!id) return;

    cancelarPendente();
    setStatus("Enviando foto...");

    try {
      const url =
        await enviarRetrato(arquivo);

      const salvo =
        await atualizarPersonagem(id, {
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
      <nav className="cs-nav">
        <Link to="/">
          ← Meus personagens
        </Link>

        {character.campanhaId && (
          <>
            <Link
              to={
                "/campanha/" +
                character.campanhaId
              }
            >
              Campanha
            </Link>

            <Link
              to={
                "/campanha/" +
                character.campanhaId +
                "/loja"
              }
            >
              Loja
            </Link>
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
                onClick={() =>
                  inputFoto.current?.click()
                }
              >
                Alterar foto
              </button>

              <input
                ref={inputFoto}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const arquivo =
                    event.target.files?.[0];

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
            {view.raca} · {view.classe} · Nível{" "}
            {view.nivel}
          </p>

          {linhaExtra && (
            <p>{linhaExtra}</p>
          )}
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
          <strong>
            {10 + modDestreza}
          </strong>

          <span>
            Classe de Armadura
          </span>
        </div>

        <div className="cs-stat">
          <strong>
            {formatarModificador(
              modDestreza,
            )}
          </strong>

          <span>Iniciativa</span>
        </div>

        <div className="cs-stat">
          <strong>
            {formatarModificador(
              bonusProficiencia(
                view.nivel,
              ),
            )}
          </strong>

          <span>Proficiência</span>
        </div>
      </div>

      {podeEditar && (
        <div className="cs-editbar">
          <span className="cs-status">
            {status ||
              (acesso.isMaster
                ? "Você pode editar esta ficha como Mestre."
                : "Você pode editar sua ficha.")}
          </span>

          {editando ? (
            <>
              <button
                type="button"
                className="btn-ghost"
                onClick={
                  cancelarEdicao
                }
                disabled={
                  salvandoEdicao
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={
                  salvarEdicao
                }
                disabled={
                  salvandoEdicao
                }
              >
                {salvandoEdicao
                  ? "Salvando..."
                  : "Salvar ficha"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-ghost"
              onClick={
                iniciarEdicao
              }
            >
              Editar ficha
            </button>
          )}
        </div>
      )}

      {editando && rascunho && (
        <section className="cs-panel">
          <h3>
            Informações do personagem
          </h3>

          <div className="cs-edit-grid">
            <Campo
              rotulo="Nome"
              valor={rascunho.nome}
              onChange={(v) =>
                atualizarRascunho(
                  "nome",
                  v,
                )
              }
            />

            <OptionField
              label="Raça"
              value={rascunho.raca}
              options={RACAS}
              onChange={(v) =>
                atualizarRascunho(
                  "raca",
                  v,
                )
              }
            />

            <OptionField
              label="Classe"
              value={rascunho.classe}
              options={CLASSES}
              onChange={(v) =>
                atualizarRascunho(
                  "classe",
                  v,
                )
              }
            />

            <Campo
              rotulo="Nível"
              tipo="number"
              valor={rascunho.nivel}
              onChange={(v) =>
                atualizarRascunho(
                  "nivel",
                  Math.min(
                    20,
                    Math.max(
                      1,
                      Number(v) || 1,
                    ),
                  ),
                )
              }
            />

            <OptionField
              label="Alinhamento"
              value={
                rascunho.alinhamento ??
                ""
              }
              options={ALINHAMENTOS}
              onChange={(v) =>
                atualizarRascunho(
                  "alinhamento",
                  v,
                )
              }
            />

            <Campo
              rotulo="Origem"
              valor={
                rascunho.origem ?? ""
              }
              onChange={(v) =>
                atualizarRascunho(
                  "origem",
                  v,
                )
              }
            />

            <Campo
              rotulo="Idade"
              valor={
                rascunho.idade ?? ""
              }
              onChange={(v) =>
                atualizarRascunho(
                  "idade",
                  v,
                )
              }
            />

            <Campo
              rotulo="Vida máxima"
              tipo="number"
              valor={
                rascunho.hp.max
              }
              onChange={(v) =>
                atualizarRascunho(
                  "hp",
                  {
                    ...rascunho.hp,
                    max: Math.max(
                      1,
                      Number(v) || 1,
                    ),
                  },
                )
              }
            />

            <Campo
              rotulo="Mana máxima"
              tipo="number"
              valor={
                rascunho.mp.max
              }
              onChange={(v) =>
                atualizarRascunho(
                  "mp",
                  {
                    ...rascunho.mp,
                    max: Math.max(
                      0,
                      Number(v) || 0,
                    ),
                  },
                )
              }
            />
          </div>
        </section>
      )}

      <section className="cs-panel">
        <h3>Vida e mana</h3>

        <div className="cs-vitals-grid">
          <div className="cs-vital">
            <StatBar
              label="Vida"
              atual={
                character.hp.atual
              }
              max={
                character.hp.max
              }
              tone="wine"
            />

            <Ajustador
              valor={
                character.hp.atual
              }
              maximo={
                character.hp.max
              }
              passos={[
                -5,
                -1,
                1,
                5,
              ]}
              desabilitado={
                !podeEditar ||
                editando
              }
              onChange={
                alterarHp
              }
            />
          </div>

          <div className="cs-vital">
            <StatBar
              label="Mana"
              atual={
                character.mp.atual
              }
              max={
                character.mp.max
              }
              tone="forest"
            />

            <Ajustador
              valor={
                character.mp.atual
              }
              maximo={
                character.mp.max
              }
              passos={[
                -5,
                -1,
                1,
                5,
              ]}
              desabilitado={
                !podeEditar ||
                editando
              }
              onChange={
                alterarMp
              }
            />
          </div>
        </div>
      </section>

      <section className="cs-panel">
        <h3>Carteira</h3>

        <div className="cs-wallet">
          <div className="cs-coin">
            <strong>PO</strong>

            <small>Ouro</small>

            <Ajustador
              valor={carteira.po}
              passos={[
                -10,
                -1,
                1,
                10,
              ]}
              desabilitado={
                !podeEditar ||
                editando
              }
              onChange={
                alterarOuro
              }
            />
          </div>
        </div>
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
            onClick={() =>
              setTab(t)
            }
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
              <div
                key={attr}
                className="attribute-block"
              >
                <span className="attribute-label">
                  {
                    ATTRIBUTE_LABELS[
                      attr
                    ]
                  }
                </span>

                {editando &&
                rascunho ? (
                  <input
                    className="cs-attr-input"
                    type="number"
                    min={1}
                    max={30}
                    value={
                      rascunho
                        .attributes[
                          attr
                        ]
                    }
                    onChange={(
                      event,
                    ) =>
                      atualizarRascunho(
                        "attributes",
                        {
                          ...rascunho.attributes,
                          [attr]:
                            Number(
                              event
                                .target
                                .value,
                            ) || 1,
                        },
                      )
                    }
                  />
                ) : (
                  <span className="attribute-value">
                    {
                      view
                        .attributes[
                          attr
                        ]
                    }
                  </span>
                )}

                <span className="attribute-mod">
                  {formatarModificador(
                    modificador(
                      view.attributes[
                        attr
                      ],
                    ),
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === "Perícias" && (
          <ul className="sheet-list">
            {view.skills.map(
              (skill) => (
                <li key={skill.id}>
                  <span>
                    {skill.nome}
                  </span>

                  <span className="sheet-list-tag">
                    {
                      ATTRIBUTE_LABELS[
                        skill
                          .atributo
                      ]
                    }{" "}
                    ·{" "}
                    {skill.treinada
                      ? "Treinada"
                      : "Não treinada"}
                  </span>

                  <span className="sheet-list-bonus">
                    +{skill.bonus}
                  </span>
                </li>
              ),
            )}

            {view.skills.length ===
              0 && (
              <p className="sheet-empty">
                Nenhuma perícia
                registrada.
              </p>
            )}
          </ul>
        )}

        {tab === "Inventário" && (
          <ul className="sheet-list">
            {view.inventory.map(
              (item) => (
                <li key={item.id}>
                  <span>
                    {item.nome}
                  </span>

                  <span className="sheet-list-tag">
                    x
                    {
                      item.quantidade
                    }
                  </span>
                </li>
              ),
            )}

            {view.inventory.length ===
              0 && (
              <p className="sheet-empty">
                Inventário vazio.
              </p>
            )}
          </ul>
        )}

        {tab === "Magias" && (
          <ul className="sheet-list sheet-list--spells">
            {view.spells.map(
              (spell) => (
                <li key={spell.id}>
                  <div className="sheet-spell-head">
                    <span>
                      {spell.nome}
                    </span>

                    <span className="sheet-list-tag">
                      {spell.custo} PM
                    </span>
                  </div>

                  <p>
                    {spell.descricao}
                  </p>
                </li>
              ),
            )}

            {view.spells.length ===
              0 && (
              <p className="sheet-empty">
                Este personagem
                não conhece
                magias.
              </p>
            )}
          </ul>
        )}

        {tab === "História" && (
          <div className="cs-story">
            {editando &&
            rascunho ? (
              <div className="cs-edit-grid">
                {HISTORIA_CAMPOS.map(
                  ([
                    chave,
                    rotulo,
                  ]) => (
                    <Campo
                      key={chave}
                      rotulo={rotulo}
                      largo
                      multilinha
                      valor={
                        rascunho[
                          chave
                        ] ?? ""
                      }
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
                  ([chave]) =>
                    view[chave],
                ).map(
                  ([
                    chave,
                    rotulo,
                  ]) => (
                    <div
                      key={chave}
                    >
                      <h4>
                        {rotulo}
                      </h4>

                      <p className="sheet-notes">
                        {view[chave]}
                      </p>
                    </div>
                  ),
                )}

                {HISTORIA_CAMPOS.every(
                  ([chave]) =>
                    !view[chave],
                ) && (
                  <p className="sheet-empty">
                    Nenhuma história
                    registrada.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {tab === "Notas" &&
          (editando &&
          rascunho ? (
            <Campo
              rotulo="Notas"
              largo
              multilinha
              valor={
                rascunho.notas
              }
              onChange={(v) =>
                atualizarRascunho(
                  "notas",
                  v,
                )
              }
            />
          ) : (
            <p className="sheet-notes">
              {view.notas ||
                "Nenhuma anotação ainda."}
            </p>
          ))}
      </div>
    </div>
  );
}