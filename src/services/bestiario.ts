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
  visivel: boolean;
  criado_em: string;
}

export type CriaturaInput = Pick<
  Criatura,
  "nome" | "tipo" | "nivel_ameaca" | "vida" | "descricao" | "ataques" | "fraquezas" | "visivel"
>;

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
