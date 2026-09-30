import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Crest } from "../../components/ui/Crest";
import "./Login.css";

type AuthTab = "login" | "register";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<AuthTab>("login");

  // Login form fields
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");

  // Register form fields
  const [regUsuario, setRegUsuario] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regSenha, setRegSenha] = useState("");
  const [regConfirmaSenha, setRegConfirmaSenha] = useState("");

  // Status and feedback
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function switchTab(tab: AuthTab) {
    setActiveTab(tab);
    setErro(null);
    setSucesso(null);
  }

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
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

    if (regSenha.length < 3) {
      setErro("A senha deve conter pelo menos 3 caracteres.");
      return;
    }

    if (regSenha !== regConfirmaSenha) {
      setErro("As senhas não coincidem. Verifique a confirmação.");
      return;
    }

    setEnviando(true);
    try {
      await register(regUsuario, regEmail, regSenha);
      setSucesso("Conta forjada com sucesso! Adentrando ao reino...");
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
    <div className="login-screen">
      <div className="login-ambient-glow" aria-hidden="true" />

      <div className="login-card-container">
        {/* Banner no estilo do Dashboard */}
        <div className="login-banner">
          <div className="login-banner-content">
            <span className="login-kicker">Portal dos Aventureiros</span>
            <div className="login-title-row">
              <div className="login-crest-wrapper">
                <Crest size={40} />
              </div>
              <div>
                <h2>Elementum</h2>
                <p>Crônicas e fichas do seu reino</p>
              </div>
            </div>
          </div>
          <span className="login-badge">Plataforma RPG</span>
        </div>

        {/* Abas Entrar / Criar Conta */}
        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${activeTab === "login" ? "active" : ""}`}
            onClick={() => switchTab("login")}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`login-tab ${activeTab === "register" ? "active" : ""}`}
            onClick={() => switchTab("register")}
          >
            Criar conta
          </button>
        </div>

        <div className="login-body">
          {/* Mensagens de Feedback */}
          {erro && (
            <div className="auth-alert alert-error" role="alert">
              <span className="alert-icon">⚔</span>
              <span>{erro}</span>
            </div>
          )}

          {sucesso && (
            <div className="auth-alert alert-success" role="alert">
              <span className="alert-icon">✨</span>
              <span>{sucesso}</span>
            </div>
          )}

          {/* FORMULÁRIO DE ENTRAR */}
          {activeTab === "login" && (
            <form className="auth-form" onSubmit={handleLoginSubmit}>
              <div className="field">
                <span>E-mail do Reino</span>
                <input
                  id="usuario"
                  type="email"
                  placeholder="seu-email@reino.com"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="field">
                <span>Senha Arcana</span>
                <input
                  id="senha"
                  type="password"
                  placeholder="Sua senha secreta"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                className="btn-primary auth-submit-btn"
                type="submit"
                disabled={enviando}
              >
                {enviando ? "Abrindo os portões..." : "Adentrar ao Reino"}
              </button>

              <div className="auth-switch-prompt">
                <span>Novo nestas terras?</span>{" "}
                <button
                  type="button"
                  className="link-switch"
                  onClick={() => switchTab("register")}
                >
                  Forjar uma nova conta
                </button>
              </div>

              <div className="mock-demo-tip">
                <span className="tip-title">Conectado ao Supabase:</span>
                <span>
                  As contas criadas são salvas e sincronizadas diretamente no seu projeto Supabase.
                </span>
              </div>
            </form>
          )}

          {/* FORMULÁRIO DE CRIAR CONTA */}
          {activeTab === "register" && (
            <form className="auth-form" onSubmit={handleRegisterSubmit}>
              <div className="field">
                <span>Nome de Aventureiro (Usuário)</span>
                <input
                  id="reg-usuario"
                  type="text"
                  placeholder="Ex: MagoEldrin, Valquíria..."
                  value={regUsuario}
                  onChange={(e) => setRegUsuario(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="field">
                <span>E-mail do Reino</span>
                <input
                  id="reg-email"
                  type="email"
                  placeholder="aventureiro@reino.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="field-grid">
                <div className="field">
                  <span>Senha</span>
                  <input
                    id="reg-senha"
                    type="password"
                    placeholder="Mínimo 3 caracteres"
                    value={regSenha}
                    onChange={(e) => setRegSenha(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="field">
                  <span>Confirmar Senha</span>
                  <input
                    id="reg-confirma-senha"
                    type="password"
                    placeholder="Repita a senha"
                    value={regConfirmaSenha}
                    onChange={(e) => setRegConfirmaSenha(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <button
                className="btn-primary auth-submit-btn"
                type="submit"
                disabled={enviando}
              >
                {enviando ? "Registrando lenda..." : "Forjar Conta de Aventureiro"}
              </button>

              <div className="auth-switch-prompt">
                <span>Já possui uma lenda registrada?</span>{" "}
                <button
                  type="button"
                  className="link-switch"
                  onClick={() => switchTab("login")}
                >
                  Entrar com conta existente
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
