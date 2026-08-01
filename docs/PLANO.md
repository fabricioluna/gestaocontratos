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

## Fase 3 — RBAC com custom claims (código concluído em 01/08/2026; publicação em produção pendente de ações manuais)

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
3. Pedir para as 6 contas de teste fazerem logout/login uma vez após o
   deploy — garante token com claims atualizado no navegador de cada uma.
4. **Publicar `firestore.rules` no console do Firebase** — só depois dos
   passos 1-3 confirmados; publicar antes travaria as 6 contas de teste
   (claims corretos no Auth, mas token em cache no navegador sem eles
   ainda). Mesmo fluxo manual da Fase 2 (sem Firebase CLI configurada
   neste ambiente).
5. Apagar a conta-robô (e-mail em `BOT_EMAIL`) no Firebase Auth Console e
   remover `BOT_EMAIL`/`BOT_PASS` das env vars da Vercel — só depois de
   confirmar que o cron novo (`firebase-admin`) está funcionando.
6. Depois do passo 4: validar manualmente (não só por leitura de código)
   que um viewer lê `itens` de um contrato que é dele por `emailSecretaria`
   mas não por `orgaoId`, com pelo menos 1 conta admin e 1 conta viewer
   reais — a regra de `itens` usa `get()` cruzando documento, apontada pelo
   agente `Plan` como o ponto mais fácil de acertar errado silenciosamente.
7. Confirmar no dashboard de Functions da Vercel que
   `api/_shared/verificarAdmin.ts` não virou uma rota pública própria (a
   convenção de prefixo `_` deveria evitar isso, mas não foi verificado
   fora do repositório).

## Fase 4 — Extrair lógica pura + Vitest

- [ ] Extrair para `src/domain/`: cálculo de valor global com aditivos,
  acréscimo/supressão, regra dos 25%, dias até vencimento, `parseMoeda`
- [ ] Vitest, 15-25 testes cobrindo esses pontos

## Fase 5 — Correção de bugs

- [ ] Datas UTC vs. hora local (divergência de um dia)
- [ ] `updateDoc` sem transação em `valorTotal`/`aditivos`
- [ ] `ModalEditarContrato` regrava `id` e `aditivos` por engano
- [ ] Modalidades divergentes entre cadastro e edição
- [ ] Falha de e-mail no cron cancela todos os alertas do dia (janela de
  vencimento perdida para sempre)
- [ ] `onSnapshot` sem callback de erro em `useDetalhesContrato.ts`
- [ ] Contrato inexistente = "A carregar..." eterno
- [ ] Fiscal com lista vazia permanente (race condition no useEffect)
- [ ] Toast preso sem `{ id: toastId }` no catch de `salvarAditivo`
- [ ] Contrato distratado ainda editável pelo botão do painel

## Fase 6 — Desempenho

- [ ] `import()` dinâmico para `xlsx`, `pdfjs-dist`, `mammoth`, `jspdf`
  (prioridade: `geminiService`, hoje 1,78 MB no bundle — ver Fase 1)
- [ ] `pdf.worker` local em vez da CDN unpkg
- [ ] Filtro por órgão do admin no servidor (hoje o navegador recebe todos
  os contratos de todos os órgãos)
- [ ] `limit()` + paginação nas queries do Firestore
- [ ] `useMemo` na ordenação/filtragem de `useContratos.ts`
- [ ] Limpar IndexedDB (cache persistente do Firestore) no logout

## Fase 7 — Refatoração

- [ ] Quebrar `ModalNovoContrato` (494 linhas), `Painel` (327),
  `DetalhesContrato` (454)
- [ ] Corrigir os 4 `react-hooks/set-state-in-effect` (ver achado da Fase 1)
- [ ] Eliminar duplicações: extração de PDF, init do firebase-admin,
  funções do Gemini, `nomesOrgaos`, importação XLSX
- [ ] Instalar `@vercel/node`, tipar os handlers de `/api`
- [ ] Reduzir os `any` (baseline: 36 após Fase 1) — meta: menos de 5
- [ ] ESLint type-aware (`recommendedTypeChecked` + `parserOptions.project`)
- [ ] `/simplify` no final

## Fase 8 — Fechamento

- [ ] README real substituindo o template do Vite
- [ ] CI no GitHub Actions (`tsc` + lint + vitest)
- [ ] `/security-review` final
- [ ] Backlog: tela de consulta do log de auditoria; cobertura do log
  para criação/edição de contrato (hoje só 5 ações são registradas)
