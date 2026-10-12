-- Elementum: Bestiário da campanha + permissões do mapa
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run.
-- Seguro para rodar mais de uma vez. Não apaga dados existentes.

-- 1) Função auxiliar: o usuário logado é Mestre ativo da campanha?
create or replace function public.eh_mestre_da_campanha(p_campanha uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from campanha_membros m
    where m.campanha_id = p_campanha
      and m.user_id = auth.uid()
      and m.papel = 'MESTRE'
      and m.status = 'ATIVO'
  );
$$;

create or replace function public.eh_membro_da_campanha(p_campanha uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from campanha_membros m
    where m.campanha_id = p_campanha
      and m.user_id = auth.uid()
      and m.status = 'ATIVO'
  );
$$;

-- 2) Tabela do Bestiário (por campanha)
create table if not exists public.bestiario (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas(id) on delete cascade,
  nome text not null,
  tipo text not null default 'inimigo' check (tipo in ('inimigo','boss','npc')),
  nivel_ameaca text,
  vida integer check (vida is null or vida >= 0),
  descricao text,
  ataques text,
  fraquezas text,
  visivel boolean not null default false, -- jogadores só veem criaturas reveladas
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

create index if not exists bestiario_campanha_idx on public.bestiario (campanha_id);

alter table public.bestiario enable row level security;

drop policy if exists "bestiario_select" on public.bestiario;
drop policy if exists "bestiario_mestre_insert" on public.bestiario;
drop policy if exists "bestiario_mestre_update" on public.bestiario;
drop policy if exists "bestiario_mestre_delete" on public.bestiario;

create policy "bestiario_select" on public.bestiario
  for select to authenticated
  using (
    public.eh_mestre_da_campanha(campanha_id)
    or (visivel and public.eh_membro_da_campanha(campanha_id))
  );

create policy "bestiario_mestre_insert" on public.bestiario
  for insert to authenticated
  with check (public.eh_mestre_da_campanha(campanha_id));

create policy "bestiario_mestre_update" on public.bestiario
  for update to authenticated
  using (public.eh_mestre_da_campanha(campanha_id))
  with check (public.eh_mestre_da_campanha(campanha_id));

create policy "bestiario_mestre_delete" on public.bestiario
  for delete to authenticated
  using (public.eh_mestre_da_campanha(campanha_id));

-- 3) Marcadores do mapa podem apontar para uma criatura do Bestiário
alter table public.mapa_marcadores
  add column if not exists criatura_id uuid references public.bestiario(id) on delete set null;

-- 4) Políticas do mapa (somam-se às existentes; políticas permissivas funcionam como "OU")
alter table public.mapa_marcadores enable row level security;

drop policy if exists "marcadores_mestre_total" on public.mapa_marcadores;
drop policy if exists "marcadores_jogador_proprio_insert" on public.mapa_marcadores;
drop policy if exists "marcadores_jogador_proprio_update" on public.mapa_marcadores;
drop policy if exists "marcadores_membro_select" on public.mapa_marcadores;

-- Mestre: ler, criar, mover, ocultar e remover qualquer marcador da própria campanha
create policy "marcadores_mestre_total" on public.mapa_marcadores
  for all to authenticated
  using (public.eh_mestre_da_campanha(campanha_id))
  with check (public.eh_mestre_da_campanha(campanha_id));

-- Membros: ler apenas marcadores visíveis
create policy "marcadores_membro_select" on public.mapa_marcadores
  for select to authenticated
  using (visivel and public.eh_membro_da_campanha(campanha_id));

-- Jogador: criar e mover somente o marcador do PRÓPRIO personagem
create policy "marcadores_jogador_proprio_insert" on public.mapa_marcadores
  for insert to authenticated
  with check (
    tipo = 'personagem'
    and public.eh_membro_da_campanha(campanha_id)
    and exists (
      select 1 from personagens p
      where p.id = mapa_marcadores.personagem_id
        and p.user_id = auth.uid()
        and p.campanha_id = mapa_marcadores.campanha_id
    )
  );

create policy "marcadores_jogador_proprio_update" on public.mapa_marcadores
  for update to authenticated
  using (
    tipo = 'personagem'
    and exists (
      select 1 from personagens p
      where p.id = mapa_marcadores.personagem_id and p.user_id = auth.uid()
    )
  )
  with check (
    tipo = 'personagem'
    and exists (
      select 1 from personagens p
      where p.id = mapa_marcadores.personagem_id and p.user_id = auth.uid()
    )
  );

-- 5) Tempo real: jogadores veem o Mestre mover peças sem recarregar
do $$
begin
  alter publication supabase_realtime add table public.mapa_marcadores;
exception when duplicate_object then null;
end $$;
