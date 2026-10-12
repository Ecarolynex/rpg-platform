begin;

alter table public.inventarios
    add column if not exists comentario_pessoal text;

create or replace function public.salvar_comentario_inventario(
    p_personagem_id uuid,
    p_item_id uuid,
    p_comentario text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_usuario_id uuid := auth.uid();
    v_dono_id uuid;
    v_campanha_id uuid;
    v_comentario text;
begin
    if v_usuario_id is null then
        raise exception 'Usuário não autenticado.';
    end if;

    v_comentario := nullif(btrim(p_comentario), '');

    if length(v_comentario) > 2000 then
        raise exception 'O comentário deve ter no máximo 2000 caracteres.';
    end if;

    select p.user_id, p.campanha_id
      into v_dono_id, v_campanha_id
    from public.personagens p
    where p.id = p_personagem_id;

    if not found then
        raise exception 'Personagem não encontrado.';
    end if;

    if v_dono_id is distinct from v_usuario_id
       and not exists (
           select 1
           from public.campanha_membros m
           where m.campanha_id = v_campanha_id
             and m.user_id = v_usuario_id
             and m.papel = 'MESTRE'
             and m.status = 'ATIVO'
       ) then
        raise exception 'Você não pode alterar este inventário.';
    end if;

    update public.inventarios
       set comentario_pessoal = v_comentario,
           updated_at = now()
     where personagem_id = p_personagem_id
       and item_id = p_item_id;

    if not found then
        raise exception 'Item não encontrado no inventário.';
    end if;

    return true;
end;
$function$;

create or replace function public.excluir_item_inventario(
    p_personagem_id uuid,
    p_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_usuario_id uuid := auth.uid();
    v_dono_id uuid;
    v_campanha_id uuid;
begin
    if v_usuario_id is null then
        raise exception 'Usuário não autenticado.';
    end if;

    select p.user_id, p.campanha_id
      into v_dono_id, v_campanha_id
    from public.personagens p
    where p.id = p_personagem_id;

    if not found then
        raise exception 'Personagem não encontrado.';
    end if;

    if v_dono_id is distinct from v_usuario_id
       and not exists (
           select 1
           from public.campanha_membros m
           where m.campanha_id = v_campanha_id
             and m.user_id = v_usuario_id
             and m.papel = 'MESTRE'
             and m.status = 'ATIVO'
       ) then
        raise exception 'Você não pode excluir itens deste inventário.';
    end if;

    delete from public.inventarios
    where personagem_id = p_personagem_id
      and item_id = p_item_id;

    if not found then
        raise exception 'Item não encontrado no inventário.';
    end if;

    return true;
end;
$function$;

revoke all on function public.salvar_comentario_inventario(uuid, uuid, text)
    from public, anon;
revoke all on function public.excluir_item_inventario(uuid, uuid)
    from public, anon;

grant execute on function public.salvar_comentario_inventario(uuid, uuid, text)
    to authenticated;
grant execute on function public.excluir_item_inventario(uuid, uuid)
    to authenticated;

commit;