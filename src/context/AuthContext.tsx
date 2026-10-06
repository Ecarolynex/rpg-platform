import { useEffect, useState, type ReactNode } from "react";
import type { User } from "../types/character";
import { AuthContext } from "./auth-context";

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
    let unsubscribe: (() => void) | undefined;

    async function loadSession() {
      try {
        const { supabase } = await import("../services/supabase");
        if (!mounted) return;

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (mounted) {
            setUser(mapSupabaseUser(session?.user ?? null));
            setLoading(false);
          }
        });
        unsubscribe = () => subscription.unsubscribe();

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Erro ao recuperar sessão:", error);
        }

        if (mounted) {
          setUser(mapSupabaseUser(data.session?.user ?? null));
          setLoading(false);
        }
      } catch (error) {
        console.error("Erro ao recuperar sessão:", error);
        if (mounted) setLoading(false);
      }
    }

    void loadSession();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  async function login(usuario: string, senha: string) {
    const { login: loginRequest } = await import("../services/api");
    setUser(await loginRequest(usuario, senha));
  }

  async function register(usuario: string, email: string, senha: string) {
    const { registerUser: registerRequest } = await import("../services/api");
    const newUser = await registerRequest(usuario, email, senha);
    const { supabase } = await import("../services/supabase");
    const { data } = await supabase.auth.getSession();

    setUser(data.session ? newUser : null);
  }

  async function logout() {
    const { supabase } = await import("../services/supabase");
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message || "Não foi possível sair do reino.");
    }

    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
