import type { Character, User } from "../types/character";
import {
  parseCharacterData,
  serializeCharacterData,
} from "../domain/characterData";
import {
  DEFAULT_CLASS_CATALOG,
  normalizarCatalogoClasses,
  normalizarBonusClassesCampanha,
  type BaseAttributeKey,
  type CampaignClassBonuses,
  type ClassDefinition,
} from "../data/personaRules";
import { supabase } from "./supabase";

/* =========================================================
   AUTENTICAÇÃO
========================================================= */

export async function login(
  usuario: string,
  senha: string,
): Promise<User> {
  const cleanInput = usuario.trim();

  if (!cleanInput || !senha) {
    throw new Error("Informe seu e-mail e senha para prosseguir.");
  }

  if (!cleanInput.includes("@")) {
    throw new Error(
      "Para entrar pelo Supabase, informe o e-mail cadastrado.",
    );
  }

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: cleanInput,
      password: senha,
    });

  if (error) {
    const mensagem = error.message.toLowerCase();

    if (mensagem.includes("email not confirmed")) {
      throw new Error(
        "E-mail ainda não confirmado! Verifique sua caixa de entrada ou desative a confirmação de e-mail no Supabase durante os testes.",
      );
    }

    if (mensagem.includes("invalid login credentials")) {
      throw new Error("E-mail ou senha incorretos.");
    }

    throw new Error(
      error.message || "Erro ao conectar com o Supabase.",
    );
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
    if (
      error.message
        .toLowerCase()
        .includes("already registered")
    ) {
      throw new Error(
        "Este e-mail já está registrado no Supabase.",
      );
    }

    throw new Error(
      error.message ||
        "Não foi possível cadastrar no Supabase.",
    );
  }

  if (!data.user) {
    throw new Error(
      "Erro ao criar aventureiro no Supabase.",
    );
  }

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
    // Mantém o cadastro mesmo que a tabela usuarios não exista.
  }

  return {
    id: data.user.id,
    nome: cleanUser,
    email: cleanEmail,
  };
}

/* =========================================================
   PERSONAGENS
========================================================= */

type PersonagemRow = {
  id: string;
  user_id?: string | null;
  campanha_id?: string | null;
  nome?: string | null;
  nivel?: number | null;
  xp?: number | null;
  dados_version?: number | null;
  dados?: unknown;
};

function rowToCharacter(row: PersonagemRow): Character | null {
  const dados = parseCharacterData(row.dados);
  if (!dados) return null;

  const { schemaVersion: _schemaVersion, ...personagem } = dados;
  const base = {
    ...personagem,
    id: row.id,
    dataVersion: row.dados_version ?? 1,
    campanhaId: row.campanha_id ?? null,
    xp: row.xp ?? 0,
    nome: row.nome ?? personagem.nome,
    nivel: row.nivel ?? personagem.nivel,
  };
  return {
    ...base,
    hp: {
      atual: personagem.hp.atual,
      max: personagem.hp.max ?? 200,
      ...(personagem.hp.temp !== undefined ? { temp: personagem.hp.temp } : {}),
    },
    mp: {
      atual: personagem.mp.atual,
      max: personagem.mp.max ?? 200,
      ...(personagem.mp.temp !== undefined ? { temp: personagem.mp.temp } : {}),
    },
  };
}

function paraDados(personagem: Character) {
  return serializeCharacterData(personagem);
}

/* =========================================================
   LISTAR PERSONAGENS
========================================================= */

export async function getCharacters(): Promise<Character[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("personagens")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(
      error.message ||
        "Não foi possível carregar os personagens.",
    );
  }

  return ((data ?? []) as PersonagemRow[])
    .map(rowToCharacter)
    .filter(
      (c): c is Character => c !== null,
    );
}

export async function getCharacterById(
  id: string,
): Promise<Character | undefined> {
  const { data, error } = await supabase
    .from("personagens")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message ||
        "Não foi possível carregar o personagem.",
    );
  }

  if (!data) {
    return undefined;
  }

  const personagem = rowToCharacter(
    data as PersonagemRow,
  );

  if (!personagem) {
    throw new Error(
      "O personagem foi encontrado, mas os dados da ficha estão vazios.",
    );
  }

  return personagem;
}

/* =========================================================
   EDITAR PERSONAGEM
========================================================= */

export async function atualizarPersonagem(
  id: string,
  personagem: Character,
): Promise<Character> {
  const { data, error } = await supabase.rpc("atualizar_personagem_versionado", {
    p_personagem_id: id,
    p_versao_esperada: personagem.dataVersion ?? 1,
    p_nome: personagem.nome,
    p_nivel: personagem.nivel,
    p_dados: paraDados(personagem),
  });

  if (error) {
    throw new Error(error.message || "Não foi possível salvar o personagem.");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Você não tem permissão para alterar este personagem.");
  }

  const atualizado = rowToCharacter(data as PersonagemRow);
  if (!atualizado) {
    throw new Error("Os dados da ficha ficaram vazios após salvar.");
  }

  return atualizado;
}

export function saveCharacter(personagem: Character): void {
  void atualizarPersonagem(personagem.id, personagem).catch((error: unknown) => {
    console.error("Erro ao salvar ficha:", error);
  });
}

