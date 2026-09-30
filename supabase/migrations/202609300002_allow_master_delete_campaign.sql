drop policy if exists "campanhas_delete_mestre" on public.campanhas;

create policy "campanhas_delete_mestre"
  on public.campanhas
  for delete
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
  );