import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import CharacterSheet from "./pages/CharacterSheet/CharacterSheet";
import Campaigns from "./pages/Campaigns/Campaigns";
import Campaign from "./pages/Campaign/Campaign";
import CampaignMap from "./pages/CampaignMap/CampaignMap";
import Shop from "./pages/Shop/Shop";
import ClassCatalog from "./pages/ClassCatalog/ClassCatalog";

function App() {
  return (
    <Routes>
      <Route path="/entra" element={<Login />} />
      <Route path="/entrar" element={<Login />} />

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
  );
}

export default App;