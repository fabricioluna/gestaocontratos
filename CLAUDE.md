# Gestão de Contratos PMP

Sistema de gestão de contratos administrativos da Prefeitura Municipal de
Pesqueira (PE) e dos fundos FMS, FME e FMAS. Ainda não está em uso real —
os únicos usuários no Firebase Auth são contas de teste. URL de deploy:
gestaocontratospmp.vercel.app.

Este repositório está em evolução guiada por um plano de fases — ver
`docs/PLANO.md` antes de iniciar qualquer trabalho. Cada fase roda numa
branch própria (`evolucao/fase-N`) e termina com o `docs/PLANO.md`
atualizado antes de um `/clear`.

## Stack real

- SPA React 19 + TypeScript 5.9 (strict) + Vite 8 (usa Rolldown por baixo),
  react-router-dom 7
- Cloud Firestore + Firebase Authentication (Firebase Web SDK 12) — **NÃO
  é Realtime Database**. Nunca sugerir `firebase/database`, `getDatabase`,
  `ref` ou `onValue`.
- 5 funções serverless na Vercel em `api/` (firebase-admin 12, nodemailer 9):
  `create-user`, `list-users`, `definir-perfil`, `cron-vencimentos`,
  `extrair-documento`. `api/_shared/verificarAdmin.ts` é um helper
  importado pelos 3 primeiros, não uma rota própria.
- `@google/generative-ai` 0.24.1, modelo `gemini-2.5-flash` — chamado do
  servidor em `api/extrair-documento.ts` desde a Fase 2.
  `src/services/geminiService.ts` no cliente só faz um `fetch` autenticado
  (token do Firebase Auth) para esse endpoint.
- `pdfjs-dist`, `mammoth`, `xlsx`, `jspdf` + `jspdf-autotable`,
  `react-hot-toast`
- CSS puro em 3 arquivos + muitos estilos inline no JSX
- Sem testes ainda (chegam na Fase 4, escopo restrito à lógica financeira
  com Vitest), sem CI ainda (Fase 8), sem biblioteca de componentes

## Fatos do domínio que valem como verdade

- Coleções do Firestore: `contratos` (com array embutido `aditivos`),
  `itens` (ligados por `contratoId`, campo
  `tipoRegistro: 'catalogo' | 'consumo'`) e `auditoria_logs`.
- Datas de contrato são strings `"YYYY-MM-DD"`. `dataUltimaAtualizacao` e
  `dataAdicao` são strings de `toLocaleString('pt-BR')`, não Timestamp.
  `new Date("YYYY-MM-DD")` é interpretado como UTC no navegador — tome
  cuidado ao comparar com lógica que faz parsing manual em hora local.
- Perfis: `'admin'` e `'viewer'`. Desde a Fase 3, são custom claims reais
  do Firebase Auth (`request.auth.token.perfil`), junto com `orgaoId`
  (`'prefeitura'|'fms'|'fme'|'fmas'`) — atribuídos via
  `POST /api/definir-perfil` (só admin). `sessionStorage` não tem mais
  nenhum papel em autorização; o estado de auth vem de
  `src/contexts/AuthContext.tsx` + `src/hooks/useAuth.ts`
  (`onAuthStateChanged` + `getIdTokenResult`).
- Firestore Security Rules (`firestore.rules`, publicado desde a Fase 3):
  `contratos` — admin só lê/escreve do próprio `orgaoId`, viewer só lê o
  contrato onde é o `emailSecretaria`. `itens` não têm `orgaoId`/
  `emailSecretaria` próprios — a regra faz `get()` do `contratos/{contratoId}`
  pai pra decidir. `auditoria_logs`: só `create`, e só se o campo
  `usuario` do documento bater com o e-mail do token
  (`request.auth.token.email`) — ninguém lê, edita ou apaga pela regra.

## Problemas conhecidos — não reintroduzir, não corrigir de surpresa

Cada um pertence a uma fase específica do plano (`docs/PLANO.md`). Se for
relevante para a tarefa atual, aponte em 1-2 frases; só corrija se for o
objetivo da fase em andamento.

1. `valorTotal` e o array `aditivos` são atualizados por read-modify-write
   sem transação (Fase 5). Ao mexer nesses caminhos, avisar sobre a
   condição de corrida em vez de silenciosamente "corrigir".
2. Datas: UTC no cliente vs. parsing manual em hora local no cron
   (Fase 5) — divergência de um dia já confirmada.
