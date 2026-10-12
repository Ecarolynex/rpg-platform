-- Forward-only repair for the remotely confirmed missing character-resource
-- functions/triggers and campaign reward objects. This file is deliberately
-- additive: it does not drop existing objects, rewrite unrelated RLS policies,
-- or delete application data.
--
-- Apply only after reviewing this migration. The preflight below aborts if the
-- rule/catalog tables and columns required by the authoritative max calculation
-- are not present.

do $preflight$
declare
  v_missing_tables text;
  v_missing_columns text;
begin
  select string_agg(required.table_name, ', ' order by required.table_name)
    into v_missing_tables
  from (values
    ('public.personagens'),
    ('public.campanhas'),
    ('public.campanha_membros'),
    ('public.itens'),
    ('public.inventarios'),
    ('public.campanha_classes_conteudos'),
    ('public.global_class_catalog'),
    ('auth.users')
  ) as required(table_name)
  where to_regclass(required.table_name) is null;

  if v_missing_tables is not null then
    raise exception 'Migração cancelada; tabelas pré-requisito ausentes: %', v_missing_tables;
  end if;

  select string_agg(format('%I.%I', required.table_name, required.column_name), ', '
                    order by required.table_name, required.column_name)
    into v_missing_columns
  from (values
    ('personagens', 'id'),
    ('personagens', 'campanha_id'),
    ('personagens', 'user_id'),
    ('personagens', 'dados'),
    ('personagens', 'nome'),
    ('personagens', 'nivel'),
    ('campanhas', 'id'),
    ('campanhas', 'bonus_classes'),
    ('campanha_membros', 'campanha_id'),
    ('campanha_membros', 'user_id'),
    ('campanha_membros', 'papel'),
    ('campanha_membros', 'status'),
    ('itens', 'id'),
    ('itens', 'bonus_atributos'),
    ('inventarios', 'personagem_id'),
    ('inventarios', 'item_id'),
    ('inventarios', 'quantidade'),
    ('inventarios', 'equipado'),
    ('inventarios', 'updated_at'),
    ('campanha_classes_conteudos', 'campanha_id'),
    ('campanha_classes_conteudos', 'classe_id'),
    ('campanha_classes_conteudos', 'tipo'),
    ('campanha_classes_conteudos', 'nome'),
    ('campanha_classes_conteudos', 'bonus_atributos'),
    ('campanha_classes_conteudos', 'bonus_hp'),
    ('campanha_classes_conteudos', 'bonus_mp'),
    ('campanha_classes_conteudos', 'created_at'),
    ('campanha_classes_conteudos', 'id'),
    ('global_class_catalog', 'id'),
    ('global_class_catalog', 'dados')
  ) as required(table_name, column_name)
  left join information_schema.columns column_info
    on column_info.table_schema = 'public'
   and column_info.table_name = required.table_name
   and column_info.column_name = required.column_name
  where column_info.column_name is null;

  if v_missing_columns is not null then
    raise exception 'Migração cancelada; colunas pré-requisito ausentes: %', v_missing_columns;
  end if;
end;
$preflight$;

-- Missing additive character contract fields from the earlier migrations.
alter table public.personagens
  add column if not exists dados_version bigint not null default 1,
  add column if not exists xp integer not null default 0;

