-- Migração para consolidar registrar_compra e registrar_compra_carrinho
-- Garante consistência total entre Loja, Carteira, Inventário e Ficha

create or replace function public.registrar_compra(
  p_personagem_id uuid,
  p_loja_item_id uuid,
  p_quantidade integer default 1
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
  v_item_loja record;
  v_quantidade integer := coalesce(p_quantidade, 1);
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if v_quantidade <= 0 then
    raise exception 'Quantidade inválida para compra.';
  end if;

  -- 1. Validar personagem e travar registro para concorrência
  select personagem.user_id, personagem.campanha_id, coalesce(personagem.dados, '{}'::jsonb)
    into v_dono_id, v_campanha_id, v_dados
  from public.personagens personagem
  where personagem.id = p_personagem_id
  for update;

  if not found then
    raise exception 'Personagem não encontrado.';
  end if;

  -- 2. Validar campanha
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

  -- Permissão: dono ou Mestre
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

  -- 3. Validar item da loja e estoque
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
  where loja_item.id = p_loja_item_id
  for update of loja_item;

  if not found then
    raise exception 'Item não pertence a uma loja ativa.';
  end if;

  if v_item_loja.ativa is distinct from true
    or v_item_loja.item_ativo is distinct from true
    or v_item_loja.campanha_id <> v_campanha_id then
    raise exception 'O item não pertence à campanha do personagem.';
  end if;

  if v_item_loja.estoque < v_quantidade then
    raise exception 'Estoque insuficiente para o item.';
  end if;

  if v_item_loja.preco_compra < 0 then
    raise exception 'Preço inválido.';
  end if;

  v_total := v_item_loja.preco_compra * v_quantidade;

  -- 4. Validar saldo da carteira (PO)
  v_carteira := coalesce(v_dados -> 'carteira', '{}'::jsonb);
  v_saldo := coalesce(nullif(v_carteira ->> 'po', '')::numeric, 0);

  if v_saldo < v_total then
    raise exception 'O personagem não possui ouro suficiente (% PO necessários, % PO disponíveis).', v_total, v_saldo;
  end if;

  -- 5. Atualizar estoque da loja
  update public.loja_itens
    set estoque = estoque - v_quantidade
  where id = p_loja_item_id
    and estoque >= v_quantidade;

  if not found then
    raise exception 'O estoque mudou durante a compra. Tente novamente.';
  end if;

  -- 6. Inserir ou incrementar no inventário persistido
  update public.inventarios
    set quantidade = quantidade + v_quantidade,
        updated_at = now()
  where personagem_id = p_personagem_id
    and item_id = v_item_loja.item_id;

  if not found then
    insert into public.inventarios (personagem_id, item_id, quantidade, equipado, updated_at)
    values (p_personagem_id, v_item_loja.item_id, v_quantidade, false, now());
  end if;

  -- 7. Descontar moedas da carteira
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

revoke all on function public.registrar_compra(uuid, uuid, integer) from public;
grant execute on function public.registrar_compra(uuid, uuid, integer) to authenticated;

notify pgrst, 'reload schema';

