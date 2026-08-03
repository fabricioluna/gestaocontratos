# Plano de evolução — Gestão de Contratos PMP

Este arquivo é o que sobrevive ao `/clear`. Ao retomar o trabalho depois de
uma limpeza de contexto, leia este arquivo primeiro — ele diz em que fase
estamos, o que já foi feito e o que falta. `CLAUDE.md` na raiz carrega
sozinho a cada sessão; este arquivo não.

**Regra de execução:** uma fase por branch (`evolucao/fase-N`), uma fase
por sessão quando possível. Ao terminar uma fase, atualizar a seção dela
aqui com o que foi feito e o que ficou pendente, fazer commit, e só depois
sugerir `/clear`.

**Prompt padrão para retomar depois de um `/clear`:**
```
Leia docs/PLANO.md. Execute a Fase N. Ao terminar, atualize o
docs/PLANO.md com o que foi feito e o que ficou pendente, e pare.
```

## Decisões já tomadas (não reabrir)

1. **RBAC definitivo**: custom claims do Firebase Auth, atribuídos por
   função servidor e validados nas Security Rules (Fase 3).
2. **Sistema ainda não foi ao ar** — liberdade para mudanças que quebram
   compatibilidade, sem coreografia de migração de usuários reais.
3. **Testes**: Vitest, escopo restrito à lógica financeira (parseMoeda,
   recálculo de valor global, acréscimo/supressão de aditivos, regra dos
   25%, dias até vencimento). Sem Testing Library por enquanto.
4. **Firestore Rules em duas etapas**: a Fase 2 corrige só o bug isolado
   de `auditoria_logs` (ver achado 0.1 abaixo). A autorização real de
   `contratos`/`itens` fica inteira para a Fase 3, junto dos custom claims
   — evita escrever a mesma regra duas vezes, e não há dado real em risco
   na janela entre as duas fases.
5. **Chave do Gemini**: restrição por referrer HTTP já aplicada como
   paliativo (ver achado 0.2). A rotação definitiva da chave acontece só
   ao final da Fase 2, quando o proxy do servidor estiver de pé — rotacionar
   antes só trocaria uma chave exposta por outra.
6. **Senhas legadas de `js/login.js`**: confirmado que não são reaproveitadas
   em nenhum outro sistema. Não serão rotacionadas; o arquivo já foi
   removido (Fase 1). Histórico do git não será reescrito (operação
   destrutiva sem benefício real dado que não há reuso).

---

## Fase 0 — Contenção (concluída em 31/07/2026)

Executada pelo usuário no console, sem código. Achados:

| Item | Achado |
|---|---|
| 0.1 Firestore Rules | `contratos`/`itens`: `allow read, write: if request.auth != null` — autenticação sem autorização, qualquer usuário logado lê/escreve/apaga tudo. `auditoria_logs` sem regra própria, cai no `if false` global → **log de auditoria 100% inoperante hoje**. |
| 0.2 Chave Gemini | Projeto GCP `gestao-contratos-pmp`. Restrição de API já correta (só Gemini API). Restrição de aplicativo estava em "Nenhum" — confirmado o pior caso. **Corrigido nesta fase**: referrer HTTP restrito a `https://gestaocontratospmp.vercel.app/*` e `http://localhost:5173/*`. É paliativo — `Referer` é forjável fora de navegador; a correção real é a Fase 2. |
| 0.3 Usuários Firebase Auth | 6 contas, todas de teste/institucionais (prefeitura, saude, educacao, assistencia @pesqueira.pe.gov.br + fiscal.teste@gmail.com + fabricioluna@live.com). Nenhum dado real de terceiros. Migração de claims na Fase 3 será trivial (script manual). |
| 0.4 Env vars na Vercel | 12/13 configuradas (falta só `EMAIL_CC`, sem impacto — código já trata com fallback). Todas escopadas "Production and Preview" — segredos de admin acessíveis em deploys de preview; considerar na estratégia de branches. Etiqueta "Sensitive" da Vercel não impede inlining de `VITE_*` no bundle — não mitiga C1. |
| 0.5 Senhas de js/login.js | Não reaproveitadas em nenhum outro sistema (confirmado pelo usuário). |

---

## Fase 1 — Fundação (em andamento)

**Objetivo:** montar o andaime que sustenta as fases seguintes e remover ruído.

- [x] Branch `evolucao/fase-1` criada
- [x] Baseline de build e lint capturado **antes** de qualquer mudança:
  - Build: 0 erros. Aviso de chunk grande: `geminiService` gera **1,78 MB**
    minificado (531 KB gzip) — desproporcional, candidato a `import()`
    dinâmico na Fase 6.
  - Lint: **53 erros, 0 warnings**. Distribuição: ~36 `@typescript-eslint/no-explicit-any`
    (bate com a auditoria original), 9 `no-unused-vars` (majoritariamente
    `catch (error)` não usado — confirma o padrão de mensagens de erro
    genéricas já mapeado na auditoria), 1 `prefer-const`,
    **5 `react-hooks/set-state-in-effect`** (achado novo, só visível via
    lint — 4 modais sincronizam prop→state dentro de `useEffect` ao abrir;
    candidato de refactor na Fase 7).
- [x] Código morto removido: `js/`, `css/`, `TabelaContratos.tsx` (0 bytes),
  `ModalLancarConsumo.tsx`, `src/assets/hero.png`, `src/assets/vite.svg`,
  `public/favicon.svg`, `public/icons.svg`, função `formatarCpfCnpj` em
  `formatters.ts`. Confirmado sem referências externas antes de remover.
- [x] Build e lint reverificados após remoção: **0 erros de build, 48 erros
  de lint** (queda de 5, exatamente os que estavam em `ModalLancarConsumo.tsx`
  — sem regressão).
- [x] `CLAUDE.md` criado na raiz.
- [x] `docs/PLANO.md` criado (este arquivo).
- [x] `.env.example` com os 13 nomes de variáveis (sem valores).
- [x] Agente `.claude/agents/revisor-pmp.md` — revisa diffs contra a lista
  de riscos conhecidos (ver `CLAUDE.md`, seção "Problemas conhecidos").
- [x] Hook em `.claude/settings.json` + `.claude/hooks/check-tsc.sh`:
  roda `npx tsc -b` (sem `--noEmit` — incompatível com `-b` na CLI do
  TypeScript; os tsconfigs já têm `noEmit: true`) após Write/Edit em
  `.ts`/`.tsx`. Usa `node` para ler o JSON de entrada/saída, não `jq`
  — `jq` não está disponível neste Git Bash do Windows (achado do
  pipe-test). Validado com payload sintético limpo, payload com erro
  real (bloqueou corretamente) e payload de arquivo não-ts (ignorado).
  **Pendente de ativação**: o observador de configuração não estava
  monitorando `.claude/` porque a pasta não existia quando esta sessão
  começou — confirmado via teste com sentinela (não disparou num Edit
  real). Rodar `/hooks` uma vez ou reiniciar a sessão para ativar.
- [x] Verificação final:
  - Build: 0 erros (idêntico ao check pós-remoção).
  - Lint: 48 erros (sem regressão).
  - `npm run dev` + Playwright Chromium (instalado localmente via
    `npm install --no-save playwright`, não gravado em package.json/
    package-lock.json) confirmaram a tela de login renderizando sem
    erro de console. Servidor parado ao final via `taskkill` (não
    `lsof`, que também não está disponível neste ambiente).
    Playwright fica em `node_modules` (gitignored) para reaproveitar
    nas verificações visuais das Fases 5-7.
  - `*.tsbuildinfo` (gerado pelo hook/build) adicionado ao `.gitignore`.
- [x] Commit da Fase 1 (a fazer após esta atualização).

---

## Fase 2 — Segurança do servidor (concluída em 01/08/2026)

**Objetivo:** eliminar os riscos críticos que não dependem da decisão de RBAC.

- [x] `auditoria_logs`: adicionar regra própria nas Firestore Rules.
  Regra final ficou mais estrita do que o desenho original: além de
  `allow create: if request.auth != null`, exige
  `request.resource.data.usuario == request.auth.token.email` — achado do
  `/security-review` desta fase (ver abaixo). Sem update/delete.
