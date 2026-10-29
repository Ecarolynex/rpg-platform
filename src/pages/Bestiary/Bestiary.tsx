import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getCampaignAccess, listarMinhasCampanhas } from "../../services/api";
import type { Campaign } from "../../services/api";
import {
  IMAGEM_TAMANHO_MAX,
  IMAGEM_TIPOS_ACEITOS,
  alternarVisibilidadeCriatura,
  enviarImagemCriatura,
  excluirCriatura,
  listarBestiario,
  removerImagemCriatura,
  salvarCriatura,
} from "../../services/bestiario";
import type { Criatura, CriaturaInput, CriaturaTipo } from "../../services/bestiario";
import "./Bestiary.css";

const TIPO_LABEL: Record<CriaturaTipo, string> = {
  inimigo: "Inimigo",
  boss: "Chefe",
  npc: "NPC",
};

const VAZIO: CriaturaInput = {
  nome: "",
  tipo: "inimigo",
  nivel_ameaca: "",
  vida: null,
  descricao: "",
  ataques: "",
  fraquezas: "",
  imagem_url: null,
  visivel: false,
};

function msg(error: unknown, padrao: string) {
  return error instanceof Error && error.message ? error.message : padrao;
}

export default function Bestiary() {
  const { id: rotaCampanhaId } = useParams<{ id: string }>();
  const [campanhas, setCampanhas] = useState<Campaign[]>([]);
  const [campanhaSelecionadaId, setCampanhaSelecionadaId] = useState<string>("");
  const [carregandoCampanhas, setCarregandoCampanhas] = useState(!rotaCampanhaId);

  const campanhaId = rotaCampanhaId || campanhaSelecionadaId;

  const [criaturas, setCriaturas] = useState<Criatura[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState<CriaturaInput>(VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Imagem: arquivo novo escolhido, prévia local e flag de remoção
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [removerImagem, setRemoverImagem] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  // Libera a URL temporária da prévia quando ela muda ou o componente sai da tela
  useEffect(() => {
    return () => {
      if (previa) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  useEffect(() => {
    if (rotaCampanhaId) return;

    let ativo = true;
    setCarregandoCampanhas(true);
    listarMinhasCampanhas()
      .then((lista) => {
        if (!ativo) return;
        setCampanhas(lista);
        if (lista.length > 0) {
          setCampanhaSelecionadaId((atual) => atual || lista[0].id);
        }
      })
      .catch((error) => {
        if (!ativo) return;
        setErro(msg(error, "Não foi possível carregar suas campanhas."));
      })
      .finally(() => {
        if (ativo) setCarregandoCampanhas(false);
      });

    return () => {
      ativo = false;
    };
  }, [rotaCampanhaId]);

  const carregar = useCallback(async () => {
    if (!campanhaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro("");
    try {
      const acesso = await getCampaignAccess(campanhaId);
      setIsMaster(acesso.isMaster);
      setCriaturas(await listarBestiario(campanhaId));
    } catch (error) {
      setErro(msg(error, "Não foi possível abrir o Bestiário."));
    } finally {
      setLoading(false);
    }
  }, [campanhaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function limparImagemSelecionada() {
    setArquivo(null);
    setPrevia(null);
    setRemoverImagem(false);
    if (inputArquivoRef.current) inputArquivoRef.current.value = "";
  }

  function limparFormulario() {
    setForm(VAZIO);
    setEditandoId(null);
    limparImagemSelecionada();
  }

  function editar(c: Criatura) {
    setEditandoId(c.id);
    limparImagemSelecionada();
    setForm({
      nome: c.nome,
      tipo: c.tipo,
      nivel_ameaca: c.nivel_ameaca ?? "",
      vida: c.vida,
      descricao: c.descricao ?? "",
      ataques: c.ataques ?? "",
      fraquezas: c.fraquezas ?? "",
      imagem_url: c.imagem_url,
      visivel: c.visivel,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function aoEscolherImagem(event: ChangeEvent<HTMLInputElement>) {
    const escolhido = event.target.files?.[0];
    if (!escolhido) return;

    if (!IMAGEM_TIPOS_ACEITOS.includes(escolhido.type)) {
      setErro("Formato inválido. Use JPG, PNG, WEBP ou GIF.");
      event.target.value = "";
      return;
    }
    if (escolhido.size > IMAGEM_TAMANHO_MAX) {
      setErro("A imagem deve ter no máximo 2 MB.");
      event.target.value = "";
      return;
    }

    setErro("");
    setArquivo(escolhido);
    setPrevia(URL.createObjectURL(escolhido));
    setRemoverImagem(false);
  }

  function aoRemoverImagem() {
    // Descarta a nova seleção e marca a imagem salva para remoção
    setArquivo(null);
    setPrevia(null);
    setRemoverImagem(true);
    if (inputArquivoRef.current) inputArquivoRef.current.value = "";
  }

  async function enviar(event: FormEvent) {
    event.preventDefault();
    if (!campanhaId || !form.nome.trim()) {
      setErro("Dê um nome à criatura.");
      return;
    }
    setSalvando(true);
    setErro("");

    const imagemAntiga = form.imagem_url;
    let imagemFinal: string | null = removerImagem ? null : imagemAntiga;
    let imagemNovaEnviada: string | null = null;

    try {
      if (arquivo) {
        imagemNovaEnviada = await enviarImagemCriatura(campanhaId, arquivo);
        imagemFinal = imagemNovaEnviada;
      }

      await salvarCriatura(
        campanhaId,
        {
          ...form,
          nome: form.nome.trim(),
          nivel_ameaca: form.nivel_ameaca?.trim() || null,
          descricao: form.descricao?.trim() || null,
          ataques: form.ataques?.trim() || null,
          fraquezas: form.fraquezas?.trim() || null,
          imagem_url: imagemFinal,
        },
        editandoId ?? undefined,
      );

      // Salvou: apaga a imagem antiga que foi trocada ou removida
      if (imagemAntiga && imagemAntiga !== imagemFinal) {
        void removerImagemCriatura(imagemAntiga).catch(() => undefined);
      }

      limparFormulario();
      await carregar();
    } catch (error) {
      // Falhou depois do upload: não deixa arquivo órfão no bucket
      if (imagemNovaEnviada) {
        void removerImagemCriatura(imagemNovaEnviada).catch(() => undefined);
      }
      setErro(msg(error, "Não foi possível salvar a criatura."));
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(c: Criatura) {
    try {
      await alternarVisibilidadeCriatura(c.id, !c.visivel);
      await carregar();
    } catch (error) {
      setErro(msg(error, "Não foi possível alterar a visibilidade."));
    }
  }

  async function excluir(c: Criatura) {
    if (!window.confirm(`Excluir "${c.nome}" do Bestiário? Peças dela no mapa ficarão sem vínculo.`)) {
      return;
    }
    try {
      await excluirCriatura(c.id);
      void removerImagemCriatura(c.imagem_url).catch(() => undefined);
      await carregar();
    } catch (error) {
      setErro(msg(error, "Não foi possível excluir a criatura."));
    }
  }

  if (carregandoCampanhas) {
    return (
      <main className="bestiary-page">
        <div className="bestiary-backdrop" aria-hidden="true" />
        <header className="bestiary-header">
          <h1>Bestiário</h1>
          <p>Carregando campanhas...</p>
        </header>
        <p role="status">Folheando o Bestiário...</p>
      </main>
    );
  }

  if (!rotaCampanhaId && campanhas.length === 0) {
    return (
      <main className="bestiary-page">
        <div className="bestiary-backdrop" aria-hidden="true" />
        <header className="bestiary-header">
          <h1>Bestiário</h1>
          <p>Catálogo de criaturas e ameaças</p>
        </header>
        <div className="bestiary-empty-box">
          <h2>Nenhuma campanha vinculada</h2>
          <p>Você ainda não participa de nenhuma campanha.</p>
          <p>O Bestiário organiza monstros, chefes e NPCs de cada aventura.</p>
          <Link to="/campanhas" className="bestiary-button ghost">
            Ver minhas campanhas
          </Link>
        </div>
      </main>
    );
  }

  const imagemExibida = previa ?? (removerImagem ? null : form.imagem_url);

  return (
    <main className="bestiary-page">
      <div className="bestiary-backdrop" aria-hidden="true" />
      <header className="bestiary-header">
        {rotaCampanhaId ? (
          <nav className="bestiary-nav" aria-label="Navegação da campanha">
            <Link to={`/campanha/${rotaCampanhaId}`}>Campanha</Link>
            <Link to={`/campanha/${rotaCampanhaId}/mapa`}>Mapa</Link>
          </nav>
        ) : (
          <div className="bestiary-campaign-select-wrap">
            <label htmlFor="bestiary-campaign-select">Campanha:</label>
            <select
              id="bestiary-campaign-select"
              aria-label="Selecionar campanha"
              value={campanhaSelecionadaId}
              onChange={(e) => setCampanhaSelecionadaId(e.target.value)}
              className="bestiary-campaign-select"
            >
              {campanhas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {campanhaId && (
              <Link to={`/campanha/${campanhaId}`} className="bestiary-campaign-link">
                Ver painel da campanha →
              </Link>
            )}
          </div>
        )}
        <h1>Bestiário</h1>
        <p>
          {isMaster
            ? "Cadastre as criaturas da campanha e revele aos jogadores quando a história pedir."
            : "Criaturas que seu grupo já encontrou."}
        </p>
      </header>

      {erro && <div className="bestiary-error" role="alert">{erro}</div>}

      {isMaster && (
        <form className="bestiary-form" onSubmit={enviar}>
          <h2>{editandoId ? "Editar criatura" : "Nova criatura"}</h2>
          <div className="bestiary-grid">
            <label>
              Nome
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                maxLength={80}
              />
            </label>
            <label>
              Tipo
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as CriaturaTipo })}
              >
                <option value="inimigo">Inimigo</option>
                <option value="boss">Chefe</option>
                <option value="npc">NPC</option>
              </select>
            </label>
            <label>
              Nível de ameaça
              <input
                value={form.nivel_ameaca ?? ""}
                onChange={(e) => setForm({ ...form, nivel_ameaca: e.target.value })}
                maxLength={20}
              />
            </label>
            <label>
              Vida
              <input
                type="number"
                min={0}
                value={form.vida ?? ""}
                onChange={(e) =>
                  setForm({ ...form, vida: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label>
            Descrição
            <textarea
              rows={3}
              value={form.descricao ?? ""}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </label>
          <div className="bestiary-grid two">
            <label>
              Ataques
              <textarea
                rows={2}
                value={form.ataques ?? ""}
                onChange={(e) => setForm({ ...form, ataques: e.target.value })}
              />
            </label>
            <label>
              Fraquezas
              <textarea
                rows={2}
                value={form.fraquezas ?? ""}
                onChange={(e) => setForm({ ...form, fraquezas: e.target.value })}
              />
            </label>
          </div>

          <div className="bestiary-image-field">
            <label htmlFor="bestiary-imagem">Imagem (JPG, PNG, WEBP ou GIF · até 2 MB)</label>
            <input
              id="bestiary-imagem"
              ref={inputArquivoRef}
              type="file"
              accept={IMAGEM_TIPOS_ACEITOS.join(",")}
              onChange={aoEscolherImagem}
            />
            {imagemExibida && (
              <div className="bestiary-image-preview">
                <img src={imagemExibida} alt="Prévia da criatura" />
                <button type="button" className="bestiary-button danger" onClick={aoRemoverImagem}>
                  Remover imagem
                </button>
              </div>
            )}
          </div>

          <label className="bestiary-check">
            <input
              type="checkbox"
              checked={form.visivel}
              onChange={(e) => setForm({ ...form, visivel: e.target.checked })}
            />
            Revelada aos jogadores
          </label>
          <div className="bestiary-actions">
            <button type="submit" className="bestiary-button" disabled={salvando}>
              {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Cadastrar criatura"}
            </button>
            {editandoId && (
              <button type="button" className="bestiary-button ghost" onClick={limparFormulario}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <p role="status">Folheando o Bestiário...</p>
      ) : criaturas.length === 0 ? (
        <p className="bestiary-empty">
          {isMaster ? "Nenhuma criatura cadastrada ainda." : "O Mestre ainda não revelou nenhuma criatura."}
        </p>
      ) : (
        <ul className="bestiary-list">
          {criaturas.map((c) => (
            <li key={c.id} className={`bestiary-card tipo-${c.tipo}`}>
              {c.imagem_url && (
                <img
                  className="bestiary-card-img"
                  src={c.imagem_url}
                  alt={`Imagem de ${c.nome}`}
                  loading="lazy"
                />
              )}
              <header>
                <h3>{c.nome}</h3>
                <span>
                  {TIPO_LABEL[c.tipo]}
                  {c.nivel_ameaca ? ` · ameaça ${c.nivel_ameaca}` : ""}
                  {c.vida !== null ? ` · vida ${c.vida}` : ""}
                </span>
                {isMaster && (
                  <em className={c.visivel ? "revealed" : "secret"}>
                    {c.visivel ? "Revelada" : "Oculta"}
                  </em>
                )}
              </header>
              {c.descricao && <p>{c.descricao}</p>}
              {c.ataques && (
                <p>
                  <strong>Ataques:</strong> {c.ataques}
                </p>
              )}
              {c.fraquezas && (
                <p>
                  <strong>Fraquezas:</strong> {c.fraquezas}
                </p>
              )}
              {isMaster && (
                <div className="bestiary-actions">
                  <button type="button" className="bestiary-button ghost" onClick={() => editar(c)}>
                    Editar
                  </button>
                  <button type="button" className="bestiary-button ghost" onClick={() => void alternar(c)}>
                    {c.visivel ? "Ocultar" : "Revelar"}
                  </button>
                  <button type="button" className="bestiary-button danger" onClick={() => void excluir(c)}>
                    Excluir
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}