import type { Character, User } from "../types/character";
import { mockCharacters } from "../data/mockCharacters";
import { supabase } from "./supabase";

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

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

  const { data, error } = await supabase.auth.signInWithPassword({
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
    if (error.message.toLowerCase().includes("already registered")) {
      throw new Error("Este e-mail já está registrado no Supabase.");
    }

    throw new Error(
      error.message || "Não foi possível cadastrar no Supabase.",
    );
  }

  if (!data.user) {
    throw new Error("Erro ao criar aventureiro no Supabase.");
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

/**
 * Linha da tabela "personagens" no Supabase.
 * A ficha completa (hp, mp, attributes, skills, etc.) fica na coluna "dados".
 */
type PersonagemRow = {
  id: string;
  nome?: string | null;
  nivel?: number | null;
  dados?: Partial<Character> | null;
};

/**
 * Converte a linha do banco no formato Character que os componentes esperam.
 * Retorna null se a linha não tiver a coluna "dados" preenchida.
 */
function rowToCharacter(row: PersonagemRow): Character | null {
  if (!row.dados) return null;

  return {
    ...(row.dados as Character),
    id: row.id,
    nome: row.nome ?? row.dados.nome ?? "",
    nivel: row.nivel ?? row.dados.nivel ?? 1,
  };
}

export async function getCharacters(): Promise<Character[]> {
  const { data, error } = await supabase
    .from("personagens")
    .select("*");

  if (error) {
    throw new Error(
      error.message || "Não foi possível carregar os personagens.",
    );
  }

  return ((data ?? []) as PersonagemRow[])
    .map(rowToCharacter)
    .filter((c): c is Character => c !== null);
}

export async function getCharacterById(
  id: string,
): Promise<Character | undefined> {
  try {
    const { data, error } = await supabase
      .from("personagens")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) {
      const personagem = rowToCharacter(data as PersonagemRow);

      if (personagem) {
        return personagem;
      }
    }
  } catch {
    // Fallback temporário para desenvolvimento.
  }

  return delay(mockCharacters.find((c) => c.id === id));
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
}

function gerarCodigoConvite(): string {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let codigo = "";

  for (let i = 0; i < 6; i++) {
    const indice = Math.floor(Math.random() * caracteres.length);
    codigo += caracteres[indice];
  }

  return codigo;
}

/* =========================================================
   CRIAR CAMPANHA
========================================================= */

export async function criarCampanha(dados: {
  nome: string;
  descricao: string;
  sistema: string;
  moeda_principal: string;
  ouro_inicial: number;
}): Promise<Campaign> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigoConvite();

    const { data, error } = await supabase
      .from("campanhas")
      .insert({
        nome: dados.nome.trim(),
        descricao: dados.descricao.trim() || null,
        sistema: dados.sistema.trim() || null,
        moeda_principal: dados.moeda_principal.trim() || null,
        ouro_inicial: Math.max(0, Math.floor(dados.ouro_inicial)),
        codigo_convite: codigo,
        created_by: user.id,
        status: "ATIVA",
      })
      .select()
      .single();

    if (!error && data) {
      const { error: membroError } = await supabase
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
        error?.message || "Não foi possível criar a campanha.",
      );
    }
  }

  throw new Error(
    "Não foi possível gerar um código de convite exclusivo. Tente novamente.",
  );
}

/* =========================================================
   LISTAR CAMPANHAS DO USUÁRIO
========================================================= */

export async function listarMinhasCampanhas(): Promise<Campaign[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data, error } = await supabase
    .from("campanha_membros")
    .select(
      `
      campanha_id,
      campanhas (*)
      `,
    )
    .eq("user_id", user.id)
    .eq("status", "ATIVO");

  if (error) {
    throw new Error(
      error.message || "Não foi possível carregar suas campanhas.",
    );
  }

  const campanhas: Campaign[] = [];

  for (const item of data ?? []) {
    const campanha = item.campanhas;

    if (campanha && !Array.isArray(campanha)) {
      campanhas.push(campanha as Campaign);
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
    throw new Error("Usuário não autenticado.");
  }

  const codigo = codigoConvite.trim().toUpperCase();

  if (!codigo) {
    throw new Error("Informe o código da campanha.");
  }

  const { data: campanha, error: campanhaError } = await supabase
    .from("campanhas")
    .select("*")
    .eq("codigo_convite", codigo)
    .eq("status", "ATIVA")
    .single();

  if (campanhaError || !campanha) {
    throw new Error("Campanha não encontrada ou não está ativa.");
  }

  const {
    data: membroExistente,
    error: membroConsultaError,
  } = await supabase
    .from("campanha_membros")
    .select("id, status")
    .eq("campanha_id", campanha.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membroConsultaError) {
    throw new Error(
      membroConsultaError.message ||
        "Não foi possível verificar sua participação.",
    );
  }

  if (membroExistente) {
    if (membroExistente.status !== "ATIVO") {
      const { error: atualizarError } = await supabase
        .from("campanha_membros")
        .update({
          status: "ATIVO",
        })
        .eq("id", membroExistente.id);

      if (atualizarError) {
        throw new Error(
          atualizarError.message ||
            "Não foi possível reativar sua participação.",
        );
      }
    }

    return campanha as Campaign;
  }

  const { error: entradaError } = await supabase
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
   ACESSO À CAMPANHA
========================================================= */

export async function getCampaignAccess(campaignId: string): Promise<{
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
    .eq("campanha_id", campaignId)
    .eq("user_id", user.id)
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
    isMaster: membership?.papel === "MESTRE",
    startingGold: campaign?.ouro_inicial ?? 1250,
  };
}

/* =========================================================
   CRIAR PERSONAGEM
========================================================= */

export async function criarPersonagem(
  campanhaId: string,
  personagem: Character,
): Promise<Character> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  if (!campanhaId) {
    throw new Error("Campanha não informada.");
  }

  const { data, error } = await supabase
    .from("personagens")
    .insert({
      campanha_id: campanhaId,
      user_id: user.id,
      nome: personagem.nome,
      nivel: personagem.nivel,
      xp: 0,
      dados: personagem,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "Não foi possível criar o personagem.",
    );
  }

  return {
    ...personagem,
    id: data.id,
  };
}