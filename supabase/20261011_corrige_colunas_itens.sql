-- Elementum: alinha as tabelas itens e inventarios com o que o código usa.
-- Seguro para rodar mais de uma vez; não apaga nem altera dados existentes.
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run.

alter table public.itens
  add column if not exists raridade text,
  add column if not exists efeito text,
  add column if not exists imagem_url text,
  add column if not exists bonus_atributos jsonb not null default '{}'::jsonb,
  add column if not exists efeito_mecanico jsonb not null default '{"tipo":"NENHUM"}'::jsonb,
  add column if not exists cargas_maximas integer;

alter table public.inventarios
  add column if not exists equipado boolean not null default false,
  add column if not exists cargas_atuais integer,
  add column if not exists updated_at timestamptz not null default now();

-- Faz o PostgREST (API do Supabase) enxergar as colunas novas imediatamente
notify pgrst, 'reload schema';
