import type { Character } from "../types/character";

export const mockCharacters: Character[] = [
  {
    id: "1",
    nome: "Bram Ferroz",
    raca: "Humano",
    classe: "Guerreiro",
    nivel: 5,
    hp: { atual: 38, max: 44 },
    mp: { atual: 4, max: 4 },
    attributes: {
      forca: 17,
      destreza: 12,
      constituicao: 15,
      inteligencia: 9,
      sabedoria: 10,
      carisma: 11,
    },
    skills: [
      { id: "s1", nome: "Atletismo", atributo: "forca", treinada: true, bonus: 6 },
      { id: "s2", nome: "Intimidação", atributo: "carisma", treinada: false, bonus: 1 },
    ],
    inventory: [
      { id: "i1", nome: "Espada longa", quantidade: 1 },
      { id: "i2", nome: "Armadura de placas", quantidade: 1 },
      { id: "i3", nome: "Ração de viagem", quantidade: 6 },
    ],
    spells: [],
    notas: "Ex-soldado do exército de Aldermoor, busca vingança contra o Barão Negro.",
  },
  {
    id: "2",
    nome: "Ysolde Vantree",
    raca: "Elfa",
    classe: "Maga",
    nivel: 4,
    hp: { atual: 21, max: 26 },
    mp: { atual: 18, max: 22 },
    attributes: {
      forca: 8,
      destreza: 13,
      constituicao: 11,
      inteligencia: 18,
      sabedoria: 14,
      carisma: 10,
    },
    skills: [
      { id: "s1", nome: "Arcanismo", atributo: "inteligencia", treinada: true, bonus: 8 },
      { id: "s2", nome: "História", atributo: "inteligencia", treinada: true, bonus: 7 },
    ],
    inventory: [
      { id: "i1", nome: "Grimório arcano", quantidade: 1 },
      { id: "i2", nome: "Cajado entalhado", quantidade: 1 },
    ],
    spells: [
      { id: "m1", nome: "Mísseis Mágicos", custo: 3, descricao: "Três dardos de força certeira." },
      { id: "m2", nome: "Escudo Arcano", custo: 2, descricao: "Barreira que absorve dano." },
    ],
    notas: "Estudou na Academia de Thessaly antes de ser exilada.",
  },
  {
    id: "3",
    nome: "Kael Sombranoite",
    raca: "Meio-elfo",
    classe: "Ladino",
    nivel: 3,
    hp: { atual: 19, max: 24 },
    mp: { atual: 6, max: 6 },
    attributes: {
      forca: 10,
      destreza: 18,
      constituicao: 12,
      inteligencia: 13,
      sabedoria: 11,
      carisma: 15,
    },
    skills: [
      { id: "s1", nome: "Furtividade", atributo: "destreza", treinada: true, bonus: 8 },
      { id: "s2", nome: "Prestidigitação", atributo: "destreza", treinada: true, bonus: 8 },
    ],
    inventory: [
      { id: "i1", nome: "Adagas gêmeas", quantidade: 2 },
      { id: "i2", nome: "Kit de arrombamento", quantidade: 1 },
    ],
    spells: [],
    notas: "Membro discreto da Guilda das Sombras de Porto Cinza.",
  },
];
