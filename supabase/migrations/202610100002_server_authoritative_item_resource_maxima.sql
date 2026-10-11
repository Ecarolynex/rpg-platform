-- Resource caps for item use are derived from persisted character and rules data.
-- The legacy p_hp_max/p_mp_max arguments remain optional and ignored so old
-- clients can continue calling the existing four-argument RPC safely.

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
    -- The frontend falls back to built-in bonuses when the catalog is absent
    -- or does not contain this class, even when other global classes exist.
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

revoke all on function public.aplicar_limites_recursos_personagem() from public;
drop trigger if exists personagens_limitar_recursos_insert on public.personagens;
drop trigger if exists personagens_limitar_recursos_update on public.personagens;
drop trigger if exists personagens_00_limitar_recursos_insert on public.personagens;
create trigger personagens_00_limitar_recursos_insert
  before insert on public.personagens
  for each row execute function public.aplicar_limites_recursos_personagem();
drop trigger if exists personagens_00_limitar_recursos_update on public.personagens;
create trigger personagens_00_limitar_recursos_update
  before update of dados, nivel, campanha_id on public.personagens
  for each row execute function public.aplicar_limites_recursos_personagem();

revoke all on function public._integer_from_jsonb(jsonb, integer, integer, integer) from public;
revoke all on function public._character_rule_key(text) from public;
revoke all on function public._builtin_character_bonus(text, text) from public;
revoke all on function public._calcular_maximos_recursos_personagem(uuid, jsonb, integer, uuid) from public;

