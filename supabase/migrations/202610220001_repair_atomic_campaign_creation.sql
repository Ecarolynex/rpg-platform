
begin;

-- 1. Criar a tabela de idempotência, caso ainda não exista.
create table if not exists public.campanha_criacoes (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id),
  unique (campanha_id)
);

alter table public.campanha_criacoes enable row level security;

revoke all on table public.campanha_criacoes
from public, anon, authenticated;

-- 2. Remover apenas a assinatura incompatível de sete parâmetros
-- que recebe p_request_id como texto e retorna void.
drop function if exists public.criar_campanha_atomica(
  text, text, text, text, integer, text, text
);

-- 3. Criar a versão compatível com src/services/api.ts.
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

  if nullif(trim(p_nome), '') is null
     or length(trim(p_nome)) > 100 then
    raise exception
      'O nome da campanha é obrigatório e deve ter até 100 caracteres.';
  end if;

  if p_ouro_inicial is null
     or p_ouro_inicial < 0
     or p_ouro_inicial > 100000 then
    raise exception
      'O ouro inicial deve estar entre 0 e 100000 PO.';
  end if;

  if p_codigo_convite is null
     or p_codigo_convite !~ '^[A-Z0-9]{6}$' then
    raise exception 'Código de convite inválido.';
  end if;

  -- Serializar tentativas da mesma operação pelo mesmo usuário.
  perform pg_advisory_xact_lock(
    hashtextextended(
      v_usuario_id::text || ':' || p_request_id::text,
      0
    )
  );

  -- Se a operação já foi concluída, devolver a mesma campanha.
  select c.*
    into v_campanha
  from public.campanha_criacoes cc
  join public.campanhas c
    on c.id = cc.campanha_id
  where cc.user_id = v_usuario_id
    and cc.request_id = p_request_id;

  if found then
    return to_jsonb(v_campanha);
  end if;

  -- Criar a campanha.
  insert into public.campanhas (
    nome,
    descricao,
    sistema,
    moeda_principal,
    ouro_inicial,
    codigo_convite,
    created_by,
    status,
    request_id
  )
  values (
    trim(p_nome),
    nullif(trim(p_descricao), ''),
    nullif(trim(p_sistema), ''),
    nullif(trim(p_moeda_principal), ''),
    p_ouro_inicial,
    p_codigo_convite,
    v_usuario_id,
    'ATIVA',
    p_request_id
  )
  returning * into v_campanha;

  -- Vincular o criador como Mestre.
  insert into public.campanha_membros (
    campanha_id,
    user_id,
    papel,
    status
  )
  values (
    v_campanha.id,
    v_usuario_id,
    'MESTRE',
    'ATIVO'
  )
  on conflict (campanha_id, user_id)
  do update set
    papel = 'MESTRE',
    status = 'ATIVO';

  -- Registrar a moeda principal, sem duplicá-la.
  if nullif(trim(v_campanha.moeda_principal), '') is not null then
    insert into public.moedas (
      campanha_id,
      nome,
      simbolo,
      ordem
    )
    values (
      v_campanha.id,
      v_campanha.moeda_principal,
      null,
      0
    )
    on conflict (campanha_id, nome) do nothing;
  end if;

  -- Registrar a chave somente após concluir os passos anteriores.
  insert into public.campanha_criacoes (
    user_id,
    request_id,
    campanha_id
  )
  values (
    v_usuario_id,
    p_request_id,
    v_campanha.id
  );

  return to_jsonb(v_campanha);
end;
$$;

-- 4. Restringir a execução e conceder acesso ao usuário autenticado.
revoke all on function public.criar_campanha_atomica(
  text, text, text, text, integer, text, uuid
) from public, anon;

grant execute on function public.criar_campanha_atomica(
  text, text, text, text, integer, text, uuid
) to authenticated;

notify pgrst, 'reload schema';

commit;
