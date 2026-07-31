# 📘 Documentação — Limitados F.C

App de gestão da pelada de quinta do **Limitados F.C**: elenco, estatísticas, sorteio de times, financeiro com PIX (baixa automática) e presença. Web + Android, com dados na nuvem e sincronização em tempo real.

> Última atualização desta doc: 2026-07-31

---

## 1. Links importantes

| O quê | Onde |
|---|---|
| **Site (app web)** | https://samyrfergusson.github.io/limitados-fc-android/ |
| **APK (Android)** | https://github.com/samyrfergusson/limitados-fc-android/releases/download/latest/app-debug.apk |
| **Repositório (GitHub)** | https://github.com/samyrfergusson/limitados-fc-android (público) |
| **Backend (Supabase)** | Projeto `ebbffyqwqzhbrgmqgtqv` — https://ebbffyqwqzhbrgmqgtqv.supabase.co |
| **Dev local** | `npm run dev` → http://127.0.0.1:5173/ |

---

## 2. Visão geral da arquitetura

```
┌──────────────┐        ┌──────────────┐        ┌───────────────────────────┐
│  APK Android │        │  Site (web)  │        │   Dev local (127.0.0.1)   │
│ (casca que   │        │ GitHub Pages │        │       npm run dev         │
│  abre o site)│        └──────┬───────┘        └────────────┬──────────────┘
└──────┬───────┘               │                             │
       └───────────────────────┴──────────────┬──────────────┘
                                               │  HTTPS
                                               ▼
                             ┌─────────────────────────────────────┐
                             │            SUPABASE (nuvem)          │
                             │  • Postgres (dados do grupo em JSON) │
                             │  • Auth (login por link mágico)      │
                             │  • Realtime (sincroniza em tempo real)│
                             │  • Edge Functions (PIX Mercado Pago) │
                             └──────────────┬──────────────────────┘
                                            │ webhook
                                            ▼
                                   ┌──────────────────┐
                                   │  Mercado Pago    │  (cobrança PIX + baixa automática)
                                   └──────────────────┘
```

**Ideia central:** todos os três "apps" (APK, site, dev) são a **mesma interface** e falam com o **mesmo Supabase**. O APK é apenas uma casca (Capacitor) que carrega o site hospedado — por isso **atualiza sozinho** a cada deploy, sem reinstalar.

---

## 3. Stack tecnológico

- **Front-end:** React 18 + Vite + Tailwind CSS + ícones `lucide-react`
- **Mobile:** Capacitor 6 (Android) — APK aponta para o site via `server.url`
- **PWA:** `vite-plugin-pwa` (service worker, instalável, atualização automática)
- **Backend:** Supabase — Postgres, Auth (GoTrue), Realtime, Edge Functions (Deno)
- **Pagamentos:** Mercado Pago (API de pagamentos PIX + webhook)
- **E-mail (login):** SMTP do Gmail (senha de app) configurado no Supabase
- **CI/CD:** GitHub Actions (build de APK, deploy do site, deploy das functions)

---

## 4. Estrutura de pastas

```
limitados-fc-android/
├── src/
│   ├── App.jsx           # TODO o app (componentes, telas, lógica)
│   ├── supabase.js       # cliente Supabase + funções (fetch, push, RPCs)
│   ├── config.js         # URL e chave anon do Supabase
│   ├── main.jsx          # entrada React
│   └── index.css         # estilos base (Tailwind)
├── supabase/
│   ├── setup.sql         # tabelas, RLS, RPCs (self_register_player, set_my_x1)
│   ├── mercadopago.sql   # tabela cobrancas
│   ├── config.toml       # config do projeto Supabase (functions)
│   └── functions/
│       ├── criar-cobranca/index.ts   # gera cobrança PIX no Mercado Pago
│       └── mp-webhook/index.ts       # recebe pagamento → baixa automática
├── android/              # projeto Capacitor/Android (gera o APK)
├── .github/workflows/
│   ├── build-apk.yml         # monta o APK e publica no Release
│   ├── deploy-web.yml        # publica o site no GitHub Pages
│   └── deploy-functions.yml  # publica as Edge Functions no Supabase
├── capacitor.config.json # server.url aponta para o site (auto-update)
├── vite.config.js        # base condicional (/limitados-fc-android/ só no Pages)
├── MERCADOPAGO.md        # guia da integração Mercado Pago
└── DOCUMENTACAO.md       # este arquivo
```

