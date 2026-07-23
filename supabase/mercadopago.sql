-- ============================================================
-- Mercado Pago — tabela de cobrancas (rode no SQL Editor)
-- Guarda cada cobranca PIX gerada, pra conciliar quando o MP avisar.
-- So as Edge Functions (service_role) acessam; por isso RLS ligado e sem policies.
-- ============================================================
create table if not exists public.cobrancas (
  payment_id         text primary key,   -- id do pagamento no Mercado Pago
  player_id          text,               -- id do jogador no elenco
  competencia        text,               -- mes de referencia (YYYY-MM)
  valor              numeric,            -- valor cobrado
  external_reference text,               -- "playerId|competencia"
  status             text,               -- approved | pending | rejected ...
  applied            boolean not null default false, -- baixa ja aplicada?
  created_at         timestamptz not null default now()
);

alter table public.cobrancas enable row level security;
-- Sem policies de propósito: nem anon nem authenticated acessam direto.
-- As Edge Functions usam a service_role key, que ignora o RLS.
