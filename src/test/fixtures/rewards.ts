import type {
  AuthoritativeCharacterResources,
  Campaign,
  CampaignResourceMaximum,
  CampaignRewardHistoryItem,
  CatalogItem,
} from "../../services/api";
import type { Character } from "../../types/character";

export const rewardFixtureIds = {
  campaign: "campaign-1",
  character: "character-1",
  member: "player-1",
  master: "master-1",
  item: "potion-1",
  goldRequest: "gold-request-1",
  xpRequest: "xp-request",
  itemRequest: "item-request",
} as const;

export type CampaignMembershipFixture = {
  campanha_id: string;
  user_id: string;
  papel: "MESTRE" | "JOGADOR";
  status: "ATIVO" | "INATIVO";
};

export type CampaignAccessFixture = {
  isMaster: boolean;
  startingGold: number;
};

export function makeCampaignAccessFixture(
  overrides: Partial<CampaignAccessFixture> = {},
): CampaignAccessFixture {
  return { isMaster: true, startingGold: 0, ...overrides };
}

export function makeCampaignFixture(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: rewardFixtureIds.campaign,
    nome: "Aventura de Teste",
    descricao: "Uma aventura de teste.",
    sistema: "Elementum",
    imagem_url: null,
    moeda_principal: "Ouro",
    status: "ATIVA",
    codigo_convite: "ABC123",
    created_by: rewardFixtureIds.master,
    created_at: "2026-10-01T12:00:00.000Z",
    ouro_inicial: 0,
    bonus_classes: null,
    ...overrides,
  };
}

export function makeCampaignMembershipFixture(
  overrides: Partial<CampaignMembershipFixture> = {},
): CampaignMembershipFixture {
  return {
    campanha_id: rewardFixtureIds.campaign,
    user_id: rewardFixtureIds.master,
    papel: "MESTRE",
    status: "ATIVO",
    ...overrides,
  };
}

export function makeCampaignCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: rewardFixtureIds.character,
    dataVersion: 1,
    campanhaId: rewardFixtureIds.campaign,
    nome: "Lira",
    raca: "Humano",
    classe: "Guerreiro",
    nivel: 2,
    xp: 100,
    hp: { atual: 10, max: 10 },
    mp: { atual: 8, max: 10 },
    attributes: {
      forca: 10,
      destreza: 10,
      constituicao: 10,
      inteligencia: 10,
      carisma: 10,
    },
    skills: [],
    inventory: [],
    spells: [],
    carteira: { pc: 0, pp: 0, pe: 0, po: 25, pl: 0 },
    notas: "",
    ...overrides,
  };
}

export function makeCatalogItemFixture(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    itemId: rewardFixtureIds.item,
    nome: "Poção de teste",
    descricao: null,
    tipo: "CONSUMIVEL",
    raridade: "COMUM",
    efeito: null,
    imagemUrl: null,
    bonusAtributos: {},
    efeitoMecanico: { tipo: "NENHUM" },
    cargasMaximas: null,
    ...overrides,
  };
}

export function makeRewardHistoryFixture(
  overrides: Partial<CampaignRewardHistoryItem> = {},
): CampaignRewardHistoryItem {
  return {
    id: 101,
    campanha_id: rewardFixtureIds.campaign,
    personagem_id: rewardFixtureIds.character,
    item_id: null,
    tipo: "OURO",
    quantidade: 25,
    quantidade_item: null,
    total_destinatarios: 1,
    created_at: "2026-10-01T12:30:00.000Z",
    ...overrides,
  };
}

export function makeCampaignResourceFixture(
  overrides: Partial<CampaignResourceMaximum> = {},
): CampaignResourceMaximum {
  return {
    personagem_id: rewardFixtureIds.character,
    hp_atual: 8,
    hp_max: 24,
    mp_atual: 5,
    mp_max: 16,
    ...overrides,
  };
}

export function makeAuthoritativeResourcesFixture(
  overrides: Partial<AuthoritativeCharacterResources> = {},
): AuthoritativeCharacterResources {
  return {
    dados_version: 3,
    hp_atual: 8,
    mp_atual: 5,
    hp_max: 24,
    mp_max: 16,
    ...overrides,
  };
}
