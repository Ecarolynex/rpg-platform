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
      imagem_url,
      created_by
    )
    values (
      trim(p_nome),
      nullif(trim(p_descricao), ''),
      p_tipo,
      p_raridade,
      nullif(trim(p_efeito), ''),
      nullif(p_imagem_url, ''),
      v_usuario_id
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

notify pgrst, 'reload schema';