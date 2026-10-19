-- Migration: 202610180001_manual_hp_mp_200_base.sql
-- Simplifica o funcionamento de Vida (HP) e Mana (MP):
-- 1. Todo personagem começa com 200 PV e 200 PM (ou bônus de classe ajustado).
-- 2. Máximos de recursos são manuais e preservados na coluna dados (JSONB).
-- 3. O trigger aplicar_limites_recursos_personagem preserva max em vez de sobrescrever com fórmulas.
-- 4. Funções de sincronização retornam os limites reais armazenados no JSONB.

create or replace function public.aplicar_limites_recursos_personagem()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_hp_max integer;
  v_mp_max integer;
  v_hp jsonb;
  v_mp jsonb;
begin
  if new.dados is null or jsonb_typeof(new.dados) is distinct from 'object' then
    return new;
  end if;

  v_hp := case
    when jsonb_typeof(new.dados -> 'hp') = 'object' then new.dados -> 'hp'
    else '{}'::jsonb
  end;
  v_mp := case
    when jsonb_typeof(new.dados -> 'mp') = 'object' then new.dados -> 'mp'
    else '{}'::jsonb
  end;

  -- Lê o limite máximo manual configurado, com baseline padrão de 200
  v_hp_max := public._integer_from_jsonb(v_hp -> 'max', 200, 1, 999999);
  v_mp_max := public._integer_from_jsonb(v_mp -> 'max', 200, 0, 999999);

  -- Atualiza e preserva max e limita o valor atual
  v_hp := jsonb_set(
    jsonb_set(
      v_hp,
      '{max}',
      to_jsonb(v_hp_max),
      true
    ),
    '{atual}',
    to_jsonb(public._integer_from_jsonb(v_hp -> 'atual', v_hp_max, 0, v_hp_max)),
    true
  );

  v_mp := jsonb_set(
    jsonb_set(
      v_mp,
      '{max}',
      to_jsonb(v_mp_max),
      true
    ),
    '{atual}',
    to_jsonb(public._integer_from_jsonb(v_mp -> 'atual', v_mp_max, 0, v_mp_max)),
    true
  );

  new.dados := jsonb_set(
    jsonb_set(new.dados, '{hp}', v_hp, true),
    '{mp}',
    v_mp,
    true
  );

  return new;
end;
$$;

create or replace function public.get_character_resource_maximums(p_personagem_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_personagem public.personagens%rowtype;
  v_hp_max integer;
  v_mp_max integer;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;
  select * into v_personagem
  from public.personagens personagem
  where personagem.id = p_personagem_id
    and (
      personagem.user_id = v_usuario_id
      or exists (
        select 1 from public.campanha_membros membro
        where membro.campanha_id = personagem.campanha_id
          and membro.user_id = v_usuario_id
          and membro.status = 'ATIVO'
      )
    );
  if not found then
    raise exception 'Personagem não encontrado ou sem permissão.';
  end if;

  v_hp_max := public._integer_from_jsonb(v_personagem.dados #> '{hp,max}', 200, 1, 999999);
  v_mp_max := public._integer_from_jsonb(v_personagem.dados #> '{mp,max}', 200, 0, 999999);

  return jsonb_build_object(
    'dados_version', v_personagem.dados_version,
    'hp_atual', public._integer_from_jsonb(v_personagem.dados #> '{hp,atual}', v_hp_max, 0, v_hp_max),
    'mp_atual', public._integer_from_jsonb(v_personagem.dados #> '{mp,atual}', v_mp_max, 0, v_mp_max),
    'hp_max', v_hp_max,
    'mp_max', v_mp_max
  );
end;
$$;

create or replace function public.reconciliar_limites_recursos_personagem(p_personagem_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_personagem public.personagens%rowtype;
  v_hp_max integer;
  v_mp_max integer;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select * into v_personagem
  from public.personagens personagem
  where personagem.id = p_personagem_id
    and (
      personagem.user_id = v_usuario_id
      or exists (
        select 1 from public.campanha_membros membro
        where membro.campanha_id = personagem.campanha_id
          and membro.user_id = v_usuario_id
          and membro.papel = 'MESTRE'
          and membro.status = 'ATIVO'
      )
    )
  for update;
  if not found then
    raise exception 'Personagem não encontrado ou sem permissão.';
  end if;

  v_hp_max := public._integer_from_jsonb(v_personagem.dados #> '{hp,max}', 200, 1, 999999);
  v_mp_max := public._integer_from_jsonb(v_personagem.dados #> '{mp,max}', 200, 0, 999999);

  return jsonb_build_object(
    'dados_version', v_personagem.dados_version,
    'hp_atual', public._integer_from_jsonb(v_personagem.dados #> '{hp,atual}', v_hp_max, 0, v_hp_max),
    'mp_atual', public._integer_from_jsonb(v_personagem.dados #> '{mp,atual}', v_mp_max, 0, v_mp_max),
    'hp_max', v_hp_max,
    'mp_max', v_mp_max
  );
end;
$$;

create or replace function public.listar_maximos_recursos_campanha(p_campanha_id uuid)
returns table (
  personagem_id uuid,
  hp_atual integer,
  hp_max integer,
  mp_atual integer,
  mp_max integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if not exists (
    select 1 from public.campanha_membros membro
    where membro.campanha_id = p_campanha_id
      and membro.user_id = v_usuario_id
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Usuário não participa desta campanha.';
  end if;

  return query
    select
      personagem.id,
      public._integer_from_jsonb(personagem.dados #> '{hp,atual}', 200, 0, public._integer_from_jsonb(personagem.dados #> '{hp,max}', 200, 1, 999999)),
      public._integer_from_jsonb(personagem.dados #> '{hp,max}', 200, 1, 999999),
      public._integer_from_jsonb(personagem.dados #> '{mp,atual}', 200, 0, public._integer_from_jsonb(personagem.dados #> '{mp,max}', 200, 0, 999999)),
      public._integer_from_jsonb(personagem.dados #> '{mp,max}', 200, 0, 999999)
    from public.personagens personagem
    join public.campanha_membros membro
      on membro.campanha_id = personagem.campanha_id
      and membro.user_id = personagem.user_id
      and membro.status = 'ATIVO'
    where personagem.campanha_id = p_campanha_id
    order by personagem.id;
end;
$$;
