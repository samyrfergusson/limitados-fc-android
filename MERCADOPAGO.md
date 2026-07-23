# Integração Mercado Pago (PIX com baixa automática)

Fluxo: jogador paga o PIX → Mercado Pago avisa a Edge Function `mp-webhook` →
o app marca **pago** + lança no caixa automaticamente (atualiza em tempo real).

## Peças já prontas no código
- `supabase/functions/criar-cobranca/` — gera o PIX (jogador gera o próprio; admin gera de qualquer um)
- `supabase/functions/mp-webhook/` — recebe o aviso do MP e dá a baixa
- `supabase/mercadopago.sql` — tabela `cobrancas` (conciliação)
- `.github/workflows/deploy-functions.yml` — publica as functions
- `src/supabase.js` → `criarCobrancaPix()` — helper do app (a tela ainda NÃO usa; ligamos depois de testar)

## Passo a passo pra ligar (você faz)

### 1. Mercado Pago — pegar o Access Token
1. Acesse https://www.mercadopago.com.br/developers → **Suas integrações → Criar aplicação**
2. Em **Credenciais de produção**, copie o **Access Token** (começa com `APP_USR-...`)
3. **Não cole em lugar nenhum do código nem aqui.** Ele vai só nos secrets (passo 3).

### 2. Banco — criar a tabela
No Supabase → **SQL Editor** → cole e rode o conteúdo de `supabase/mercadopago.sql`.

### 3. Secrets das Edge Functions (Supabase)
No Supabase → **Edge Functions → Secrets** (ou via CLI):
- `MP_ACCESS_TOKEN` = o token do passo 1

> `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já são
> fornecidos automaticamente às functions — não precisa cadastrar.

### 4. Publicar as functions (via GitHub Actions — evita o bloqueio do Netskope)
1. Supabase → **Account → Access Tokens** → gere um token
2. GitHub → repositório → **Settings → Secrets and variables → Actions → New repository secret**:
   - Nome: `SUPABASE_ACCESS_TOKEN` · Valor: o token do Supabase
3. GitHub → **Actions → Deploy Supabase Functions → Run workflow**

### 5. Configurar o Webhook no Mercado Pago
No painel da sua aplicação MP → **Webhooks / Notificações**, aponte para:
```
https://ebbffyqwqzhbrgmqgtqv.supabase.co/functions/v1/mp-webhook
```
Evento: **Pagamentos (payment)**.

### 6. Testar
- Use as **credenciais de teste** do MP (usuário de teste comprador/vendedor) antes de valer dinheiro real.
- Chame `criar-cobranca` (dá pra testar pelo painel de Functions do Supabase), pague o PIX de teste e confira se o app marcou "pago" sozinho.

## Depois de testar
Aí eu **ligo a tela**: o botão PIX passa a mostrar o QR + copia-e-cola dinâmico e a
tela atualiza sozinha quando o pagamento cai. (Fase 2: e-mail automático dia 01.)

## Observações
- O dinheiro cai no **saldo da conta Mercado Pago**; configure no MP a transferência
  automática pro seu banco, se quiser.
- Conta **CPF** recebe PIX normalmente (pode haver limites/KYC do próprio MP).
