import { useEffect, useState } from "react";
import { NavLink, Outlet, useMatch } from "react-router-dom";
import { Crest } from "../ui/Crest";
import { useAuth } from "../../context/AuthContext";
import { listarMinhasCampanhas } from "../../services/api";
import "./AppShell.css";
import "./AppShellCampaign.css";

export function AppShell() {
  const { user, logout } = useAuth();

  // Dentro de /campanha/:id (e da loja), o menu mostra a área daquela campanha.
  const campanhaAtual = useMatch("/campanha/:id/*");
  const campanhaId = campanhaAtual?.params.id;
  const [nomeCampanha, setNomeCampanha] = useState("");

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
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <Crest size={30} />
          <span>Elementum</span>
        </div>

        <nav className="app-sidebar-nav">
          <NavLink to="/" end>
            Meus personagens
          </NavLink>

          <NavLink to="/campanhas" end>
            Campanhas
          </NavLink>

          {campanhaId && (
            <>
              <span className="app-sidebar-section">
                {nomeCampanha || "Campanha atual"}
              </span>

              <NavLink to={"/campanha/" + campanhaId} end>
                Visão geral
              </NavLink>

              <NavLink to={"/campanha/" + campanhaId + "/loja"}>
                Loja
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
