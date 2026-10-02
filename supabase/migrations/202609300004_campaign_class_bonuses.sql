alter table public.campanhas
  add column if not exists bonus_classes jsonb not null default '{}'::jsonb
  check (jsonb_typeof(bonus_classes) = 'object');

drop policy if exists "campanhas_update_mestre" on public.campanhas;

create policy "campanhas_update_mestre"
  on public.campanhas
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.campanha_membros membro
      where membro.campanha_id = campanhas.id
        and membro.user_id = auth.uid()
        and membro.papel = 'MESTRE'
        and membro.status = 'ATIVO'
    )
  )
  with check (
    exists (
      select 1
      from public.campanha_membros membro
      where membro.campanha_id = campanhas.id
        and membro.user_id = auth.uid()
        and membro.papel = 'MESTRE'
        and membro.status = 'ATIVO'
    )
  );