- [x] Versionado `firestore.rules` + `firebase.json` no repositório e
  **publicado no console do Firebase pelo usuário em 01/08/2026** —
  confirmado por ele fora desta sessão (não há Firebase CLI configurado
  neste ambiente para verificar por aqui). A regra de `auditoria_logs`
  (create só em nome do próprio usuário) já vale de verdade; o achado
  0.1 da Fase 0 está resolvido.
- [x] Novo endpoint `POST /api/extrair-documento` (`api/extrair-documento.ts`):
  recebe `{ texto, tipo: 'contrato' | 'aditivo' }`, exige
  `Authorization: Bearer <idToken>` verificado com `verifyIdToken`
  (firebase-admin), chama o Gemini com `GEMINI_API_KEY` do servidor e
  delimita o texto do documento no prompt com marcadores
  `===DOCUMENTO===` e instrução explícita para o modelo tratar o conteúdo
  como dado, nunca como comando.
- [x] `geminiService.ts` reescrito: não importa mais `@google/generative-ai`
  nem lê `API_KEY` nenhuma — só pega o ID token do usuário logado
  (`auth.currentUser.getIdToken()`) e faz `fetch('/api/extrair-documento')`.
  Mesma assinatura pública (`extrairDadosContratoComIA`,
  `extrairDadosAditivoComIA`), então `ModalNovoContrato.tsx` e
  `useDetalhesContrato.ts` não precisaram mudar a chamada em si.
- [x] `VITE_GEMINI_API_KEY` → `GEMINI_API_KEY`, movida para a seção de
  servidor do `.env.example`. Criada na Vercel e testada em produção
  pelo usuário em 01/08/2026 ("Carregar Contrato" preencheu os campos
  via IA) — `/api/extrair-documento` está lendo `GEMINI_API_KEY` do
  servidor corretamente. `VITE_GEMINI_API_KEY` foi removida da Vercel.
- [x] `verifyIdToken` em `/api/create-user` e `/api/list-users` — sem
  token válido, ambos respondem 401. Os dois chamadores no cliente
  (`ModalNovoContrato.tsx`, `ModalGerenciarUsuarios.tsx`) agora mandam
  `Authorization: Bearer <idToken>`. Continua sem checar *perfil*
  (admin vs. viewer) — isso é a Fase 3, que ainda não tem custom claims
  para checar.
- [x] `/api/cron-vencimentos` valida
  `Authorization: Bearer $CRON_SECRET` contra `process.env.CRON_SECRET`
  antes de qualquer outra coisa. A Vercel injeta esse header sozinha nas
  chamadas agendadas quando o env var existe no projeto — nada a
  configurar em `vercel.json`. **`CRON_SECRET` criada na Vercel pelo
  usuário em 01/08/2026** junto com `GEMINI_API_KEY`. **Não determinado**:
  a execução agendada real (`0 11 * * *`) ainda não foi observada
  passando com o secret novo — só o teste manual de IA foi confirmado.
  Se o próximo disparo do cron falhar com 401, o primeiro lugar a olhar é
  se o valor de `CRON_SECRET` na Vercel bate com o que a própria Vercel
  está mandando (não deveria haver divergência, já que é a mesma
  plataforma injetando os dois lados).
- [x] Senha provisória por e-mail trocada por link de redefinição:
  `create-user.ts` agora gera uma senha aleatória com
  `crypto.randomBytes(24)` só para satisfazer a API do
  `auth.createUser` (nunca é exposta), e usa
  `auth.generatePasswordResetLink(email)` para gerar o link que vai no
  e-mail. O usuário define a própria senha pelo fluxo do Firebase.
- [x] Handlers de `/api` (`create-user`, `list-users`, `cron-vencimentos`,
  `extrair-documento`) não devolvem mais `error.message` bruto ao
  cliente — sempre uma mensagem genérica fixa, com `console.error` do
  detalhe real no servidor (vai para os logs da Vercel).
- [x] `/security-review` rodado ao final via 3 subagentes (achar riscos →
  filtrar falso-positivo por item → cortar confiança < 8). De 3 candidatos
  (log de auditoria forjável, `verifyIdToken` sem `checkRevoked`, prompt
  injection residual no Gemini), só o primeiro sobreviveu com confiança
  8/10 — corrigido na própria regra do `auditoria_logs` acima. Os outros
  dois foram descartados: falta de `checkRevoked` é reforço de defesa,
  não vulnerabilidade concreta, dado token de curta duração e só 6 contas
  de teste; prompt injection no texto do documento já cai numa etapa
  humana de revisão antes de qualquer gravação no Firestore.
- [x] Rotacionar a chave do Gemini. Confirmado pelo usuário em
  01/08/2026: chave nova gerada no Google Cloud Console do projeto
  `gestao-contratos-pmp`, `GEMINI_API_KEY` na Vercel atualizada com o
  valor novo, chave antiga (a que ficou meses exposta via
  `VITE_GEMINI_API_KEY`) revogada/apagada no Console, e
  `VITE_GEMINI_API_KEY` removida da Vercel. Não verificável a partir
  deste repositório (ação no Google Cloud Console, fora do escopo do
  código) — registrado como feito com base na confirmação direta do
  usuário.

**Build/lint ao final da fase** (baseline da Fase 1: build 0 erros, lint
48 erros): build **0 erros** (idêntico); lint **44 erros** (queda de 4 —
`error: any` viraram `catch (error)` sem tipo em 3 dos 4 handlers de
`/api`; os 2 `any` novos em `api/extrair-documento.ts` são o mesmo padrão
`(req: any, res: any)` do problema conhecido nº 5 do `CLAUDE.md`, não uma
regressão nova). Sem novos erros de tipo (`tsc -b` limpo, verificado
também pelo hook a cada edição).

**Pendências que ficaram para fora desta fase, por decisão consciente:**
- Autorização por perfil (admin vs. viewer) nos três endpoints — Fase 3,
  precisa dos custom claims.
- `firestore.rules` versionado mas não publicado, `GEMINI_API_KEY` e
  `CRON_SECRET` não confirmadas na Vercel, rotação da chave do Gemini —
  as três dependem de ações manuais fora do repositório, listadas acima.
- Duplicação do bloco de inicialização do firebase-admin entre os 4
  arquivos de `api/` (create-user, list-users, cron-vencimentos,
  extrair-documento) — mantida de propósito, já é a convenção existente
  no repositório e a consolidação está no escopo da Fase 7
  ("Eliminar duplicações... init do firebase-admin").

## Fase 3 — RBAC com custom claims (concluída e validada em produção em 01/08/2026; restam só os itens 5 e 7 da lista de pendências, não bloqueantes)

- [x] Pedido desenho ao agente `Plan` antes de codificar. As 8 decisões de
  trade-off (bootstrap do primeiro admin, shape do claim, regra de `itens`
  via `get()` do contrato pai, cron com `firebase-admin` ignorando as Rules,
  `ProtectedRoute` assíncrono, contexto de auth compartilhado nesta fase e
  não na Fase 7, helper `verificarAdmin` sem tocar na duplicação de init do
  firebase-admin, `orgaoId` obrigatório sem default) foram resolvidas antes
  de qualquer código — ver histórico da sessão, não repetido aqui.
- [x] `api/definir-perfil.ts`: `POST`, só admin (`api/_shared/verificarAdmin.ts`,
  novo helper reaproveitado também por `create-user`/`list-users` — só a
  checagem de admin é compartilhada, o bloco de init do firebase-admin
  continua duplicado nos 4 arquivos de propósito, decisão já registrada na
  Fase 2 e mantida). Recebe `{ email, perfil: 'admin'|'viewer', orgaoId:
  'prefeitura'|'fms'|'fme'|'fmas' }`, validado contra os 2 enums no
  servidor, e chama `auth.setCustomUserClaims`.
- [x] `Login.tsx`: não infere mais `orgao`/`perfil` por substring do
  e-mail nem grava `sessionStorage`. Após `signInWithEmailAndPassword`,
  chama `getIdTokenResult(true)` (refresh forçado); se a conta não tiver
  `perfil`/`orgaoId` nos claims, faz `signOut` e mostra "conta sem perfil
  configurado" em vez de navegar para `/painel`.
