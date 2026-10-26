import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import "./Login.css";

type AuthTab = "login" | "register";

/* ── Campo gravado na pedra (com erro inline e olho de senha) ── */
interface FieldProps {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  error?: string;
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
}: FieldProps) {
  const [visivel, setVisivel] = useState(false);
  const isPassword = type === "password";
  const errorId = `${id}-erro`;

  return (
    <div className="portal-engraved-field">
      <label htmlFor={id} className="engraved-label">
        {label}
      </label>
      <div className={`engraved-input-wrap ${error ? "has-error" : ""}`}>
        <input
          id={id}
          type={isPassword && visivel ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {isPassword && (
          <button
            type="button"
            className="engraved-eye"
            aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={visivel}
            onClick={() => setVisivel((v) => !v)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
              {visivel && <path d="M4 4l16 16" />}
            </svg>
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="engraved-error">
          {error}
        </p>
      )}
    </div>
  );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AuthTab>("login");

  // Campos de login
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");

  // Campos de cadastro
  const [regUsuario, setRegUsuario] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regSenha, setRegSenha] = useState("");
  const [regConfirmaSenha, setRegConfirmaSenha] = useState("");

  // Feedback
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errosCampos, setErrosCampos] = useState<Record<string, string>>({});

  function switchTab(tab: AuthTab) {
    setActiveTab(tab);
    setErro(null);
    setSucesso(null);
    setErrosCampos({});
  }

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const erros: Record<string, string> = {};
    if (!usuario.trim()) erros.usuario = "Informe o e-mail do Reino.";
    else if (!EMAIL_REGEX.test(usuario.trim()))
      erros.usuario = "Esse e-mail não parece válido.";
    if (!senha) erros.senha = "Informe a senha arcana.";
    setErrosCampos(erros);
    if (Object.keys(erros).length > 0) return;

    setEnviando(true);
    try {
      await login(usuario, senha);
      navigate("/");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar no reino.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleRegisterSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const erros: Record<string, string> = {};
    if (!regUsuario.trim()) erros.regUsuario = "Escolha um nome de aventureiro.";
    if (!regEmail.trim()) erros.regEmail = "Informe o e-mail do Reino.";
    else if (!EMAIL_REGEX.test(regEmail.trim()))
      erros.regEmail = "Esse e-mail não parece válido.";
    if (regSenha.length < 3)
      erros.regSenha = "A senha deve conter pelo menos 3 caracteres.";
    if (regSenha !== regConfirmaSenha)
      erros.regConfirmaSenha = "As senhas não coincidem.";
    setErrosCampos(erros);
    if (Object.keys(erros).length > 0) return;

    setEnviando(true);
    try {
      await register(regUsuario, regEmail, regSenha);
      setSucesso("Conta forjada com sucesso! Adentrando o reino...");
      setTimeout(() => {
        navigate("/");
      }, 1000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao forjar conta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="realm-portal-page">
      {/* Cenário: a arte do portal ocupa a tela toda */}
      <div className="portal-atmosphere-backdrop" aria-hidden="true" />

      <main className="portal-gate-structure">
        {/* Título curvo, acompanhando o arco da porta */}
        <header className="portal-keystone">
          <svg
            className="portal-arc-title"
            viewBox="0 0 480 130"
            role="img"
            aria-label="Portal dos Aventureiros — Elementum"
          >
            <defs>
              <path id="arc-outer" d="M 40 118 A 260 260 0 0 1 440 118" />
              <path id="arc-inner" d="M 83.7 118 A 228 228 0 0 1 396.3 118" />
            </defs>
            <text className="arc-line arc-line--main">
              <textPath href="#arc-outer" startOffset="50%" textAnchor="middle">
                PORTAL DOS AVENTUREIROS
              </textPath>
            </text>
            <text className="arc-line arc-line--sub">
              <textPath href="#arc-inner" startOffset="50%" textAnchor="middle">
                ELEMENTUM
              </textPath>
            </text>
          </svg>
        </header>

        {/* Pilares rúnicos laterais */}
        <aside className="portal-pillar portal-pillar--left" aria-hidden="true">
          <span className="rune-glyph">ᚦ</span>
          <span className="rune-glyph">ᚨ</span>
          <span className="rune-glyph">ᚱ</span>
          <span className="rune-glyph">ᛈ</span>
          <span className="rune-glyph">ᛗ</span>
        </aside>

        <aside className="portal-pillar portal-pillar--right" aria-hidden="true">
          <span className="rune-glyph">ᚱ</span>
          <span className="rune-glyph">ᛏ</span>
          <span className="rune-glyph">ᛁ</span>
          <span className="rune-glyph">ᚱ</span>
          <span className="rune-glyph">ᛚ</span>
        </aside>

        {/* Núcleo do portal: formulário direto sobre a arte, sem card */}
        <section className="portal-inner-sanctum">
          <nav className="portal-rites-nav" aria-label="Acesso ao reino">
            <button
              type="button"
              className={`portal-rite-btn ${activeTab === "login" ? "active" : ""}`}
              aria-current={activeTab === "login" ? "page" : undefined}
              onClick={() => switchTab("login")}
            >
              ENTRAR
            </button>
            <button
              type="button"
              className={`portal-rite-btn ${activeTab === "register" ? "active" : ""}`}
              aria-current={activeTab === "register" ? "page" : undefined}
              onClick={() => switchTab("register")}
            >
              CRIAR CONTA
            </button>
          </nav>

          {erro && (
            <div className="portal-relic-alert alert-error" role="alert">
              <span className="alert-symbol" aria-hidden="true">⚔</span>
              <span>{erro}</span>
            </div>
          )}
          {sucesso && (
            <div className="portal-relic-alert alert-success" role="status">
              <span className="alert-symbol" aria-hidden="true">✨</span>
              <span>{sucesso}</span>
            </div>
          )}

          {/* Rito de Entrada (Login) */}
          {activeTab === "login" && (
            <form
              className="portal-inscriptions-form"
              onSubmit={handleLoginSubmit}
              noValidate
            >
              <Field
                id="usuario"
                label="E-mail do Reino"
                type="email"
                placeholder="seu-email@reino.com"
                value={usuario}
                onChange={setUsuario}
                autoComplete="email"
                error={errosCampos.usuario}
              />

              <Field
                id="senha"
                label="Senha Arcana"
                type="password"
                placeholder="sua-senha-secreta"
                value={senha}
                onChange={setSenha}
                autoComplete="current-password"
                error={errosCampos.senha}
              />

              <div className="portal-seal-mechanism">
                <button
                  type="submit"
                  className="portal-seal-trigger"
                  disabled={enviando}
                  aria-busy={enviando}
                  aria-label={enviando ? "Abrindo o portal" : "Adentrar o Reino"}
                >
                  <div className="seal-emblem-disc">
                    <img
                      src="/logo.png"
                      alt=""
                      className="seal-phoenix-img"
                    />
                    <div className="seal-radial-glow" aria-hidden="true" />
                  </div>
                  <span className="seal-arc-text">
                    {enviando ? "ABRINDO O PORTAL..." : "ADENTRAR O REINO"}
                  </span>
                </button>
              </div>

              <div className="portal-ancient-switch">
                <span className="switch-prompt">Ainda não tem conta?</span>{" "}
                <button
                  type="button"
                  className="switch-action-btn"
                  onClick={() => switchTab("register")}
                >
                  Forjar uma nova conta
                </button>
              </div>
            </form>
          )}

          {/* Rito de Forja (Cadastro) */}
          {activeTab === "register" && (
            <form
              className="portal-inscriptions-form"
              onSubmit={handleRegisterSubmit}
              noValidate
            >
              <Field
                id="reg-usuario"
                label="Nome de Aventureiro"
                placeholder="Ex: MagoEldrin, Valquíria..."
                value={regUsuario}
                onChange={setRegUsuario}
                autoComplete="username"
                error={errosCampos.regUsuario}
              />

              <Field
                id="reg-email"
                label="E-mail do Reino"
                type="email"
                placeholder="aventureiro@reino.com"
                value={regEmail}
                onChange={setRegEmail}
                autoComplete="email"
                error={errosCampos.regEmail}
              />

              <div className="engraved-field-row">
                <Field
                  id="reg-senha"
                  label="Senha"
                  type="password"
                  placeholder="Mínimo 3 caracteres"
                  value={regSenha}
                  onChange={setRegSenha}
                  autoComplete="new-password"
                  error={errosCampos.regSenha}
                />
                <Field
                  id="reg-confirma-senha"
                  label="Confirmar Senha"
                  type="password"
                  placeholder="Repita a senha"
                  value={regConfirmaSenha}
                  onChange={setRegConfirmaSenha}
                  autoComplete="new-password"
                  error={errosCampos.regConfirmaSenha}
                />
              </div>

              <div className="portal-seal-mechanism">
                <button
                  type="submit"
                  className="portal-seal-trigger"
                  disabled={enviando}
                  aria-busy={enviando}
                  aria-label={enviando ? "Forjando a conta" : "Forjar Conta de Aventureiro"}
                >
                  <div className="seal-emblem-disc">
                    <img
                      src="/logo.png"
                      alt=""
                      className="seal-phoenix-img"
                    />
                    <div className="seal-radial-glow" aria-hidden="true" />
                  </div>
                  <span className="seal-arc-text">
                    {enviando ? "FORJANDO..." : "FORJAR CONTA"}
                  </span>
                </button>
              </div>

              <div className="portal-ancient-switch">
                <span className="switch-prompt">Já possui uma lenda registrada?</span>{" "}
                <button
                  type="button"
                  className="switch-action-btn"
                  onClick={() => switchTab("login")}
                >
                  Entrar com conta existente
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Rodapé de glifos */}
        <footer className="portal-pedestal-relics" aria-hidden="true">
          <div className="pedestal-glyph-row">
            <span className="pedestal-glyph">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5.500c0 4.500-3 8-7 9.500-4-1.500-7-5-7-9.500V6l7-3z" /><path d="M12 7v9" /></svg>
            </span>
            <span className="pedestal-glyph">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><path d="M12 7.500l3 4.500-3 4.500-3-4.500z" /></svg>
            </span>
            <span className="pedestal-glyph-crest">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c2.2 2.6 2.2 5.4 0 8.500-2.200-3.100-2.200-5.9 0-8.500z" /><path d="M12 11.500c-.8-3.500-5.500-3.800-6 0-.3 2.6 2.3 3.6 4.2 2.200" /><path d="M12 11.500c.8-3.5 5.500-3.8 6 0 .3 2.600-2.3 3.600-4.2 2.200" /><path d="M8.5 17h7M12 11.500V21" /></svg>
            </span>
            <span className="pedestal-glyph">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l10 10M20 4L10 14" /><path d="M12 16l-3 3M12 16l3 3M7.5 12.500l-3 3M16.5 12.500l3 3" /></svg>
            </span>
            <span className="pedestal-glyph">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.100L19 10l-5.1 1.900L12 17l-1.900-5.100L5 10l5.100-1.900z" /><path d="M18.5 16.500v3M17 18h3" /></svg>
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}