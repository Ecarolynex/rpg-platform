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

export interface Character {
  id: string;
  nome: string;
  raca: string;
  classe: string;
  nivel: number;
  portraitUrl?: string;
  hp: { atual: number; max: number };
  mp: { atual: number; max: number };
  attributes: Attributes;
  skills: Skill[];
  inventory: InventoryItem[];
  spells: Spell[];
  notas: string;
}

export interface User {
  id: string;
  nome: string;
  email?: string;
}
