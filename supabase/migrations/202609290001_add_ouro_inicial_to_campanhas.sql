alter table public.campanhas
  add column if not exists ouro_inicial integer not null default 1250
  check (ouro_inicial >= 0);