/* =========================================================
   PERMISSÕES DO PERSONAGEM
========================================================= */

export async function getCharacterAccess(
  characterId: string,
): Promise<{
  canEdit: boolean;
  isMaster: boolean;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      canEdit: false,
      isMaster: false,
    };
  }

  const { data, error } = await supabase
    .from("personagens")
    .select("user_id, campanha_id")
    .eq("id", characterId)
    .maybeSingle();

  if (error || !data) {
    return {
      canEdit: false,
      isMaster: false,
    };
  }

  const { data: membership } = await supabase
    .from("campanha_membros")
    .select("papel")
    .eq("campanha_id", data.campanha_id)
    .eq("user_id", user.id)
    .eq("status", "ATIVO")
    .maybeSingle();

  const isMaster =
    membership?.papel === "MESTRE";

  const isOwner =
    data.user_id === user.id;

  return {
    canEdit: isOwner || isMaster,
    isMaster,
  };
}

/* =========================================================
   FOTO DO PERSONAGEM
========================================================= */

export async function enviarRetrato(
  arquivo: File,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  if (!arquivo.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem.");
  }

  if (arquivo.size > 3 * 1024 * 1024) {
    throw new Error(
      "A imagem deve ter no máximo 3 MB.",
    );
  }

  const extensao =
    (
      arquivo.name.split(".").pop() ||
      "png"
    ).toLowerCase();

  const caminho =
    user.id +
    "/" +
    Date.now() +
    "." +
    extensao;

  const { error } = await supabase.storage
    .from("retratos")
    .upload(
      caminho,
      arquivo,
      {
        cacheControl: "3600",
        upsert: false,
        contentType: arquivo.type,
      },
    );

  if (error) {
    throw new Error(
      error.message ||
        "Não foi possível enviar a imagem.",
    );
  }

  const { data } =
    supabase.storage
      .from("retratos")
      .getPublicUrl(caminho);

  return data.publicUrl;
}

/* =========================================================
   PERSONAGENS DA CAMPANHA
========================================================= */

export async function listarPersonagensDaCampanha(
  campanhaId: string,
): Promise<Character[]> {
  const { data, error } = await supabase
    .from("personagens")
    .select("*")
    .eq("campanha_id", campanhaId);

  if (error) {
    throw new Error(
      error.message ||
        "Não foi possível carregar os personagens da campanha.",
    );
  }

  return ((data ?? []) as PersonagemRow[])
    .map(rowToCharacter)
    .filter(
      (c): c is Character => c !== null,
    );
}

/* =========================================================
   VINCULAR PERSONAGEM À CAMPANHA
========================================================= */

export async function vincularPersonagem(
  personagemId: string,
  campanhaId: string,
): Promise<Character> {
  const atual = await getCharacterById(personagemId);
  if (!atual) throw new Error("Personagem não encontrado.");

  const { data, error } = await supabase.rpc("vincular_personagem_campanha", {
    p_personagem_id: personagemId,
    p_campanha_id: campanhaId,
    p_versao_esperada: atual.dataVersion ?? 1,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível vincular o personagem.");
  }

  const vinculado = data && typeof data === "object"
    ? rowToCharacter(data as PersonagemRow)
    : null;
  if (!vinculado) {
    throw new Error("O Supabase não confirmou o vínculo do personagem.");
  }
  return vinculado;
}

/* =========================================================
   EXCLUIR PERSONAGEM
========================================================= */

export async function excluirPersonagem(
  personagemId: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const {
    data,
    error,
  } = await supabase
    .from("personagens")
    .delete()
    .eq("id", personagemId)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    throw new Error(
      error.message ||
        "Não foi possível excluir o personagem.",
    );
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Não foi possível excluir: personagem não encontrado ou sem permissão.",
    );
  }
}

/* =========================================================
   CAMPANHAS
========================================================= */

export interface Campaign {
  id: string;
  nome: string;
  descricao: string | null;
  sistema: string | null;
  imagem_url: string | null;
  moeda_principal: string | null;
  status: string;
  codigo_convite: string;
  created_by: string;
  created_at: string;
  ouro_inicial: number;
  bonus_classes: CampaignClassBonuses | null;
}

export interface CampaignClassContent {
  id: string;
  campanha_id: string;
  classe_id: string;
  tipo: "CLASSE" | "PERICIA" | "HABILIDADE";
  nome: string;
  descricao: string;
  atributo: BaseAttributeKey | null;
  nivel: number | null;
  bonus_atributos: Partial<Record<BaseAttributeKey, number>>;
  bonus_hp: number;
  bonus_mp: number;
  created_by: string;
}

export async function canManageGlobalClassCatalog(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message || "Não foi possível verificar o acesso ao catálogo.");
  return data.user?.app_metadata?.global_rules_admin === true;
}

export async function getCatalogoGlobalClasses(): Promise<ClassDefinition[]> {
  const { data, error } = await supabase
    .from("global_class_catalog")
    .select("dados")
    .eq("id", "global")
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message || "Não foi possível carregar o catálogo de classes.",
    );
  }

  return data ? normalizarCatalogoClasses(data.dados) : DEFAULT_CLASS_CATALOG;
}

