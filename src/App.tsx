import { Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import CharacterSheet from "./pages/CharacterSheet/CharacterSheet";
import Campaigns from "./pages/Campaigns/Campaigns";
import Campaign from "./pages/Campaign/Campaign";

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
        <Route path="/campanha/:id" element={<Campaign />} />
        <Route path="/personagem/:id" element={<CharacterSheet />} />
      </Route>
    </Routes>
  );
}

export default App;