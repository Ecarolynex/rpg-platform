-- Optimistic concurrency for the character JSON contract. This migration is
-- additive; legacy JSON remains readable until the client next saves it as V1.

alter table public.personagens
  add column if not exists dados_version bigint not null default 1;

-- Typed item rules replace runtime parsing of the display-only `efeito` text.
alter table public.itens
  add column if not exists bonus_atributos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(bonus_atributos) = 'object'),
  add column if not exists efeito_mecanico jsonb not null default '{"tipo":"NENHUM"}'::jsonb
    check (jsonb_typeof(efeito_mecanico) = 'object'),
  add column if not exists cargas_maximas integer
    check (cargas_maximas is null or cargas_maximas > 0);

alter table public.inventarios
  add column if not exists cargas_atuais integer
    check (cargas_atuais is null or cargas_atuais >= 0);

create or replace function public.inicializar_cargas_inventario()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_cargas_maximas integer;
begin
  select cargas_maximas into v_cargas_maximas
  from public.itens where id = new.item_id;
  if v_cargas_maximas is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.cargas_atuais is null then
      new.cargas_atuais := v_cargas_maximas * new.quantidade;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.quantidade > old.quantidade then
      new.cargas_atuais := coalesce(old.cargas_atuais, 0) +
        (new.quantidade - old.quantidade) * v_cargas_maximas;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists inventarios_inicializar_cargas on public.inventarios;
create trigger inventarios_inicializar_cargas
  before insert or update on public.inventarios
  for each row execute function public.inicializar_cargas_inventario();

update public.inventarios inventario
set cargas_atuais = item.cargas_maximas * inventario.quantidade
from public.itens item
where item.id = inventario.item_id
  and item.cargas_maximas is not null
  and inventario.cargas_atuais is null;

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

drop trigger if exists personagens_incrementar_versao_dados
  on public.personagens;
create trigger personagens_incrementar_versao_dados
  before update of dados, nome, nivel, campanha_id on public.personagens
  for each row execute function public.incrementar_versao_dados_personagem();

