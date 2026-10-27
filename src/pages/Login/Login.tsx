import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { PortalScene } from "./PortalScene";
import "./Login.css";

type AuthTab = "login" | "register";

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
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const errorId = `${id}-error`;

  return (
    <div className="portal-field">
      <label htmlFor={id}>{label}</label>
      <div className={`portal-field__control${error ? " is-invalid" : ""}`}>
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {isPassword && (
          <button
            type="button"
            className="portal-field__visibility"
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? "OCULTAR" : "MOSTRAR"}
          </button>
        )}
      </div>
      {error && <p className="portal-field__error" id={errorId}>{error}</p>}
    </div>
  );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [opened, setOpened] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<AuthTab>("login");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [regUsuario, setRegUsuario] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regSenha, setRegSenha] = useState("");
  const [regConfirmaSenha, setRegConfirmaSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errosCampos, setErrosCampos] = useState<Record<string, string>>({});
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);

  function enterRealm() {
    if (opened) return;
    setOpened(true);
    revealTimer.current = setTimeout(
      () => setAuthVisible(true),
      reduceMotion ? 100 : 2850,
    );
  }

  function switchTab(tab: AuthTab) {
    setActiveTab(tab);
    setErro(null);
    setSucesso(null);
    setErrosCampos({});
  }

  async function handleLoginSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setSucesso(null);

    const errors: Record<string, string> = {};
    if (!usuario.trim()) errors.usuario = "Informe o e-mail do Reino.";
    else if (!EMAIL_REGEX.test(usuario.trim())) errors.usuario = "Esse e-mail não parece válido.";
    if (!senha) errors.senha = "Informe a senha arcana.";
    setErrosCampos(errors);
    if (Object.keys(errors).length > 0) return;

    setEnviando(true);
    try {
      await login(usuario, senha);
      navigate("/");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível entrar no reino.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleRegisterSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setSucesso(null);

    const errors: Record<string, string> = {};
    if (!regUsuario.trim()) errors.regUsuario = "Escolha um nome de aventureiro.";
    if (!regEmail.trim()) errors.regEmail = "Informe o e-mail do Reino.";
    else if (!EMAIL_REGEX.test(regEmail.trim())) errors.regEmail = "Esse e-mail não parece válido.";
    if (regSenha.length < 3) errors.regSenha = "A senha deve conter pelo menos 3 caracteres.";
    if (regSenha !== regConfirmaSenha) errors.regConfirmaSenha = "As senhas não coincidem.";
    setErrosCampos(errors);
    if (Object.keys(errors).length > 0) return;

    setEnviando(true);
    try {
      await register(regUsuario, regEmail, regSenha);
      setSucesso("Conta forjada com sucesso! Adentrando o reino...");
      setTimeout(() => navigate("/"), 1000);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao forjar conta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className={`realm-portal-page${opened ? " is-opened" : ""}`}>
      <PortalScene opened={opened} reducedMotion={reduceMotion ?? false} />

      <motion.section
        className="portal-intro"
        initial={false}
        animate={{ opacity: opened ? 0 : 1, y: opened ? -18 : 0 }}
        transition={{ duration: reduceMotion ? 0.1 : 0.55 }}
        aria-hidden={opened}
        inert={opened}
      >
        <span className="portal-intro__eyebrow">ELEMENTUM · CRÔNICAS DO REINO</span>
        <h1>AS PORTAS DE OUTRO MUNDO AGUARDAM.</h1>
        <p>Além destas pedras antigas, uma nova lenda começa.</p>
        <motion.button
          className="portal-enter-button"
          type="button"
          aria-label="Entrar no reino"
          onClick={enterRealm}
          whileHover={reduceMotion ? undefined : { scale: 1.035 }}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        >
          <span aria-hidden="true">✧</span>
        </motion.button>
      </motion.section>

      <AnimatePresence>
        {authVisible && (
          <motion.section
            className="portal-auth-panel"
            aria-labelledby="portal-auth-title"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.75, ease: [0.2, 0.75, 0.25, 1] }}
          >
            <div className="portal-auth-panel__crest" aria-hidden="true">✧</div>
            <p className="portal-auth-panel__eyebrow">O PORTAL FOI ABERTO</p>
            <h2 id="portal-auth-title">
              {activeTab === "login" ? "RETORNAR AO REINO" : "FORJE SUA LENDA"}
            </h2>
            <nav className="portal-auth-tabs" aria-label="Acesso ao reino">
              <button
                type="button"
                className={activeTab === "login" ? "active" : ""}
                aria-current={activeTab === "login" ? "page" : undefined}
                onClick={() => switchTab("login")}
              >
                ENTRAR
              </button>
              <button
                type="button"
                className={activeTab === "register" ? "active" : ""}
                aria-current={activeTab === "register" ? "page" : undefined}
                onClick={() => switchTab("register")}
              >
                CRIAR CONTA
              </button>
            </nav>

            {erro && <div className="portal-feedback portal-feedback--error" role="alert">{erro}</div>}
            {sucesso && <div className="portal-feedback portal-feedback--success" role="status">{sucesso}</div>}

            <AnimatePresence mode="wait" initial={false}>
              {activeTab === "login" ? (
                <motion.form
                  key="login"
                  className="portal-auth-form"
                  onSubmit={handleLoginSubmit}
                  noValidate
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: reduceMotion ? 0.1 : 0.22 }}
                >
                  <Field
                    id="usuario"
                    label="E-mail cadastrado"
                    type="email"
                    placeholder="seu-email@reino.com"
                    value={usuario}
                    onChange={setUsuario}
                    autoComplete="email"
                    error={errosCampos.usuario}
                  />
                  <Field
                    id="senha"
                    label="Senha arcana"
                    type="password"
                    placeholder="Sua senha secreta"
                    value={senha}
                    onChange={setSenha}
                    autoComplete="current-password"
                    error={errosCampos.senha}
                  />
                  <button className="portal-submit-button" type="submit" disabled={enviando} aria-busy={enviando}>
                    {enviando ? "ABRINDO O PORTAL..." : "ENTRAR NO REINO"}
                  </button>
                  <p className="portal-auth-switch">
                    Ainda não tem conta?{" "}
                    <button type="button" onClick={() => switchTab("register")}>Forje sua lenda</button>
                  </p>
                </motion.form>
              ) : (
                <motion.form
                  key="register"
                  className="portal-auth-form"
                  onSubmit={handleRegisterSubmit}
                  noValidate
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: reduceMotion ? 0.1 : 0.22 }}
                >
                  <Field
                    id="reg-usuario"
                    label="Nome de aventureiro"
                    placeholder="Ex.: MagoEldrin"
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
                  <div className="portal-auth-form__row">
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
                      label="Confirmar senha"
                      type="password"
                      placeholder="Repita a senha"
                      value={regConfirmaSenha}
                      onChange={setRegConfirmaSenha}
                      autoComplete="new-password"
                      error={errosCampos.regConfirmaSenha}
                    />
                  </div>
                  <button className="portal-submit-button" type="submit" disabled={enviando} aria-busy={enviando}>
                    {enviando ? "FORJANDO SUA LENDA..." : "FORJAR CONTA"}
                  </button>
                  <p className="portal-auth-switch">
                    Já possui uma conta?{" "}
                    <button type="button" onClick={() => switchTab("login")}>Retornar ao login</button>
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
