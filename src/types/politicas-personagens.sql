-- Rode no Supabase: SQL Editor > New query > cole tudo > Run.
-- Regra: só o dono do personagem ou o Mestre da campanha pode ler e alterar a ficha.

alter table personagens enable row level security;

drop policy if exists "personagens_select_dono_ou_mestre" on personagens;
drop policy if exists "personagens_update_dono_ou_mestre" on personagens;

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

-- Fotos dos personagens (bucket público para leitura; envio só na própria pasta).
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
