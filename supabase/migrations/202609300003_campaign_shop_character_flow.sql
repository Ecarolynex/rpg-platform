drop policy if exists "personagens_select_dono_ou_mestre" on public.personagens;
drop policy if exists "personagens_select_membro_ativo" on public.personagens;

create policy "personagens_select_membro_ativo"
  on public.personagens
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.campanha_membros membro
      where membro.campanha_id = personagens.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
    )
  );

alter table public.inventarios enable row level security;
drop policy if exists "inventarios_select_membro_ativo" on public.inventarios;

create policy "inventarios_select_membro_ativo"
  on public.inventarios
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.personagens personagem
      where personagem.id = inventarios.personagem_id
        and (
          personagem.user_id = auth.uid()
          or exists (
            select 1
            from public.campanha_membros membro
            where membro.campanha_id = personagem.campanha_id
              and membro.user_id = auth.uid()
              and membro.status = 'ATIVO'
          )
        )
    )
  );

alter table public.inventarios
  add column if not exists equipado boolean not null default false;

alter table public.lojas enable row level security;
drop policy if exists "lojas_select_membro_ativo" on public.lojas;
create policy "lojas_select_membro_ativo"
  on public.lojas
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.campanha_membros membro
      where membro.campanha_id = lojas.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
    )
  );

alter table public.loja_itens enable row level security;
drop policy if exists "loja_itens_select_membro_ativo" on public.loja_itens;
create policy "loja_itens_select_membro_ativo"
  on public.loja_itens
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.lojas loja
      join public.campanha_membros membro
        on membro.campanha_id = loja.campanha_id
      where loja.id = loja_itens.loja_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
    )
  );

alter table public.itens enable row level security;
drop policy if exists "itens_select_authenticated" on public.itens;
create policy "itens_select_authenticated"
  on public.itens
  for select
  to authenticated
  using (true);