- [x] `src/contexts/authContextBase.ts` + `AuthContext.tsx` +
  `src/hooks/useAuth.ts` (3 arquivos, não 1 — `react-refresh/only-export-components`
  barra misturar o `createContext`, o `AuthProvider` e o hook `useAuth` no
  mesmo arquivo; sem isso o lint subia de 44 para 49 em vez de 48). Único
  lugar do app com `onAuthStateChanged` + `getIdTokenResult`. `ProtectedRoute`,
  `Painel.tsx`, `DetalhesContrato.tsx` e `useContratos.ts` foram todos
  migrados para `useAuth()` — zero leitura de `sessionStorage` relacionada
  a auth restando em `src/` (confirmado por grep).
- [x] `ProtectedRoute.tsx`: 3 estados (`carregando` → tela de espera;
  sem `user`/`perfil`/`orgaoId` → `Navigate to="/"`; caso contrário
  renderiza). `App.tsx` envolve `<BrowserRouter>` com `<AuthProvider>`.
- [x] Firestore Rules (`firestore.rules`, **não publicado ainda** — ver
  pendências): `contratos` — admin só lê/escreve do próprio `orgaoId`,
  viewer só lê o contrato cujo `emailSecretaria` bate com o e-mail do
  token; `update` não pode trocar o `orgaoId` do contrato. `itens` — não
  carregam `orgaoId`/`emailSecretaria` próprios, a regra faz um `get()` do
  `contratos/{contratoId}` pai para decidir (custo de 1 leitura extra por
  item; aceito nesta fase, candidato a denormalizar se o custo incomodar
  na Fase 6).
- [x] `useContratos.ts`: **achado da sessão, não previsto no checklist
  original** — o ramo admin fazia `query(contratosRef)` sem filtro e
  filtrava client-side por `.includes()`. Com as Rules novas isso
  quebraria: uma query sem `where('orgaoId','==', orgaoId)` correspondente
  à regra é rejeitada **inteira** pelo Firestore (`permission-denied`), não
  filtrada em silêncio. Corrigido: `useContratos()` agora lê `useAuth()`
  internamente (perdeu o parâmetro `orgaoLogado`) e sempre filtra no
  servidor (`where('orgaoId','==', orgaoId)` para admin, `where('emailSecretaria','==', user.email)`
  para viewer).
- [x] Botão "Sair" em `Painel.tsx`: **segundo achado da sessão** — antes só
  fazia `sessionStorage.clear()`, nunca deslogava do Firebase Auth de
  verdade (`auth.currentUser` continuava preenchido). Com `ProtectedRoute`
  passando a depender de `onAuthStateChanged`, isso virava um logout que não
  loga out. Corrigido para `auth.signOut()`.
- [x] `api/cron-vencimentos.ts`: não usa mais o client SDK com conta-robô
  (`BOT_EMAIL`/`BOT_PASS` via `signInWithEmailAndPassword`) — migrado para
  `firebase-admin` com `FIREBASE_ADMIN_CREDENTIALS` (mesmo padrão dos
  outros 3 handlers de `/api`). O SDK admin ignora as Rules por design;
  aceito porque o cron só lê (nunca escreve) e precisa varrer todos os
  órgãos. `.env.example` atualizado (removidas `BOT_EMAIL`/`BOT_PASS`).
- [x] `scripts/migrar-perfis.ts`: script one-off (não é rota HTTP) com a
  lista fixa dos 6 e-mails de teste → `perfil`/`orgaoId`, usando
  `firebase-admin` direto. `setCustomUserClaims` substitui o claim inteiro
  a cada chamada — rodar 2x produz o mesmo resultado, sem duplicar efeito.
  `npm run migrar:perfis` (novo script no `package.json`; `tsx` e `dotenv`
  adicionados como devDependencies só para isso).
- [x] `ModalGerenciarUsuarios.tsx` e o fluxo inline de cadastro de e-mail em
  `ModalNovoContrato.tsx` (**terceiro achado da sessão** — esse segundo
  ponto de criação de usuário não estava no checklist original, mas chama
  `/api/create-user` e sem `/api/definir-perfil` em seguida a conta ficaria
  sem claims e nunca conseguiria logar): os dois agora encadeiam
  `POST /api/create-user` → `POST /api/definir-perfil` (`perfil: 'viewer'`),
  com o `<select>` de órgão trocado de texto livre ("Fundo Municipal de
  Saúde") para os 4 ids normalizados (`fms`/`fme`/`fmas`/`prefeitura`) e
  passando a ser obrigatório (sem default silencioso — atribuir órgão
  errado por omissão seria pior que forçar a escolha).
- [x] Verificação: `sessionStorage.setItem('perfilLogado','admin')` +
  `orgaoLogado` no DevTools e navegar para `/painel` continua mandando
  para `/` — testado com Playwright headless contra `npm run dev` (ver
  abaixo), não só por leitura de código.

**Build/lint ao final da fase** (baseline da Fase 2: build 0 erros, lint 44
erros): build **0 erros** (idêntico). Lint **48 erros** (+4) — os 4 novos
são `(req: any, res: any)` em `api/_shared/verificarAdmin.ts` (2) e
`api/definir-perfil.ts` (2), mesmo padrão do problema conhecido nº 5 do
`CLAUDE.md` (não instalar `@vercel/node` é decisão da Fase 7), não uma
categoria nova de problema. Confirmado por diff completo dos dois lints
(antes/depois), não só pela contagem total.

**Teste local**: `npm run dev` + Playwright Chromium headless (mesma
instalação `--no-save` da Fase 1). Confirmado: tela de login renderiza sem
erro de console; `/painel` e `/contrato/:id` sem sessão redirecionam para
`/`; **`sessionStorage` forjado no DevTools não dá mais acesso** (a
verificação-chave do checklist desta fase). Não foi possível testar login
real nem as Firestore Rules novas fim-a-fim nesta sessão — o `.env` local
só tem a config pública do Firebase (cliente), sem
`FIREBASE_ADMIN_CREDENTIALS` nem senha de nenhuma das 6 contas de teste.

**Pendências manuais, nesta ordem:**
1. [x] **Concluído em 01/08/2026.** Gerada uma chave nova de service account
   no Firebase Console (Configurações do projeto → Contas de serviço →
   Gerar nova chave privada) e colocada em `FIREBASE_ADMIN_CREDENTIALS` no
   `.env` local. Achado da sessão: colar o JSON multi-linha direto (como
   baixado) quebra o `dotenv`, que só lê a primeira linha da string — o
   valor precisa estar comprimido numa linha só e entre aspas simples
   (`FIREBASE_ADMIN_CREDENTIALS='{"type":"service_account",...}'`).
   `npm run migrar:perfis` rodado com sucesso — os 6 e-mails de teste
   confirmados com `perfil`/`orgaoId` corretos (log local, não repetido
   aqui por conter e-mails reais de contas de produção).
2. [x] **Concluído em 01/08/2026.** PR #2 (`evolucao/fase-3` → `main`)
   aberto e mergeado pelo usuário no GitHub. Deploy de produção na Vercel
   deve disparar automaticamente a partir do merge em `main` — não
   verificado a partir deste repositório (painel da Vercel, fora do
   escopo do código); confirmar lá antes do passo 3.
3. [x] **Concluído em 01/08/2026.** As 6 contas de teste fizeram
   logout/login (ou primeiro login, para as 3 que nunca tinham entrado).
   Único imprevisto: senha de `fiscal.teste@gmail.com` esquecida —
   redefinida diretamente via `firebase-admin` (`updateUser` com a nova
   senha escolhida pelo usuário), sem precisar do link de e-mail; valor da
   senha não passou pelo log/histórico desta sessão.
4. [x] **Concluído em 01/08/2026.** `firestore.rules` publicado pelo
   usuário no console do Firebase.
5. Apagar a conta-robô (e-mail em `BOT_EMAIL`) no Firebase Auth Console e
   remover `BOT_EMAIL`/`BOT_PASS` das env vars da Vercel — só depois de
   confirmar que o cron novo (`firebase-admin`) está funcionando (ainda
   "não determinado": o cron roda 1x/dia, não foi observado passando desde
   o deploy desta fase).
6. [x] **Concluído em 01/08/2026, validado em produção com contas reais**
   (não só por leitura de código): admin (`prefeitura`) logou depois da
   publicação e viu só os contratos do próprio órgão; viewer
   (`fiscal.teste@gmail.com`) logou e confirmou acesso restrito ao
   contrato/itens onde é o `emailSecretaria` — a regra de `itens` via
   `get()` do contrato pai (ponto que o agente `Plan` apontou como mais
   fácil de acertar errado silenciosamente) funcionou como desenhado.
7. [x] **Concluído em 01/08/2026** — resolvido junto do incidente abaixo,
   não como verificação isolada. Confirmado em produção via `curl`:
   `api/_shared/verificarAdmin` responde 404 (não é rota pública).

### Incidente pós-deploy: `create-user`/`list-users`/`definir-perfil` quebrados em produção (01/08/2026, resolvido no mesmo dia)

Ao investigar o item 7 (se `_shared` tinha virado rota pública), usei
`curl` direto contra a produção pra confirmar — e descobri que os 3
endpoints que importam `verificarAdmin` estavam respondendo
`500 FUNCTION_INVOCATION_FAILED` (erro genérico da própria Vercel, não do
nosso código) desde o deploy da Fase 3. `api/extrair-documento` (não
depende de `verificarAdmin`) respondia normalmente — isolando o problema
para esse import específico. Não pego por nenhum teste local porque
dependia do ambiente de build da Vercel, não do `tsc -b`/`vite build`
daqui.

**Duas hipóteses erradas testadas e descartadas antes da causa real**
(cada uma virou um deploy, nenhuma resolveu — registrado para não
repetir o mesmo caminho errado numa próxima vez):
1. "A Vercel exclui pastas `_` do bundle inteiro, não só do roteamento" —
   mover `verificarAdmin.ts` de `api/_shared/` para `api/lib/` não
   resolveu nada (confirmado via `curl` depois do deploy virar "Current"
   em produção).
2. "`import { getAuth, type DecodedIdToken } from '...'` (tipo misturado
   num import de valor) não transpila certo" — separar em duas linhas
   também não resolveu.

