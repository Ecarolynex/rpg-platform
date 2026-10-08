import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

const Login = lazy(() => import("./pages/Login/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const CharacterSheet = lazy(
  () => import("./pages/CharacterSheet/CharacterSheet")
);
const Campaigns = lazy(() => import("./pages/Campaigns/Campaigns"));
const Campaign = lazy(() => import("./pages/Campaign/Campaign"));
const CampaignMap = lazy(
  () => import("./pages/CampaignMap/CampaignMap")
);
const Shop = lazy(() => import("./pages/Shop/Shop"));
const ClassCatalog = lazy(
  () => import("./pages/ClassCatalog/ClassCatalog")
);

const DiceRollerPage = lazy(() =>
  import("./pages/DiceRoller/DiceRollerPage")
);

const AppShell = lazy(() =>
  import("./components/layout/AppShell").then((module) => ({
    default: module.AppShell,
  }))
);

function App() {
  return (
    <Suspense
      fallback={
        <div className="route-loading" role="status" aria-live="polite">
          Carregando tela...
        </div>
      }
    >
      <Routes>
        {/* Login */}
        <Route path="/entra" element={<Login />} />
        <Route path="/entrar" element={<Login />} />

        {/* Área protegida */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          {/* Dashboard */}
          <Route path="/" element={<Dashboard />} />

          {/* Campanhas */}
          <Route path="/campanhas" element={<Campaigns />} />

          {/* Catálogo global de classes */}
          <Route
            path="/regras/classes"
            element={<ClassCatalog />}
          />

          {/* Compatibilidade: loja sem campanha */}
          <Route
            path="/loja"
            element={<Navigate to="/campanhas" replace />}
          />

          {/* Campanha */}
          <Route
            path="/campanha/:id"
            element={<Campaign />}
          />

          {/* Mapa da campanha */}
          <Route
            path="/campanha/:id/mapa"
            element={<CampaignMap />}
          />

          {/* Rolador de dados */}
          <Route
            path="/campanha/:id/dados"
            element={
              <Suspense
                fallback={
                  <p role="status">
                    Carregando rolador de dados...
                  </p>
                }
              >
                <DiceRollerPage />
              </Suspense>
            }
          />

          {/* Loja da campanha */}
          <Route
            path="/campanha/:id/loja"
            element={<Shop />}
          />

          {/* Carrinho da loja */}
          <Route
            path="/campanha/:id/loja/carrinho"
            element={<Shop />}
          />

          {/* Ficha do personagem */}
          <Route
            path="/personagem/:id"
            element={<CharacterSheet />}
          />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;