create or replace function public.usar_item_personagem(
  p_personagem_id uuid,
  p_item_id uuid,
  p_hp_max integer default null,
  p_mp_max integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_personagem public.personagens%rowtype;
  v_inventario public.inventarios%rowtype;
  v_item public.itens%rowtype;
  v_campanha_id uuid;
  v_dados jsonb;
  v_recurso jsonb;
  v_cargas integer;
  v_quantidade integer;
  v_novo_valor integer;
  v_maximo integer;
  v_hp_max integer;
  v_mp_max integer;
  v_delta integer;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select * into v_personagem
  from public.personagens
  where id = p_personagem_id
  for update;
  if not found then
    raise exception 'Personagem não encontrado.';
  end if;
  v_campanha_id := v_personagem.campanha_id;

  if v_personagem.user_id is distinct from v_usuario_id and not exists (
    select 1 from public.campanha_membros membro
    where membro.campanha_id = v_campanha_id
      and membro.user_id = v_usuario_id
      and membro.papel = 'MESTRE'
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Você não pode usar itens deste personagem.';
  end if;

  -- Serialize equipped-item changes against the authoritative equipment bonuses.
  perform inventario.item_id
  from public.inventarios inventario
  where inventario.personagem_id = p_personagem_id
  order by inventario.item_id
  for update;

  select * into v_inventario
  from public.inventarios
  where personagem_id = p_personagem_id and item_id = p_item_id
  for update;
  if not found or v_inventario.quantidade <= 0 then
    raise exception 'Item não encontrado no inventário.';
  end if;

  select * into v_item from public.itens where id = p_item_id;
  if not found then
    raise exception 'Definição do item não encontrada.';
  end if;
  if v_item.tipo is distinct from 'CONSUMIVEL' and v_item.cargas_maximas is null then
    raise exception 'Este item não pode ser consumido.';
  end if;

  select maxima.hp_max, maxima.mp_max
    into v_hp_max, v_mp_max
  from public._calcular_maximos_recursos_personagem(
    p_personagem_id,
    coalesce(v_personagem.dados, '{}'::jsonb),
    v_personagem.nivel,
    v_campanha_id
  ) maxima;

  v_dados := coalesce(v_personagem.dados, '{}'::jsonb);
  v_delta := public._integer_from_jsonb(
    v_item.efeito_mecanico -> 'valor', 0, -999999, 999999
  );
  if v_item.efeito_mecanico ->> 'tipo' = 'RECURSO' then
    if v_item.efeito_mecanico ->> 'recurso' not in ('hp', 'mp') then
      raise exception 'O recurso deste item é inválido.';
    end if;

    if v_item.efeito_mecanico ->> 'recurso' = 'hp' then
      v_recurso := case
        when jsonb_typeof(v_dados -> 'hp') = 'object' then v_dados -> 'hp'
        else '{}'::jsonb
      end;
      v_maximo := v_hp_max;
    else
      v_recurso := case
        when jsonb_typeof(v_dados -> 'mp') = 'object' then v_dados -> 'mp'
        else '{}'::jsonb
      end;
      v_maximo := v_mp_max;
    end if;

    v_novo_valor := greatest(
      0,
      least(
        v_maximo,
        public._integer_from_jsonb(v_recurso -> 'atual', 0, 0, 200)
          + greatest(v_delta, 0)
      )
    );
    v_recurso := jsonb_set(v_recurso, '{atual}', to_jsonb(v_novo_valor), true);
    if v_item.efeito_mecanico ->> 'recurso' = 'hp' then
      v_dados := jsonb_set(v_dados, '{hp}', v_recurso, true);
    else
      v_dados := jsonb_set(v_dados, '{mp}', v_recurso, true);
    end if;
  end if;

  if v_item.cargas_maximas is not null then
    v_cargas := coalesce(
      v_inventario.cargas_atuais,
      v_item.cargas_maximas * v_inventario.quantidade
    );
    if v_cargas <= 0 then
      raise exception 'Este item está sem cargas.';
    end if;
    v_cargas := v_cargas - 1;
    v_quantidade := least(
      v_inventario.quantidade,
      ceil(v_cargas::numeric / v_item.cargas_maximas)::integer
    );
    if v_quantidade <= 0 then
      delete from public.inventarios
      where personagem_id = p_personagem_id and item_id = p_item_id;
    else
      update public.inventarios
      set quantidade = v_quantidade,
          cargas_atuais = v_cargas,
          updated_at = now()
      where personagem_id = p_personagem_id and item_id = p_item_id;
    end if;
  elsif v_item.tipo = 'CONSUMIVEL' then
    v_quantidade := v_inventario.quantidade - 1;
    if v_quantidade <= 0 then
      delete from public.inventarios
      where personagem_id = p_personagem_id and item_id = p_item_id;
    else
      update public.inventarios
      set quantidade = v_quantidade,
          updated_at = now()
      where personagem_id = p_personagem_id and item_id = p_item_id;
    end if;
  end if;

  update public.personagens
  set dados = v_dados
  where id = p_personagem_id;

  return jsonb_build_object(
    'personagem_id', p_personagem_id,
    'hp', v_dados -> 'hp',
    'mp', v_dados -> 'mp',
    'quantidade', greatest(0, v_quantidade),
    'hp_max', v_hp_max,
    'mp_max', v_mp_max
  );
end;
$$;

-- Retain the four-argument PostgreSQL identity for rolling client deployments.
-- p_hp_max and p_mp_max are accepted for compatibility and never consulted.
revoke all on function public.usar_item_personagem(uuid, uuid, integer, integer) from public;
grant execute on function public.usar_item_personagem(uuid, uuid, integer, integer) to authenticated;
comment on function public.usar_item_personagem(uuid, uuid, integer, integer) is
  'Consumes an item atomically and derives HP/MP maxima from persisted rules; legacy maximum arguments are ignored.';

-- The global catalog determines server-enforced resource caps; only explicitly
-- provisioned trusted operators may change it through the authenticated client.
drop policy if exists "global_class_catalog_write_authenticated"
  on public.global_class_catalog;
create policy "global_class_catalog_write_trusted_admin"
  on public.global_class_catalog
  for all to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'global_rules_admin', 'false') = 'true'
  )
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'global_rules_admin', 'false') = 'true'
  );

notify pgrst, 'reload schema';