**Causa real**, achada lendo os Build Logs completos da Vercel (não
aparece resumido na UI, só no log expandido): `error TS2835: Relative
import paths need explicit file extensions in ECMAScript imports when
'--moduleResolution' is 'node16' or 'nodenext'`. A Vercel compila cada
função de `api/` com uma resolução de módulo mais estrita que a nossa
(`tsconfig.node.json` usa `"moduleResolution": "bundler"`, permissivo)
— por isso o erro nunca apareceu no `tsc -b` local. O erro TS2835 não
falha o build inteiro (a Vercel completa e marca "Ready" mesmo assim),
mas deixa a função quebrada em runtime. Corrigido acrescentando `.js` aos
3 imports (`from './_shared/verificarAdmin.js'`) — sintaxe válida em
TS+ESM mesmo importando um arquivo `.ts` (a extensão escrita é a de
saída, não a de origem).

Depois da causa real corrigida, voltei `verificarAdmin.ts` para
`api/_shared/` (a hipótese 1 estava errada sobre a causa do incidente,
mas o comportamento em si era real: `api/lib/verificarAdmin`, sem `_`,
tinha virado uma rota própria acessível, respondendo 500 por não ter
`export default handler` — sem risco de segurança, mas sem necessidade
de existir). Confirmado com `curl`: os 4 endpoints reais voltaram a
responder corretamente, `_shared` responde 404.

**Registrado em `CLAUDE.md`** (seção "Convenções do código") como regra
permanente — relevante principalmente para a Fase 7, que pretende
consolidar código duplicado entre os arquivos de `api/` e vai criar mais
imports relativos como este.

**Teste end-to-end do fluxo de cadastro de usuário, feito depois da
correção:** achado um segundo problema, também de configuração externa,
não de código — `auth.generatePasswordResetLink` falhava com
`auth/unauthorized-continue-uri` porque `gestaocontratospmp.vercel.app`
não estava na lista de **Authorized domains** do Firebase Auth (Console
→ Authentication → Settings). Usuário corrigiu manualmente. Reteste
completo: conta criada, `perfil`/`orgaoId` corretos via
`/api/definir-perfil`, e-mail entregue com sucesso pelo Gmail — só caiu
no Spam do destinatário (entregabilidade do remetente
`notifica.licitacao.pesqueira@gmail.com`, sem SPF/DKIM configurado; fora
do escopo de código, não é bug, backlog de melhoria se incomodar no uso
real).

## Fase 4 — Extrair lógica pura + Vitest (concluída em 01/08/2026)

- [x] `src/domain/moeda.ts`: `parseMoeda` movida para cá.
  `src/utils/formatters.ts` passou a reexportar (`export { parseMoeda } from
  '../domain/moeda'`) em vez de duplicar — os 3 arquivos que já importavam
  de `utils/formatters` não precisaram mudar.
- [x] `src/domain/aditivos.ts`: `calcularResumoValorGlobal` (valor global
  atualizado / total de aditivos / valor original — antes calculado inline
  em `useDetalhesContrato.ts`), `calcularValorAlteracaoAditivo` (sinal do
  acréscimo/supressão), `excedeLimite25` (regra dos 25%) e
  `recalcularValorTotalComAditivo` (desfaz o aditivo anterior ao editar,
  reaproveitada também na exclusão de aditivo, passando alteração nova = 0).
  Extraída também `substituirAditivo` (não estava no checklist original,
  mas fazia parte do mesmo bloco de `salvarAditivo`): **achado da sessão**
  — o comportamento original, se um aditivo em edição tem um `id` que não
  bate com nenhum item da lista, é não fazer nada (nem substituir, nem
  inserir); preservado de propósito com um parâmetro `emEdicao: boolean`
  separado do id, em vez de inferir "está editando" a partir do id ter sido
  encontrado (isso teria mudado o comportamento silenciosamente).
- [x] `src/domain/vencimento.ts`: `diasAteVencimento` (mesma leitura
  `new Date(dataFim)` que já existia em `Painel.tsx`, interpretada como UTC)
  e `statusVencimento` (classifica em `vencido`/`critico`/`atencao`/
  `vigente` pelos mesmos limiares de 0/30/90 dias que já existiam).
  **Decisão deliberada**: `api/cron-vencimentos.ts` **não** foi migrado
  para usar esta função — o cron faz parsing manual em hora local
  (`new Date(ano, mes-1, dia)`), que é exatamente a divergência do
  problema conhecido nº 2 do `CLAUDE.md` (Fase 5). Unificar os dois agora
  teria corrigido o bug de surpresa, fora do escopo desta fase. Só
  `Painel.tsx` (`getRowStyle`/`getRowTitle`) foi migrado para a função de
  domínio, porque já usava exatamente essa mesma lógica.
- [x] `useDetalhesContrato.ts` e `Painel.tsx` refatorados para chamar as
  funções de `src/domain/`; comportamento numérico conferido função a
  função contra o código original antes de cada substituição (inclusive o
  detalhe de que a regra dos 25% só dispara em acréscimo, nunca em
  supressão — preservado, não é bug desta fase corrigir).
- [x] Vitest instalado (`^4.1.10`, devDependency) + script `"test": "vitest
  run"` no `package.json`. **21 testes** em 3 arquivos
  (`moeda.test.ts`, `aditivos.test.ts`, `vencimento.test.ts`), todos
  passando. Sem Testing Library, sem ambiente jsdom — só funções puras,
  ambiente `node` padrão do Vitest.
- [x] `revisor-pmp` rodado no diff desta fase antes de considerá-la
  concluída: **nenhum achado**. Conferiu termo a termo a equivalência
  numérica de cada função extraída contra o código original (incluindo a
  ordem de operações em `recalcularValorTotalComAditivo` e a assimetria
  acréscimo/supressão da regra dos 25%) e confirmou que nenhum teste testa
  algo diferente do que a função realmente faz.

