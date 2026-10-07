import { createContext } from "react";
import type { User } from "../types/character";

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (usuario: string, senha: string) => Promise<void>;
  register: (usuario: string, email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
