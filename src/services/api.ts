import type { Character, User } from "../types/character";
import { mockCharacters } from "../data/mockCharacters";

// Defina VITE_API_URL no seu .env quando o backend estiver pronto para receber
// requisições reais. Enquanto essa variável não existir, o app usa os dados
// de exemplo em src/data/mockCharacters.ts.
const API_URL = import.meta.env.VITE_API_URL as string | undefined;
const USE_MOCK = !API_URL;

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function login(usuario: string, senha: string): Promise<User> {
  if (USE_MOCK) {
    if (!usuario || !senha) throw new Error("Informe usuário e senha.");
    return delay({ id: "u1", nome: usuario });
  }
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, senha }),
  });
  if (!res.ok) throw new Error("Usuário ou senha inválidos.");
  return res.json();
}

export async function getCharacters(): Promise<Character[]> {
  if (USE_MOCK) return delay(mockCharacters);
  const res = await fetch(`${API_URL}/characters`);
  if (!res.ok) throw new Error("Não foi possível carregar os personagens.");
  return res.json();
}

export async function getCharacterById(id: string): Promise<Character | undefined> {
  if (USE_MOCK) return delay(mockCharacters.find((c) => c.id === id));
  const res = await fetch(`${API_URL}/characters/${id}`);
  if (!res.ok) throw new Error("Personagem não encontrado.");
  return res.json();
}