**Build/lint ao final da fase** (baseline da Fase 3: build 0 erros, lint 48
erros): build **0 erros** (idêntico). Lint **47 erros** (queda de 1) — a
extração de `substituirAditivo` transformou um `let novaLista` que nunca
era reatribuído em `const` (achado do lint `prefer-const` que já existia
antes desta fase, corrigido como efeito colateral da extração, não uma
correção proposital). Confirmado por diff completo dos dois lints
(antes/depois): nenhuma categoria nova de erro, todas as outras linhas são
as mesmas apenas deslocadas de número de linha.

**Teste visual**: `npm run dev` + Playwright Chromium headless (reinstalado
localmente via `npm install --no-save playwright`, mesma convenção da
Fase 1 — não persiste no `package.json`/`package-lock.json`). Tela de
login carregou sem erro de console.

**Pendências:** nenhuma — a fase não tinha dependência de ação manual fora
do repositório.

## Fase 5 — Correção de bugs (concluída em 02/08/2026)

- [x] **Datas UTC vs. hora local.** `src/domain/vencimento.ts` ganhou
  `parseDataLocal` (interpreta `"YYYY-MM-DD"` como meia-noite local, mesma
  leitura manual que `api/cron-vencimentos.ts` já fazia — o cliente foi
  alinhado ao cron, não o contrário). `diasAteVencimento` passou a usá-la
  internamente; `Painel.tsx` (`filtrarContratosPorPeriodo`) e
  `DetalhesContrato.tsx` (`getStatus`, agora reaproveitando
  `diasAteVencimento` em vez de reimplementar o cálculo) foram migrados
  para a mesma função. `api/cron-vencimentos.ts` não foi tocado — seu
  parsing manual já era o comportamento correto. `vencimento.test.ts`
  ajustado: o parâmetro `hoje` dos testes passou a usar
  `new Date(ano, mes-1, dia)` (data local) em vez de
  `new Date('YYYY-MM-DD')` (UTC) — do jeito antigo o teste só passava por
  coincidência de que ambos os lados sofriam o mesmo desvio de fuso;
  confirmado que quebraria em fuso não-UTC antes desse ajuste (máquina de
  desenvolvimento roda em America/Fortaleza, UTC-3).
- [x] **`updateDoc` sem transação em `valorTotal`/`aditivos`.**
  `useDetalhesContrato.ts`: `excluirAditivo`, `salvarAditivo` e a parte de
  `salvarEdicaoItem` que ajusta o `valorTotal` do contrato agora usam
  `runTransaction`, lendo o contrato do servidor no momento do commit em
  vez do estado React (que pode estar desatualizado). Achado do
  `revisor-pmp` nesta fase: a checagem da regra dos 25% (`excedeLimite25`)
  ainda usava o valor em memória só para decidir se mostrava o
  `window.confirm` — que não pode rodar dentro da transação, pois o
  Firestore pode reexecutar o corpo em caso de conflito. Corrigido
  repetindo a checagem *dentro* da transação contra o valor real: se o
  usuário não tinha sido avisado (achava que era um acréscimo normal) mas
  o valor base mudou nesse intervalo — outro fiscal registou aditivo — e
  agora ultrapassa 25%, a transação aborta com um erro específico
  (`CONCORRENCIA_25`) e pede para reabrir o aditivo, em vez de gravar
  silenciosamente sem aviso. Se o aviso já tinha sido confirmado, prossegue
  sem perguntar de novo.
- [x] **`ModalEditarContrato` regrava `id` e `aditivos` por engano.**
  `formEdit` continua inicializado com `{ ...contratoOriginal }` (mais
  simples que reconstruir campo a campo), mas agora `id` e `aditivos` são
  removidos do payload (`delete`) antes do `updateDoc` — evita o campo
  `id` redundante no documento e, principalmente, a sobrescrita de
  `aditivos` com o snapshot que estava em memória quando o modal abriu.
- [x] **Modalidades divergentes entre cadastro e edição.** Lista única em
  `src/utils/modalidades.ts` (`MODALIDADES_LICITACAO`), usada nos dois
  `<select>`. É a união das duas listas antigas, **exceto** a opção
  `"Pregão"` (sem qualificador), que só existia no modal de edição —
  decisão consciente (achado do `revisor-pmp`): como o sistema ainda não
  tem uso real (só contas de teste), o risco de um contrato salvo com
  `modalidade === "Pregão"` ficar sem opção correspondente é aceitável;
  não valia duplicar uma opção ambígua na lista unificada.
- [x] **Falha de e-mail no cron cancela todos os alertas do dia.**
  `api/cron-vencimentos.ts`: o `sendMail` dentro do laço agora tem
  try/catch por contrato — um `emailSecretaria` inválido não aborta mais
  os alertas dos contratos seguintes na mesma execução. Resposta do
  endpoint passou a informar `emailsComFalha` na mensagem quando houver.
- [x] **`onSnapshot` sem callback de erro em `useDetalhesContrato.ts`.**
  Os dois listeners (contrato e itens do catálogo) ganharam callback de
  erro, seguindo o padrão já usado em `useContratos.ts`.
- [x] **Contrato inexistente = "A carregar..." eterno.** Novo estado
  `erro` no hook: setado quando `docSnap.exists()` é falso ou quando
  qualquer um dos `onSnapshot` falha; limpo quando o contrato carrega com
  sucesso. `DetalhesContrato.tsx` mostra a mensagem de erro com botão
  "Voltar ao Painel" em vez de manter o "A carregar..." para sempre.
- [x] **Fiscal com lista vazia permanente (race condition no useEffect).**
  Investigado e confirmado **já resolvido como efeito colateral da
  reescrita do `AuthContext` na Fase 3** — nenhuma mudança de código
  necessária nesta fase. O bug original (auditoria M-race, pré-Fase-3) era
  o `useEffect` de `useContratos.ts` depender só de `orgaoLogado`
  (`sessionStorage`) e desistir silenciosamente se `auth.currentUser`
  ainda fosse `null`, sem nunca reexecutar. Hoje o efeito depende de
  `[carregando, user, perfil, orgaoId, isAdmin]`, todos vindos de
  `useAuth()`, e reexecuta corretamente assim que o auth state resolve.
- [x] **Toast preso sem `{ id: toastId }` no catch de `salvarAditivo`.**
  Corrigido — o catch agora sempre referencia o `toastId` do escopo
  externo (precisou virar `let` no topo da função, já que o
  `toast.loading` só roda depois das validações síncronas).
- [x] **Contrato distratado ainda editável pelo botão do painel.**
  `Painel.tsx`: o botão ✏️ de editar contrato agora só aparece quando
  `!c.dataDistrato`, consistente com o resto da tela de detalhes.

**Build/lint/testes ao final da fase** (baseline da Fase 4: build 0 erros,
lint 47 erros, 21 testes): build **0 erros** (idêntico). Lint **46 erros**
(queda de 1) — o catch de `salvarAditivo` passou a referenciar `error`
(para distinguir o abort por `CONCORRENCIA_25` do erro genérico), o que
eliminou um dos `catch (error)` não usados já mapeados como padrão na
Fase 1; confirmado por diff completo (`eslint --format json`, agrupado por
arquivo+regra) contra a baseline da Fase 4 — nenhuma categoria nova de
erro sobrando, só essa queda de 1. Vitest **21/21 passando** (mesmos
testes da Fase 4, `vencimento.test.ts` ajustado para a nova leitura local
de data sem mudar a cobertura).

**Revisão:** `revisor-pmp` rodado no diff completo desta fase. Dois
achados, ambos endereçados nesta mesma sessão (não ficaram pendentes): a
janela de checagem dos 25% dessincronizada da transação (corrigido, ver
item acima) e a lista de modalidades unificada descartando a opção
`"Pregão"` sem qualificador (decisão consciente, documentada acima, não
corrigida por ser de baixo risco com o sistema ainda sem uso real).

