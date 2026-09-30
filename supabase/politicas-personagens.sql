-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.
--
-- 1) Personagem passa a poder existir sem campanha (vinculado depois pelo código da campanha).
-- 2) Regra: só o dono do personagem ou o Mestre da campanha lê e altera a ficha.
-- 3) Bucket "retratos" para as fotos.

alter table personagens alter column campanha_id drop not null;

alter table personagens enable row level security;

drop policy if exists "personagens_select_dono_ou_mestre" on personagens;
drop policy if exists "personagens_update_dono_ou_mestre" on personagens;
drop policy if exists "personagens_insert_proprio" on personagens;
drop policy if exists "personagens_delete_dono" on personagens;

create policy "personagens_select_dono_ou_mestre"
  on personagens
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from campanha_membros m
      where m.campanha_id = personagens.campanha_id
        and m.user_id = auth.uid()
        and m.papel = 'MESTRE'
        and m.status = 'ATIVO'
    )
  );

-- O dono só pode colocar o personagem em campanha da qual participa (ou deixá-lo sem campanha).
create policy "personagens_insert_proprio"
  on personagens
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      campanha_id is null
      or exists (
        select 1
        from campanha_membros m
        where m.campanha_id = personagens.campanha_id
          and m.user_id = auth.uid()
          and m.status = 'ATIVO'
      )
    )
  );

create policy "personagens_update_dono_ou_mestre"
  on personagens
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from campanha_membros m
      where m.campanha_id = personagens.campanha_id
        and m.user_id = auth.uid()
        and m.papel = 'MESTRE'
        and m.status = 'ATIVO'
    )
  )
  with check (
    (
      user_id = auth.uid()
      and (
        campanha_id is null
        or exists (
          select 1
          from campanha_membros m
          where m.campanha_id = personagens.campanha_id
            and m.user_id = auth.uid()
            and m.status = 'ATIVO'
        )
      )
    )
    or exists (
      select 1
      from campanha_membros m
      where m.campanha_id = personagens.campanha_id
        and m.user_id = auth.uid()
        and m.papel = 'MESTRE'
        and m.status = 'ATIVO'
    )
  );

-- Só o dono pode excluir o próprio personagem.
create policy "personagens_delete_dono"
  on personagens
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Fotos dos personagens (leitura pública; envio só na própria pasta).
insert into storage.buckets (id, name, public)
values ('retratos', 'retratos', true)
on conflict (id) do nothing;

drop policy if exists "retratos_leitura_publica" on storage.objects;
drop policy if exists "retratos_envio_proprio" on storage.objects;

create policy "retratos_leitura_publica"
  on storage.objects
  for select
  using (bucket_id = 'retratos');

create policy "retratos_envio_proprio"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'retratos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
