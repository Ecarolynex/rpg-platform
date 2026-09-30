import type { Wallet } from "../types/character";

export const RACAS = [
  "Anão",
  "Draconato",
  "Elfo",
  "Gnomo",
  "Halfling",
  "Humano",
  "Meio-elfo",
  "Meio-orc",
  "Tiefling",
];

export const CLASSES = [
  "Bárbaro",
  "Bardo",
  "Bruxo",
  "Clérigo",
  "Druida",
  "Feiticeiro",
  "Guerreiro",
  "Ladino",
  "Mago",
  "Monge",
  "Paladino",
  "Patrulheiro",
];

export const ALINHAMENTOS = [
  "Leal e Bom",
  "Neutro e Bom",
  "Caótico e Bom",
  "Leal e Neutro",
  "Neutro",
  "Caótico e Neutro",
  "Leal e Mau",
  "Neutro e Mau",
  "Caótico e Mau",
];

export const MOEDAS: { chave: keyof Wallet; sigla: string; nome: string }[] = [
  { chave: "pc", sigla: "PC", nome: "Cobre" },
  { chave: "pp", sigla: "PP", nome: "Prata" },
  { chave: "pe", sigla: "PE", nome: "Electro" },
  { chave: "po", sigla: "PO", nome: "Ouro" },
  { chave: "pl", sigla: "PL", nome: "Platina" },
];

const DADO_DE_VIDA: Record<string, number> = {
  Bárbaro: 12,
  Guerreiro: 10,
  Paladino: 10,
  Patrulheiro: 10,
  Bardo: 8,
  Bruxo: 8,
  Clérigo: 8,
  Druida: 8,
  Ladino: 8,
  Monge: 8,
  Feiticeiro: 6,
  Mago: 6,
};

export function modificador(valor: number): number {
  return Math.floor((valor - 10) / 2);
}

export function formatarModificador(valor: number): string {
  return (valor >= 0 ? "+" : "") + valor;
}

export function bonusProficiencia(nivel: number): number {
  return Math.ceil(nivel / 4) + 1;
}

/** Vida máxima: dado de vida cheio no nível 1, média do dado nos níveis seguintes. */
export function calcularVidaMaxima(
  classe: string,
  nivel: number,
  constituicao: number,
): number {
  const dado = DADO_DE_VIDA[classe] ?? 8;
  const mod = modificador(constituicao);
  const porNivel = Math.max(1, Math.floor(dado / 2) + 1 + mod);

  return Math.max(1, dado + mod + (nivel - 1) * porNivel);
}

/** Mesma regra que o projeto já usava para a mana. */
export function calcularManaMaxima(inteligencia: number): number {
  return 8 + inteligencia;
}

export function carteiraInicial(ouro: number): Wallet {
  return { pc: 0, pp: 0, pe: 0, po: Math.max(0, ouro), pl: 0 };
}
