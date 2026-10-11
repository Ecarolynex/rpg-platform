-- Campaign row, creator membership, and retry idempotency commit as one transaction.
create table if not exists public.campanha_criacoes (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id),
  unique (campanha_id)
);

alter table public.campanha_criacoes enable row level security;
revoke all on public.campanha_criacoes from anon, authenticated;

create or replace function public.criar_campanha_atomica(
  p_nome text,
  p_descricao text,
  p_sistema text,
  p_moeda_principal text,
  p_ouro_inicial integer,
  p_codigo_convite text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_campanha public.campanhas%rowtype;
begin
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if p_request_id is null then
    raise exception 'Chave da operação obrigatória.';
  end if;
  if nullif(trim(p_nome), '') is null or length(trim(p_nome)) > 100 then
    raise exception 'O nome da campanha é obrigatório e deve ter até 100 caracteres.';
  end if;
  if p_ouro_inicial is null or p_ouro_inicial < 0 or p_ouro_inicial > 100000 then
    raise exception 'O ouro inicial deve estar entre 0 e 100000 PO.';
  end if;
  if p_codigo_convite !~ '^[A-Z0-9]{6}$' then
    raise exception 'Código de convite inválido.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_usuario_id::text || ':' || p_request_id::text, 0));
  select campanha.* into v_campanha
  from public.campanha_criacoes criacao
  join public.campanhas campanha on campanha.id = criacao.campanha_id
  where criacao.user_id = v_usuario_id and criacao.request_id = p_request_id;
  if found then
    return to_jsonb(v_campanha);
  end if;

  insert into public.campanhas (
    nome, descricao, sistema, moeda_principal, ouro_inicial,
    codigo_convite, created_by, status
  ) values (
    trim(p_nome), nullif(trim(p_descricao), ''), nullif(trim(p_sistema), ''),
    nullif(trim(p_moeda_principal), ''), p_ouro_inicial,
    p_codigo_convite, v_usuario_id, 'ATIVA'
  ) returning * into v_campanha;

  insert into public.campanha_membros (campanha_id, user_id, papel, status)
  values (v_campanha.id, v_usuario_id, 'MESTRE', 'ATIVO');

  insert into public.campanha_criacoes (user_id, request_id, campanha_id)
  values (v_usuario_id, p_request_id, v_campanha.id);

  return to_jsonb(v_campanha);
end;
$$;

revoke all on function public.criar_campanha_atomica(text, text, text, text, integer, text, uuid) from public;
grant execute on function public.criar_campanha_atomica(text, text, text, text, integer, text, uuid) to authenticated;

notify pgrst, 'reload schema';
