import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "../types/character";
import { login as loginRequest, registerUser as registerRequest } from "../services/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (usuario: string, senha: string) => Promise<void>;
  register: (usuario: string, email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "aldermoor.user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  async function login(usuario: string, senha: string) {
    const loggedUser = await loginRequest(usuario, senha);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
    setUser(loggedUser);
  }

  async function register(usuario: string, email: string, senha: string) {
    const newUser = await registerRequest(usuario, email, senha);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
