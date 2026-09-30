import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import CharacterSheet from "./pages/CharacterSheet/CharacterSheet";
import Campaigns from "./pages/Campaigns/Campaigns";
import Campaign from "./pages/Campaign/Campaign";
import Shop from "./pages/Shop/Shop";
import Inventory from "./pages/Inventory/Inventory";

function App() {
  return (
    <Routes>
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
        <Route path="/loja" element={<Navigate to="/campanhas" replace />} />
        <Route path="/campanha/:id" element={<Campaign />} />
        <Route path="/campanha/:id/loja/carrinho" element={<Shop />} />
        <Route path="/campanha/:id/loja" element={<Shop />} />
        <Route path="/campanha/:id/inventario" element={<Inventory />} />
        <Route path="/campanha/:id/inventario/:characterId" element={<Inventory />} />
        <Route path="/personagem/:id" element={<CharacterSheet />} />
        <Route path="/personagem/:id/inventario" element={<Inventory />} />
      </Route>
    </Routes>
  );
}

export default App;