---

## 5. Modelo de dados (Supabase / Postgres)

Todo o app vive em **um único registro JSON**, o que simplifica tudo.

### Tabela `grupo`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | int | sempre `1` (registro único) |
| `dados` | jsonb | **o app inteiro** (ver estrutura abaixo) |
| `updated_at` | timestamptz | última alteração |

Estrutura de `dados` (JSON):
```jsonc
{
  "club":     { "nome", "cidade", "mensalidade", "caixa", "pixKey", "presidente", "vice" },
  "players":  [ { ficha do jogador } ],   // ver abaixo
  "matches":  [ { partidas } ],
  "payments": { "<playerId>": { "<YYYY-MM>": "pago|pendente|atrasado" } },
  "multas":   [ { "id", "playerId", "tipo", "valor", "data", "pago" } ],
  "lancamentos": [ { "id", "data", "desc", "tipo": "receita|despesa", "valor" } ],
  "proximoJogo": { "data", "hora", "local", "vagas",
                   "rsvp": { "<playerId>": { "s": "vou|duvida|fora", "at": <timestamp> } } },
  "regras":   { valores de multas },
  "sorteioHist":  { "<chave-dos-presentes>": ["<combinações já sorteadas>"] },
  "sorteioAtual": { "data", "timeVermelho": ["<ids>"], "timeAzul": ["<ids>"] }, // times atuais (persistem)
  "chamadas":     [ { "id", "data", "vou", "duvida", "fora", "presentes" } ]     // histórico de chamadas
}
```

Ficha do jogador (`players[]`):
```jsonc
{
  "id", "nome", "apelido", "numero", "posicao": "GOL|ZAG|MEI|ATA",
  "overall",                 // "peso" (visível só p/ admin)
  "cargo": "presidente|suplente|admin|mensalista|diarista",
  "mensalista": true,        // tipo de pagamento
  "status": "ativo|inativo",
  "dataEntrada", "dataSaida", "aniversario",
  "email",                   // vincula ao login (auto-cadastro)
  "x1Set": true,             // trava do auto-ajuste do X1
  "estrela": true,           // Estrela da Patota (só o presidente promove)
  "atr": { "vel", "fin", "pas", "def", "fis", "dri" }  // dri = X1
}
```

### Tabela `admins`
Lista de e-mails que **podem editar** (é isso que define admin, NÃO o campo "cargo").
Coluna `role`: `'admin'` (padrão) ou `'presidente'` (poderes exclusivos — ver seção 6).
```sql
select email, role from public.admins;                    -- ver admins e papéis
insert into public.admins (email) values ('x@y.com');     -- dar permissão de admin
update public.admins set role = 'presidente' where email = 'x@y.com';  -- tornar presidente
delete from public.admins where email = 'x@y.com';        -- remover permissão
```

### Tabela `cobrancas`
Cada cobrança PIX gerada (para conciliar o pagamento). Só as Edge Functions acessam.

---

## 6. Autenticação e permissões

- **Login:** link mágico por e-mail (`signInWithOtp`). Sem senha — o usuário recebe um link e clica.
- **Redirect:** o link volta para `origin + BASE_URL` (precisa estar em *Authentication → URL Configuration → Redirect URLs* no Supabase).
- **Quem edita:** apenas e-mails na tabela `admins`. Os demais ficam em **modo consulta**.
- **Hierarquia:** o **presidente** (`admins.role = 'presidente'`) tem poderes exclusivos que **nem outros admins têm**:
  - promover/remover a **Estrela da Patota**;
  - definir **cargos elevados** (Presidente/Vice/Admin) no formulário do jogador — admins comuns só definem Mensalista/Diarista.
  > Observação: o "cargo" é rótulo visual; a permissão real de edição continua sendo a tabela `admins`.
- **RLS (Row Level Security):**
  - `grupo`: todo autenticado **lê**; só admin **escreve**.
  - Exceções seguras via funções `security definer`:
    - `self_register_player(payload)` — jogador se cadastra 1x no 1º acesso.
    - `set_my_x1(valor)` — jogador ajusta o próprio X1 1x (trava depois).
    - `set_estrela(player_id, estrela)` — **só o presidente** promove/remove a Estrela da Patota.
    - `set_my_rsvp(status)` — jogador confirma a **própria** presença (vou/duvida/fora).

