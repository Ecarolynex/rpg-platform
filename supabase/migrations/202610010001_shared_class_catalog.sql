create table if not exists public.global_class_catalog (
  id text primary key check (id = 'global'),
  dados jsonb not null default '[]'::jsonb
    check (jsonb_typeof(dados) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.global_class_catalog enable row level security;
grant select, insert, update, delete on public.global_class_catalog to authenticated;

drop policy if exists "global_class_catalog_select_authenticated"
  on public.global_class_catalog;
create policy "global_class_catalog_select_authenticated"
  on public.global_class_catalog
  for select to authenticated
  using (true);

drop policy if exists "global_class_catalog_write_authenticated"
  on public.global_class_catalog;
create policy "global_class_catalog_write_authenticated"
  on public.global_class_catalog
  for all to authenticated
  using (true)
  with check (true);

create table if not exists public.campanha_classes_conteudos (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  classe_id text not null,
  tipo text not null check (tipo in ('CLASSE', 'PERICIA', 'HABILIDADE')),
  nome text not null check (length(trim(nome)) between 1 and 100),
  descricao text not null default '',
  atributo text check (
    atributo is null or atributo in (
      'forca', 'destreza', 'constituicao', 'inteligencia', 'carisma'
    )
  ),
  nivel integer check (nivel is null or nivel between 1 and 20),
  bonus_atributos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(bonus_atributos) = 'object'),
  bonus_hp integer not null default 0,
  bonus_mp integer not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (tipo != 'PERICIA' or atributo is not null),
  check (tipo != 'HABILIDADE' or nivel is not null)
);

create index if not exists campanha_classes_conteudos_campanha_idx
  on public.campanha_classes_conteudos (campanha_id, classe_id, tipo);

alter table public.campanha_classes_conteudos enable row level security;
grant select, insert, delete on public.campanha_classes_conteudos to authenticated;

drop policy if exists "campanha_classes_conteudos_select_membro"
  on public.campanha_classes_conteudos;
create policy "campanha_classes_conteudos_select_membro"
  on public.campanha_classes_conteudos
  for select to authenticated
  using (
    exists (
      select 1
      from public.campanha_membros membro
      where membro.campanha_id = campanha_classes_conteudos.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
    )
  );

drop policy if exists "campanha_classes_conteudos_insert_membro"
  on public.campanha_classes_conteudos;
create policy "campanha_classes_conteudos_insert_membro"
  on public.campanha_classes_conteudos
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.campanha_membros membro
      where membro.campanha_id = campanha_classes_conteudos.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
    )
  );

drop policy if exists "campanha_classes_conteudos_delete_membro"
  on public.campanha_classes_conteudos;
create policy "campanha_classes_conteudos_delete_membro"
  on public.campanha_classes_conteudos
  for delete to authenticated
  using (
    exists (
      select 1
      from public.campanha_membros membro
      where membro.campanha_id = campanha_classes_conteudos.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
    )
  );
