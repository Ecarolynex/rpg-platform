import type { Character, User } from "../types/character";
import { mockCharacters } from "../data/mockCharacters";
import { supabase } from "./supabase";

const CHARACTERS_STORAGE_KEY = "aldermoor_characters_v2";

function getLocalCharacters(): Character[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [...mockCharacters];
  }
  try {
    const raw = window.localStorage.getItem(CHARACTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Erro ao carregar personagens locais:", err);
  }

  // Inicializa o storage com os mockCharacters se não houver dados salvos ainda
  try {
    window.localStorage.setItem(CHARACTERS_STORAGE_KEY, JSON.stringify(mockCharacters));
  } catch {
    // ignora em caso de cota de armazenamento
  }
  return [...mockCharacters];
}

function setLocalCharacters(characters: Character[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(CHARACTERS_STORAGE_KEY, JSON.stringify(characters));
  } catch (err) {
    console.error("Erro ao salvar personagens no localStorage:", err);
  }
}

function delay<T>(value: T, ms = 50): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function withTimeout<T>(promise: Promise<T>, ms = 600): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Supabase timeout")), ms)
    ),
  ]);
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
    const { data, error } = await withTimeout(
      supabase.from("personagens").select("*"),
      500
    );
    if (!error && data && data.length > 0) {
      const locals = getLocalCharacters();
      const combined = [...locals];
      for (const item of data as Character[]) {
        if (!combined.some((c) => c.id === item.id)) {
          combined.push(item);
        }
      }
      setLocalCharacters(combined);
      return combined;
    }
  } catch {
    // fallback para localStorage
  }
  return delay(getLocalCharacters());
}

export async function getCharacterById(id: string): Promise<Character | undefined> {
  const locals = getLocalCharacters();
  const foundLocal = locals.find((c) => String(c.id) === String(id));
  if (foundLocal) {
    return delay(foundLocal);
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from("personagens")
        .select("*")
        .eq("id", id)
        .single(),
      500
    );
    if (!error && data) {
      const char = data as Character;
      setLocalCharacters([char, ...locals]);
      return char;
    }
  } catch {
    // fallback
  }

  return delay(mockCharacters.find((c) => String(c.id) === String(id)));
}

export async function saveCharacter(character: Character): Promise<Character> {
  const characters = getLocalCharacters();
  const existingIndex = characters.findIndex((c) => String(c.id) === String(character.id));
  let updatedList: Character[];

  if (existingIndex >= 0) {
    updatedList = characters.map((c) => (String(c.id) === String(character.id) ? character : c));
  } else {
    updatedList = [character, ...characters];
  }

  setLocalCharacters(updatedList);

  try {
    await supabase.from("personagens").upsert(character);
  } catch {
    // Fallback silencioso para armazenamento local
  }

  return delay(character, 50);
}

export async function deleteCharacter(id: string): Promise<void> {
  const characters = getLocalCharacters();
  const updated = characters.filter((c) => String(c.id) !== String(id));
  setLocalCharacters(updated);

  try {
    await supabase.from("personagens").delete().eq("id", id);
  } catch {
    // ignore
  }
}
