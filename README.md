# Limitados F.C — App (Android / PWA)

App de gestão da pelada de quinta: elenco, mensalidades + PIX, presença com
multa por falta/atraso, partidas, artilharia, goleiros (menos/mais vazado),
sorteio de times equilibrados e ranking. Feito em React + Vite, instalável no
Android como PWA e empacotável em APK.

## Pré-requisitos
- Node.js 18 ou superior (https://nodejs.org)

## Rodar e testar no computador
```bash
npm install
npm run dev
```
Abra o endereço que aparecer (ex.: http://localhost:5173).

## Gerar a versão final (build)
```bash
npm run build      # gera a pasta dist/
npm run preview     # testa o build localmente
```

## Instalar no Android (PWA — recomendado pra começar)
1. Publique a pasta `dist/` em qualquer hospedagem **HTTPS** grátis
   (Netlify, Vercel ou GitHub Pages). HTTPS é obrigatório pra PWA.
2. No celular, abra o site no **Chrome**.
3. Menu (⋮) → **Instalar app** / **Adicionar à tela inicial**.
4. Pronto: abre em tela cheia, com o escudo como ícone, e funciona offline.
   Atualiza sozinho sempre que você publicar uma nova versão.

## Gerar um APK / publicar na Play Store (opcional, com Capacitor)
Usa o mesmo código, sem reescrever:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Limitados F.C" com.limitados.fc --web-dir=dist
npm run build
npx cap add android
npx cap sync
npx cap open android      # abre o Android Studio p/ gerar o APK/AAB
```
No Android Studio: Build → Build Bundle(s)/APK(s). O AAB é o formato pra
publicar na Play Store.

## Sobre os dados
Nesta versão os dados ficam salvos **no próprio celular** (armazenamento local).
Ou seja, cada instalação tem seus próprios dados — ideal pro admin (você)
gerenciar tudo num aparelho. Para os dados serem **compartilhados** entre os
jogadores (cada um vê presença, ranking e cobrança em tempo real), o próximo
passo é o backend (FastAPI + banco de dados), que a gente já planejou.

## Ícones
Em `public/`: `pwa-192x192.png`, `pwa-512x512.png`, `maskable-512.png`
(máscara adaptativa do Android), `apple-touch-icon.png` e `favicon.ico`.
Todos gerados a partir do escudo. Se conseguir o escudo em **SVG** ou PNG
grande (1024px), dá pra regerar tudo com qualidade máxima.

---

# Gerar o APK (projeto Android já incluído na pasta `android/`)

O projeto nativo Android **já está pronto** nesta pasta. Só falta o passo de
compilar, que precisa do Android SDK (por isso não vem o `.apk` pronto no zip).
Escolha um caminho:

## Opção 1 — Android Studio (mais fácil, recomendado)
1. Instale o **Android Studio** (traz o SDK e o Gradle automaticamente):
   https://developer.android.com/studio
2. Abra o Android Studio → **Open** → selecione a pasta **`android/`**.
3. Aguarde o "Gradle Sync" terminar (na 1ª vez ele baixa o necessário).
4. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Quando terminar, clique em **locate** e pegue o arquivo:
   `android/app/build/outputs/apk/debug/app-debug.apk`
6. Passe esse `.apk` pro celular (WhatsApp, cabo USB, Drive), toque nele e
   permita **"Instalar de fontes desconhecidas"**. Pronto.

## Opção 2 — Linha de comando (se já tiver o Android SDK + ANDROID_HOME)
```bash
cd android
./gradlew assembleDebug
# saída: android/app/build/outputs/apk/debug/app-debug.apk
```

## Opção 3 — Sem instalar nada (na nuvem) via PWABuilder
1. Publique a pasta `dist/` num host HTTPS (Netlify/Vercel).
2. Acesse https://www.pwabuilder.com, cole a URL do site.
3. Ele gera um **APK/AAB assinado** pra você baixar e instalar.

## Se você mudar o app depois
```bash
npm run build
npx cap sync android
```
e recompile (Opção 1 ou 2).

> Dica: o **app-debug.apk** já vem assinado com a chave de debug e instala
> direto no celular — perfeito pra distribuir pro pessoal do grupo. Só use o
> fluxo de "release" + keystore se for publicar na Play Store.
