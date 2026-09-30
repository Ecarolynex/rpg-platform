import type { Character, User } from "../types/character";
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

  return {
    ...(row.dados as Character),
    id: row.id,
    campanhaId: row.campanha_id ?? null,
    nome: row.nome ?? row.dados.nome ?? "",
    nivel: row.nivel ?? row.dados.nivel ?? 1,
  };
}

function paraDados(
  personagem: Character,
): Character {
  const copia: Character = {
    ...personagem,
    id: "",
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

  const { data: campanha } =
    await supabase
      .from("campanhas")
      .select("ouro_inicial")
      .eq("id", campanhaId)
      .maybeSingle();

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

  const carteira =
    atual.carteira ?? {
      pc: 0,
      pp: 0,
      pe: 0,
      po: 0,
      pl: 0,
    };

  const semMoedas =
    Object.values(carteira).every(
      (valor) => valor === 0,
    );

  const dados = paraDados({
    ...atual,
    carteira: semMoedas
      ? {
          ...carteira,
          po: campanha?.ouro_inicial ?? 0,
        }
      : carteira,
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

  return {
    ...personagem,
    id: data.id,
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
  moedaId: string;
  precoCompra: number;
  precoVenda: number | null;
  estoque: number;
  vendaPermitida: boolean;
  ativo: boolean;
}

type LojaItemRow = {
  id: string;
  loja_id: string;
  item_id: string;
  moeda_id: string;
  preco_compra: number | string;
  preco_venda: number | string | null;
  estoque: number;
  venda_permitida: boolean;
  ativo: boolean;
  itens:
    | {
        id: string;
        campanha_id: string;
        nome: string;
        descricao: string | null;
        tipo: string | null;
        raridade: string | null;
        efeito: string | null;
        imagem_url: string | null;
      }
    | {
        id: string;
        campanha_id: string;
        nome: string;
        descricao: string | null;
        tipo: string | null;
        raridade: string | null;
        efeito: string | null;
        imagem_url: string | null;
      }[]
    | null;
};

export async function listarItensDaLoja(
  campanhaId: string,
): Promise<ShopItem[]> {
  const {
    data,
    error,
  } = await supabase
    .from("loja_itens")
    .select(`
      id,
      loja_id,
      item_id,
      moeda_id,
      preco_compra,
      preco_venda,
      estoque,
      venda_permitida,
      ativo,
      itens (
        id,
        campanha_id,
        nome,
        descricao,
        tipo,
        raridade,
        efeito,
        imagem_url
      ),
      lojas!inner (
        id,
        campanha_id,
        ativa
      )
    `)
    .eq(
      "lojas.campanha_id",
      campanhaId,
    )
    .eq(
      "lojas.ativa",
      true,
    )
    .eq(
      "ativo",
      true,
    );

  if (error) {
    throw new Error(
      error.message ||
        "Não foi possível carregar os itens da loja.",
    );
  }

  const resultado: ShopItem[] = [];

  for (
    const row of (data ?? []) as unknown as LojaItemRow[]
  ) {
    const item =
      Array.isArray(row.itens)
        ? row.itens[0]
        : row.itens;

    if (!item) {
      continue;
    }

    resultado.push({
      id: row.id,
      lojaId: row.loja_id,
      itemId: row.item_id,
      campanhaId:
        item.campanha_id,
      nome: item.nome,
      descricao:
        item.descricao,
      tipo: item.tipo,
      raridade:
        item.raridade,
      efeito: item.efeito,
      imagemUrl:
        item.imagem_url,
      moedaId:
        row.moeda_id,
      precoCompra:
        Number(
          row.preco_compra,
        ),
      precoVenda:
        row.preco_venda === null
          ? null
          : Number(
              row.preco_venda,
            ),
      estoque:
        row.estoque,
      vendaPermitida:
        row.venda_permitida,
      ativo:
        row.ativo,
    });
  }

  return resultado;
}

/* =========================================================
   COMPRAR ITEM
========================================================= */

export async function comprarItem(
  personagemId: string,
  lojaItemId: string,
  quantidade: number = 1,
) {
  if (!personagemId) {
    throw new Error(
      "Personagem não informado.",
    );
  }

  if (!lojaItemId) {
    throw new Error(
      "Item da loja não informado.",
    );
  }

  if (quantidade <= 0) {
    throw new Error(
      "A quantidade deve ser maior que zero.",
    );
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "registrar_compra",
    {
      p_personagem_id:
        personagemId,
      p_loja_item_id:
        lojaItemId,
      p_quantidade:
        quantidade,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        "Não foi possível realizar a compra.",
    );
  }

  if (!data) {
    throw new Error(
      "A compra não retornou uma confirmação.",
    );
  }

  return data;
}
export async function getInventory(personagemId: string) {
  const { data, error } = await supabase
    .from("inventarios")
    .select(`
      personagem_id,
      item_id,
      quantidade,
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
    .eq("personagem_id", personagemId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar inventário:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}