---

## 7. Funcionalidades

### Elenco
- Fichas com posição, número, cargo, aniversário e **6 habilidades**: VEL, FIN, PAS, DEF, FIS, **X1** (drible, 1–99).
- **Overall (peso):** visível **só para admin** (evita briga).
- **Auto-cadastro:** no 1º acesso, o jogador (não-admin, sem ficha) preenche a própria (cargo limitado a Mensalista/Diarista; sem overall).
- **Ajuste do X1:** o jogador pode alterar o próprio X1 **uma única vez**, depois trava.
- **⭐ Estrela da Patota:** badge de honraria mostrado abaixo do Overall no card. **Visível para todos**; só o **presidente** classifica/promove (botão exclusivo dele, validado no servidor).

### Destaques / Rankings
Artilheiros, garçom (assistências), ranking por pontos, craque da última, goleiros (gols sofridos).
Fórmula de pontos: `3·vitória + empate + 2·gol + assistência + 3·craque`.

### Sortear times (só admin)
- **Time Vermelho** (🔴) e **Time Azul** (🔵) — internamente ainda são `timeA`/`timeB`.
- **Presentes = confirmados:** a tela já abre com quem marcou **"Vou"** selecionado (sem re-selecionar na mão).
- Distribui por **overall**, separando goleiros.
- **Variado e sem repetir:** guarda as combinações já sorteadas (`sorteioHist`) e só repete depois de esgotar as equilibradas.
- **Times persistem:** o sorteio fica salvo (`sorteioAtual`) e continua aparecendo até um novo sorteio.
- **Botão "pesos ocultos / visíveis"** (começa OCULTO): esconde TODOS os overalls da tela (lista, totais, diferença → "times sorteados ✓", números dos cartões) para tirar print sem vazar nota. A barra colorida continua.

### Partidas
- Registrar: **Time Vermelho** × **Time Azul**, placar, gols/assistências por jogador, craque (MVP).
- **Avaliação do sorteio:** "os times ficaram parelhos?" + observação (fica no histórico).

### Financeiro
- Controle de **mensalidades** por mês (pago/pendente/atrasado).
- **Multas** em aberto e quitação.
- **Caixa** editável (saldo e mensalidade), lançamentos manuais (com apagar).
- **PIX** por jogador (ver seção 8).

### Presença (próximo jogo) — fluxo integrado
- **Confirmação self-service:** cada jogador (com ficha) confirma a **própria** presença — **Vou / Dúvida / Fora** — no card "Sua confirmação" (via RPC `set_my_rsvp`, validado no servidor). Admin também pode marcar qualquer um.
- **Fechar chamada (admin)** faz tudo de uma vez:
  1. lança as **multas** (falta/atraso);
  2. **sorteia os times** de quem veio (salvo em `sorteioAtual`, persiste);
  3. registra a **chamada no histórico** (`chamadas`: data + contagem de confirmações);
  4. **avança para a próxima quinta** (`nextThursday()`) e **zera as confirmações**.
- **Histórico de chamadas:** seção abaixo das Confirmações, jogo a jogo (data · X vou · Y dúvida · Z fora · quantos vieram).
- **Recorrência:** como é toda quinta, o app já reabre a próxima automaticamente ao fechar a chamada.

---

## 8. Integração Mercado Pago (PIX com baixa automática)

**Fluxo:** app gera cobrança PIX no MP → jogador paga → MP chama o webhook → o app marca "pago", quita multas e lança no caixa — tudo em tempo real.

- **`criar-cobranca`** (Edge Function): calcula o valor (mensalidade + multas), cria o PIX no MP, retorna QR + copia-e-cola. Jogador gera só o próprio; admin gera de qualquer um.
- **`mp-webhook`** (Edge Function): recebe o aviso do MP, confirma o pagamento e dá a baixa (idempotente).
- **Fallback:** se o MP falhar, o app cai no **PIX estático** (copia-e-cola simples, sem baixa automática).
- **Config necessária:**
  - Conta Mercado Pago com **chave PIX registrada** e **token de produção** (`APP_USR-...`).
  - Secret `MP_ACCESS_TOKEN` (no Supabase e no repo GitHub).
  - Webhook no MP apontando para `https://ebbffyqwqzhbrgmqgtqv.supabase.co/functions/v1/mp-webhook` (evento: pagamentos).

