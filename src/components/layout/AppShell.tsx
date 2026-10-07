import { useEffect, useState } from "react";
import { NavLink, Outlet, useMatch } from "react-router-dom";
import { Crest } from "../ui/Crest";
import { useAuth } from "../../context/AuthContext";
import { listarMinhasCampanhas } from "../../services/api";
import "./AppShell.css";
import "./AppShellCampaign.css";

export function AppShell() {
  const { user, logout } = useAuth();

  // Dentro das rotas de campanha, o menu mostra os destinos daquela campanha.
  const campanhaAtual = useMatch("/campanha/:id/*");
  const campanhaId = campanhaAtual?.params.id;
  const personagemFichaAtual = useMatch("/personagem/:id");
  const personagemAtual = Boolean(personagemFichaAtual);
  const [nomeCampanha, setNomeCampanha] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (!campanhaId) return;

    let ativo = true;

    listarMinhasCampanhas()
      .then((campanhas) => {
        if (ativo) {
          setNomeCampanha(
            campanhas.find((item) => item.id === campanhaId)?.nome ?? "",
          );
        }
      })
      .catch(() => {
        if (ativo) setNomeCampanha("");
      });

    return () => {
      ativo = false;
    };
  }, [campanhaId]);

  return (
    <div className="app-shell">
      <aside className={menuAberto ? "app-sidebar app-sidebar--open" : "app-sidebar"}>
        <div className="app-sidebar-header">
          <div className="app-sidebar-brand">
            <Crest size={30} />
            <span>Elementum</span>
          </div>

          <button
            type="button"
            className="btn-ghost app-sidebar-menu-toggle"
            aria-controls="app-sidebar-navigation"
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto((aberto) => !aberto)}
          >
            {menuAberto ? "Fechar menu" : "Menu"}
            <span aria-hidden="true">{menuAberto ? "−" : "+"}</span>
          </button>
        </div>

        <nav id="app-sidebar-navigation" className="app-sidebar-nav" aria-label="Navegação principal">
          <NavLink
            to="/"
            end
            className={({ isActive }) => isActive || personagemAtual ? "active" : undefined}
            onClick={() => setMenuAberto(false)}
          >
            Meus personagens
          </NavLink>

          <NavLink to="/campanhas" end onClick={() => setMenuAberto(false)}>
            Campanhas
          </NavLink>

          <NavLink to="/regras/classes" onClick={() => setMenuAberto(false)}>
            Classes e habilidades
          </NavLink>

          {campanhaId && (
            <>
              <span className="app-sidebar-section">
                {nomeCampanha || "Campanha atual"}
              </span>

              <NavLink to={"/campanha/" + campanhaId} end onClick={() => setMenuAberto(false)}>
                Visão geral
              </NavLink>
              <NavLink to={"/campanha/" + campanhaId + "/mapa"} onClick={() => setMenuAberto(false)}>
                Mapa
              </NavLink>
              <NavLink to={"/campanha/" + campanhaId + "/loja"} onClick={() => setMenuAberto(false)}>
                Loja
              </NavLink>
              <NavLink to={"/campanha/" + campanhaId + "/dados"} onClick={() => setMenuAberto(false)}>
                Dados
              </NavLink>
            </>
          )}
        </nav>

        <div className="app-sidebar-footer">
          <div
            className="app-sidebar-account"
            aria-label={`Conta conectada: ${user?.nome || "Aventureiro"}`}
          >
            <span className="app-sidebar-account-mark" aria-hidden="true">
              {user?.nome?.trim().charAt(0).toUpperCase() || "A"}
            </span>

            <span className="app-sidebar-account-details">
              <span className="app-sidebar-account-label">Conta conectada</span>
              <span className="app-sidebar-user" title={user?.nome}>
                {user?.nome || "Aventureiro"}
              </span>
            </span>
          </div>

          <button
            className="btn-ghost app-sidebar-logout"
            aria-label="Sair da conta"
            onClick={() => {
              void logout();
            }}
          >
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
