import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "../types/character";
import {
  login as loginRequest,
  registerUser as registerRequest,
} from "../services/api";
import { supabase } from "../services/supabase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (usuario: string, senha: string) => Promise<void>;
  register: (usuario: string, email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapSupabaseUser(
  supabaseUser: {
    id: string;
    email?: string | null;
    user_metadata?: {
      nome?: string;
      username?: string;
    };
  } | null,
): User | null {
  if (!supabaseUser) {
    return null;
  }

  const nome =
    supabaseUser.user_metadata?.nome ||
    supabaseUser.user_metadata?.username ||
    supabaseUser.email?.split("@")[0] ||
    "Aventureiro";

  return {
    id: supabaseUser.id,
    nome,
    email: supabaseUser.email ?? undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Erro ao recuperar sessão:", error);
      }

      if (mounted) {
        setUser(mapSupabaseUser(data.session?.user ?? null));
        setLoading(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(mapSupabaseUser(session?.user ?? null));
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function login(usuario: string, senha: string) {
    const loggedUser = await loginRequest(usuario, senha);
    setUser(loggedUser);
  }

  async function register(
    usuario: string,
    email: string,
    senha: string,
  ) {
    const newUser = await registerRequest(usuario, email, senha);

    const { data } = await supabase.auth.getSession();

    if (data.session) {
      setUser(newUser);
    } else {
      setUser(null);
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message || "Não foi possível sair do reino.");
    }

    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  }

  return ctx;
}