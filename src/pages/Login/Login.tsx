import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import "./Login.css";

type AuthTab = "login" | "register";

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
      setTimeout(() => { navigate("/"); }, 1000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao forjar conta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="realm-portal-page">
      {/* Cenário Monumental Contínuo */}
      <div className="portal-atmosphere-backdrop" aria-hidden="true" />

      {/* Arquitetura Central da Entrada Monumental */}
      <main className="portal-gate-structure">
        {/* Arco Superior - Inscrição Rúnica e Título */}
        <header className="portal-keystone">
          <span className="keystone-runes" aria-hidden="true">ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ</span>
          <h1 className="portal-monumental-title">PORTAL DOS AVENTUREIROS — ELEMENTUM</h1>
          <span className="keystone-runes" aria-hidden="true">ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ</span>
        </header>

        {/* Pilares Rúnicos Laterais Integrados à Arquitetura */}
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

        {/* Núcleo do Portal - Portão de Passagem Interativo */}
        <section className="portal-inner-sanctum">
          {/* Seletor de Rito esculpido em pedra e bronze */}
          <nav className="portal-rites-nav" aria-label="Acesso ao reino">
            <button
              type="button"
              className={`portal-rite-btn ${activeTab === "login" ? "active" : ""}`}
              onClick={() => switchTab("login")}
            >
              ENTRAR
            </button>
            <button
              type="button"
              className={`portal-rite-btn ${activeTab === "register" ? "active" : ""}`}
              onClick={() => switchTab("register")}
            >
              CRIAR CONTA
            </button>
          </nav>

          {/* Mensagens Rúnicas de Feedback */}
          {erro && (
            <div className="portal-relic-alert alert-error" role="alert">
              <span className="alert-symbol">⚔</span>
              <span>{erro}</span>
            </div>
          )}
          {sucesso && (
            <div className="portal-relic-alert alert-success" role="alert">
              <span className="alert-symbol">✨</span>
              <span>{sucesso}</span>
            </div>
          )}

          {/* Rito de Entrada (Login) */}
          {activeTab === "login" && (
            <form className="portal-inscriptions-form" onSubmit={handleLoginSubmit}>
              <div className="portal-engraved-field">
                <label htmlFor="usuario" className="engraved-label">
                  E-mail do Reino
                </label>
                <div className="engraved-input-wrap">
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
              </div>

              <div className="portal-engraved-field">
                <label htmlFor="senha" className="engraved-label">
                  Senha Arcana
                </label>
                <div className="engraved-input-wrap">
                  <input
                    id="senha"
                    type="password"
                    placeholder="sua-senha-secreta"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              {/* Selo Místico Monumental - Mecanismo de Abertura */}
              <div className="portal-seal-mechanism">
                <button
                  type="submit"
                  className="portal-seal-trigger"
                  disabled={enviando}
                  aria-label="Adentrar ao Reino"
                >
                  <div className="seal-emblem-disc">
                    <img
                      src="/logo.png"
                      alt="Forged Phoenix Seal"
                      className="seal-phoenix-img"
                    />
                    <div className="seal-radial-glow" aria-hidden="true" />
                  </div>
                  <span className="seal-arc-text">ADENTRAR AO REINO</span>
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
            <form className="portal-inscriptions-form" onSubmit={handleRegisterSubmit}>
              <div className="portal-engraved-field">
                <label htmlFor="reg-usuario" className="engraved-label">
                  Nome de Aventureiro
                </label>
                <div className="engraved-input-wrap">
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
              </div>

              <div className="portal-engraved-field">
                <label htmlFor="reg-email" className="engraved-label">
                  E-mail do Reino
                </label>
                <div className="engraved-input-wrap">
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
              </div>

              <div className="engraved-field-row">
                <div className="portal-engraved-field">
                  <label htmlFor="reg-senha" className="engraved-label">
                    Senha
                  </label>
                  <div className="engraved-input-wrap">
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
                </div>

                <div className="portal-engraved-field">
                  <label htmlFor="reg-confirma-senha" className="engraved-label">
                    Confirmar Senha
                  </label>
                  <div className="engraved-input-wrap">
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
              </div>

              {/* Botão de Selo para Forjar Conta */}
              <div className="portal-seal-mechanism">
                <button
                  type="submit"
                  className="portal-seal-trigger"
                  disabled={enviando}
                  aria-label="Forjar Conta de Aventureiro"
                >
                  <div className="seal-emblem-disc">
                    <img
                      src="/logo.png"
                      alt="Forged Phoenix Seal"
                      className="seal-phoenix-img"
                    />
                    <div className="seal-radial-glow" aria-hidden="true" />
                  </div>
                  <span className="seal-arc-text">FORJAR CONTA</span>
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

        {/* Rodapé Arquitetônico de Glifos */}
        <footer className="portal-pedestal-relics" aria-hidden="true">
          <div className="pedestal-glyph-row">
            <span className="pedestal-glyph">🛡️</span>
            <span className="pedestal-glyph">💰</span>
            <span className="pedestal-glyph-crest">⚜️</span>
            <span className="pedestal-glyph">⚔️</span>
            <span className="pedestal-glyph">✨</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
