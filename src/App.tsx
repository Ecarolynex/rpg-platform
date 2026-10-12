import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

const Login = lazy(() => import("./pages/Login/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const CharacterSheet = lazy(() => import("./pages/CharacterSheet/CharacterSheet"));
const Campaigns = lazy(() => import("./pages/Campaigns/Campaigns"));
const Campaign = lazy(() => import("./pages/Campaign/Campaign"));
const CampaignMap = lazy(() => import("./pages/CampaignMap/CampaignMap"));
const Bestiary = lazy(() => import("./pages/Bestiary/Bestiary"));
const Shop = lazy(() => import("./pages/Shop/Shop"));
const ClassCatalog = lazy(() => import("./pages/ClassCatalog/ClassCatalog"));
const DiceRollerPage = lazy(() => import("./pages/DiceRoller/DiceRollerPage"));

const AppShell = lazy(() =>
  import("./components/layout/AppShell").then((module) => ({
    default: module.AppShell,
  })),
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
          <Route path="/" element={<Dashboard />} />
          <Route path="/campanhas" element={<Campaigns />} />
          <Route path="/regras/classes" element={<ClassCatalog />} />

          {/* Compatibilidade: loja sem campanha */}
          <Route path="/loja" element={<Navigate to="/campanhas" replace />} />

          {/* Campanha e seus recursos */}
          <Route path="/campanha/:id" element={<Campaign />} />
          <Route path="/campanha/:id/mapa" element={<CampaignMap />} />
          <Route path="/campanha/:id/bestiario" element={<Bestiary />} />
          <Route path="/campanha/:id/dados" element={<DiceRollerPage />} />
          <Route path="/campanha/:id/loja" element={<Shop />} />
          <Route path="/campanha/:id/loja/carrinho" element={<Shop />} />

          {/* Ficha do personagem */}
          <Route path="/personagem/:id" element={<CharacterSheet />} />

          {/* Rota desconhecida volta ao início em vez de tela em branco */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
