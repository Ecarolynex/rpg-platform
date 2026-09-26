import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { OrnateFrame } from "../../components/ui/OrnateFrame";
import { Crest } from "../../components/ui/Crest";
import "./Login.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login(usuario, senha);
      navigate("/");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-screen">
      <OrnateFrame>
        <div className="login-card">
          <div className="login-brand">
            <Crest size={44} />
            <h1>Aldermoor</h1>
            <p>Crônicas e fichas do seu reino</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="usuario">Usuário</label>
              <input
                id="usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="senha">Senha</label>
              <input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {erro && <p className="login-error">{erro}</p>}

            <button className="btn-primary" type="submit" disabled={enviando}>
              {enviando ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="login-footer">
            Ainda não tem uma conta? <a href="#">Criar conta</a>
          </p>
        </div>
      </OrnateFrame>
    </div>
  );
}