export async function salvarCatalogoGlobalClasses(
  classes: ClassDefinition[],
): Promise<ClassDefinition[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const normalizadas = normalizarCatalogoClasses(classes);
  const ids = new Set<string>();
  const nomes = new Set<string>();
  for (const classe of normalizadas) {
    const nome = classe.nome.toLocaleLowerCase();
    if (ids.has(classe.id) || nomes.has(nome)) {
      throw new Error("As classes precisam ter nomes e identificadores únicos.");
    }
    ids.add(classe.id);
    nomes.add(nome);
  }

  const { data, error } = await supabase
    .from("global_class_catalog")
    .upsert(
      { id: "global", dados: normalizadas, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    )
    .select("dados")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Não foi possível salvar o catálogo.");
  }

  return normalizarCatalogoClasses(data.dados);
}

export async function listarConteudosClasseCampanha(
  campaignId: string,
): Promise<CampaignClassContent[]> {
  const { data, error } = await supabase
    .from("campanha_classes_conteudos")
    .select("*")
    .eq("campanha_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      error.message || "Não foi possível carregar os conteúdos da campanha.",
    );
  }

  return (data ?? []) as CampaignClassContent[];
}

export async function adicionarConteudoClasseCampanha(
  campaignId: string,
  conteudo: Omit<CampaignClassContent, "id" | "campanha_id" | "created_by">,
): Promise<CampaignClassContent> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { data: membership, error: membershipError } = await supabase
    .from("campanha_membros")
    .select("papel")
    .eq("campanha_id", campaignId)
    .eq("user_id", user.id)
    .eq("status", "ATIVO")
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      membershipError.message || "Não foi possível verificar sua permissão.",
    );
  }
  if (membership?.papel !== "MESTRE") {
    throw new Error("Somente o Mestre ativo pode alterar as regras da campanha.");
  }

  const { data, error } = await supabase
    .from("campanha_classes_conteudos")
    .insert({
      ...conteudo,
      campanha_id: campaignId,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "Não foi possível adicionar conteúdo à campanha.",
    );
  }

  return data as CampaignClassContent;
}

export async function removerConteudoClasseCampanha(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("campanha_classes_conteudos")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Não foi possível remover o conteúdo.");
  }
  if (!data) {
    throw new Error("Conteúdo não encontrado ou você não participa da campanha.");
  }
}

export async function getCampaignClassBonuses(
  campaignId: string,
): Promise<CampaignClassBonuses> {
  const [{ data, error }, catalogo] = await Promise.all([
    supabase
      .from("campanhas")
      .select("bonus_classes")
      .eq("id", campaignId)
      .maybeSingle(),
    getCatalogoGlobalClasses(),
  ]);

  if (error) {
    throw new Error(
      error.message || "Não foi possível carregar os bônus da campanha.",
    );
  }

  if (!data) {
    throw new Error("Campanha não encontrada.");
  }

  const bonusesCatalogo = Object.fromEntries(
    catalogo.map((classe) => [classe.nome, classe]),
  );
  const hasCampaignOverrides =
    typeof data.bonus_classes === "object" &&
    data.bonus_classes !== null &&
    Object.keys(data.bonus_classes).length > 0;
  return {
    ...bonusesCatalogo,
    ...(hasCampaignOverrides
      ? normalizarBonusClassesCampanha(data.bonus_classes, false)
      : {}),
  };
}

export async function salvarBonusClassesCampanha(
  campaignId: string,
  bonuses: CampaignClassBonuses,
): Promise<CampaignClassBonuses> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("campanha_membros")
    .select("papel")
    .eq("campanha_id", campaignId)
    .eq("user_id", user.id)
    .eq("status", "ATIVO")
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      membershipError.message || "Não foi possível verificar sua permissão.",
    );
  }

  if (membership?.papel !== "MESTRE") {
    throw new Error("Somente o Mestre pode alterar os bônus da campanha.");
  }

  const bonusNormalizados = normalizarBonusClassesCampanha(bonuses);
  const { data, error } = await supabase
    .from("campanhas")
    .update({ bonus_classes: bonusNormalizados })
    .eq("id", campaignId)
    .select("bonus_classes")
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message || "Não foi possível salvar os bônus da campanha.",
    );
  }

  if (!data) {
    throw new Error("Campanha não encontrada ou sem permissão para alterar.");
  }

  return normalizarBonusClassesCampanha(data.bonus_classes);
}

function gerarCodigoConvite(): string {
  const caracteres =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let codigo = "";

  for (let i = 0; i < 6; i++) {
    const indice = Math.floor(
      Math.random() * caracteres.length,
    );

    codigo += caracteres[indice];
  }

  return codigo;
}

/* =========================================================
   CRIAR CAMPANHA
========================================================= */

