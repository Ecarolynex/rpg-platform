import { NavLink, Outlet } from "react-router-dom";
import { Crest } from "../ui/Crest";
import { useAuth } from "../../context/AuthContext";
import "./AppShell.css";

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <Crest size={30} />
          <span>Aldermoor</span>
        </div>
        <nav className="app-sidebar-nav">
          <NavLink to="/" end>
            Meus personagens
          </NavLink>
          <NavLink to="/campanhas">Campanhas</NavLink>
          <NavLink to="/bestiario">Bestiário</NavLink>
        </nav>
        <div className="app-sidebar-footer">
          <span className="app-sidebar-user">{user?.nome}</span>
          <button className="btn-ghost" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
