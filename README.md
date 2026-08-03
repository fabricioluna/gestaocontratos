# Gestão de Contratos PMP

Sistema de gestão de contratos administrativos da Prefeitura Municipal de
Pesqueira (PE) e dos fundos FMS, FME e FMAS: cadastro de contratos e
catálogo de itens, extração automática de dados de contratos/aditivos via
IA, registro de termos aditivos e distratos, emissão de Ordens de
Serviço/Solicitações de Compra em PDF, relatórios em PDF/Excel e alerta
automático por e-mail de contratos a vencer.

> Ainda não está em uso real — os únicos usuários no Firebase Auth são
> contas de teste. URL de deploy: gestaocontratospmp.vercel.app.

## Stack

- SPA React 19 + TypeScript 5.9 (strict) + Vite 8, `react-router-dom` 7
- Cloud Firestore + Firebase Authentication (custom claims para RBAC)
- 5 funções serverless na Vercel em `api/` (`firebase-admin`, `nodemailer`)
- `@google/generative-ai` (Gemini 2.5 Flash) chamado só do servidor, em
  `api/extrair-documento.ts`
- `pdfjs-dist`, `mammoth`, `xlsx`, `jspdf` — todos carregados sob demanda
  via `import()` dinâmico, não entram no bundle inicial
- Vitest para a lógica financeira pura em `src/domain/`

Detalhes de arquitetura, decisões e convenções do código estão em
[`CLAUDE.md`](CLAUDE.md). O histórico da evolução do projeto — o que foi
feito em cada fase, incidentes e o porquê das decisões — está em
[`docs/PLANO.md`](docs/PLANO.md).

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com os valores reais (ver abaixo)
npm run dev
```

### Variáveis de ambiente

Ver [`.env.example`](.env.example) para a lista completa com comentários.
Resumo:

| Variável | Onde é usada | Observação |
|---|---|---|
| `VITE_FIREBASE_*` (6) | Cliente | Config pública do Firebase Web SDK — protegida pelas Security Rules, não por sigilo |
| `GEMINI_API_KEY` | `api/extrair-documento.ts` | Nunca deve ter prefixo `VITE_` |
| `FIREBASE_ADMIN_CREDENTIALS` | Todos os handlers de `api/` + `scripts/migrar-perfis.ts` | JSON da service account, numa linha só |
| `CRON_SECRET` | `api/cron-vencimentos.ts` | Em produção a Vercel injeta sozinha; só precisa ser definida aqui para rodar o cron localmente |
| `EMAIL_USER` / `EMAIL_PASS` | `api/create-user.ts`, `api/cron-vencimentos.ts` | Conta Gmail; `EMAIL_PASS` é senha de app, não a senha da conta |
| `EMAIL_CC` | `api/cron-vencimentos.ts` | Opcional |

Nunca criar variáveis `VITE_*` novas para segredos — qualquer coisa com
esse prefixo entra no bundle público servido ao navegador.

## Scripts

```bash
npm run dev             # servidor de desenvolvimento (Vite)
npm run build            # tsc -b && vite build
npm run lint              # eslint . (type-aware, ver eslint.config.js)
npm run test               # vitest run
npm run migrar:perfis       # script one-off — atribui perfil/orgaoId aos usuários de teste
```

## Estrutura

```
api/                  Funções serverless da Vercel (create-user, list-users,
                       definir-perfil, cron-vencimentos, extrair-documento)
src/domain/            Lógica financeira pura, coberta por Vitest
src/hooks/              useContratos, useDetalhesContrato — leituras/escritas no Firestore
src/services/            geminiService — fetch autenticado para /api/extrair-documento
src/components/          Componentes de UI, organizados por tela (Painel/, DetalhesContrato/)
src/utils/                Helpers puros (formatação, extração de arquivo, geração de PDF/Excel)
firestore.rules            Regras do Firestore (versionadas aqui, publicadas manualmente no console)
firestore.indexes.json       Índices compostos do Firestore
```

## Deploy

Deploy automático na Vercel a partir de `main`. O cron de alertas de
vencimento roda diariamente às 11h UTC (ver `vercel.json`).

Mudanças em `firestore.rules` e `firestore.indexes.json` **não** são
publicadas automaticamente — precisam ser aplicadas manualmente no console
do Firebase (ou via `firebase deploy`, não configurado neste ambiente).

## Testes

```bash
npm run test
```

Cobertura restrita à lógica financeira pura em `src/domain/`
(`parseMoeda`, recálculo de valor global, acréscimo/supressão de aditivos,
regra dos 25%, dias até vencimento) — decisão registrada em
[`docs/PLANO.md`](docs/PLANO.md).

## Segurança

Convenções de segurança do projeto (RBAC via custom claims, Firestore
Rules, segredos de servidor vs. cliente) estão documentadas em
[`CLAUDE.md`](CLAUDE.md). Não escrever o valor de nenhuma chave, token ou
senha em código, commit ou issue.