export async function criarCampanha(
  dados: {
    nome: string;
    descricao: string;
    sistema: string;
    moeda_principal: string;
    ouro_inicial: number;
  },
  requestId = criarIdempotencyKey(),
): Promise<Campaign> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }
  if (
    !Number.isSafeInteger(dados.ouro_inicial) ||
    dados.ouro_inicial < 0 ||
    dados.ouro_inicial > 100000
  ) {
    throw new Error("O ouro inicial deve estar entre 0 e 100000 PO.");
  }

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { data, error } = await supabase.rpc("criar_campanha_atomica", {
      p_nome: dados.nome.trim(),
      p_descricao: dados.descricao.trim() || null,
      p_sistema: dados.sistema.trim() || null,
      p_moeda_principal: dados.moeda_principal.trim() || null,
      p_ouro_inicial: Math.max(0, Math.min(100000, Math.floor(dados.ouro_inicial))),
      p_codigo_convite: gerarCodigoConvite(),
      p_request_id: requestId,
    });

    if (!error && data && typeof data === "object") return data as Campaign;
    if (error?.code === "23505") continue;
    throw new Error(error?.message || "Não foi possível criar a campanha.");
  }

  throw new Error("Não foi possível gerar um código de convite exclusivo. Tente novamente.");
}

export async function excluirCampanha(campanhaId: string): Promise<void> {
  if (!campanhaId) {
    throw new Error("Campanha não informada.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data: membro, error: membroError } = await supabase
    .from("campanha_membros")
    .select("papel")
    .eq("campanha_id", campanhaId)
    .eq("user_id", user.id)
    .eq("status", "ATIVO")
    .maybeSingle();

  if (membroError) {
    throw new Error(membroError.message || "Não foi possível verificar sua permissão.");
  }

  if (membro?.papel !== "MESTRE") {
    throw new Error("Somente o Mestre pode excluir esta campanha.");
  }

  const { data, error } = await supabase
    .from("campanhas")
    .delete()
    .eq("id", campanhaId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Não foi possível excluir a campanha.");
  }

  if (!data) {
    throw new Error("Campanha não encontrada ou sem permissão para excluir.");
  }
}

/* =========================================================
   LISTAR CAMPANHAS DO USUÁRIO
========================================================= */

export async function listarMinhasCampanhas(): Promise<
  Campaign[]
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      "Usuário não autenticado.",
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("campanha_membros")
    .select(
      "campanha_id, campanhas (*)",
    )
    .eq("user_id", user.id)
    .eq("status", "ATIVO");

  if (error) {
    throw new Error(
      error.message ||
        "Não foi possível carregar suas campanhas.",
    );
  }

  const campanhas: Campaign[] = [];

  for (const item of data ?? []) {
    const campanha =
      item.campanhas;

    if (
      campanha &&
      !Array.isArray(campanha)
    ) {
      campanhas.push(
        campanha as Campaign,
      );
    }
  }

  return campanhas;
}

/* =========================================================
   ENTRAR EM CAMPANHA POR CÓDIGO
========================================================= */

export async function entrarNaCampanha(
  codigoConvite: string,
): Promise<Campaign> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      "Usuário não autenticado.",
    );
  }

  const codigo =
    codigoConvite.trim().toUpperCase();

  if (!codigo) {
    throw new Error(
      "Informe o código da campanha.",
    );
  }

  const {
    data: campanha,
    error: campanhaError,
  } = await supabase
    .from("campanhas")
    .select("*")
    .eq(
      "codigo_convite",
      codigo,
    )
    .eq("status", "ATIVA")
    .single();

  if (
    campanhaError ||
    !campanha
  ) {
    throw new Error(
      "Campanha não encontrada ou não está ativa.",
    );
  }

  const {
    data: membroExistente,
    error: membroConsultaError,
  } = await supabase
    .from("campanha_membros")
    .select("id, status")
    .eq(
      "campanha_id",
      campanha.id,
    )
    .eq(
      "user_id",
      user.id,
    )
    .maybeSingle();

  if (membroConsultaError) {
    throw new Error(
      membroConsultaError.message ||
        "Não foi possível verificar sua participação.",
    );
  }

  if (membroExistente) {
    if (
      membroExistente.status !==
      "ATIVO"
    ) {
      const {
        error: atualizarError,
      } = await supabase
        .from("campanha_membros")
        .update({
          status: "ATIVO",
        })
        .eq(
          "id",
          membroExistente.id,
        );

      if (atualizarError) {
        throw new Error(
          atualizarError.message ||
            "Não foi possível reativar sua participação.",
        );
      }
    }

    return campanha as Campaign;
  }

  const {
    error: entradaError,
  } = await supabase
    .from("campanha_membros")
    .insert({
      campanha_id: campanha.id,
      user_id: user.id,
      papel: "JOGADOR",
      status: "ATIVO",
    });

  if (entradaError) {
    throw new Error(
      entradaError.message ||
        "Não foi possível entrar na campanha.",
    );
  }

  return campanha as Campaign;
}

/* =========================================================
   BUSCAR CAMPANHA POR CÓDIGO
========================================================= */

export async function buscarCampanhaPorCodigo(
  codigoConvite: string,
): Promise<Campaign> {
  const codigo =
    codigoConvite.trim().toUpperCase();

  if (!codigo) {
    throw new Error(
      "Informe o código da campanha.",
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("campanhas")
    .select("*")
    .eq(
      "codigo_convite",
      codigo,
    )
    .eq("status", "ATIVA")
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message ||
        "Não foi possível buscar a campanha.",
    );
  }

  if (!data) {
    throw new Error(
      "Campanha não encontrada ou não está ativa.",
    );
  }

  return data as Campaign;
}