3. `onSnapshot` sem callback de erro em `useDetalhesContrato.ts` — falhas
   de permissão ou rede ficam mudas (Fase 5).
4. `react-hooks/set-state-in-effect` em 4 modais (sincronizar prop→state
   dentro de `useEffect` ao abrir) — achado do lint, não da auditoria
   original. Candidato de refactor na Fase 7.
5. Os handlers de `/api` usam `(req: any, res: any)` — `@vercel/node`
   não está instalado (Fase 7).
6. O chunk de build que hoje aparece com o nome `geminiService` (~1,76 MB
   minificado) na verdade é jsPDF + html2canvas agrupados por um artefato
   de nomeação do bundler — o SDK do Gemini saiu do cliente na Fase 2.
   Candidato a `import()` dinâmico na Fase 6 mesmo assim.

Resolvidos na Fase 2 (não reabrir): `VITE_GEMINI_API_KEY` exposta no
bundle, e `/api/create-user` / `/api/list-users` / `/api/cron-vencimentos`
sem verificação de chamador.

Resolvidos na Fase 3 (não reabrir): RBAC decorativo (perfil por substring
do e-mail em `sessionStorage`) e Firestore Rules sem autorização real —
ver `docs/PLANO.md` para o incidente de produção descoberto e corrigido
no fechamento desta fase (import relativo sem extensão `.js` quebrando
`create-user`/`list-users`/`definir-perfil` — ver convenção abaixo).

## Convenções do código

- Nomes de função, variáveis, comentários e mensagens de usuário são em
  português. Mantenha.
- O código mistura pt-BR e pt-PT ("A carregar", "guardar", "utilizador").
  Ao editar um arquivo, siga a variante que já está nele, não padronize
  por conta própria fora do escopo da tarefa.
- Feedback ao usuário é sempre `react-hot-toast`, padrão
  `toast.loading` → `toast.success`/`toast.error` passando `{ id: toastId }`.
  Não usar `alert()` nem `window.confirm()` em código novo.
- Escritas no Firestore ficam nos hooks (`src/hooks/`), não nos
  componentes.
- Leituras são `onSnapshot` em tempo real e devem sempre ter callback de
  erro (ver problema conhecido nº 3 — é uma lacuna a fechar, não um
  padrão a copiar).
- Tipos compartilhados vivem em `src/types/types.ts`.
- Nunca criar variáveis `VITE_*` novas para segredos — qualquer coisa com
  esse prefixo entra no bundle público. Segredos de servidor são lidos em
  `api/*.ts` via `process.env`, sem prefixo.
- **Imports relativos entre arquivos dentro de `api/` precisam da
  extensão `.js` explícita** (ex: `from './_shared/verificarAdmin.js'`,
  mesmo o arquivo de origem sendo `.ts`). A Vercel compila cada função de
  `api/` com `moduleResolution: node16`/`nodenext`, que exige isso — mas
  `tsconfig.node.json` usa `moduleResolution: "bundler"` (mais
  permissivo), então o `tsc -b` local **não pega esse erro**. Sem a
  extensão, o build da Vercel completa normalmente (não falha o deploy)
  mas a função quebra em runtime com `FUNCTION_INVOCATION_FAILED` em toda
  requisição — só aparece nos Build Logs da Vercel, não no terminal local.
  Isso já quebrou produção uma vez na Fase 3; checar isto primeiro se
  algum handler de `/api` voltar a dar 500 genérico sem log de aplicação.
  Pastas de `api/` prefixadas com `_` (ex: `_shared`) não viram rota
  pública — confirmado em produção; use esse prefixo para helpers.

## Como trabalhar neste repositório

- Antes de começar, leia `docs/PLANO.md` para saber em que fase estamos.
- Uma fase por branch (`evolucao/fase-N`), uma fase por sessão. Ao terminar
  uma fase, atualizar `docs/PLANO.md` com o que foi feito e o que ficou
  pendente antes de sugerir `/clear`.
- Rodar `npm run build` e `npm run lint` antes de considerar uma fase
  concluída; comparar contra os números registrados em `docs/PLANO.md`
  para não introduzir regressão silenciosa.
- Se algo depender das Security Rules publicadas, do painel da Vercel ou
  do console do Firebase — coisas fora do repositório — diga
  "não determinado" em vez de supor.
- Nunca escrever o valor de nenhuma chave, token ou senha em código,
  commit ou resposta, mesmo que apareça colado por engano. Nesse caso,
  avisar para rotacionar.
