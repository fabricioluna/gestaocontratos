// src/utils/orgaos.ts

// Mapa de órgãoId → nome de exibição, antes duplicado (e ligeiramente
// divergente — Painel.tsx incluía a sigla entre parênteses, DetalhesContrato.tsx
// não) entre Painel.tsx e DetalhesContrato.tsx (Fase 7).
export const NOMES_ORGAOS: Record<string, string> = {
  prefeitura: 'Prefeitura Municipal de Pesqueira',
  fmas: 'Fundo Municipal de Assistência Social (FMAS)',
  fme: 'Fundo Municipal de Educação (FME)',
  fms: 'Fundo Municipal de Saúde (FMS)',
};