/* =========================================================
   ACESSO À CAMPANHA
========================================================= */

export async function getCampaignAccess(
  campaignId: string,
): Promise<{
  isMaster: boolean;
  startingGold: number;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      isMaster: false,
      startingGold: 1250,
    };
  }

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("campanha_membros")
    .select("papel")
    .eq(
      "campanha_id",
      campaignId,
    )
    .eq(
      "user_id",
      user.id,
    )
    .eq("status", "ATIVO")
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      membershipError.message ||
        "Não foi possível verificar seu papel na campanha.",
    );
  }

  const {
    data: campaign,
    error: campaignError,
  } = await supabase
    .from("campanhas")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) {
    throw new Error(
      campaignError.message ||
        "Não foi possível carregar a economia da campanha.",
    );
  }

  return {
    isMaster:
      membership?.papel ===
      "MESTRE",
    startingGold:
      campaign?.ouro_inicial ??
      1250,
  };
}

/* =========================================================
   CRIAR PERSONAGEM
========================================================= */

export async function criarPersonagem(
  campanhaId: string | null,
  personagem: Character,
): Promise<Character> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      "Usuário não autenticado.",
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("personagens")
    .insert({
      campanha_id: campanhaId,
      user_id: user.id,
      nome: personagem.nome,
      nivel: personagem.nivel,
      xp: 0,
      dados: paraDados(personagem),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Não foi possível criar o personagem.",
    );
  }

  const salvo = rowToCharacter(data as PersonagemRow);
  if (!salvo) {
    throw new Error("O personagem foi salvo, mas os dados da ficha estão vazios.");
  }

  return {
    ...salvo,
    campanhaId,
  };
}

/* =========================================================
   LOJA
========================================================= */

export interface ShopItem {
  id: string;
  lojaId: string;
  itemId: string;
  campanhaId: string;
  nome: string;
  descricao: string | null;
  tipo: string | null;
  raridade: string | null;
  efeito: string | null;
  imagemUrl: string | null;
  bonusAtributos?: Partial<Record<BaseAttributeKey, number>>;
  efeitoMecanico?: import("../types/character").ItemEffect | null;
  cargasMaximas?: number | null;
  precoCompra: number;
  precoVenda: number | null;
  estoque: number;
  vendaPermitida: boolean;
  ativo: boolean;
}

/**
 * Lista as ofertas de TODAS as lojas ativas da campanha.
 * Não usa .single()/.maybeSingle(): uma campanha pode ter 0, 1 ou várias lojas,
 * e qualquer uma dessas situações precisa funcionar sem erro.
 */

export async function listarItensDaLoja(
  campanhaId: string,
): Promise<ShopItem[]> {
  const { data, error } = await supabase
    .from("lojas")
    .select(`
      id,
      campanha_id,
      ativa,
      loja_itens (
        id,
        item_id,
        preco_compra,
        preco_venda,
        estoque,
        venda_permitida,
        ativo,
        itens (
          id,
          nome,
          descricao,
          tipo,
          raridade,
          efeito,
          imagem_url,
          bonus_atributos,
          efeito_mecanico,
          cargas_maximas
        )
      )
    `)
    .eq("campanha_id", campanhaId)
    .eq("ativa", true);

  if (error) {
    throw new Error(
      error.message || "Não foi possível carregar a loja.",
    );
  }

  if (!data || data.length === 0) {
    return [];
  }

  type LojaComItens = {
    id: string;
    campanha_id: string;
    ativa: boolean;
    loja_itens?: Array<{
      id: string;
      item_id: string;
      preco_compra: number;
      preco_venda: number | null;
      estoque: number;
      venda_permitida: boolean;
      ativo: boolean;
      itens:
        | {
            id: string;
            nome: string;
            descricao: string | null;
            tipo: string | null;
            raridade: string | null;
            efeito: string | null;
            imagem_url: string | null;
            bonus_atributos:
              | Partial<Record<BaseAttributeKey, number>>
              | null;
            efeito_mecanico:
              | import("../types/character").ItemEffect
              | null;
            cargas_maximas: number | null;
          }
        | null;
    }>;
  };

  const lojas = data as unknown as LojaComItens[];

  return lojas.flatMap((loja) =>
    (loja.loja_itens ?? [])
      .filter(
        (lojaItem) =>
          lojaItem.ativo &&
          lojaItem.itens !== null,
      )
      .map((lojaItem) => ({
        id: lojaItem.id,
        lojaId: loja.id,
        campanhaId: loja.campanha_id,
        itemId: lojaItem.item_id,
        nome: lojaItem.itens!.nome,
        descricao: lojaItem.itens!.descricao,
        tipo: lojaItem.itens!.tipo,
        raridade: lojaItem.itens!.raridade,
        efeito: lojaItem.itens!.efeito,
        imagemUrl: lojaItem.itens!.imagem_url,
        bonusAtributos:
          lojaItem.itens!.bonus_atributos ?? {},
        efeitoMecanico:
          lojaItem.itens!.efeito_mecanico ?? null,
        cargasMaximas:
          lojaItem.itens!.cargas_maximas ?? null,
        precoCompra: Number(lojaItem.preco_compra),
        precoVenda:
          lojaItem.preco_venda === null
            ? null
            : Number(lojaItem.preco_venda),
        estoque: Number(lojaItem.estoque),
        vendaPermitida: lojaItem.venda_permitida,
        ativo: lojaItem.ativo,
      })),
  );
}

