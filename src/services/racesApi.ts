import {
  DEFAULT_RACE_CATALOG,
  chaveDeRaca,
  normalizarCatalogoRacas,
  normalizarConfigRacasCampanha,
  type CampaignRaceConfig,
  type RaceDefinition,
} from "../data/raceCatalog";
import { supabase } from "./supabase";

/* =========================================================
   CATÁLOGO GLOBAL DE RAÇAS
   (mesmo modelo do catálogo global de classes)
========================================================= */

export async function canManageGlobalRaceCatalog(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(
      error.message || "Não foi possível verificar o acesso ao catálogo de raças.",
    );
  }
  return data.user?.app_metadata?.global_rules_admin === true;
}

export async function getCatalogoGlobalRacas(): Promise<RaceDefinition[]> {
  const { data, error } = await supabase
    .from("global_race_catalog")
    .select("dados")
    .eq("id", "global")
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message || "Não foi possível carregar o catálogo de raças.",
    );
  }

  // Sem linha salva ainda: usa o catálogo padrão embutido no código.
  return data ? normalizarCatalogoRacas(data.dados) : DEFAULT_RACE_CATALOG;
}

export async function salvarCatalogoGlobalRacas(
  racas: RaceDefinition[],
): Promise<RaceDefinition[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const normalizadas = normalizarCatalogoRacas(racas);
  if (normalizadas.length === 0) {
    throw new Error("O catálogo precisa ter pelo menos uma raça.");
  }

  const ids = new Set<string>();
  const nomes = new Set<string>();
  for (const raca of normalizadas) {
    const nome = chaveDeRaca(raca.nome);
    if (ids.has(raca.id) || nomes.has(nome)) {
      throw new Error("As raças precisam ter nomes e identificadores únicos.");
    }
    ids.add(raca.id);
    nomes.add(nome);
  }

  const { data, error } = await supabase
    .from("global_race_catalog")
    .upsert(
      { id: "global", dados: normalizadas, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    )
    .select("dados")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "Não foi possível salvar o catálogo de raças.",
    );
  }

  return normalizarCatalogoRacas(data.dados);
}

/* =========================================================
   RAÇAS DA CAMPANHA
   (bloqueios, bônus ajustados e raças exclusivas do Mestre)
========================================================= */

export async function getRacasCampanha(
  campaignId: string,
): Promise<CampaignRaceConfig> {
  const { data, error } = await supabase
    .from("campanhas")
    .select("racas_config")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message || "Não foi possível carregar as raças da campanha.",
    );
  }

  if (!data) {
    throw new Error("Campanha não encontrada.");
  }

  return normalizarConfigRacasCampanha(data.racas_config);
}

export async function salvarRacasCampanha(
  campaignId: string,
  config: CampaignRaceConfig,
): Promise<CampaignRaceConfig> {
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
    throw new Error("Somente o Mestre pode alterar as raças da campanha.");
  }

  const normalizada = normalizarConfigRacasCampanha(config);

  const nomes = new Set<string>();
  for (const raca of normalizada.exclusivas) {
    const nome = chaveDeRaca(raca.nome);
    if (nomes.has(nome)) {
      throw new Error("As raças exclusivas precisam ter nomes únicos.");
    }
    nomes.add(nome);
  }

  const { data, error } = await supabase
    .from("campanhas")
    .update({ racas_config: normalizada })
    .eq("id", campaignId)
    .select("racas_config")
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message || "Não foi possível salvar as raças da campanha.",
    );
  }

  if (!data) {
    throw new Error("Campanha não encontrada ou sem permissão para alterar.");
  }

  return normalizarConfigRacasCampanha(data.racas_config);
}