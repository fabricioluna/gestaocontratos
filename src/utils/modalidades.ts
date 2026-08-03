// src/utils/modalidades.ts

// Lista única de modalidades de licitação, usada tanto no cadastro quanto
// na edição de contrato. Antes cada modal tinha sua própria lista de
// <option>, divergentes entre si — um contrato cadastrado com uma opção que
// só existia no modal de cadastro abria na edição com o <select> sem
// nenhuma correspondência, e salvar sem mexer no campo gravava um valor
// diferente do original (achado M9 da auditoria, Fase 5).
export const MODALIDADES_LICITACAO = [
  'Pregão Eletrônico',
  'Pregão Presencial',
  'Concorrência',
  'Dispensa',
  'Inexigibilidade',
  'Credenciamento',
  'Contratação Direta',
] as const;