export interface SaveShopItemInput {
  campanhaId: string;
  lojaItemId?: string;
  nome: string;
  descricao: string;
  tipo: string;
  raridade: string;
  efeito: string;
  imagemUrl: string | null;
  bonusAtributos?: Partial<Record<BaseAttributeKey, number>>;
  efeitoMecanico?: import("../types/character").ItemEffect | null;
  cargasMaximas?: number | null;
  precoCompra: number;
  estoque: number;
  ativo: boolean;
}


export async function salvarItemDaLoja(
  item: SaveShopItemInput,
): Promise<ShopItem> {
  const { data, error } = await supabase.rpc("salvar_item_loja", {
    p_campanha_id: item.campanhaId,
    p_loja_item_id: item.lojaItemId ?? null,
    p_nome: item.nome,
    p_descricao: item.descricao,
    p_tipo: item.tipo,
    p_raridade: item.raridade,
    p_efeito: item.efeito,
    p_imagem_url: item.imagemUrl,
    p_preco_compra: item.precoCompra,
    p_estoque: item.estoque,
    p_ativo: item.ativo,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível salvar o item da loja.");
  }

  if (!data || typeof data !== "object") {
    throw new Error("O Supabase não confirmou o salvamento do item.");
  }

  const receipt = data as {
    loja_id: string;
    loja_item_id: string;
    item_id: string;
  };

  return {
    id: receipt.loja_item_id,
    lojaId: receipt.loja_id,
    itemId: receipt.item_id,
    campanhaId: item.campanhaId,
    nome: item.nome,
    descricao: item.descricao,
    tipo: item.tipo,
    raridade: item.raridade,
    efeito: item.efeito,
    imagemUrl: item.imagemUrl,
    bonusAtributos: item.bonusAtributos ?? {},
    efeitoMecanico: item.efeitoMecanico ?? null,
    cargasMaximas: item.cargasMaximas ?? null,
    precoCompra: item.precoCompra,
    precoVenda: null,
    estoque: item.estoque,
    vendaPermitida: true,
    ativo: item.ativo,
  };
}

export type CatalogItem = Pick<
  ShopItem,
  "itemId" | "nome" | "descricao" | "tipo" | "raridade" | "efeito" | "imagemUrl" |
  "bonusAtributos" | "efeitoMecanico" | "cargasMaximas"
>;

export async function listarCatalogoItens(): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from("itens")
    .select("id, nome, descricao, tipo, raridade, efeito, imagem_url, bonus_atributos, efeito_mecanico, cargas_maximas")
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(error.message || "Não foi possível carregar o catálogo de cartas.");
  }

  return (data ?? []).map((item) => ({
    itemId: item.id,
    nome: item.nome,
    descricao: item.descricao,
    tipo: item.tipo,
    raridade: item.raridade,
    efeito: item.efeito,
    imagemUrl: item.imagem_url,
    bonusAtributos: item.bonus_atributos ?? {},
    efeitoMecanico: item.efeito_mecanico ?? null,
    cargasMaximas: item.cargas_maximas ?? null,
  }));
}

