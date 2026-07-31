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

## Fase 2 — Segurança do servidor

**Objetivo:** eliminar os riscos críticos que não dependem da decisão de RBAC.

- [ ] `auditoria_logs`: adicionar regra própria nas Firestore Rules
  (`allow create: if request.auth != null;`, sem update/delete)
- [ ] Versionar `firestore.rules` + `firebase.json` no repositório
- [ ] Novo endpoint `POST /api/extrair-documento`: move a chamada ao
  Gemini do cliente para o servidor
- [ ] `geminiService.ts` passa a chamar `/api/extrair-documento`, não o
  Google diretamente
- [ ] Renomear `VITE_GEMINI_API_KEY` → `GEMINI_API_KEY` (perde o prefixo
  `VITE_`, some do bundle)
- [ ] `verifyIdToken` (firebase-admin) em `/api/create-user` e
  `/api/list-users`
- [ ] Validar `Authorization: Bearer $CRON_SECRET` em
  `/api/cron-vencimentos`
- [ ] Trocar senha provisória por e-mail por `crypto.randomBytes` + link
  de redefinição do Firebase
- [ ] Parar de devolver `error.message` bruto ao cliente nos handlers de
  `/api`; logar no servidor
- [ ] Delimitar o texto do documento no prompt do Gemini agora que passa
  pelo servidor
- [ ] `/security-review` no final
- [ ] Rotacionar a chave do Gemini (só depois do proxy estar de pé)

## Fase 3 — RBAC com custom claims

- [ ] Pedir desenho ao agente `Plan` antes de codificar (fase com
  trade-offs reais)
- [ ] Endpoint `POST /api/definir-perfil`, só admin
- [ ] Login lê `getIdTokenResult()` em vez de inferir perfil por substring
  do e-mail
- [ ] `ProtectedRoute` usa `onAuthStateChanged`, não `sessionStorage`
- [ ] Firestore Rules validam `request.auth.token.perfil` e `.orgaoId`
  para `contratos`/`itens` (a regra definitiva que a Fase 2 adiou)
- [ ] Cron migra para `firebase-admin` (mata a conta-robô com credenciais
  estáticas)
- [ ] Script de migração dos 6 usuários existentes (ver achado 0.3)
- [ ] Verificação: `sessionStorage.setItem('perfilLogado','admin')` no
  DevTools não deve dar mais acesso a nada

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