**Teste visual**: `npm run dev` (porta 5174, a 5173 já estava em uso) +
Playwright Chromium headless (reaproveitado de `node_modules`, mesma
convenção `--no-save` das fases anteriores). Tela de login carregou sem
erro de console. Não foi possível testar login real nem os fluxos de
aditivo/transação fim-a-fim nesta sessão — mesma limitação já registrada na
Fase 3 (sem `FIREBASE_ADMIN_CREDENTIALS`/senha de conta de teste no
ambiente local desta sessão).

**Pendências:** nenhuma bloqueante. Nota para fases futuras: a opção de
modalidade `"Pregão"` (sem qualificador) não existe mais em nenhum dos dois
`<select>` — se algum contrato de teste antigo tiver esse valor exato
salvo, o campo aparecerá em branco ao editar (ver decisão acima).

## Fase 6 — Desempenho (concluída em 02/08/2026)

- [x] **`import()` dinâmico para `xlsx`, `pdfjs-dist`, `mammoth`,
  `jspdf`/`jspdf-autotable`.** Dois helpers novos: `src/utils/pdfjs.ts`
  (`carregarPdfjs`) e `src/utils/pdfGerador.ts` (`carregarJsPDF`, carrega
  `jspdf`+`jspdf-autotable` juntos via `Promise.all`); `xlsx` e `mammoth`
  importados diretamente no ponto de uso, sem helper (só uma função por
  arquivo usa cada um). Tocou 6 arquivos: `useDetalhesContrato.ts`,
  `ModalNovoContrato.tsx` (extração de PDF/DOCX/XLSX), `Painel.tsx`,
  `DetalhesContrato.tsx` (relatórios PDF/Excel) e `ModalEmitirOS.tsx`
  (O.S. em PDF) — as funções que chamavam essas libs viraram `async`.
  Resultado do build: o bundle carregado de imediato (`index-*.js`, único
  `<script>` referenciado no `index.html`) caiu de ~897 KB + o chunk de
  1,78 MB (rotulado `geminiService` por um artefato de nomeação — era
  jsPDF+html2canvas, o SDK do Gemini já tinha saído do cliente na Fase 2,
  ver CLAUDE.md problema conhecido nº 6) para **~899 KB isolados**; xlsx
  (425 KB), pdf.js (410 KB), jsPDF (400 KB), mammoth (497 KB, chunk `lib`)
  e o plugin autoTable (30 KB) agora só carregam sob demanda, quando o
  usuário efetivamente sobe um arquivo ou pede um relatório.
- [x] **`pdf.worker` local em vez da CDN unpkg.** Resolvido junto do item
  acima: `carregarPdfjs()` aponta `GlobalWorkerOptions.workerSrc` para
  `new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href` —
  Vite empacota o worker como asset próprio (`pdf.worker-*.mjs`, ~2,1 MB,
  também sob demanda). Confirmado por grep: zero referências a
  `unpkg.com` restando no código-fonte (era o achado A3 da auditoria —
  dependia de CDN externa em runtime, sem SRI).
- [x] **Filtro por órgão do admin no servidor.** Investigado antes de
  mexer: **já resolvido desde a Fase 3** (`useContratos.ts` já fazia
  `where('orgaoId','==', orgaoId)` server-side) — nenhuma mudança de
  código necessária nesta fase, mesmo padrão do achado do "fiscal com
  lista vazia" na Fase 5.
- [x] **`limit()` + paginação nas queries do Firestore.**
  `useContratos.ts`: a query principal ganhou
  `orderBy('numeroContrato', 'desc') + limit(tamanhoPagina)`
  (`tamanhoPagina` começa em 200, cresce em passos de 200 via
  `carregarMaisContratos`, novo botão "Carregar mais contratos" em
  `Painel.tsx` condicionado a `temMais`). Não é paginação por cursor
  (`startAfter`) — a cada "carregar mais" a query inteira é reexecutada
  com um `limit` maior; decisão deliberada porque cursor real não
  combina bem com `onSnapshot` em tempo real (documentos podem ser
  inseridos/removidos entre páginas) e o app não tinha esse problema
  antes. **Achado do `revisor-pmp`, corrigido nesta mesma sessão**:
  `where()` em um campo + `orderBy()` em campo diferente normalmente
  exige um índice composto do Firestore que não é coberto pelos índices
  automáticos de campo único — sem ele, a query falha em runtime com
  "the query requires an index", erro que não aparece no `tsc -b`/`vite
  build` local (mesma classe de problema do incidente da Fase 3 com os
  imports de `api/`, mas do lado do Firestore). Corrigido criando
  `firestore.indexes.json` (dois índices: `orgaoId`+`numeroContrato` para
  admin, `emailSecretaria`+`numeroContrato` para viewer) e referenciando
  em `firebase.json`. **Não determinado**: os índices não foram
  publicados nesta sessão — não há Firebase CLI configurado neste
  ambiente (mesma limitação já registrada na Fase 2 para
  `firestore.rules`). Publicar com `firebase deploy --only
  firestore:indexes` (ou criar manualmente pelo link que o próprio erro
  do Firestore mostra no console do navegador na primeira vez que a query
  rodar) é pendência manual antes desta parte da fase valer em produção
  — ver lista de pendências abaixo.
- [x] **`useMemo` na ordenação/filtragem de `useContratos.ts`.**
  `contratosOrdenados` e `contratosFiltrados` só recalculam quando
  `contratos`/`ordenacao` ou `termoBusca` mudam, respectivamente — antes
  rodavam a cada renderização (inclusive a cada tecla digitada na busca).
