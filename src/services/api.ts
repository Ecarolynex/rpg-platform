import type { Character, User } from "../types/character";
import { mockCharacters } from "../data/mockCharacters";
import { supabase } from "./supabase";

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function login(usuario: string, senha: string): Promise<User> {
  const cleanInput = usuario.trim();
  if (!cleanInput || !senha) {
    throw new Error("Informe seu e-mail e senha para prosseguir.");
  }

  // Se o usuário digitou sem '@', avisa amigavelmente
  if (!cleanInput.includes("@")) {
    throw new Error(
      "Para entrar pelo Supabase, informe o e-mail cadastrado (ex: aventureiro@reino.com).",
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanInput,
    password: senha,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      throw new Error(
        "E-mail ainda não confirmado! Verifique sua caixa de entrada ou desative a confirmação de e-mail no painel do Supabase durante os testes.",
      );
    }
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      throw new Error("E-mail ou senha incorretos.");
    }
    throw new Error(error.message || "Erro ao conectar com o Supabase.");
  }

  if (!data.user) {
    throw new Error("Usuário não encontrado.");
  }

  const nome =
    data.user.user_metadata?.nome ||
    data.user.user_metadata?.username ||
    data.user.email?.split("@")[0] ||
    "Aventureiro";

  return {
    id: data.user.id,
    nome,
    email: data.user.email,
  };
}

export async function registerUser(
  usuario: string,
  email: string,
  senha: string,
): Promise<User> {
  const cleanUser = usuario.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanUser || !cleanEmail || !senha) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: senha,
    options: {
      data: {
        username: cleanUser,
        nome: cleanUser,
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      throw new Error("Este e-mail já está registrado no Supabase.");
    }
    throw new Error(error.message || "Não foi possível cadastrar no Supabase.");
  }

  if (!data.user) {
    throw new Error("Erro ao criar aventureiro no Supabase.");
  }

  // Se o Supabase tiver a tabela 'usuarios', tenta gravar os dados adicionais lá também
  try {
    await supabase.from("usuarios").insert([
      {
        id: data.user.id,
        usuario: cleanUser,
        nome: cleanUser,
        email: cleanEmail,
      },
    ]);
  } catch {
    // Se a tabela tiver estrutura diferente ou não existir no schema public, o auth nativo já está salvo
  }

  return {
    id: data.user.id,
    nome: cleanUser,
    email: cleanEmail,
  };
}

export async function getCharacters(): Promise<Character[]> {
  try {
    const { data, error } = await supabase.from("personagens").select("*");
    if (!error && data && data.length > 0) {
      return data as Character[];
    }
  } catch {
    // fallback para mock se a tabela estiver vazia
  }
  return delay(mockCharacters);
}

export async function getCharacterById(id: string): Promise<Character | undefined> {
  try {
    const { data, error } = await supabase
      .from("personagens")
      .select("*")
      .eq("id", id)
      .single();
    if (!error && data) {
      return data as Character;
    }
  } catch {
    // fallback
  }
  return delay(mockCharacters.find((c) => c.id === id));
}
