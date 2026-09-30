export interface Attributes {
  forca: number;
  destreza: number;
  constituicao: number;
  inteligencia: number;
  sabedoria: number;
  carisma: number;
}

export interface Skill {
  id: string;
  nome: string;
  atributo: keyof Attributes;
  treinada: boolean;
  bonus: number;
}

export interface InventoryItem {
  id: string;
  nome: string;
  quantidade: number;
  descricao?: string;
}

export interface Spell {
  id: string;
  nome: string;
  custo: number;
  descricao: string;
}

/** Carteira no estilo D&D: cobre, prata, electro, ouro e platina. */
export interface Wallet {
  pc: number;
  pp: number;
  pe: number;
  po: number;
  pl: number;
}

export interface Character {
  id: string;
  nome: string;
  raca: string;
  classe: string;
  nivel: number;
  portraitUrl?: string;
  alinhamento?: string;
  origem?: string;
  idade?: string;
  historia?: string;
  aparencia?: string;
  objetivo?: string;
  defeito?: string;
  hp: { atual: number; max: number };
  mp: { atual: number; max: number };
  attributes: Attributes;
  skills: Skill[];
  inventory: InventoryItem[];
  spells: Spell[];
  carteira?: Wallet;
  notas: string;
}

export interface User {
  id: string;
  nome: string;
  email?: string;
}
