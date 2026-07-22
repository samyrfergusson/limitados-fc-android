# Ligar o app ao Supabase (servidor + dados compartilhados)

Objetivo: sair dos dados "no celular de cada um" para **dados compartilhados**
em tempo real, com a diretoria editando e os integrantes só vendo.

Custo: **R$ 0**, sem cartão de crédito. Só precisa de 1 conta no Supabase.

---

## Passo 1 — Criar o projeto (voce faz, ~5 min)
1. Acesse https://supabase.com e crie a conta (e-mail ou GitHub).
2. "New project": nome `limitados-fc`, defina uma senha de banco (guarde),
   e escolha a regiao **South America (Sao Paulo)**.
3. Espere ~2 min o projeto ficar pronto.

## Passo 2 e 3 — Tabelas + seguranca (voce faz, ~2 min)
1. No menu lateral: **SQL Editor -> New query**.
2. Abra o arquivo `supabase/setup.sql` deste projeto, copie TUDO e cole la.
3. **Troque os dois e-mails** de exemplo pelos seus (voce e o Marcelo).
4. Clique em **Run**. Pronto: cria as tabelas, as permissoes e o tempo real.

## Passo 4 — Pegar as chaves (voce faz, ~1 min)
1. Menu **Project Settings -> API**.
2. Copie **Project URL** e a chave **anon public**.
3. Cole as duas em `src/config.js`, no lugar dos valores de exemplo.

## Passo 5 — App ja adaptado (feito)
O app ja conversa com o Supabase: login por link no e-mail, carga dos dados,
tempo real, e papeis (diretoria edita / consulta so ve). Nada a fazer aqui.

## Passo 6 — Rodar / publicar
- Testar no PC:
  ```bash
  npm install
  npm run dev
  ```
- Publicar (escolha um):
  - **APK** (Android): siga o README (secao "Gerar o APK"). O app aponta
    sozinho pro Supabase; nao precisa de host.
  - **Link web**: `npm run build` e publique a pasta `dist/` no
    Cloudflare Pages ou Netlify (gratis). Mande o link no grupo.

## Passo 7 — Adicionar integrantes
- Cada um abre o app/link e entra com o proprio e-mail (recebe um link).
- Voce e o Marcelo entram com os e-mails que estao na tabela `admins`
  e veem os botoes de edicao. Os demais entram em **modo consulta**.
- Para promover alguem a admin depois: Supabase -> Table Editor -> `admins`
  -> Insert row com o e-mail da pessoa.

---

## Observacoes honestas
- **Primeira carga**: o banco comeca vazio. Quando o PRIMEIRO admin entra,
  o app cria os dados de exemplo automaticamente. A partir dai e so editar.
- **E-mails de login**: o Supabase gratis manda e-mails com um limite por hora.
  Para um grupo pequeno da certo; se atrasar no onboarding de muita gente de
  uma vez, configure um SMTP gratis (ou va convidando aos poucos).
- **Hibernacao**: projeto gratis pausa apos ~7 dias parado. Pelada semanal
  nunca chega la; se pausar, reative com 1 clique no painel.
- **Confirmar a propria presenca**: nesta versao a diretoria gerencia a
  presenca. Deixar cada jogador confirmar a PROPRIA presenca e um passo
  seguinte (precisa ligar cada e-mail a um jogador do elenco).
