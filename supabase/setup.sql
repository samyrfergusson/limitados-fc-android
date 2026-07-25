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

-- ---------- Jogador ajusta o proprio X1 (drible) UMA vez ----------
-- Valida o e-mail do login, altera SO o campo atr.dri do proprio jogador e
-- marca x1Set=true. Se ja foi ajustado, recusa. Admin edita sem restricao.
create or replace function public.set_my_x1(valor int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uemail   text := auth.email();
  arr      jsonb;
  el       jsonb;
  newarr   jsonb := '[]'::jsonb;
  matched  boolean := false;
begin
  if uemail is null then raise exception 'Nao autenticado.'; end if;
  if valor is null or valor < 1 or valor > 99 then raise exception 'Valor invalido (1 a 99).'; end if;

  select dados->'players' into arr from public.grupo where id = 1;
  if arr is null then raise exception 'Grupo sem elenco.'; end if;

  for el in select * from jsonb_array_elements(arr) loop
    if lower(el->>'email') = lower(uemail) then
      if coalesce((el->>'x1Set')::boolean, false) then
        raise exception 'Voce ja ajustou seu X1.';
      end if;
      el := jsonb_set(el, '{atr}', coalesce(el->'atr', '{}'::jsonb));
      el := jsonb_set(el, '{atr,dri}', to_jsonb(valor));
      el := jsonb_set(el, '{x1Set}', 'true'::jsonb);
      matched := true;
    end if;
    newarr := newarr || jsonb_build_array(el);
  end loop;

  if not matched then raise exception 'Voce ainda nao tem ficha no elenco.'; end if;

  update public.grupo set dados = jsonb_set(dados, '{players}', newarr), updated_at = now() where id = 1;
end;
$$;

grant execute on function public.set_my_x1(int) to authenticated;

-- ---------- Presidente & Estrela da Patota ----------
-- Papel na diretoria: 'presidente' tem poderes exclusivos (nem outros admins).
alter table public.admins add column if not exists role text not null default 'admin';
-- >>> MARQUE O PRESIDENTE (troque pelo e-mail real):
-- update public.admins set role = 'presidente' where email = 'presidente@exemplo.com';

-- Só o presidente promove/remove a "Estrela da Patota".
create or replace function public.set_estrela(player_id text, estrela boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uemail  text := auth.email();
  arr     jsonb;
  el      jsonb;
  newarr  jsonb := '[]'::jsonb;
  matched boolean := false;
begin
  if uemail is null then raise exception 'Nao autenticado.'; end if;
  if not exists (
    select 1 from public.admins where lower(email) = lower(uemail) and role = 'presidente'
  ) then
    raise exception 'Apenas o presidente pode alterar a Estrela da Patota.';
  end if;

  select dados->'players' into arr from public.grupo where id = 1;
  if arr is null then raise exception 'Grupo sem elenco.'; end if;

  for el in select * from jsonb_array_elements(arr) loop
    if el->>'id' = player_id then
      el := jsonb_set(el, '{estrela}', to_jsonb(estrela));
      matched := true;
    end if;
    newarr := newarr || jsonb_build_array(el);
  end loop;

  if not matched then raise exception 'Jogador nao encontrado.'; end if;

  update public.grupo set dados = jsonb_set(dados, '{players}', newarr), updated_at = now() where id = 1;
end;
$$;

grant execute on function public.set_estrela(text, boolean) to authenticated;

-- Pronto. Depois disso: preencha src/config.js com a URL e a chave anon,
-- rode o app, entre com um e-mail da diretoria e ele configura o grupo sozinho.