create or replace function public.atualizar_personagem_versionado(
  p_personagem_id uuid,
  p_versao_esperada bigint,
  p_nome text,
  p_nivel integer,
  p_dados jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_personagem public.personagens%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if p_versao_esperada is null or p_nivel < 1 or nullif(trim(p_nome), '') is null
     or jsonb_typeof(p_dados) is distinct from 'object'
     or p_dados ->> 'schemaVersion' is distinct from '1' then
    raise exception 'Contrato da ficha inválido.';
  end if;

  select * into v_personagem
  from public.personagens
  where id = p_personagem_id
  for update;

  if not found then
    raise exception 'Personagem não encontrado ou sem permissão.';
  end if;
  if v_personagem.dados_version <> p_versao_esperada then
    raise exception 'A ficha foi alterada por outra operação. Recarregue antes de salvar.';
  end if;

  update public.personagens
  set nome = trim(p_nome), nivel = p_nivel, dados = p_dados
  where id = p_personagem_id
  returning * into v_personagem;

  if not found then
    raise exception 'Personagem não encontrado ou sem permissão para editar.';
  end if;

  return jsonb_build_object(
    'id', v_personagem.id,
    'campanha_id', v_personagem.campanha_id,
    'nome', v_personagem.nome,
    'nivel', v_personagem.nivel,
    'xp', v_personagem.xp,
    'dados', v_personagem.dados,
    'dados_version', v_personagem.dados_version
  );
end;
$$;

create or replace function public.vincular_personagem_campanha(
  p_personagem_id uuid,
  p_campanha_id uuid,
  p_versao_esperada bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_personagem public.personagens%rowtype;
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
    raise exception 'Você precisa participar ativamente da campanha para vincular um personagem.';
  end if;

  select * into v_personagem
  from public.personagens
  where id = p_personagem_id and user_id = v_usuario_id
  for update;

  if not found then
    raise exception 'Personagem não encontrado ou sem permissão.';
  end if;

  -- Repeated requests for the same link are safe and do not touch ficha/carteira.
  if v_personagem.campanha_id = p_campanha_id then
    return jsonb_build_object(
      'id', v_personagem.id,
      'campanha_id', v_personagem.campanha_id,
      'nome', v_personagem.nome,
      'nivel', v_personagem.nivel,
      'xp', v_personagem.xp,
      'dados', v_personagem.dados,
      'dados_version', v_personagem.dados_version
    );
  end if;
  if v_personagem.campanha_id is not null then
    raise exception 'Este personagem já está em outra campanha.';
  end if;
  if v_personagem.dados_version <> p_versao_esperada then
    raise exception 'A ficha foi alterada por outra operação. Recarregue antes de vincular.';
  end if;

  update public.personagens
  set campanha_id = p_campanha_id
  where id = p_personagem_id
  returning * into v_personagem;

  if not found then
    raise exception 'Personagem não encontrado ou sem permissão para vincular.';
  end if;

  return jsonb_build_object(
    'id', v_personagem.id,
    'campanha_id', v_personagem.campanha_id,
    'nome', v_personagem.nome,
    'nivel', v_personagem.nivel,
    'xp', v_personagem.xp,
    'dados', v_personagem.dados,
    'dados_version', v_personagem.dados_version
  );
end;
$$;

revoke all on function public.atualizar_personagem_versionado(uuid, bigint, text, integer, jsonb) from public;
grant execute on function public.atualizar_personagem_versionado(uuid, bigint, text, integer, jsonb) to authenticated;
revoke all on function public.vincular_personagem_campanha(uuid, uuid, bigint) from public;
grant execute on function public.vincular_personagem_campanha(uuid, uuid, bigint) to authenticated;

create or replace function public.creditar_ouro_campanha(
  p_campanha_id uuid,
  p_quantia integer,
  p_personagem_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_personagem record;
  v_dados jsonb;
  v_carteira jsonb;
  v_novo_saldo numeric;
  v_atualizados integer := 0;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if p_quantia <= 0 or p_quantia > 100000 then
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

  for v_personagem in
    select personagem.id, personagem.dados
    from public.personagens personagem
    where personagem.campanha_id = p_campanha_id
      and (p_personagem_id is null or personagem.id = p_personagem_id)
    order by personagem.id
    for update
  loop
    v_dados := coalesce(v_personagem.dados, '{}'::jsonb);
    v_carteira := coalesce(v_dados -> 'carteira', '{}'::jsonb);
    v_novo_saldo := least(
      9999999,
      coalesce(nullif(v_carteira ->> 'po', '')::numeric, 0) + p_quantia
    );
    v_carteira := v_carteira || jsonb_build_object('po', v_novo_saldo);
    v_dados := jsonb_set(v_dados, '{carteira}', v_carteira, true);
    update public.personagens set dados = v_dados where id = v_personagem.id;
    v_atualizados := v_atualizados + 1;
  end loop;

  if p_personagem_id is not null and v_atualizados = 0 then
    raise exception 'Personagem não pertence a esta campanha.';
  end if;
  return v_atualizados;
end;
$$;

create or replace function public.salvar_item_loja(
  p_campanha_id uuid,
  p_loja_item_id uuid,
  p_nome text,
  p_descricao text,
  p_tipo text,
  p_raridade text,
  p_efeito text,
  p_imagem_url text,
  p_bonus_atributos jsonb,
  p_efeito_mecanico jsonb,
  p_cargas_maximas integer,
  p_preco_compra numeric,
  p_estoque integer,
  p_ativo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_resultado jsonb;
  v_item_id uuid;
  v_bonus jsonb := coalesce(p_bonus_atributos, '{}'::jsonb);
  v_efeito jsonb := coalesce(p_efeito_mecanico, '{"tipo":"NENHUM"}'::jsonb);
  v_bonus_entry record;
begin
  if jsonb_typeof(v_bonus) is distinct from 'object'
     or jsonb_typeof(v_efeito) is distinct from 'object'
     or (p_cargas_maximas is not null and p_cargas_maximas <= 0) then
    raise exception 'Os dados mecânicos do item são inválidos.';
  end if;
  if v_efeito ->> 'tipo' not in ('ATRIBUTO', 'RECURSO', 'NENHUM') then
    raise exception 'Tipo de efeito mecânico inválido.';
  end if;
  for v_bonus_entry in select key, value from jsonb_each(v_bonus) loop
    if v_bonus_entry.key not in ('forca', 'destreza', 'constituicao', 'inteligencia', 'carisma')
       or jsonb_typeof(v_bonus_entry.value) is distinct from 'number' then
      raise exception 'Bônus de atributo inválido.';
    end if;
  end loop;
  if v_efeito ->> 'tipo' = 'ATRIBUTO' and (
       v_efeito ->> 'atributo' not in ('forca', 'destreza', 'constituicao', 'inteligencia', 'carisma')
       or jsonb_typeof(v_efeito -> 'valor') is distinct from 'number'
     ) then
    raise exception 'Efeito de atributo inválido.';
  end if;
  if v_efeito ->> 'tipo' = 'RECURSO' and (
       v_efeito ->> 'recurso' not in ('hp', 'mp')
       or jsonb_typeof(v_efeito -> 'valor') is distinct from 'number'
       or (v_efeito ->> 'valor')::integer <= 0
     ) then
    raise exception 'Efeito de recurso inválido.';
  end if;

  v_resultado := public.salvar_item_loja(
    p_campanha_id, p_loja_item_id, p_nome, p_descricao, p_tipo,
    p_raridade, p_efeito, p_imagem_url, p_preco_compra, p_estoque, p_ativo
  );
  v_item_id := (v_resultado ->> 'item_id')::uuid;

  update public.itens
  set bonus_atributos = v_bonus,
      efeito_mecanico = v_efeito,
      cargas_maximas = p_cargas_maximas
  where id = v_item_id;

  return v_resultado;
end;
$$;

create or replace function public.usar_item_personagem(
  p_personagem_id uuid,
  p_item_id uuid,
  p_hp_max integer,
  p_mp_max integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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
  v_delta integer;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if coalesce(p_hp_max, -1) < 0 or p_hp_max > 200
     or coalesce(p_mp_max, -1) < 0 or p_mp_max > 200 then
    raise exception 'Máximo de recurso inválido.';
  end if;

  select * into v_personagem from public.personagens
  where id = p_personagem_id for update;
  if not found then raise exception 'Personagem não encontrado.'; end if;
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

  select * into v_inventario from public.inventarios
  where personagem_id = p_personagem_id and item_id = p_item_id
  for update;
  if not found or v_inventario.quantidade <= 0 then
    raise exception 'Item não encontrado no inventário.';
  end if;
  select * into v_item from public.itens where id = p_item_id;
  if not found then raise exception 'Definição do item não encontrada.'; end if;
  if v_item.tipo <> 'CONSUMIVEL' and v_item.cargas_maximas is null then
    raise exception 'Este item não pode ser consumido.';
  end if;

  v_dados := coalesce(v_personagem.dados, '{}'::jsonb);
  v_delta := coalesce(nullif(v_item.efeito_mecanico ->> 'valor', '')::integer, 0);
  if v_item.efeito_mecanico ->> 'tipo' = 'RECURSO' then
    if v_item.efeito_mecanico ->> 'recurso' not in ('hp', 'mp') then
      raise exception 'O recurso deste item é inválido.';
    end if;
    if v_item.efeito_mecanico ->> 'recurso' = 'hp' then
      v_recurso := coalesce(v_dados -> 'hp', '{}'::jsonb);
      v_maximo := p_hp_max;
    else
      v_recurso := coalesce(v_dados -> 'mp', '{}'::jsonb);
      v_maximo := p_mp_max;
    end if;
    v_novo_valor := greatest(0, least(v_maximo, coalesce(nullif(v_recurso ->> 'atual', '')::integer, 0) + greatest(v_delta, 0)));
    v_recurso := jsonb_set(v_recurso, '{atual}', to_jsonb(v_novo_valor), true);
    if v_item.efeito_mecanico ->> 'recurso' = 'hp' then
      v_dados := jsonb_set(v_dados, '{hp}', v_recurso, true);
    else
      v_dados := jsonb_set(v_dados, '{mp}', v_recurso, true);
    end if;
  end if;

  if v_item.cargas_maximas is not null then
    v_cargas := coalesce(v_inventario.cargas_atuais, v_item.cargas_maximas * v_inventario.quantidade);
    if v_cargas <= 0 then raise exception 'Este item está sem cargas.'; end if;
    v_cargas := v_cargas - 1;
    v_quantidade := least(v_inventario.quantidade, ceil(v_cargas::numeric / v_item.cargas_maximas)::integer);
    if v_quantidade <= 0 then
      delete from public.inventarios where personagem_id = p_personagem_id and item_id = p_item_id;
    else
      update public.inventarios
      set quantidade = v_quantidade, cargas_atuais = v_cargas, updated_at = now()
      where personagem_id = p_personagem_id and item_id = p_item_id;
    end if;
  elsif v_item.tipo = 'CONSUMIVEL' then
    v_quantidade := v_inventario.quantidade - 1;
    if v_quantidade <= 0 then
      delete from public.inventarios where personagem_id = p_personagem_id and item_id = p_item_id;
    else
      update public.inventarios
      set quantidade = v_quantidade, updated_at = now()
      where personagem_id = p_personagem_id and item_id = p_item_id;
    end if;
  end if;

  update public.personagens set dados = v_dados where id = p_personagem_id;
  return jsonb_build_object(
    'personagem_id', p_personagem_id,
    'hp', v_dados -> 'hp',
    'mp', v_dados -> 'mp',
    'quantidade', greatest(0, v_quantidade)
  );
end;
$$;

revoke all on function public.salvar_item_loja(uuid, uuid, text, text, text, text, text, text, jsonb, jsonb, integer, numeric, integer, boolean) from public;
grant execute on function public.salvar_item_loja(uuid, uuid, text, text, text, text, text, text, jsonb, jsonb, integer, numeric, integer, boolean) to authenticated;
revoke all on function public.usar_item_personagem(uuid, uuid, integer, integer) from public;
grant execute on function public.usar_item_personagem(uuid, uuid, integer, integer) to authenticated;
revoke all on function public.creditar_ouro_campanha(uuid, integer, uuid) from public;
grant execute on function public.creditar_ouro_campanha(uuid, integer, uuid) to authenticated;



-- Campaign custom content administration belongs to active Masters.
drop policy if exists "campanha_classes_conteudos_insert_membro" on public.campanha_classes_conteudos;
drop policy if exists "campanha_classes_conteudos_insert_mestre" on public.campanha_classes_conteudos;
create policy "campanha_classes_conteudos_insert_mestre"
  on public.campanha_classes_conteudos
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.campanha_membros membro
      where membro.campanha_id = campanha_classes_conteudos.campanha_id
        and membro.user_id = auth.uid()
        and membro.papel = 'MESTRE'
        and membro.status = 'ATIVO'
    )
  );
drop policy if exists "campanha_classes_conteudos_delete_membro" on public.campanha_classes_conteudos;
create policy "campanha_classes_conteudos_delete_mestre"
  on public.campanha_classes_conteudos
  for delete to authenticated
  using (
    exists (
      select 1 from public.campanha_membros membro
      where membro.campanha_id = campanha_classes_conteudos.campanha_id
        and membro.user_id = auth.uid()
        and membro.papel = 'MESTRE'
        and membro.status = 'ATIVO'
    )
  );

notify pgrst, 'reload schema';
