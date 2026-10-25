import { supabase } from "./supabase";

export type CriaturaTipo = "inimigo" | "boss" | "npc";

export interface Criatura {
  id: string;
  campanha_id: string;
  nome: string;
  tipo: CriaturaTipo;
  nivel_ameaca: string | null;
  vida: number | null;
  descricao: string | null;
  ataques: string | null;
  fraquezas: string | null;
  imagem_url: string | null;
  visivel: boolean;
  criado_em: string;
}

export type CriaturaInput = Pick<
  Criatura,
  "nome" | "tipo" | "nivel_ameaca" | "vida" | "descricao" | "ataques" | "fraquezas" | "imagem_url" | "visivel"
>;

const BUCKET = "bestiario";
export const IMAGEM_TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const IMAGEM_TAMANHO_MAX = 2 * 1024 * 1024; // 2 MB

function mensagem(error: { message?: string } | null, padrao: string) {
  return new Error(error?.message || padrao);
}

// O Mestre recebe todas; jogadores recebem só as reveladas (garantido pela RLS).
export async function listarBestiario(campanhaId: string): Promise<Criatura[]> {
  const { data, error } = await supabase
    .from("bestiario")
    .select("*")
    .eq("campanha_id", campanhaId)
    .order("nome", { ascending: true });

  if (error) throw mensagem(error, "Não foi possível carregar o Bestiário.");
  return (data ?? []) as Criatura[];
}

export async function enviarImagemCriatura(campanhaId: string, arquivo: File): Promise<string> {
  if (!IMAGEM_TIPOS_ACEITOS.includes(arquivo.type)) {
    throw new Error("Formato inválido. Use JPG, PNG, WEBP ou GIF.");
  }
  if (arquivo.size > IMAGEM_TAMANHO_MAX) {
    throw new Error("A imagem deve ter no máximo 2 MB.");
  }

  const extensao = arquivo.name.split(".").pop()?.toLowerCase() || "png";
  const caminho = `${campanhaId}/${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (error) throw mensagem(error, "Não foi possível enviar a imagem.");

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
  return data.publicUrl;
}

// Melhor esforço: se falhar, não bloqueia o fluxo principal.
export async function removerImagemCriatura(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const marcador = `/object/public/${BUCKET}/`;
  const indice = url.indexOf(marcador);
  if (indice === -1) return;
  const caminho = decodeURIComponent(url.slice(indice + marcador.length).split("?")[0]);
  await supabase.storage.from(BUCKET).remove([caminho]);
}

export async function salvarCriatura(
  campanhaId: string,
  dados: CriaturaInput,
  id?: string,
): Promise<void> {
  if (id) {
    const { error } = await supabase.from("bestiario").update(dados).eq("id", id);
    if (error) throw mensagem(error, "Não foi possível atualizar a criatura.");
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { error } = await supabase
    .from("bestiario")
    .insert({ ...dados, campanha_id: campanhaId, criado_por: user.id });
  if (error) throw mensagem(error, "Não foi possível cadastrar a criatura.");
}

export async function alternarVisibilidadeCriatura(
  id: string,
  visivel: boolean,
): Promise<void> {
  const { error } = await supabase.from("bestiario").update({ visivel }).eq("id", id);
  if (error) throw mensagem(error, "Não foi possível alterar a visibilidade.");
}

export async function excluirCriatura(id: string): Promise<void> {
  const { error } = await supabase.from("bestiario").delete().eq("id", id);
  if (error) throw mensagem(error, "Não foi possível excluir a criatura.");
}