-- Shared helpers used by server-side resource calculations.
create or replace function public._integer_from_jsonb(
  p_value jsonb,
  p_fallback integer,
  p_min integer,
  p_max integer
)
returns integer
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_value numeric;
begin
  if p_value is null or jsonb_typeof(p_value) is distinct from 'number' then
    return p_fallback;
  end if;

  v_value := (p_value #>> '{}')::numeric;
  return greatest(p_min, least(p_max, trunc(v_value)))::integer;
exception
  when numeric_value_out_of_range or invalid_text_representation then
    return p_fallback;
end;
$$;

create or replace function public._character_rule_key(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select translate(
    lower(trim(coalesce(p_value, ''))),
    'áàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc'
  );
$$;

create or replace function public._builtin_character_bonus(
  p_source text,
  p_name text
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_key text := public._character_rule_key(p_name);
begin
  if p_source = 'RACA' then
    return case v_key
      when 'humano' then '{"atributoBonus":{"forca":1,"destreza":1,"constituicao":1,"inteligencia":1,"carisma":1},"hpBonus":0,"mpBonus":0}'::jsonb
      when 'elfo' then '{"atributoBonus":{"destreza":2},"hpBonus":0,"mpBonus":5}'::jsonb
      when 'anao' then '{"atributoBonus":{"constituicao":2},"hpBonus":10,"mpBonus":0}'::jsonb
      when 'meio-orc' then '{"atributoBonus":{"forca":2,"constituicao":1},"hpBonus":0,"mpBonus":0}'::jsonb
      when 'orc' then '{"atributoBonus":{"forca":2},"hpBonus":6,"mpBonus":0}'::jsonb
      when 'draconato' then '{"atributoBonus":{"forca":2,"carisma":1},"hpBonus":0,"mpBonus":0}'::jsonb
      else '{"atributoBonus":{},"hpBonus":0,"mpBonus":0}'::jsonb
    end;
  elsif p_source = 'FILIACAO' then
    return case v_key
      when 'colegio de magos arcanum' then '{"atributoBonus":{"inteligencia":1},"hpBonus":0,"mpBonus":6}'::jsonb
      when 'ordem da presa do lobo' then '{"atributoBonus":{"constituicao":1},"hpBonus":6,"mpBonus":0}'::jsonb
      when 'sombras urbanas' then '{"atributoBonus":{"destreza":1,"carisma":1},"hpBonus":0,"mpBonus":0}'::jsonb
      else '{"atributoBonus":{},"hpBonus":0,"mpBonus":0}'::jsonb
    end;
  end if;

  return case v_key
    when 'bardo' then '{"atributoBonus":{"carisma":2},"hpBonus":0,"mpBonus":6}'::jsonb
    when 'artifice' then '{"atributoBonus":{"inteligencia":2},"hpBonus":0,"mpBonus":5}'::jsonb
    when 'paladino' then '{"atributoBonus":{"forca":2,"carisma":1},"hpBonus":8,"mpBonus":0}'::jsonb
    when 'necromante' then '{"atributoBonus":{"inteligencia":2},"hpBonus":0,"mpBonus":8}'::jsonb
    when 'barbaro' then '{"atributoBonus":{"forca":2},"hpBonus":12,"mpBonus":0}'::jsonb
    when 'clerigo' then '{"atributoBonus":{"constituicao":1,"carisma":1},"hpBonus":5,"mpBonus":5}'::jsonb
    when 'mago' then '{"atributoBonus":{"inteligencia":2},"hpBonus":0,"mpBonus":10}'::jsonb
    when 'ladino' then '{"atributoBonus":{"destreza":2,"carisma":1},"hpBonus":0,"mpBonus":0}'::jsonb
    when 'guerreiro' then '{"atributoBonus":{"forca":2},"hpBonus":10,"mpBonus":0}'::jsonb
    else '{"atributoBonus":{},"hpBonus":0,"mpBonus":0}'::jsonb
  end;
end;
$$;

create or replace function public._calcular_maximos_recursos_personagem(
  p_personagem_id uuid,
  p_dados jsonb,
  p_nivel integer,
  p_campanha_id uuid
)
returns table (hp_max integer, mp_max integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_classe text := coalesce(p_dados ->> 'classe', 'Aventureiro');
  v_classe_id text := p_dados ->> 'classeId';
  v_raca text := coalesce(p_dados ->> 'raca', '');
  v_filiacao text := coalesce(p_dados ->> 'filiacao', '');
  v_bonus_raca jsonb;
  v_bonus_classe jsonb;
  v_bonus_filiacao jsonb;
  v_override jsonb;
  v_conteudo_campanha jsonb;
  v_classe_global jsonb;
  v_catalogo_global jsonb;
  v_bonus_campanha jsonb := '{}'::jsonb;
  v_tem_override boolean := false;
  v_tem_conteudo_campanha boolean := false;
  v_tem_catalogo_global boolean := false;
  v_tem_classe_global boolean := false;
  v_chave_classe text := public._character_rule_key(v_classe);
  v_forca numeric;
  v_destreza numeric;
  v_constituicao numeric;
  v_inteligencia numeric;
  v_carisma numeric;
  v_bonus_equip_constituicao numeric := 0;
  v_bonus_equip_inteligencia numeric := 0;
  v_bonus_atributo jsonb;
  v_dado_vida integer;
  v_nivel integer := greatest(1, coalesce(p_nivel, 1));
  v_modificador_con numeric;
  v_por_nivel numeric;
  v_hp numeric;
  v_mp numeric;
begin
  v_bonus_raca := public._builtin_character_bonus('RACA', v_raca);
  v_bonus_filiacao := public._builtin_character_bonus('FILIACAO', v_filiacao);

  if p_campanha_id is not null then
    select coalesce(campanha.bonus_classes, '{}'::jsonb)
      into v_bonus_campanha
    from public.campanhas campanha
    where campanha.id = p_campanha_id
    for share;

    select entrada.value
      into v_override
    from jsonb_each(
      case when jsonb_typeof(v_bonus_campanha) = 'object'
        then v_bonus_campanha else '{}'::jsonb end
    ) as entrada(key, value)
    where jsonb_typeof(entrada.value) = 'object'
      and public._character_rule_key(entrada.key) in (
        v_chave_classe,
        public._character_rule_key(v_classe_id)
      )
    order by case
      when public._character_rule_key(entrada.key) = public._character_rule_key(v_classe_id) then 0
      else 1
    end
    limit 1;
    v_tem_override := found;

    select jsonb_build_object(
      'atributoBonus', conteudo.bonus_atributos,
      'hpBonus', conteudo.bonus_hp,
      'mpBonus', conteudo.bonus_mp
    )
      into v_conteudo_campanha
    from public.campanha_classes_conteudos conteudo
    where conteudo.campanha_id = p_campanha_id
      and conteudo.tipo = 'CLASSE'
      and (
        (v_classe_id is not null and conteudo.classe_id = v_classe_id)
        or public._character_rule_key(conteudo.nome) = v_chave_classe
      )
    order by conteudo.created_at, conteudo.id
    limit 1;
    v_tem_conteudo_campanha := found;
  end if;

  select catalogo.dados
    into v_catalogo_global
  from public.global_class_catalog catalogo
  where catalogo.id = 'global'
  for share;
  v_tem_catalogo_global := found;

  if v_tem_catalogo_global then
    select entrada.value
      into v_classe_global
    from jsonb_array_elements(
      case when jsonb_typeof(v_catalogo_global) = 'array'
        then v_catalogo_global else '[]'::jsonb end
    ) with ordinality as entrada(value, ordem)
    where (
      (v_classe_id is not null and entrada.value ->> 'id' = v_classe_id)
      or public._character_rule_key(entrada.value ->> 'nome') = v_chave_classe
      or exists (
        select 1
        from jsonb_array_elements_text(
          case when jsonb_typeof(entrada.value -> 'aliases') = 'array'
            then entrada.value -> 'aliases' else '[]'::jsonb end
        ) as class_alias(nome)
        where public._character_rule_key(class_alias.nome) = v_chave_classe
      )
    )
    order by entrada.ordem
    limit 1;
    v_tem_classe_global := found;
  end if;

  if v_tem_override then
    v_bonus_classe := v_override;
  elsif v_tem_conteudo_campanha then
    v_bonus_classe := v_conteudo_campanha;
  elsif v_tem_classe_global then
    v_bonus_classe := v_classe_global;
  else
    v_bonus_classe := public._builtin_character_bonus('CLASSE', v_classe);
  end if;

  v_bonus_atributo := coalesce(v_bonus_raca -> 'atributoBonus', '{}'::jsonb);
  v_forca := public._integer_from_jsonb(p_dados #> '{attributes,forca}', 10, 1, 30)
    + public._integer_from_jsonb(v_bonus_atributo -> 'forca', 0, -999999, 999999);
  v_destreza := public._integer_from_jsonb(p_dados #> '{attributes,destreza}', 10, 1, 30)
    + public._integer_from_jsonb(v_bonus_atributo -> 'destreza', 0, -999999, 999999);
  v_constituicao := public._integer_from_jsonb(p_dados #> '{attributes,constituicao}', 10, 1, 30)
    + public._integer_from_jsonb(v_bonus_atributo -> 'constituicao', 0, -999999, 999999);
  v_inteligencia := public._integer_from_jsonb(p_dados #> '{attributes,inteligencia}', 10, 1, 30)
    + public._integer_from_jsonb(v_bonus_atributo -> 'inteligencia', 0, -999999, 999999);
  v_carisma := public._integer_from_jsonb(p_dados #> '{attributes,carisma}', 10, 1, 30)
    + public._integer_from_jsonb(v_bonus_atributo -> 'carisma', 0, -999999, 999999);

  v_bonus_atributo := coalesce(v_bonus_classe -> 'atributoBonus', '{}'::jsonb);
  v_forca := v_forca + public._integer_from_jsonb(v_bonus_atributo -> 'forca', 0, -999999, 999999);
  v_destreza := v_destreza + public._integer_from_jsonb(v_bonus_atributo -> 'destreza', 0, -999999, 999999);
  v_constituicao := v_constituicao + public._integer_from_jsonb(v_bonus_atributo -> 'constituicao', 0, -999999, 999999);
  v_inteligencia := v_inteligencia + public._integer_from_jsonb(v_bonus_atributo -> 'inteligencia', 0, -999999, 999999);
  v_carisma := v_carisma + public._integer_from_jsonb(v_bonus_atributo -> 'carisma', 0, -999999, 999999);

  v_bonus_atributo := coalesce(v_bonus_filiacao -> 'atributoBonus', '{}'::jsonb);
  v_forca := v_forca + public._integer_from_jsonb(v_bonus_atributo -> 'forca', 0, -999999, 999999);
  v_destreza := v_destreza + public._integer_from_jsonb(v_bonus_atributo -> 'destreza', 0, -999999, 999999);
  v_constituicao := v_constituicao + public._integer_from_jsonb(v_bonus_atributo -> 'constituicao', 0, -999999, 999999);
  v_inteligencia := v_inteligencia + public._integer_from_jsonb(v_bonus_atributo -> 'inteligencia', 0, -999999, 999999);
  v_carisma := v_carisma + public._integer_from_jsonb(v_bonus_atributo -> 'carisma', 0, -999999, 999999);

  select
    coalesce(sum(public._integer_from_jsonb(item.bonus_atributos -> 'constituicao', 0, -999999, 999999)), 0),
    coalesce(sum(public._integer_from_jsonb(item.bonus_atributos -> 'inteligencia', 0, -999999, 999999)), 0)
    into v_bonus_equip_constituicao, v_bonus_equip_inteligencia
  from public.inventarios inventario
  join public.itens item on item.id = inventario.item_id
  where inventario.personagem_id = p_personagem_id
    and inventario.equipado = true
    and inventario.quantidade > 0;

  v_constituicao := v_constituicao + v_bonus_equip_constituicao;
  v_inteligencia := v_inteligencia + v_bonus_equip_inteligencia;

  v_bonus_raca := coalesce(v_bonus_raca, '{}'::jsonb);
  v_bonus_filiacao := coalesce(v_bonus_filiacao, '{}'::jsonb);
  v_bonus_classe := coalesce(v_bonus_classe, '{}'::jsonb);

  v_dado_vida := case v_classe
    when 'Bárbaro' then 12
    when 'Guerreiro' then 10
    when 'Paladino' then 10
    when 'Patrulheiro' then 10
    when 'Bardo' then 8
    when 'Bruxo' then 8
    when 'Clérigo' then 8
    when 'Druida' then 8
    when 'Ladino' then 8
    when 'Monge' then 8
    when 'Feiticeiro' then 6
    when 'Mago' then 6
    else 8
  end;

  v_modificador_con := floor((v_constituicao - 10) / 2);
  v_por_nivel := greatest(1, floor(v_dado_vida / 2.0) + 1 + v_modificador_con);
  v_hp := greatest(
    1,
    least(
      200,
      v_dado_vida + v_modificador_con + (v_nivel - 1) * v_por_nivel
      + public._integer_from_jsonb(v_bonus_raca -> 'hpBonus', 0, -999999, 999999)
      + public._integer_from_jsonb(v_bonus_classe -> 'hpBonus', 0, -999999, 999999)
      + public._integer_from_jsonb(v_bonus_filiacao -> 'hpBonus', 0, -999999, 999999)
    )
  );
  v_mp := greatest(
    0,
    least(
      200,
      8 + v_inteligencia
      + public._integer_from_jsonb(v_bonus_raca -> 'mpBonus', 0, -999999, 999999)
      + public._integer_from_jsonb(v_bonus_classe -> 'mpBonus', 0, -999999, 999999)
      + public._integer_from_jsonb(v_bonus_filiacao -> 'mpBonus', 0, -999999, 999999)
    )
  );

  return query select v_hp::integer, v_mp::integer;
end;
$$;

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

  select maxima.hp_max, maxima.mp_max
    into v_hp_max, v_mp_max
  from public._calcular_maximos_recursos_personagem(
    new.id,
    new.dados,
    new.nivel,
    new.campanha_id
  ) maxima;

  v_hp := case
    when jsonb_typeof(new.dados -> 'hp') = 'object' then new.dados -> 'hp'
    else '{}'::jsonb
  end;
  v_mp := case
    when jsonb_typeof(new.dados -> 'mp') = 'object' then new.dados -> 'mp'
    else '{}'::jsonb
  end;
  v_hp := jsonb_set(
    v_hp - 'max',
    '{atual}',
    to_jsonb(public._integer_from_jsonb(v_hp -> 'atual', 0, 0, v_hp_max)),
    true
  );
  v_mp := jsonb_set(
    v_mp - 'max',
    '{atual}',
    to_jsonb(public._integer_from_jsonb(v_mp -> 'atual', 0, 0, v_mp_max)),
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

create or replace function public.incrementar_versao_dados_personagem()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if row(new.dados, new.nome, new.nivel, new.campanha_id)
     is distinct from row(old.dados, old.nome, old.nivel, old.campanha_id) then
    new.dados_version := old.dados_version + 1;
  else
    new.dados_version := old.dados_version;
  end if;
  return new;
end;
$$;

revoke all on function public.aplicar_limites_recursos_personagem() from public;
revoke all on function public.incrementar_versao_dados_personagem() from public;
revoke all on function public._integer_from_jsonb(jsonb, integer, integer, integer) from public;
revoke all on function public._character_rule_key(text) from public;
revoke all on function public._builtin_character_bonus(text, text) from public;
revoke all on function public._calcular_maximos_recursos_personagem(uuid, jsonb, integer, uuid) from public;

do $create_character_triggers$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.personagens'::regclass
      and tgname = 'personagens_incrementar_versao_dados'
      and not tgisinternal
  ) then
    execute 'create trigger personagens_incrementar_versao_dados
      before update of dados, nome, nivel, campanha_id on public.personagens
      for each row execute function public.incrementar_versao_dados_personagem()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.personagens'::regclass
      and tgname = 'personagens_00_limitar_recursos_insert'
      and not tgisinternal
  ) then
    execute 'create trigger personagens_00_limitar_recursos_insert
      before insert on public.personagens
      for each row execute function public.aplicar_limites_recursos_personagem()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.personagens'::regclass
      and tgname = 'personagens_00_limitar_recursos_update'
      and not tgisinternal
  ) then
    execute 'create trigger personagens_00_limitar_recursos_update
      before update of dados, nivel, campanha_id on public.personagens
      for each row execute function public.aplicar_limites_recursos_personagem()';
  end if;
end;
$create_character_triggers$;

-- Reward audit table. It is new according to the remote SQL Editor diagnosis.
create table if not exists public.campanha_recompensas (
  id bigint generated by default as identity primary key,
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  personagem_id uuid references public.personagens(id) on delete set null,
  item_id uuid references public.itens(id) on delete set null,
  tipo text not null check (tipo in ('OURO', 'XP', 'ITEM')),
  quantidade integer not null check (quantidade > 0),
  quantidade_item integer check (quantidade_item is null or quantidade_item > 0),
  total_destinatarios integer not null default 0 check (total_destinatarios >= 0),
  request_id uuid not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (created_by, request_id)
);

create index if not exists campanha_recompensas_campanha_created_idx
  on public.campanha_recompensas (campanha_id, created_at desc);

alter table public.campanha_recompensas enable row level security;
grant select on public.campanha_recompensas to authenticated;

do $create_reward_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'campanha_recompensas'
      and policyname = 'campanha_recompensas_select_membro'
  ) then
    execute $policy$
      create policy "campanha_recompensas_select_membro"
        on public.campanha_recompensas
        for select to authenticated
        using (
          exists (
            select 1 from public.campanha_membros membro
            where membro.campanha_id = campanha_recompensas.campanha_id
              and membro.user_id = auth.uid()
              and membro.status = 'ATIVO'
          )
        )
    $policy$;
  end if;
end;
$create_reward_policy$;

create or replace function public.creditar_ouro_campanha(
  p_campanha_id uuid,
  p_quantia integer,
  p_personagem_id uuid default null,
  p_request_id uuid default gen_random_uuid()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_operation_id bigint;
  v_existing public.campanha_recompensas%rowtype;
  v_personagem record;
  v_dados jsonb;
  v_carteira jsonb;
  v_novo_saldo numeric;
  v_atualizados integer := 0;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if p_quantia is null or p_quantia <= 0 or p_quantia > 100000 then
    raise exception 'A quantia deve estar entre 1 e 100000 PO.';
  end if;
  if not exists (
    select 1 from public.campanha_membros membro
    where membro.campanha_id = p_campanha_id
      and membro.user_id = v_usuario_id
      and membro.papel = 'MESTRE'
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Somente o Mestre ativo pode distribuir ouro.';
  end if;

  insert into public.campanha_recompensas (
    campanha_id, personagem_id, tipo, quantidade, request_id, created_by
  ) values (
    p_campanha_id, p_personagem_id, 'OURO', p_quantia, v_request_id, v_usuario_id
  ) on conflict (created_by, request_id) do nothing
  returning id into v_operation_id;

  if v_operation_id is null then
    select * into v_existing
    from public.campanha_recompensas
    where created_by = v_usuario_id and request_id = v_request_id;
    if not found
      or v_existing.campanha_id <> p_campanha_id
      or v_existing.personagem_id is distinct from p_personagem_id
      or v_existing.tipo <> 'OURO'
      or v_existing.item_id is not null
      or v_existing.quantidade <> p_quantia then
      raise exception 'A chave da recompensa já foi usada com outros dados.';
    end if;
    return v_existing.total_destinatarios;
  end if;

  for v_personagem in
    select personagem.id, personagem.dados
    from public.personagens personagem
    join public.campanha_membros membro
      on membro.campanha_id = personagem.campanha_id
      and membro.user_id = personagem.user_id
      and membro.status = 'ATIVO'
    where personagem.campanha_id = p_campanha_id
      and (p_personagem_id is null or personagem.id = p_personagem_id)
    order by personagem.id
    for update
  loop
    v_dados := coalesce(v_personagem.dados, '{}'::jsonb);
    v_carteira := case
      when jsonb_typeof(v_dados -> 'carteira') = 'object' then v_dados -> 'carteira'
      else '{}'::jsonb
    end;
    v_novo_saldo := coalesce(nullif(v_carteira ->> 'po', '')::numeric, 0) + p_quantia;
    if v_novo_saldo > 9999999 then
      raise exception 'O saldo de % excederia o limite de 9999999 PO.', v_personagem.id;
    end if;
    v_carteira := v_carteira || jsonb_build_object('po', v_novo_saldo);
    v_dados := jsonb_set(v_dados, '{carteira}', v_carteira, true);
    update public.personagens set dados = v_dados where id = v_personagem.id;
    v_atualizados := v_atualizados + 1;
  end loop;

  if p_personagem_id is not null and v_atualizados = 0 then
    raise exception 'Personagem não pertence a esta campanha.';
  end if;
  update public.campanha_recompensas
  set total_destinatarios = v_atualizados
  where id = v_operation_id;
  return v_atualizados;
end;
$$;

create or replace function public.creditar_experiencia_campanha(
  p_campanha_id uuid,
  p_quantia integer,
  p_personagem_id uuid default null,
  p_request_id uuid default gen_random_uuid()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_operation_id bigint;
  v_existing public.campanha_recompensas%rowtype;
  v_personagem record;
  v_novo_xp bigint;
  v_atualizados integer := 0;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if p_quantia is null or p_quantia <= 0 or p_quantia > 2147483647 then
    raise exception 'A quantidade de XP deve ser maior que zero.';
  end if;
  if not exists (
    select 1 from public.campanha_membros membro
    where membro.campanha_id = p_campanha_id
      and membro.user_id = v_usuario_id
      and membro.papel = 'MESTRE'
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Somente o Mestre ativo pode distribuir XP.';
  end if;

  insert into public.campanha_recompensas (
    campanha_id, personagem_id, tipo, quantidade, request_id, created_by
  ) values (
    p_campanha_id, p_personagem_id, 'XP', p_quantia, v_request_id, v_usuario_id
  ) on conflict (created_by, request_id) do nothing
  returning id into v_operation_id;

  if v_operation_id is null then
    select * into v_existing
    from public.campanha_recompensas
    where created_by = v_usuario_id and request_id = v_request_id;
    if not found
      or v_existing.campanha_id <> p_campanha_id
      or v_existing.personagem_id is distinct from p_personagem_id
      or v_existing.tipo <> 'XP'
      or v_existing.item_id is not null
      or v_existing.quantidade <> p_quantia then
      raise exception 'A chave da recompensa já foi usada com outros dados.';
    end if;
    return v_existing.total_destinatarios;
  end if;

  for v_personagem in
    select personagem.id, personagem.xp
    from public.personagens personagem
    join public.campanha_membros membro
      on membro.campanha_id = personagem.campanha_id
      and membro.user_id = personagem.user_id
      and membro.status = 'ATIVO'
    where personagem.campanha_id = p_campanha_id
      and (p_personagem_id is null or personagem.id = p_personagem_id)
    order by personagem.id
    for update
  loop
    v_novo_xp := coalesce(v_personagem.xp, 0)::bigint + p_quantia;
    if v_novo_xp > 2147483647 then
      raise exception 'O XP excederia o limite armazenável para o personagem %.', v_personagem.id;
    end if;
    update public.personagens
    set xp = v_novo_xp::integer
    where id = v_personagem.id;
    v_atualizados := v_atualizados + 1;
  end loop;

  if p_personagem_id is not null and v_atualizados = 0 then
    raise exception 'Personagem não pertence a esta campanha.';
  end if;
  update public.campanha_recompensas
  set total_destinatarios = v_atualizados
  where id = v_operation_id;
  return v_atualizados;
end;
$$;

create or replace function public.entregar_item_campanha(
  p_campanha_id uuid,
  p_item_id uuid,
  p_quantidade integer,
  p_personagem_id uuid default null,
  p_request_id uuid default gen_random_uuid()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_operation_id bigint;
  v_existing public.campanha_recompensas%rowtype;
  v_personagem record;
  v_updated integer;
  v_destinatarios integer := 0;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if p_quantidade is null or p_quantidade <= 0 or p_quantidade > 9999 then
    raise exception 'A quantidade de itens deve estar entre 1 e 9999.';
  end if;
  if not exists (select 1 from public.itens item where item.id = p_item_id) then
    raise exception 'O item selecionado não existe mais.';
  end if;
  if not exists (
    select 1 from public.campanha_membros membro
    where membro.campanha_id = p_campanha_id
      and membro.user_id = v_usuario_id
      and membro.papel = 'MESTRE'
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Somente o Mestre ativo pode entregar itens.';
  end if;

  insert into public.campanha_recompensas (
    campanha_id, personagem_id, item_id, tipo, quantidade, quantidade_item, request_id, created_by
  ) values (
    p_campanha_id, p_personagem_id, p_item_id, 'ITEM', p_quantidade, p_quantidade, v_request_id, v_usuario_id
  ) on conflict (created_by, request_id) do nothing
  returning id into v_operation_id;

  if v_operation_id is null then
    select * into v_existing
    from public.campanha_recompensas
    where created_by = v_usuario_id and request_id = v_request_id;
    if not found
      or v_existing.campanha_id <> p_campanha_id
      or v_existing.personagem_id is distinct from p_personagem_id
      or v_existing.tipo <> 'ITEM'
      or v_existing.item_id is distinct from p_item_id
      or v_existing.quantidade_item <> p_quantidade then
      raise exception 'A chave da recompensa já foi usada com outros dados.';
    end if;
    return v_existing.total_destinatarios;
  end if;

  for v_personagem in
    select personagem.id
    from public.personagens personagem
    join public.campanha_membros membro
      on membro.campanha_id = personagem.campanha_id
      and membro.user_id = personagem.user_id
      and membro.status = 'ATIVO'
    where personagem.campanha_id = p_campanha_id
      and (p_personagem_id is null or personagem.id = p_personagem_id)
    order by personagem.id
    for update
  loop
    update public.inventarios
      set quantidade = quantidade + p_quantidade,
          updated_at = now()
      where personagem_id = v_personagem.id
        and item_id = p_item_id;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      insert into public.inventarios (personagem_id, item_id, quantidade, equipado, updated_at)
      values (v_personagem.id, p_item_id, p_quantidade, false, now());
    end if;
    v_destinatarios := v_destinatarios + 1;
  end loop;

  if p_personagem_id is not null and v_destinatarios = 0 then
    raise exception 'Personagem não pertence a esta campanha.';
  end if;
  update public.campanha_recompensas
  set total_destinatarios = v_destinatarios
  where id = v_operation_id;
  return v_destinatarios;
end;
$$;

create or replace function public.listar_recompensas_campanha(p_campanha_id uuid)
returns setof public.campanha_recompensas
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.campanha_membros membro
    where membro.campanha_id = p_campanha_id
      and membro.user_id = auth.uid()
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Você não participa ativamente desta campanha.';
  end if;
  return query
    select * from public.campanha_recompensas recompensa
    where recompensa.campanha_id = p_campanha_id
    order by recompensa.created_at desc
    limit 30;
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
begin
  if auth.uid() is null or not exists (
    select 1 from public.campanha_membros membro
    where membro.campanha_id = p_campanha_id
      and membro.user_id = auth.uid()
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Você não participa ativamente desta campanha.';
  end if;

  return query
    select
      personagem.id,
      public._integer_from_jsonb(personagem.dados #> '{hp,atual}', 0, 0, maxima.hp_max),
      maxima.hp_max,
      public._integer_from_jsonb(personagem.dados #> '{mp,atual}', 0, 0, maxima.mp_max),
      maxima.mp_max
    from public.personagens personagem
    join public.campanha_membros membro
      on membro.campanha_id = personagem.campanha_id
      and membro.user_id = personagem.user_id
      and membro.status = 'ATIVO'
    cross join lateral public._calcular_maximos_recursos_personagem(
      personagem.id, personagem.dados, personagem.nivel, personagem.campanha_id
    ) maxima
    where personagem.campanha_id = p_campanha_id
    order by personagem.id;
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
  v_maximos record;
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

  select * into v_maximos
  from public._calcular_maximos_recursos_personagem(
    v_personagem.id, v_personagem.dados, v_personagem.nivel, v_personagem.campanha_id
  );
  return jsonb_build_object(
    'dados_version', v_personagem.dados_version,
    'hp_atual', public._integer_from_jsonb(v_personagem.dados #> '{hp,atual}', 0, 0, v_maximos.hp_max),
    'mp_atual', public._integer_from_jsonb(v_personagem.dados #> '{mp,atual}', 0, 0, v_maximos.mp_max),
    'hp_max', v_maximos.hp_max,
    'mp_max', v_maximos.mp_max
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
  v_maximos record;
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

  select * into v_maximos
  from public._calcular_maximos_recursos_personagem(
    v_personagem.id,
    coalesce(v_personagem.dados, '{}'::jsonb),
    v_personagem.nivel,
    v_personagem.campanha_id
  );

  update public.personagens
  set dados = coalesce(v_personagem.dados, '{}'::jsonb)
  where id = p_personagem_id
  returning * into v_personagem;

  return jsonb_build_object(
    'dados_version', v_personagem.dados_version,
    'hp_atual', public._integer_from_jsonb(v_personagem.dados #> '{hp,atual}', 0, 0, v_maximos.hp_max),
    'mp_atual', public._integer_from_jsonb(v_personagem.dados #> '{mp,atual}', 0, 0, v_maximos.mp_max),
    'hp_max', v_maximos.hp_max,
    'mp_max', v_maximos.mp_max
  );
end;
$$;

revoke all on function public.creditar_ouro_campanha(uuid, integer, uuid, uuid) from public;
grant execute on function public.creditar_ouro_campanha(uuid, integer, uuid, uuid) to authenticated;
revoke all on function public.creditar_experiencia_campanha(uuid, integer, uuid, uuid) from public;
grant execute on function public.creditar_experiencia_campanha(uuid, integer, uuid, uuid) to authenticated;
revoke all on function public.entregar_item_campanha(uuid, uuid, integer, uuid, uuid) from public;
grant execute on function public.entregar_item_campanha(uuid, uuid, integer, uuid, uuid) to authenticated;
revoke all on function public.listar_recompensas_campanha(uuid) from public;
grant execute on function public.listar_recompensas_campanha(uuid) to authenticated;
revoke all on function public.listar_maximos_recursos_campanha(uuid) from public;
grant execute on function public.listar_maximos_recursos_campanha(uuid) to authenticated;
revoke all on function public.get_character_resource_maximums(uuid) from public;
grant execute on function public.get_character_resource_maximums(uuid) to authenticated;
revoke all on function public.reconciliar_limites_recursos_personagem(uuid) from public;
grant execute on function public.reconciliar_limites_recursos_personagem(uuid) to authenticated;

notify pgrst, 'reload schema';
