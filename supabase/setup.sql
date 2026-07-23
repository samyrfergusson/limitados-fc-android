-- ============================================================
-- Limitados F.C — configuracao do Supabase (PASSOS 2 e 3)
-- Onde rodar: painel do Supabase -> SQL Editor -> New query
--             cole TUDO isto e clique em "Run".
-- Pode rodar mais de uma vez sem problema (e idempotente).
-- ============================================================

-- ---------- PASSO 2: onde os dados moram ----------
-- O app inteiro vive num unico documento JSON (id = 1).
create table if not exists public.grupo (
  id         integer primary key,
  dados      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.grupo (id, dados)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- Diretoria: quem pode editar. TROQUE pelos e-mails reais!
create table if not exists public.admins (
  email text primary key
);

insert into public.admins (email) values
  ('samyr@email.com'),      -- <<< troque pelo seu e-mail
  ('marcelo@email.com')     -- <<< troque pelo e-mail do Marcelo
on conflict (email) do nothing;

-- ---------- PASSO 3: seguranca (RLS) ----------
-- Regra: todo mundo logado LE; so a diretoria ESCREVE.
alter table public.grupo  enable row level security;
alter table public.admins enable row level security;

drop policy if exists "grupo_read"  on public.grupo;
drop policy if exists "grupo_write" on public.grupo;
drop policy if exists "admins_read" on public.admins;

create policy "grupo_read" on public.grupo
  for select to authenticated using (true);

create policy "grupo_write" on public.grupo
  for update to authenticated
  using      (exists (select 1 from public.admins a where a.email = auth.email()))
  with check (exists (select 1 from public.admins a where a.email = auth.email()));

create policy "admins_read" on public.admins
  for select to authenticated using (true);

-- Privilegios de tabela (necessarios para a API automatica do Supabase)
grant select on public.grupo  to authenticated;
grant update on public.grupo  to authenticated;
grant select on public.admins to authenticated;

-- ---------- Tempo real: avisa os clientes quando o documento muda ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'grupo'
  ) then
    alter publication supabase_realtime add table public.grupo;
  end if;
end $$;

-- ---------- Auto-cadastro do jogador (1o acesso) ----------
-- Permite que um jogador comum se cadastre UMA vez no elenco. A funcao roda
-- com privilegio elevado (security definer), mas valida no servidor:
--   * forca o e-mail do proprio login (auth.email()) -- ninguem se cadastra por outro;
--   * recusa se ja existir jogador com aquele e-mail -- cria so uma vez;
-- Depois disso, editar so via update do grupo (admin). Sem politica de UPDATE
-- para o jogador, ele nao consegue mais alterar a propria ficha.
create or replace function public.self_register_player(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uemail text := auth.email();
begin
  if uemail is null then
    raise exception 'Nao autenticado.';
  end if;

  -- ja possui ficha? (procura o e-mail dentro do JSON de players)
  if exists (
    select 1
    from public.grupo g,
         jsonb_array_elements(coalesce(g.dados->'players', '[]'::jsonb)) as p
    where g.id = 1 and lower(p->>'email') = lower(uemail)
  ) then
    raise exception 'Voce ja possui cadastro.';
  end if;

  -- adiciona o jogador, SEMPRE forcando o e-mail do login
  update public.grupo
    set dados = jsonb_set(
          coalesce(dados, '{}'::jsonb),
          '{players}',
          coalesce(dados->'players', '[]'::jsonb)
            || jsonb_build_array(payload || jsonb_build_object('email', uemail))
        ),
        updated_at = now()
    where id = 1;
end;
$$;

grant execute on function public.self_register_player(jsonb) to authenticated;

-- Pronto. Depois disso: preencha src/config.js com a URL e a chave anon,
-- rode o app, entre com um e-mail da diretoria e ele configura o grupo sozinho.
