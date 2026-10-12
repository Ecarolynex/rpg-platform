-- Restrict direct client execution of internal helpers and trigger functions.
-- Keep the seven application RPCs available to authenticated callers while
-- removing anon access. This changes EXECUTE ACLs only; function owners,
-- service_role grants, function bodies, triggers, table data, and RLS policies
-- are intentionally unchanged.

begin;

do $preflight$
declare
  v_missing text;
begin
  select string_agg(required.signature, ', ' order by required.signature)
    into v_missing
  from (values
    ('public._integer_from_jsonb(jsonb, integer, integer, integer)'),
    ('public._character_rule_key(text)'),
    ('public._builtin_character_bonus(text, text)'),
    ('public._calcular_maximos_recursos_personagem(uuid, jsonb, integer, uuid)'),
    ('public.aplicar_limites_recursos_personagem()'),
    ('public.incrementar_versao_dados_personagem()'),
    ('public.creditar_ouro_campanha(uuid, integer, uuid, uuid)'),
    ('public.creditar_experiencia_campanha(uuid, integer, uuid, uuid)'),
    ('public.entregar_item_campanha(uuid, uuid, integer, uuid, uuid)'),
    ('public.listar_recompensas_campanha(uuid)'),
    ('public.listar_maximos_recursos_campanha(uuid)'),
    ('public.get_character_resource_maximums(uuid)'),
    ('public.reconciliar_limites_recursos_personagem(uuid)')
  ) as required(signature)
  where to_regprocedure(required.signature) is null;

  if v_missing is not null then
    raise exception 'Migração cancelada; funções esperadas ausentes ou com assinatura diferente: %', v_missing;
  end if;
end;
$preflight$;

-- Internal helpers are invoked by database-owned SECURITY DEFINER RPCs or by
-- already-created triggers; clients must not call them directly.
revoke execute on function public._integer_from_jsonb(jsonb, integer, integer, integer)
  from anon, authenticated;
revoke execute on function public._character_rule_key(text)
  from anon, authenticated;
revoke execute on function public._builtin_character_bonus(text, text)
  from anon, authenticated;
revoke execute on function public._calcular_maximos_recursos_personagem(uuid, jsonb, integer, uuid)
  from anon, authenticated;
revoke execute on function public.aplicar_limites_recursos_personagem()
  from anon, authenticated;
revoke execute on function public.incrementar_versao_dados_personagem()
  from anon, authenticated;

-- Application RPCs are not anonymous endpoints. Preserve authenticated access
-- required by the existing client and its campaign-membership checks.
revoke execute on function public.creditar_ouro_campanha(uuid, integer, uuid, uuid) from anon;
grant execute on function public.creditar_ouro_campanha(uuid, integer, uuid, uuid) to authenticated;
revoke execute on function public.creditar_experiencia_campanha(uuid, integer, uuid, uuid) from anon;
grant execute on function public.creditar_experiencia_campanha(uuid, integer, uuid, uuid) to authenticated;
revoke execute on function public.entregar_item_campanha(uuid, uuid, integer, uuid, uuid) from anon;
grant execute on function public.entregar_item_campanha(uuid, uuid, integer, uuid, uuid) to authenticated;
revoke execute on function public.listar_recompensas_campanha(uuid) from anon;
grant execute on function public.listar_recompensas_campanha(uuid) to authenticated;
revoke execute on function public.listar_maximos_recursos_campanha(uuid) from anon;
grant execute on function public.listar_maximos_recursos_campanha(uuid) to authenticated;
revoke execute on function public.get_character_resource_maximums(uuid) from anon;
grant execute on function public.get_character_resource_maximums(uuid) to authenticated;
revoke execute on function public.reconciliar_limites_recursos_personagem(uuid) from anon;
grant execute on function public.reconciliar_limites_recursos_personagem(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