- [x] **Limpar IndexedDB (cache persistente do Firestore) no logout.**
  `Painel.tsx`: `lidarComSaida` faz `terminate(db)` seguido de
  `clearIndexedDbPersistence(db)` após o `signOut()`, com reload completo
  (`window.location.href`, não `navigate()`) porque `db` fica inutilizável
  na aba depois do `terminate`. **Achado do `revisor-pmp`, corrigido
  nesta mesma sessão**: `firebase.ts` usa `persistentMultipleTabManager`,
  que compartilha o IndexedDB entre abas da mesma origem —
  `clearIndexedDbPersistence` rejeita (comportamento documentado da
  própria API de IndexedDB, não bug deste código) se houver outra aba do
  sistema aberta, exatamente o cenário de "computador compartilhado" que
  essa limpeza deveria cobrir (achado A9 da auditoria). O catch agora
  mostra um toast avisando o usuário em vez de falhar em silêncio
  ("Sessão encerrada, mas não foi possível limpar todos os dados locais
  ... feche todas as abas"). `signOut()` também ganhou tratamento de erro
  próprio (não tinha antes desta fase). **Não testado com múltiplas abas
  reais nesta sessão** — o comportamento acima é inferido da documentação
  do IndexedDB/Firestore, não confirmado empiricamente; candidato a
  verificação manual (abrir duas abas, fazer logout numa, checar se a
  outra ainda lê dados do cache).

**Build/lint/testes ao final da fase** (baseline da Fase 5: build 0 erros,
lint 46 erros, 21 testes): build **0 erros** (idêntico). Bundle inicial
caiu de ~2,7 MB eager para ~899 KB (detalhe acima). Lint **46 erros**
(idêntico) — confirmado por diff completo (`eslint --format json`,
agrupado por arquivo+regra) contra a baseline da Fase 5: **zero
diferenças**, nenhuma categoria nova, nenhuma removida. Vitest **21/21
passando** (sem testes novos — nenhuma lógica de domínio financeira nova
nesta fase, escopo do Vitest continua restrito a isso por decisão já
tomada).

**Revisão:** `revisor-pmp` rodado no diff completo desta fase. Três
achados: o índice composto do Firestore ausente para a nova query paginada
(corrigido — `firestore.indexes.json` criado, publicação pendente, ver
acima), a limpeza de IndexedDB falhando em silêncio com múltiplas abas
(corrigido — aviso ao usuário via toast, ver acima) e `auth.signOut()` sem
tratamento de erro (corrigido, tratamento de erro adicionado). Os três
ficaram resolvidos nesta mesma sessão, exceto a publicação do índice em
si, que depende do Firebase CLI/Console (pendência manual, listada
abaixo).

**Teste visual**: `npm run dev` (porta 5174) + Playwright Chromium
headless. Tela de login carregou sem erro de console. Não foi possível
testar os fluxos de upload de PDF/DOCX/XLSX, geração de relatórios, nem o
logout com múltiplas abas nesta sessão — mesma limitação de ambiente já
registrada nas fases anteriores (sem conta de teste configurada
localmente).

**Pendências manuais:**
1. Publicar os índices compostos de `firestore.indexes.json` no projeto
   Firebase (`firebase deploy --only firestore:indexes`, ou criar
   manualmente pelo link que aparece no erro "the query requires an
   index" na primeira vez que a query de `useContratos.ts` rodar contra o
   Firestore real). Sem isso, `/painel` vai quebrar com erro de
   permissão/índice ao carregar a lista de contratos — testar antes do
   próximo deploy.
2. Confirmar manualmente o comportamento da limpeza de IndexedDB no
   logout com duas abas do sistema abertas simultaneamente (ver achado do
   `revisor-pmp` acima) — não bloqueia o uso do sistema de nenhuma forma
   (o toast de aviso já cobre o caso de falha), mas vale confirmar que o
   aviso aparece quando esperado.

## Fase 7 — Refatoração (concluída em 03/08/2026)

- [x] **Eliminar duplicações.** Seis extrações, cada uma com comentário no
  código apontando os pontos de uso originais: `src/utils/extrairTexto.ts`
  (leitura de PDF/DOCX, antes duplicada entre `useDetalhesContrato.ts` e
  `ModalNovoContrato.tsx`), `api/_shared/firebaseAdmin.ts`
  (`inicializarFirebaseAdmin`, consolidando o bloco de init repetido nos 5
  arquivos de `api/`), `src/utils/xlsxGerador.ts` (`gerarPlanilhaXlsx`,
  antes duplicada entre os dois relatórios Excel), `src/utils/orgaos.ts`
  (`NOMES_ORGAOS`, antes duplicado — e ligeiramente divergente, uma cópia
  tinha a sigla entre parênteses e a outra não — entre `Painel.tsx` e
  `DetalhesContrato.tsx`), e os fragmentos repetidos dos dois prompts do
  Gemini em `api/extrair-documento.ts` (`REGRA_ANTI_INJECAO`,
  `SCHEMA_ITENS`, `envolverDocumento`). "Importação XLSX" do checklist
  original já tinha virado `import()` dinâmico na Fase 6; o que restava
  duplicado era a lógica de geração em si, coberta pelo `xlsxGerador.ts`.
- [x] **Instalar `@vercel/node`, tipar os handlers de `/api`.** Os 6
  arquivos (`create-user`, `list-users`, `definir-perfil`,
  `cron-vencimentos`, `extrair-documento`, `_shared/verificarAdmin`)
  trocaram `(req: any, res: any)` por `(req: VercelRequest, res:
  VercelResponse)`. `req.body` continua sendo `any` no tipo da lib
  (decisão do próprio `@vercel/node`), então cada handler faz
  `req.body as { campo?: tipo }` no destructuring — só afeta o
  TypeScript, a validação em runtime (`if (!email) return
  res.status(400)...`, `PERFIS_VALIDOS.includes(...)`) continua
  acontecendo depois, e em `definir-perfil.ts` ficou até mais estrita
  (`!perfil`/`!orgaoId` explícitos antes do `.includes()`, evitando passar
  `undefined` pra ele). `JSON.parse(envVar)` (service account) passou a
  ser `as ServiceAccount` em vez de implícito `any`.
- [x] **Reduzir os `any`.** Baseline real desta sessão: 33 (não os 36 do
  CLAUDE.md, que já tinha caído um pouco nas fases anteriores). Resultado:
  **zero** `any` explícito em todo o repositório (`src/`, `api/`,
  `scripts/`) — muito além da meta de "menos de 5". A tipagem dos
  handlers de `/api` (item acima) já eliminou 14 de uma vez; o resto foi
  corrigido na origem: `geminiService.ts` ganhou um genérico
  `chamarExtracaoIA<T>` (elimina a propagação de `any` para
  `useDetalhesContrato.ts` e `ModalNovoContrato.tsx` de uma vez, em vez de
  um cast em cada consumidor), `src/vite-env.d.ts` tipou
  `import.meta.env.VITE_*`, `src/types/types.ts` ganhou `RespostaApi`
  para tipar `await response.json()` nos três fetches para `/api` do
  cliente, e casts pontuais (`as ServiceAccount`, `as Record<string,
  unknown>`) substituíram os `any` que restavam em `JSON.parse`.
- [x] **Corrigir os 4 `react-hooks/set-state-in-effect`**
  (`ModalEditarItemCatalogo`, `ModalEmitirOS`, `ModalEditarContrato`,
  `ModalNovoContrato`) — todos tinham o mesmo padrão: um `useEffect`
  sincronizando prop→state toda vez que o modal abria. Corrigido pela
  raiz, não com gambiarra: o componente pai passou a só montar o modal
  quando `isOpen` é `true` (`{isOpen && <Modal ... />}`) em vez de manter
  o componente sempre montado com um `if (!isOpen) return null` interno;
  o estado inicial passou a vir de um lazy initializer do `useState`
  (`useState(() => ({...itemOriginal}))`), que roda uma vez por
  montagem — e como o componente só monta quando deve abrir, isso já
  cobre o caso de sincronizar com a prop, sem efeito nenhum. Efeito
  colateral positivo: `ModalNovoContrato.tsx` agora sempre abre com
  formulário limpo (antes, cancelar sem salvar e reabrir mantinha os
  campos preenchidos, já que o componente nunca desmontava).
- [x] **Quebrar `ModalNovoContrato` (494→434 linhas), `Painel`
  (360→288), `DetalhesContrato` (457→379).** Seis componentes novos,
  todos puramente apresentacionais (recebem dados prontos e callbacks,
  sem estado que precisasse ser movido com cuidado especial):
  `TabelaContratos.tsx` e `CatalogoItensPreviaForm.tsx` (Painel/ModalNovoContrato),
  `CatalogoItensContrato.tsx` e `HistoricoAditivos.tsx`
  (DetalhesContrato), `ModalBuscarEmail.tsx` e `ModalCadastrarEmail.tsx`
  (os dois sub-modais de e-mail do ModalNovoContrato). Não é uma reescrita
  completa da arquitetura desses 3 arquivos — é uma primeira extração
  segura e verificável; ainda sobra espaço para quebrar mais
  (`ModalNovoContrato.tsx` continua o maior dos três).
- [x] **ESLint type-aware** (`tseslint.configs.recommendedTypeChecked` +
  `parserOptions.projectService`). Ligar a regra gerou **165 erros novos**
  de uma vez — não foi corrigido erro a erro sem critério; a causa de
  cada categoria foi resolvida na origem:
  - `no-misused-promises` (~25 ocorrências): configurado com
    `checksVoidReturn: { attributes: false }` — a opção oficial do
    próprio typescript-eslint para o padrão `onClick={async () =>
    ...}`, predominante neste projeto (toast.loading → await →
    toast.success/error) e que o React já tolera de propósito.
  - `no-unsafe-*` (~110 ocorrências): quase todas vinham de duas fontes —
    `geminiService.ts` sem tipo de retorno e `import.meta.env` sem
    augmentation — corrigidas na origem (ver item "Reduzir os any"
    acima), o que fez a maioria cair em cascata.
  - `lastAutoTable` do jspdf-autotable (propriedade injetada em runtime,
    ausente dos tipos oficiais do jsPDF): em vez de castear em cada
    ponto de uso, virou module augmentation
    (`src/types/jspdf-autotable.d.ts`), então nenhum cast é mais
    necessário nos dois call sites.
  - Resto (`no-floating-promises`, `no-unnecessary-type-assertion`,
    `no-base-to-string`, `require-await`): corrigidos um a um,
    pontuais.
- [x] **`/simplify` no final.** 4 agentes em paralelo (reuse,
  simplification, efficiency, altitude) sobre o diff completo da fase.
  Achados aplicados: helper `quebrarTexto()` em `src/utils/pdfGerador.ts`
  substituindo o cast de `splitTextToSize` duplicado 5 vezes entre
  `DetalhesContrato.tsx` e `ModalEmitirOS.tsx`; `src/utils/statusContrato.ts`
  unificado numa função só `infoVencimento()` (antes
  `corLinhaPorVencimento`/`tituloPorVencimento` recalculavam
  `statusVencimento` cada uma por conta própria — `TabelaContratos.tsx`
  chamava as duas por linha renderizada). Achado de "efficiency" sobre
  esse mesmo ponto anotado como não-regressão (padrão já existia em
  `Painel.tsx` antes desta fase) e resolvido do mesmo jeito.

**Build/lint/testes ao final da fase** (baseline da Fase 6: build 0 erros,
lint 46 erros, 21 testes): build **0 erros** (idêntico). Lint **0 erros** —
não é "sem regressão", é uma redução real de 46 para 0 (os 46 da Fase 6
incluíam os ~30 `any`/handlers de `/api` não tipados que este fase
eliminou, mais o ganho líquido de ligar `recommendedTypeChecked` e ainda
assim fechar em zero). Vitest **21/21 passando** (mesmos testes, nenhuma
lógica de domínio nova nesta fase). `any` explícito: **zero** em todo o
repositório (baseline desta sessão: 33).

**Revisão:** duas rodadas. `/simplify` (4 agentes em paralelo) encontrou
duplicação de casts jsPDF e cálculo de status duplicado, ambos corrigidos
(ver acima). `revisor-pmp` no diff completo da fase: **nenhum achado** —
conferiu especificamente que a tipagem de `req.body` não enfraqueceu
nenhuma validação em runtime, que os 4 modais refatorados preservaram
fechar por clique no overlay e (onde já existia) por ESC, que `RespostaApi`
bate com o que cada endpoint devolve de verdade, e que nada das Fases 5/6
(transações do Firestore, `parseDataLocal`, paginação, limpeza de
IndexedDB) foi tocado por engano durante a extração de componentes.

**Teste visual**: `npm run dev` + Playwright Chromium headless (Playwright
precisou ser reinstalado com `--no-save` nesta sessão — tinha sumido do
`node_modules` depois do `npm install @vercel/node`; confirmado que não
vazou para `package-lock.json`). Tela de login carregou sem erro de
console.

**Achado não-crítico registrado, não corrigido nesta fase:** a extração de
`extrairTexto.ts` unificou o comportamento para arquivos que não são
`.pdf`/`.docx` — antes `ModalNovoContrato.tsx` produzia string vazia
nesse caso, `useDetalhesContrato.ts` já fazia fallback para `file.text()`;
agora os dois fazem `file.text()`. Mudança de comportamento pequena e
provavelmente benéfica (efeito colateral da consolidação, não um bug
introduzido de propósito), sinalizada pelo `revisor-pmp` como nuance, não
como achado formal.

**Pendências:** nenhuma bloqueante. `ModalNovoContrato.tsx` (434 linhas)
continua o maior arquivo do projeto — candidato a uma segunda rodada de
extração numa fase futura, se o incômodo justificar (não estava no
critério de conclusão desta fase, que era "quebrar", não atingir um
número de linhas específico).

## Fase 8 — Fechamento (concluída em 03/08/2026)

- [x] **README real** substituindo o template do Vite. Cobre stack,
  variáveis de ambiente (tabela resumida + link para `.env.example`),
  scripts, estrutura de pastas, deploy e testes; aponta para `CLAUDE.md`
  (arquitetura/convenções) e `docs/PLANO.md` (histórico) em vez de
  duplicar o conteúdo dos dois.
- [x] **CI no GitHub Actions** (`.github/workflows/ci.yml`): `npm ci` →
  `npm run build` (`tsc -b && vite build`) → `npm run lint` → `npm run
  test`, em push/PR para `main`. Node 22 (LTS), sem step de deploy — a
  Vercel já cuida disso separadamente a partir de `main`. Não verificável
  a partir deste repositório se vai passar na primeira execução real no
  GitHub (não determinado — depende do ambiente do runner, não testável
  localmente); os 4 comandos rodam limpos localmente com o mesmo
  `package-lock.json` que o `npm ci` vai usar.
- [x] **`/security-review` final** no diff completo das Fases 5-8
  (`main...HEAD`). Processo de 3 etapas (identificação → filtro de
  falsos-positivos em paralelo → corte por confiança ≥8) collapsou na
  primeira etapa: **nenhuma vulnerabilidade encontrada**, então não houve
  achados para filtrar. Pontos checados especificamente e descartados:
  os casts `req.body as {...}` nos handlers de `/api` não enfraqueceram
  nenhuma validação de runtime (`definir-perfil.ts` até ficou mais
  estrito); `verificarAdmin.ts` manteve a lógica de verificação de token
  e claim idêntica, só mudou a assinatura de tipos; os delimitadores
  `===DOCUMENTO===` contra prompt injection em `extrair-documento.ts`
  saíram intactos da extração dos fragmentos compartilhados do prompt;
  as transações do Firestore e a paginação (Fases 5 e 6) continuam
  sujeitas às mesmas Firestore Rules, sem bypass de autorização
  introduzido; nenhum `dangerouslySetInnerHTML`/`eval`/`innerHTML` em
  todo o diff.
- [x] **Backlog registrado** (não implementado nesta fase — o item do
  checklist original já pedia só o registro, não a construção): o log de
  auditoria (`src/services/auditService.ts`, coleção `auditoria_logs`)
  hoje registra só 5 ações — `EXCLUSÃO CONTRATO`, `EXCLUSÃO ADITIVO`,
  `ADITIVO` (criação/edição), `DISTRATO`, `EDIÇÃO CATÁLOGO` (todas em
  `useDetalhesContrato.ts`). Faltam: criação de contrato
  (`ModalNovoContrato.tsx`), edição de contrato
  (`ModalEditarContrato.tsx`), criação de usuário (`ModalNovoContrato.tsx`
  fluxo inline, `ModalGerenciarUsuarios.tsx`) e login — nenhum desses
  fluxos chama `registrarLog`. Não há tela nenhuma que leia
  `auditoria_logs`; a coleção só recebe escritas. Duas tarefas de backlog
  distintas para uma fase futura: (1) adicionar `registrarLog` aos 4
  fluxos que faltam; (2) construir uma tela (provavelmente só para admin)
  que liste `auditoria_logs` ordenado por `timestamp`. Nenhuma das duas
  é urgente — o sistema ainda não está em uso real — mas ambas exigem
  atenção às Firestore Rules já publicadas (`auditoria_logs`: só
  `create`, ninguém pode `read`/`update`/`delete` hoje; a tela de consulta
  vai precisar de uma regra de leitura nova, provavelmente restrita a
  `perfil == 'admin'`).

**Build/lint/testes ao final da fase** (baseline da Fase 7: build 0 erros,
lint 0 erros, 21 testes): build **0 erros**, lint **0 erros**, Vitest
**21/21 passando** — idêntico, sem regressão. Nenhuma mudança de código de
produção nesta fase (só documentação, CI e a revisão de segurança), então
não havia expectativa de diferença.

**Pendências:** nenhuma bloqueante. Itens que dependem de ações fora
deste repositório, já registrados nas fases correspondentes e ainda em
aberto: publicar os índices de `firestore.indexes.json` no console do
Firebase (Fase 6, bloqueante para `/painel` funcionar em produção depois
do próximo deploy), apagar a conta-robô `BOT_EMAIL` (Fase 3, item 5), e
confirmar visualmente a primeira execução do workflow de CI no GitHub
após o merge em `main` (não verificável a partir daqui).

---

## Fechamento do plano de evolução

As 8 fases planejadas foram concluídas (Fase 0 em 31/07/2026 até Fase 8
em 03/08/2026). Este arquivo continua sendo o registro histórico de cada
fase — decisões, achados de revisão, incidentes e pendências — e deve
continuar sendo atualizado se o trabalho no repositório continuar em
fases futuras (ex: uma "Fase 9" para os itens de backlog registrados
acima, ou para as pendências manuais que ainda restam nas Fases 3 e 6).
