import type { Attributes, Character, User } from "../types/character";
import {
  DEFAULT_CLASS_CATALOG,
  normalizarCatalogoClasses,
  normalizarBonusClassesCampanha,
  type BaseAttributeKey,
  type CampaignClassBonuses,
  type ClassDefinition,
} from "../data/personaRules";
import { LIMITE_RECURSO } from "../data/dnd";
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
  dados?: Partial<Character> | null;
};

function rowToCharacter(
  row: PersonagemRow,
): Character | null {
  if (!row.dados) return null;

  const personagem = row.dados as Character;
  if (!personagem.attributes) return null;
  const attributes: Attributes = {
    forca: personagem.attributes.forca,
    destreza: personagem.attributes.destreza,
    constituicao: personagem.attributes.constituicao,
    inteligencia: personagem.attributes.inteligencia,
    carisma: personagem.attributes.carisma,
  };

  return {
    ...personagem,
    attributes,
    id: row.id,
    campanhaId: row.campanha_id ?? null,
    nome: row.nome ?? row.dados.nome ?? "",
    nivel: row.nivel ?? row.dados.nivel ?? 1,
  };
}

function paraDados(
  personagem: Character,
): Character {
  const limitarRecurso = (valor: number, minimo: number, maximo: number) =>
    Number.isFinite(valor)
      ? Math.max(minimo, Math.min(maximo, Math.trunc(valor)))
      : minimo;
  const hpMax = limitarRecurso(personagem.hp.max, 1, LIMITE_RECURSO);
  const mpMax = limitarRecurso(personagem.mp.max, 0, LIMITE_RECURSO);
  const copia: Character = {
    ...personagem,
    id: "",
    attributes: {
      forca: personagem.attributes.forca,
      destreza: personagem.attributes.destreza,
      constituicao: personagem.attributes.constituicao,
      inteligencia: personagem.attributes.inteligencia,
      carisma: personagem.attributes.carisma,
    },
    hp: {
      ...personagem.hp,
      max: hpMax,
      atual: limitarRecurso(personagem.hp.atual, 0, hpMax),
    },
    mp: {
      ...personagem.mp,
      max: mpMax,
      atual: limitarRecurso(personagem.mp.atual, 0, mpMax),
    },
  };

  delete copia.campanhaId;

  return copia;
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
  const dados = paraDados(personagem);

  const { data, error } = await supabase
    .from("personagens")
    .update({
      nome: personagem.nome,
      nivel: personagem.nivel,
      dados,
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message ||
        "Não foi possível salvar o personagem.",
    );
  }

  if (!data) {
    throw new Error(
      "Você não tem permissão para alterar este personagem.",
    );
  }

  const atualizado = rowToCharacter(
    data as PersonagemRow,
  );

  if (!atualizado) {
    throw new Error(
      "Os dados da ficha ficaram vazios após salvar.",
    );
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const {
    data: membro,
    error: membroError,
  } = await supabase
    .from("campanha_membros")
    .select("id")
    .eq("campanha_id", campanhaId)
    .eq("user_id", user.id)
    .eq("status", "ATIVO")
    .maybeSingle();

  if (membroError) {
    throw new Error(
      membroError.message ||
        "Não foi possível verificar sua participação.",
    );
  }

  if (!membro) {
    throw new Error(
      "Você precisa participar da campanha para vincular um personagem.",
    );
  }

  const {
    data: linha,
    error: linhaError,
  } = await supabase
    .from("personagens")
    .select("*")
    .eq("id", personagemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (linhaError) {
    throw new Error(
      linhaError.message ||
        "Não foi possível carregar o personagem.",
    );
  }

  if (!linha) {
    throw new Error(
      "Personagem não encontrado.",
    );
  }

  if (linha.campanha_id) {
    throw new Error(
      "Este personagem já está em uma campanha.",
    );
  }

  const atual = rowToCharacter(
    linha as PersonagemRow,
  );

  if (!atual) {
    throw new Error(
      "Os dados da ficha estão vazios.",
    );
  }

  const dados = paraDados({
    ...atual,
    carteira: {
      pc: 0,
      pp: 0,
      pe: 0,
      po: 0,
      pl: 0,
    },
  });

  const {
    data,
    error,
  } = await supabase
    .from("personagens")
    .update({
      campanha_id: campanhaId,
      dados,
    })
    .eq("id", personagemId)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message ||
        "Não foi possível vincular o personagem.",
    );
  }

  const vinculado = data
    ? rowToCharacter(
        data as PersonagemRow,
      )
    : null;

  if (!vinculado) {
    throw new Error(
      "Você não tem permissão para vincular este personagem.",
    );
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
    .select("id")
    .eq("campanha_id", campaignId)
    .eq("user_id", user.id)
    .eq("status", "ATIVO")
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      membershipError.message || "Não foi possível verificar sua participação.",
    );
  }
  if (!membership) {
    throw new Error("Você precisa participar da campanha para adicionar conteúdo.");
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
): Promise<Campaign> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  for (
    let tentativa = 0;
    tentativa < 5;
    tentativa++
  ) {
    const codigo =
      gerarCodigoConvite();

    const {
      data,
      error,
    } = await supabase
      .from("campanhas")
      .insert({
        nome: dados.nome.trim(),
        descricao:
          dados.descricao.trim() || null,
        sistema:
          dados.sistema.trim() || null,
        moeda_principal:
          dados.moeda_principal.trim() || null,
        ouro_inicial: Math.max(
          0,
          Math.floor(
            dados.ouro_inicial,
          ),
        ),
        codigo_convite: codigo,
        created_by: user.id,
        status: "ATIVA",
      })
      .select()
      .single();

    if (!error && data) {
      const {
        error: membroError,
      } = await supabase
        .from("campanha_membros")
        .insert({
          campanha_id: data.id,
          user_id: user.id,
          papel: "MESTRE",
          status: "ATIVO",
        });

      if (membroError) {
        await supabase
          .from("campanhas")
          .delete()
          .eq("id", data.id);

        throw new Error(
          membroError.message ||
            "A campanha foi criada, mas não foi possível registrar o Mestre.",
        );
      }

      return data as Campaign;
    }

    if (error?.code !== "23505") {
      throw new Error(
        error?.message ||
          "Não foi possível criar a campanha.",
      );
    }
  }

  throw new Error(
    "Não foi possível gerar um código de convite exclusivo. Tente novamente.",
  );
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
  precoCompra: number;
  precoVenda: number | null;
  estoque: number;
  vendaPermitida: boolean;
  ativo: boolean;
}

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
          imagem_url
        )
      )
    `)
    .eq("campanha_id", campanhaId)
    .eq("ativa", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message || "Não foi possível carregar a loja.",
    );
  }

  if (!data) {
    return [];
  }

  const loja = data as unknown as {
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
          }
        | null;
    }>;
  };

  return (loja.loja_itens ?? [])
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
      precoCompra: Number(lojaItem.preco_compra),
      precoVenda:
        lojaItem.preco_venda === null
          ? null
          : Number(lojaItem.preco_venda),
      estoque: Number(lojaItem.estoque),
      vendaPermitida: lojaItem.venda_permitida,
      ativo: lojaItem.ativo,
    }));
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
      precoCompra: item.precoCompra,
      precoVenda: null,
      estoque: item.estoque,
      vendaPermitida: true,
      ativo: item.ativo,
    };
  }

  export type CatalogItem = Pick<
    ShopItem,
    "itemId" | "nome" | "descricao" | "tipo" | "raridade" | "efeito" | "imagemUrl"
  >;

  export async function listarCatalogoItens(): Promise<CatalogItem[]> {
    const { data, error } = await supabase
      .from("itens")
      .select("id, nome, descricao, tipo, raridade, efeito, imagem_url")
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
      updated_at,
      itens (
        id,
        nome,
        descricao,
        tipo,
        raridade,
        efeito,
        imagem_url
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