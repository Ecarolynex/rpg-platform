-- Enforce campaign membership, hidden-marker visibility, and marker ownership in RLS.
alter table public.mapa_marcadores enable row level security;
revoke all on public.mapa_marcadores from anon, authenticated;
grant select, insert, delete on public.mapa_marcadores to authenticated;
grant update (pos_x, pos_y) on public.mapa_marcadores to authenticated;

-- The permissive policy provides the normal grant; this restrictive policy also
-- intersects with any older permissive policies already deployed remotely.
drop policy if exists "mapa_marcadores_select_active_member" on public.mapa_marcadores;
create policy "mapa_marcadores_select_active_member"
  on public.mapa_marcadores
  for select to authenticated
  using (
    exists (
      select 1 from public.campanha_membros membro
      where membro.campanha_id = mapa_marcadores.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
    )
  );
drop policy if exists "mapa_marcadores_select_visibility_guard" on public.mapa_marcadores;
create policy "mapa_marcadores_select_visibility_guard"
  on public.mapa_marcadores
  as restrictive
  for select to authenticated
  using (
    exists (
      select 1 from public.campanha_membros membro
      where membro.campanha_id = mapa_marcadores.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
        and (
          membro.papel = 'MESTRE'
          or mapa_marcadores.visivel = true
        )
    )
  );

drop policy if exists "mapa_marcadores_insert_authorized" on public.mapa_marcadores;
create policy "mapa_marcadores_insert_authorized"
  on public.mapa_marcadores
  for insert to authenticated
  with check (
    criado_por = auth.uid()
    and exists (
      select 1 from public.campanha_membros membro
      where membro.campanha_id = mapa_marcadores.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
        and (
          membro.papel = 'MESTRE'
          or (
            mapa_marcadores.tipo = 'personagem'
            and mapa_marcadores.visivel = true
            and exists (
              select 1 from public.personagens personagem
              where personagem.id = mapa_marcadores.personagem_id
                and personagem.user_id = auth.uid()
                and personagem.campanha_id = mapa_marcadores.campanha_id
            )
          )
        )
    )
  );
drop policy if exists "mapa_marcadores_insert_role_guard" on public.mapa_marcadores;
create policy "mapa_marcadores_insert_role_guard"
  on public.mapa_marcadores
  as restrictive
  for insert to authenticated
  with check (
    criado_por = auth.uid()
    and exists (
      select 1 from public.campanha_membros membro
      where membro.campanha_id = mapa_marcadores.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
        and (
          membro.papel = 'MESTRE'
          or (
            mapa_marcadores.tipo = 'personagem'
            and mapa_marcadores.visivel = true
            and exists (
              select 1 from public.personagens personagem
              where personagem.id = mapa_marcadores.personagem_id
                and personagem.user_id = auth.uid()
                and personagem.campanha_id = mapa_marcadores.campanha_id
            )
          )
        )
    )
  );

drop policy if exists "mapa_marcadores_update_owner_or_master" on public.mapa_marcadores;
create policy "mapa_marcadores_update_owner_or_master"
  on public.mapa_marcadores
  for update to authenticated
  using (
    exists (
      select 1 from public.campanha_membros membro
      where membro.campanha_id = mapa_marcadores.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
        and (
          membro.papel = 'MESTRE'
          or (
            mapa_marcadores.tipo = 'personagem'
            and exists (
              select 1 from public.personagens personagem
              where personagem.id = mapa_marcadores.personagem_id
                and personagem.user_id = auth.uid()
                and personagem.campanha_id = mapa_marcadores.campanha_id
            )
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.campanha_membros membro
      where membro.campanha_id = mapa_marcadores.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
        and (
          membro.papel = 'MESTRE'
          or (
            mapa_marcadores.tipo = 'personagem'
            and exists (
              select 1 from public.personagens personagem
              where personagem.id = mapa_marcadores.personagem_id
                and personagem.user_id = auth.uid()
                and personagem.campanha_id = mapa_marcadores.campanha_id
            )
          )
        )
    )
  );
drop policy if exists "mapa_marcadores_update_role_guard" on public.mapa_marcadores;
create policy "mapa_marcadores_update_role_guard"
  on public.mapa_marcadores
  as restrictive
  for update to authenticated
  using (
    exists (
      select 1 from public.campanha_membros membro
      where membro.campanha_id = mapa_marcadores.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
        and (
          membro.papel = 'MESTRE'
          or (
            mapa_marcadores.tipo = 'personagem'
            and exists (
              select 1 from public.personagens personagem
              where personagem.id = mapa_marcadores.personagem_id
                and personagem.user_id = auth.uid()
                and personagem.campanha_id = mapa_marcadores.campanha_id
            )
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.campanha_membros membro
      where membro.campanha_id = mapa_marcadores.campanha_id
        and membro.user_id = auth.uid()
        and membro.status = 'ATIVO'
        and (
          membro.papel = 'MESTRE'
          or (
            mapa_marcadores.tipo = 'personagem'
            and exists (
              select 1 from public.personagens personagem
              where personagem.id = mapa_marcadores.personagem_id
                and personagem.user_id = auth.uid()
                and personagem.campanha_id = mapa_marcadores.campanha_id
            )
          )
        )
    )
  );

drop policy if exists "mapa_marcadores_delete_master" on public.mapa_marcadores;
create policy "mapa_marcadores_delete_master"
  on public.mapa_marcadores
  for delete to authenticated
  using (
    exists (
      select 1 from public.campanha_membros membro
      where membro.campanha_id = mapa_marcadores.campanha_id
        and membro.user_id = auth.uid()
        and membro.papel = 'MESTRE'
        and membro.status = 'ATIVO'
    )
  );
drop policy if exists "mapa_marcadores_delete_role_guard" on public.mapa_marcadores;
create policy "mapa_marcadores_delete_role_guard"
  on public.mapa_marcadores
  as restrictive
  for delete to authenticated
  using (
    exists (
      select 1 from public.campanha_membros membro
      where membro.campanha_id = mapa_marcadores.campanha_id
        and membro.user_id = auth.uid()
        and membro.papel = 'MESTRE'
        and membro.status = 'ATIVO'
    )
  );

notify pgrst, 'reload schema';