export async function adicionarItemExistenteNaLoja(
  campanhaId: string,
  itemId: string,
  precoCompra: number,
  estoque: number,
): Promise<string> {
  const { data, error } = await supabase.rpc("adicionar_item_existente_loja", {
    p_campanha_id: campanhaId,
    p_item_id: itemId,
    p_preco_compra: precoCompra,
    p_estoque: estoque,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível adicionar a carta existente.");
  }

  if (typeof data !== "string") {
    throw new Error("O Supabase não confirmou a inclusão da carta.");
  }

  return data;
}

export async function removerItemDaLoja(
  campanhaId: string,
  lojaItemId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("remover_item_loja", {
    p_campanha_id: campanhaId,
    p_loja_item_id: lojaItemId,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível remover a carta desta loja.");
  }

  if (data !== true) {
    throw new Error("O Supabase não confirmou a remoção da carta.");
  }
}

/* =========================================================
   COMPRAR ITEM
========================================================= */

export async function comprarItem(
  personagemId: string,
  lojaItemId: string,
  quantidade: number = 1,
) {
  return comprarCarrinho(personagemId, [
    { lojaItemId, quantidade },
  ]);
}

export interface CartPurchaseLine {
  lojaItemId: string;
  quantidade: number;
}

export interface PurchaseReceipt {
  personagem_id: string;
  saldo_po: number;
  total_gasto: number;
}

export async function comprarCarrinho(
  personagemId: string,
  itens: CartPurchaseLine[],
  requestId = criarIdempotencyKey(),
): Promise<PurchaseReceipt> {
  if (!personagemId) {
    throw new Error("Personagem não informado.");
  }

  if (
    itens.length === 0 ||
    itens.some(
      (item) =>
        !item.lojaItemId ||
        !Number.isSafeInteger(item.quantidade) ||
        item.quantidade <= 0,
    )
  ) {
    throw new Error("O carrinho contém itens ou quantidades inválidas.");
  }

  const { data, error } = await supabase.rpc(
    "registrar_compra_carrinho",
    {
      p_personagem_id: personagemId,
      p_itens: itens.map((item) => ({
        loja_item_id: item.lojaItemId,
        quantidade: item.quantidade,
      })),
      p_request_id: requestId,
    },
  );

  if (error) {
    throw new Error(error.message || "Não foi possível realizar a compra.");
  }

  if (!data) {
    throw new Error("A compra não retornou uma confirmação.");
  }

  return data as PurchaseReceipt;
}

/* =========================================================
   INVENTÁRIO
========================================================= */

export async function creditarOuroCampanha(
  campanhaId: string,
  quantidade: number,
  personagemId?: string,
  requestId = criarIdempotencyKey(),
): Promise<number> {
  if (!campanhaId || !Number.isSafeInteger(quantidade) || quantidade <= 0 || quantidade > 100000) {
    throw new Error("A quantia deve estar entre 1 e 100000 PO.");
  }
  const { data, error } = await supabase.rpc("creditar_ouro_campanha", {
    p_campanha_id: campanhaId,
    p_quantia: quantidade,
    p_personagem_id: personagemId ?? null,
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message || "Não foi possível creditar o ouro.");
  if (typeof data !== "number") throw new Error("O Supabase não confirmou o crédito.");
  return data;
}

function criarIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    return (token === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export async function creditarExperienciaCampanha(
  campanhaId: string,
  quantidade: number,
  personagemId?: string,
  requestId = criarIdempotencyKey(),
): Promise<number> {
  if (!campanhaId || !Number.isSafeInteger(quantidade) || quantidade <= 0 || quantidade > 2147483647) {
    throw new Error("A quantidade de XP deve ser um inteiro entre 1 e 2147483647.");
  }
  const { data, error } = await supabase.rpc("creditar_experiencia_campanha", {
    p_campanha_id: campanhaId,
    p_quantia: quantidade,
    p_personagem_id: personagemId ?? null,
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message || "Não foi possível creditar XP.");
  if (typeof data !== "number") throw new Error("O Supabase não confirmou o crédito de XP.");
  return data;
}

export async function entregarItemCampanha(
  campanhaId: string,
  itemId: string,
  quantidade: number,
  personagemId?: string,
  requestId = criarIdempotencyKey(),
): Promise<number> {
  if (!campanhaId || !itemId || !Number.isSafeInteger(quantidade) || quantidade <= 0 || quantidade > 9999) {
    throw new Error("Item e quantidade de entrega inválidos.");
  }
  const { data, error } = await supabase.rpc("entregar_item_campanha", {
    p_campanha_id: campanhaId,
    p_item_id: itemId,
    p_quantidade: quantidade,
    p_personagem_id: personagemId ?? null,
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message || "Não foi possível entregar o item.");
  if (typeof data !== "number") throw new Error("O Supabase não confirmou a entrega do item.");
  return data;
}

export interface CampaignRewardHistoryItem {
  id: number;
  campanha_id: string;
  personagem_id: string | null;
  item_id: string | null;
  tipo: "OURO" | "XP" | "ITEM";
  quantidade: number;
  quantidade_item: number | null;
  total_destinatarios: number;
  created_at: string;
}

export async function listarRecompensasCampanha(campaignId: string): Promise<CampaignRewardHistoryItem[]> {
  const { data, error } = await supabase
    .from("campanha_recompensas")
    .select("id, campanha_id, personagem_id, item_id, tipo, quantidade, quantidade_item, total_destinatarios, created_at")
    .eq("campanha_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message || "Não foi possível carregar o histórico de recompensas.");
  return (data ?? []) as CampaignRewardHistoryItem[];
}

export async function listarCatalogoItensDaCampanha(): Promise<CatalogItem[]> {
  return listarCatalogoItens();
}

export interface ItemUseReceipt {
  personagem_id: string;
  hp: { atual: number; temp?: number } | null;
  mp: { atual: number; temp?: number } | null;
  quantidade: number;
  hp_max: number;
  mp_max: number;
}

export async function usarItemPersonagem(
  personagemId: string,
  itemId: string,
): Promise<ItemUseReceipt> {
  const { data, error } = await supabase.rpc("usar_item_personagem", {
    p_personagem_id: personagemId,
    p_item_id: itemId,
  });
  if (error) throw new Error(error.message || "Não foi possível usar o item.");
  if (!data || typeof data !== "object") throw new Error("O Supabase não confirmou o uso do item.");
  return data as ItemUseReceipt;
}

export interface CampaignResourceMaximum {
  personagem_id: string;
  hp_atual: number;
  hp_max: number;
  mp_atual: number;
  mp_max: number;
}

export async function getCampaignResourceMaximums(campaignId: string): Promise<CampaignResourceMaximum[]> {
  const { data, error } = await supabase.rpc("listar_maximos_recursos_campanha", {
    p_campanha_id: campaignId,
  });
  if (error) throw new Error(error.message || "Não foi possível carregar os máximos da campanha.");
  return (data ?? []) as CampaignResourceMaximum[];
}

export async function getEquippedAttributeBonusesByCharacter(
  characterIds: string[],
): Promise<Record<string, Partial<Record<BaseAttributeKey, number>>>> {
  const ids = [...new Set(characterIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("inventarios")
    .select("personagem_id, itens ( bonus_atributos )")
    .in("personagem_id", ids)
    .eq("equipado", true)
    .gt("quantidade", 0);

  if (error) {
    throw new Error(error.message || "Não foi possível carregar os bônus de equipamento.");
  }

  const totals: Record<string, Partial<Record<BaseAttributeKey, number>>> = {};
  for (const row of data ?? []) {
    const item = Array.isArray(row.itens) ? row.itens[0] : row.itens;
    const bonuses = item?.bonus_atributos as Partial<Record<BaseAttributeKey, number>> | null | undefined;
    if (!bonuses) continue;
    const characterBonuses = totals[row.personagem_id] ?? (totals[row.personagem_id] = {});
    for (const attribute of ["forca", "destreza", "constituicao", "inteligencia", "carisma"] as const) {
      const amount = bonuses[attribute];
      if (typeof amount === "number" && Number.isFinite(amount)) {
        characterBonuses[attribute] = (characterBonuses[attribute] ?? 0) + Math.trunc(amount);
      }
    }
  }

  return totals;
}

export interface AuthoritativeCharacterResources {
  dados_version: number;
  hp_atual: number;
  mp_atual: number;
  hp_max: number;
  mp_max: number;
}

export async function getCharacterResourceMaximums(personagemId: string): Promise<AuthoritativeCharacterResources> {
  const { data, error } = await supabase.rpc("get_character_resource_maximums", {
    p_personagem_id: personagemId,
  });
  if (error) throw new Error(error.message || "Não foi possível carregar os máximos do servidor.");
  if (!data || typeof data !== "object") throw new Error("O Supabase não retornou os máximos do personagem.");
  return validateAuthoritativeCharacterResources(data);
}

function validateAuthoritativeCharacterResources(data: unknown): AuthoritativeCharacterResources {
  const result = data as Record<string, unknown>;
  if (
    typeof result.dados_version !== "number" ||
    typeof result.hp_atual !== "number" ||
    typeof result.mp_atual !== "number" ||
    typeof result.hp_max !== "number" ||
    typeof result.mp_max !== "number"
  ) throw new Error("A resposta de sincronização dos recursos é inválida.");
  return {
    dados_version: result.dados_version,
    hp_atual: result.hp_atual,
    mp_atual: result.mp_atual,
    hp_max: result.hp_max,
    mp_max: result.mp_max,
  };
}

export async function reconciliarLimitesRecursosPersonagem(personagemId: string): Promise<AuthoritativeCharacterResources> {
  const { data, error } = await supabase.rpc("reconciliar_limites_recursos_personagem", {
    p_personagem_id: personagemId,
  });
  if (error) throw new Error(error.message || "Não foi possível sincronizar os recursos.");
  if (!data || typeof data !== "object") {
    throw new Error("O Supabase não confirmou a sincronização dos recursos.");
  }
  return validateAuthoritativeCharacterResources(data);
}

export async function getInventory(
  personagemId: string,
) {
  const {
    data,
    error,
  } = await supabase
    .from("inventarios")
    .select(`
      personagem_id,
      item_id,
      quantidade,
      equipado,
      cargas_atuais,
      comentario_pessoal,
      updated_at,
      itens (
        id,
        nome,
        descricao,
        tipo,
        raridade,
        efeito,
        imagem_url,
        bonus_atributos,
        efeito_mecanico,
        cargas_maximas
      )
    `)
    .eq(
      "personagem_id",
      personagemId,
    )
    .order(
      "updated_at",
      { ascending: false },
    );

  if (error) {
    console.error(
      "Erro ao carregar inventário:",
      error,
    );

    throw new Error(
      error.message,
    );
  }

  return data ?? [];
}

export async function alterarItemEquipado(
  personagemId: string,
  itemId: string,
  equipado: boolean,
): Promise<void> {
  const { data, error } = await supabase.rpc("alterar_item_equipado", {
    p_personagem_id: personagemId,
    p_item_id: itemId,
    p_equipado: equipado,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível atualizar o equipamento.");
  }

  if (!data) {
    throw new Error("O equipamento não foi atualizado.");
  }
}

export async function salvarComentarioInventario(
  personagemId: string,
  itemId: string,
  comentario: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("salvar_comentario_inventario", {
    p_personagem_id: personagemId,
    p_item_id: itemId,
    p_comentario: comentario,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível salvar o comentário.");
  }
  if (data !== true) {
    throw new Error("O Supabase não confirmou o salvamento do comentário.");
  }
}

export async function excluirItemInventario(
  personagemId: string,
  itemId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("excluir_item_inventario", {
    p_personagem_id: personagemId,
    p_item_id: itemId,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível excluir o item.");
  }
  if (data !== true) {
    throw new Error("O Supabase não confirmou a exclusão do item.");
  }
}