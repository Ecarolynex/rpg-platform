import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import CharacterSheet from "./pages/CharacterSheet/CharacterSheet";
import Campaigns from "./pages/Campaigns/Campaigns";
import Campaign from "./pages/Campaign/Campaign";
import CampaignMap from "./pages/CampaignMap/CampaignMap";
import Shop from "./pages/Shop/Shop";
import ClassCatalog from "./pages/ClassCatalog/ClassCatalog";
const DiceRollerPage = lazy(() => import("./pages/DiceRoller/DiceRollerPage"));
const AppShell = lazy(() => import("./components/layout/AppShell").then((module) => ({
  default: module.AppShell,
})));
const Login = lazy(() => import("./pages/Login/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const CharacterSheet = lazy(() => import("./pages/CharacterSheet/CharacterSheet"));
const Campaigns = lazy(() => import("./pages/Campaigns/Campaigns"));
const Campaign = lazy(() => import("./pages/Campaign/Campaign"));
const CampaignMap = lazy(() => import("./pages/CampaignMap/CampaignMap"));
const Shop = lazy(() => import("./pages/Shop/Shop"));
const ClassCatalog = lazy(() => import("./pages/ClassCatalog/ClassCatalog"));

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
        <Route path="/entra" element={<Login />} />
        <Route path="/entrar" element={<Login />} />

        <Route
          path="/loja"
          element={<Navigate to="/campanhas" replace />}
        />

        <Route path="/campanha/:id" element={<Campaign />} />
        <Route path="/campanha/:id/mapa" element={<CampaignMap />} />
        <Route
          path="/campanha/:id/dados"
          element={(
            <Suspense fallback={<p role="status">Carregando rolador de dados...</p>}>
              <DiceRollerPage />
            </Suspense>
          )}
        />

        <Route path="/campanha/:id/loja/carrinho" element={<Shop />} />
        <Route path="/campanha/:id/loja" element={<Shop />} />

        <Route path="/personagem/:id" element={<CharacterSheet />} />
      </Route>
    </Routes>
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/campanhas" element={<Campaigns />} />
          <Route path="/regras/classes" element={<ClassCatalog />} />

          <Route
            path="/loja"
            element={<Navigate to="/campanhas" replace />}
          />

          <Route path="/campanha/:id" element={<Campaign />} />
          <Route path="/campanha/:id/mapa" element={<CampaignMap />} />

          <Route path="/campanha/:id/loja/carrinho" element={<Shop />} />
          <Route path="/campanha/:id/loja" element={<Shop />} />

          <Route path="/personagem/:id" element={<CharacterSheet />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