create or replace function public.registrar_compra_carrinho(
  p_personagem_id uuid,
  p_itens jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_dono_id uuid;
  v_campanha_id uuid;
  v_dados jsonb;
  v_carteira jsonb;
  v_saldo numeric;
  v_novo_saldo numeric;
  v_total numeric := 0;
  v_linha record;
  v_item_loja record;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if jsonb_typeof(p_itens) is distinct from 'array'
    or jsonb_array_length(p_itens) = 0 then
    raise exception 'O carrinho está vazio.';
  end if;

  select personagem.user_id, personagem.campanha_id, coalesce(personagem.dados, '{}'::jsonb)
    into v_dono_id, v_campanha_id, v_dados
  from public.personagens personagem
  where personagem.id = p_personagem_id
  for update;

  if not found then
    raise exception 'Personagem não encontrado.';
  end if;

  if v_campanha_id is null then
    raise exception 'O personagem não está vinculado a uma campanha.';
  end if;

  if not exists (
    select 1
    from public.campanha_membros membro
    where membro.campanha_id = v_campanha_id
      and membro.user_id = v_usuario_id
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Você não participa ativamente desta campanha.';
  end if;

  if v_dono_id <> v_usuario_id and not exists (
    select 1
    from public.campanha_membros membro
    where membro.campanha_id = v_campanha_id
      and membro.user_id = v_usuario_id
      and membro.papel = 'MESTRE'
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Você só pode comprar para seu personagem.';
  end if;

  v_carteira := coalesce(v_dados -> 'carteira', '{}'::jsonb);
  v_saldo := coalesce(nullif(v_carteira ->> 'po', '')::numeric, 0);

  for v_linha in
    select linha.loja_item_id, sum(linha.quantidade)::integer as quantidade
    from jsonb_to_recordset(p_itens) as linha(loja_item_id uuid, quantidade integer)
    group by linha.loja_item_id
    order by linha.loja_item_id
  loop
    if v_linha.loja_item_id is null or v_linha.quantidade is null or v_linha.quantidade <= 0 then
      raise exception 'O carrinho contém uma quantidade inválida.';
    end if;

    select
      loja_item.item_id,
      loja_item.preco_compra,
      loja_item.estoque,
      loja_item.ativo as item_ativo,
      loja.ativa,
      loja.campanha_id
    into v_item_loja
    from public.loja_itens loja_item
    join public.lojas loja on loja.id = loja_item.loja_id
    where loja_item.id = v_linha.loja_item_id
    for update of loja_item;

    if not found then
      raise exception 'Um dos itens não pertence a uma loja ativa.';
    end if;

    if v_item_loja.ativa is distinct from true
      or v_item_loja.item_ativo is distinct from true
      or v_item_loja.campanha_id <> v_campanha_id then
      raise exception 'O item não pertence à campanha do personagem.';
    end if;

    if v_item_loja.estoque < v_linha.quantidade then
      raise exception 'Estoque insuficiente para um dos itens.';
    end if;

    if v_item_loja.preco_compra < 0 then
      raise exception 'O preço do item é inválido.';
    end if;

    v_total := v_total + v_item_loja.preco_compra * v_linha.quantidade;
  end loop;

  if v_saldo < v_total then
    raise exception 'O personagem não tem ouro suficiente.';
  end if;

  for v_linha in
    select linha.loja_item_id, sum(linha.quantidade)::integer as quantidade
    from jsonb_to_recordset(p_itens) as linha(loja_item_id uuid, quantidade integer)
    group by linha.loja_item_id
    order by linha.loja_item_id
  loop
    select loja_item.item_id
      into v_item_loja
    from public.loja_itens loja_item
    where loja_item.id = v_linha.loja_item_id;

    update public.loja_itens
      set estoque = estoque - v_linha.quantidade
    where id = v_linha.loja_item_id
      and estoque >= v_linha.quantidade;

    if not found then
      raise exception 'O estoque mudou durante a compra. Tente novamente.';
    end if;

    update public.inventarios
      set quantidade = quantidade + v_linha.quantidade,
          updated_at = now()
    where personagem_id = p_personagem_id
      and item_id = v_item_loja.item_id;

    if not found then
      insert into public.inventarios (personagem_id, item_id, quantidade, updated_at)
      values (p_personagem_id, v_item_loja.item_id, v_linha.quantidade, now());
    end if;
  end loop;

  v_novo_saldo := v_saldo - v_total;
  v_carteira := v_carteira || jsonb_build_object('po', v_novo_saldo);
  v_dados := jsonb_set(v_dados, '{carteira}', v_carteira, true);

  update public.personagens
    set dados = v_dados
  where id = p_personagem_id;

  return jsonb_build_object(
    'personagem_id', p_personagem_id,
    'saldo_po', v_novo_saldo,
    'total_gasto', v_total
  );
end;
$$;

revoke all on function public.registrar_compra_carrinho(uuid, jsonb) from public;
grant execute on function public.registrar_compra_carrinho(uuid, jsonb) to authenticated;

create or replace function public.alterar_item_equipado(
  p_personagem_id uuid,
  p_item_id uuid,
  p_equipado boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_dono_id uuid;
  v_campanha_id uuid;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select personagem.user_id, personagem.campanha_id
    into v_dono_id, v_campanha_id
  from public.personagens personagem
  where personagem.id = p_personagem_id;

  if not found then
    raise exception 'Personagem não encontrado.';
  end if;

  if v_dono_id <> v_usuario_id and not exists (
    select 1
    from public.campanha_membros membro
    where membro.campanha_id = v_campanha_id
      and membro.user_id = v_usuario_id
      and membro.papel = 'MESTRE'
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Você não pode alterar os equipamentos deste personagem.';
  end if;

  update public.inventarios
    set equipado = p_equipado,
        updated_at = now()
  where personagem_id = p_personagem_id
    and item_id = p_item_id;

  if not found then
    raise exception 'Item não encontrado no inventário deste personagem.';
  end if;

  return true;
end;
$$;

revoke all on function public.alterar_item_equipado(uuid, uuid, boolean) from public;
grant execute on function public.alterar_item_equipado(uuid, uuid, boolean) to authenticated;

create or replace function public.salvar_item_loja(
  p_campanha_id uuid,
  p_loja_item_id uuid,
  p_nome text,
  p_descricao text,
  p_tipo text,
  p_raridade text,
  p_efeito text,
  p_imagem_url text,
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
  v_usuario_id uuid := auth.uid();
  v_loja_id uuid;
  v_item_id uuid;
  v_loja_item_id uuid;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not exists (
    select 1
    from public.campanha_membros membro
    where membro.campanha_id = p_campanha_id
      and membro.user_id = v_usuario_id
      and membro.papel = 'MESTRE'
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Somente o Mestre ativo pode administrar a loja.';
  end if;

  if nullif(trim(p_nome), '') is null or p_preco_compra < 0 or p_estoque < 0 then
    raise exception 'Nome, preço e estoque do item são inválidos.';
  end if;

  select loja.id
    into v_loja_id
  from public.lojas loja
  where loja.campanha_id = p_campanha_id
    and loja.ativa = true
  order by loja.id
  limit 1
  for update;

  if not found then
    insert into public.lojas (campanha_id, nome, ativa)
    select campanha.id, campanha.nome, true
    from public.campanhas campanha
    where campanha.id = p_campanha_id
    returning id into v_loja_id;

    if not found then
      raise exception 'Campanha não encontrada.';
    end if;
  end if;

  if p_loja_item_id is not null then
    select loja_item.item_id
      into v_item_id
    from public.loja_itens loja_item
    where loja_item.id = p_loja_item_id
      and loja_item.loja_id = v_loja_id
    for update;

    if not found then
      raise exception 'O item não pertence à loja desta campanha.';
    end if;

    update public.itens
      set nome = trim(p_nome),
          descricao = nullif(trim(p_descricao), ''),
          tipo = p_tipo,
          raridade = p_raridade,
          efeito = nullif(trim(p_efeito), ''),
          imagem_url = nullif(p_imagem_url, '')
    where id = v_item_id;

    update public.loja_itens
      set preco_compra = p_preco_compra,
          estoque = p_estoque,
          ativo = p_ativo
    where id = p_loja_item_id;

    v_loja_item_id := p_loja_item_id;
  else
    insert into public.itens (
      nome,
      descricao,
      tipo,
      raridade,
      efeito,
      imagem_url
    )
    values (
      trim(p_nome),
      nullif(trim(p_descricao), ''),
      p_tipo,
      p_raridade,
      nullif(trim(p_efeito), ''),
      nullif(p_imagem_url, '')
    )
    returning id into v_item_id;

    insert into public.loja_itens (
      loja_id,
      item_id,
      preco_compra,
      estoque,
      venda_permitida,
      ativo
    )
    values (
      v_loja_id,
      v_item_id,
      p_preco_compra,
      p_estoque,
      true,
      p_ativo
    )
    returning id into v_loja_item_id;
  end if;

  return jsonb_build_object(
    'loja_id', v_loja_id,
    'loja_item_id', v_loja_item_id,
    'item_id', v_item_id
  );
end;
$$;

revoke all on function public.salvar_item_loja(uuid, uuid, text, text, text, text, text, text, numeric, integer, boolean) from public;
grant execute on function public.salvar_item_loja(uuid, uuid, text, text, text, text, text, text, numeric, integer, boolean) to authenticated;

create or replace function public.adicionar_item_existente_loja(
  p_campanha_id uuid,
  p_item_id uuid,
  p_preco_compra numeric,
  p_estoque integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_loja_id uuid;
  v_loja_item_id uuid;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not exists (
    select 1
    from public.campanha_membros membro
    where membro.campanha_id = p_campanha_id
      and membro.user_id = v_usuario_id
      and membro.papel = 'MESTRE'
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Somente o Mestre ativo pode administrar a loja.';
  end if;

  if p_preco_compra < 0 or p_estoque < 0 then
    raise exception 'Preço e estoque devem ser positivos ou zero.';
  end if;

  if not exists (select 1 from public.itens item where item.id = p_item_id) then
    raise exception 'A carta não existe mais no catálogo.';
  end if;

  select loja.id
    into v_loja_id
  from public.lojas loja
  where loja.campanha_id = p_campanha_id
    and loja.ativa = true
  order by loja.id
  limit 1
  for update;

  if not found then
    insert into public.lojas (campanha_id, nome, ativa)
    select campanha.id, campanha.nome, true
    from public.campanhas campanha
    where campanha.id = p_campanha_id
    returning id into v_loja_id;

    if not found then
      raise exception 'Campanha não encontrada.';
    end if;
  end if;

  select loja_item.id
    into v_loja_item_id
  from public.loja_itens loja_item
  where loja_item.loja_id = v_loja_id
    and loja_item.item_id = p_item_id
  for update;

  if found then
    update public.loja_itens
      set preco_compra = p_preco_compra,
          estoque = p_estoque,
          ativo = true
    where id = v_loja_item_id;
  else
    insert into public.loja_itens (
      loja_id,
      item_id,
      preco_compra,
      estoque,
      venda_permitida,
      ativo
    )
    values (
      v_loja_id,
      p_item_id,
      p_preco_compra,
      p_estoque,
      true,
      true
    )
    returning id into v_loja_item_id;
  end if;

  return v_loja_item_id;
end;
$$;

revoke all on function public.adicionar_item_existente_loja(uuid, uuid, numeric, integer) from public;
grant execute on function public.adicionar_item_existente_loja(uuid, uuid, numeric, integer) to authenticated;

create or replace function public.remover_item_loja(
  p_campanha_id uuid,
  p_loja_item_id uuid
)
returns boolean
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
    select 1
    from public.campanha_membros membro
    where membro.campanha_id = p_campanha_id
      and membro.user_id = v_usuario_id
      and membro.papel = 'MESTRE'
      and membro.status = 'ATIVO'
  ) then
    raise exception 'Somente o Mestre ativo pode administrar a loja.';
  end if;

  delete from public.loja_itens loja_item
  using public.lojas loja
  where loja_item.id = p_loja_item_id
    and loja_item.loja_id = loja.id
    and loja.campanha_id = p_campanha_id;

  if not found then
    raise exception 'A carta não pertence à loja desta campanha.';
  end if;

  return true;
end;
$$;

revoke all on function public.remover_item_loja(uuid, uuid) from public;
grant execute on function public.remover_item_loja(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';