Detalhes completos em [MERCADOPAGO.md](MERCADOPAGO.md).

---

## 9. Deploy e CI/CD (GitHub Actions)

**Tudo automático a cada `git push` na branch `main`:**

| Workflow | Dispara | O que faz |
|---|---|---|
| `build-apk.yml` | push / manual | monta o APK e publica no **Release "latest"** |
| `deploy-web.yml` | push / manual | publica o site no **GitHub Pages** |
| `deploy-functions.yml` | manual | publica as **Edge Functions** + seta o `MP_ACCESS_TOKEN` no Supabase |

**Fluxo de atualização do app:** altera o código → `git push` → site atualiza → o APK (que aponta pro site) mostra a versão nova ao reabrir. **Sem reinstalar.**

> A versão aparece no topo do app (constante `APP_VERSION` em `src/App.jsx`). Suba esse número a cada atualização relevante.

---

## 10. Segredos e configurações

**Nunca versionar tokens.** Localização de cada um:

| Segredo | Onde fica | Para quê |
|---|---|---|
| Chave `anon` do Supabase | `src/config.js` (pode ser pública — protegida por RLS) | app acessar o Supabase |
| `SUPABASE_ACCESS_TOKEN` | GitHub → Settings → Secrets → Actions | deploy das functions |
| `MP_ACCESS_TOKEN` | GitHub Secrets **e** Supabase → Edge Functions → Secrets | Mercado Pago |
| Senha de app do Gmail | Supabase → Authentication → SMTP Settings | envio dos e-mails de login |

Configurações no Supabase (painel):
- **Authentication → URL Configuration:** Site URL e Redirect URLs = URL do site.
- **Authentication → SMTP Settings:** Gmail (`smtp.gmail.com`, porta 587, usuário = e-mail, senha = senha de app).
- **Authentication → Rate Limits:** e-mails por hora elevado (senão trava o grupo).

---

## 11. Manutenção — receitas rápidas

**Rodar localmente:**
```bash
npm install
npm run dev        # http://127.0.0.1:5173/
```
> Neste ambiente o Node não está no PATH: use o caminho completo do `npm.cmd` (ver seção 12).

**Publicar uma mudança:** `git push origin main` (site e APK atualizam sozinhos).

**Dar/remover permissão de admin:** editar a tabela `admins` no Supabase (SQL na seção 5).

**Definir o presidente:** `update public.admins set role = 'presidente' where email = '<email>';` (o e-mail precisa já estar em `admins`). Só ele promove a Estrela da Patota e cargos elevados.

**Baixar o APK mais recente:** botão no site ou o link de Release (seção 1).

**Liberar o X1 de novo p/ um jogador** (SQL Editor): remover a flag `x1Set` daquele jogador no JSON.

---

## 12. Peculiaridades do ambiente (máquina de dev)

- **Node/npm fora do PATH:** usar `& "C:\Program Files\nodejs\npm.cmd" <cmd>`.
- **Build Android local NÃO funciona:** agentes de segurança (Netskope/CrowdStrike) bloqueiam o loopback NIO do Java que o Gradle precisa. Por isso o APK é montado **na nuvem** (GitHub Actions).
- **TLS corporativo (Netskope):** o `git` usa `http.sslBackend schannel` (cofre de certificados do Windows) para o push funcionar.

---

## 13. Pendências / roadmap

- **Fase 2 do PIX:** e-mail automático todo dia 01 com a cobrança de cada jogador (agendador + Resend). Os e-mails já vêm do auto-cadastro.
- Personalizar o **template do e-mail** de login com a identidade do clube.
- Atualizar as GitHub Actions para a versão nova do Node (aviso de deprecation — não urgente).
- (Opcional) Persistir o histórico de sorteio já está feito; avaliar limpeza periódica.

---

*Documentação gerada com Claude Code. Mantenha este arquivo atualizado conforme o projeto evoluir.*
