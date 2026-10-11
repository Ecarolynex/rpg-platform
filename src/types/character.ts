export interface Attributes {
  forca: number;
  destreza: number;
  constituicao: number;
  inteligencia: number;
  carisma: number;
}

export interface Skill {
  id: string;
  nome: string;
  atributo: keyof Attributes;
  descricao?: string;
  treinada: boolean;
  bonus: number;
  bonusManual?: number;
}

export interface InventoryItem {
  id: string;
  nome: string;
  quantidade: number;
  descricao?: string;
  imagemUrl?: string;
  equipado?: boolean;
  bonusAtributos?: Partial<Record<keyof Attributes, number>>;
  cargas?: number | null;
  cargasMaximas?: number | null;
  efeitoMecanico?: ItemEffect | null;
}

export type ItemEffect =
  | { tipo: "ATRIBUTO"; atributo: keyof Attributes; valor: number }
  | { tipo: "RECURSO"; recurso: "hp" | "mp"; valor: number }
  | { tipo: "NENHUM" };

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
  /** Versão otimista da linha em `personagens`, não persistida dentro de `dados`. */
  dataVersion?: number;
  nome: string;
  raca: string;
  classe: string;
  classeId?: string;
  nivel: number;
  /** XP vive na coluna relacional `personagens.xp`, não no JSON de ficha. */
  xp?: number;
  portraitUrl?: string;
  /** null = personagem ainda sem campanha; vem da coluna campanha_id do banco. */
  campanhaId?: string | null;
  alinhamento?: string;
  qualidades?: string;
  origem?: string;
  idade?: string;
  historia?: string;
  aparencia?: string;
  objetivo?: string;
  defeito?: string;
  filiacao?: string;
  altura?: number;
  tracos?: string;
  defeitos?: string;
  hp: { atual: number; max: number; temp?: number };
  mp: { atual: number; max: number; temp?: number };
  attributes: Attributes;
  skills: Skill[];
  inventory: InventoryItem[];
  spells: Spell[];
  carteira?: Wallet;
  notas: string;
}

export interface CharacterDataV1 extends Omit<Character, "id" | "campanhaId" | "dataVersion" | "xp" | "hp" | "mp"> {
  schemaVersion: 1;
  hp: { atual: number; temp?: number };
  mp: { atual: number; temp?: number };
  /** Campos futuros/legados fora do contrato conhecido são preservados. */
  [key: string]: unknown;
}

export interface User {
  id: string;
  nome: string;
  email?: string;
}
