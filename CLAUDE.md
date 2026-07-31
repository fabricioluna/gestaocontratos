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
- 3 funções serverless na Vercel em `api/` (firebase-admin 12, nodemailer 9)
- `@google/generative-ai` 0.24.1, modelo `gemini-2.5-flash` — hoje chamado
  do cliente em `src/services/geminiService.ts`; migra para o servidor na
  Fase 2 do plano.
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
- Perfis: `'admin'` e `'viewer'`. Até a Fase 3 do plano, são inferidos de
  substrings do e-mail no login e guardados em `sessionStorage` — isso é
  decorativo, não é controle de acesso real. A partir da Fase 3, viram
  custom claims do Firebase Auth.
- Firestore Security Rules hoje (antes da Fase 3): `contratos` e `itens`
  permitem `read, write` para qualquer usuário autenticado, sem checar
  quem é. Não trate isso como segurança real ao raciocinar sobre acesso
  a dados até a Fase 3 estar concluída.

## Problemas conhecidos — não reintroduzir, não corrigir de surpresa

Cada um pertence a uma fase específica do plano (`docs/PLANO.md`). Se for
relevante para a tarefa atual, aponte em 1-2 frases; só corrija se for o
objetivo da fase em andamento.

1. `VITE_GEMINI_API_KEY` é lida no cliente e fica exposta no bundle
   (Fase 2). Nunca criar variáveis `VITE_*` novas para segredos.
2. `/api/create-user`, `/api/list-users` e `/api/cron-vencimentos` não
   têm autenticação (Fase 2). Não adicionar endpoint novo sem verificação
   de chamador.
3. `valorTotal` e o array `aditivos` são atualizados por read-modify-write
   sem transação (Fase 5). Ao mexer nesses caminhos, avisar sobre a
   condição de corrida em vez de silenciosamente "corrigir".
4. Datas: UTC no cliente vs. parsing manual em hora local no cron
   (Fase 5) — divergência de um dia já confirmada.
5. `onSnapshot` sem callback de erro em `useDetalhesContrato.ts` — falhas
   de permissão ou rede ficam mudas (Fase 5).
6. `react-hooks/set-state-in-effect` em 4 modais (sincronizar prop→state
   dentro de `useEffect` ao abrir) — achado do lint, não da auditoria
   original. Candidato de refactor na Fase 7.
7. Os handlers de `/api` usam `(req: any, res: any)` — `@vercel/node`
   não está instalado (Fase 7).
8. `geminiService` sozinho gera um chunk de build de ~1.78 MB minificado —
   candidato a `import()` dinâmico na Fase 6.

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
  erro (ver problema conhecido nº 5 — é uma lacuna a fechar, não um
  padrão a copiar).
- Tipos compartilhados vivem em `src/types/types.ts`.

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
