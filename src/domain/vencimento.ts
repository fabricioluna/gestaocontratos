// src/domain/vencimento.ts

// Mesma leitura de data que já era feita em Painel.tsx: `new Date(dataFim)`
// interpreta "YYYY-MM-DD" como UTC (ver CLAUDE.md, problema conhecido nº 2).
// O cron (api/cron-vencimentos.ts) faz parsing manual em hora local e diverge
// desta função por até um dia — divergência conhecida, não corrigida nesta
// fase (Fase 5). Não trocar a implementação do cron por esta sem revisar
// esse problema primeiro.
export const diasAteVencimento = (dataFim: string, hoje: Date = new Date()): number => {
  const hojeZerado = new Date(hoje);
  hojeZerado.setHours(0, 0, 0, 0);
  const vencimento = new Date(dataFim);
  vencimento.setHours(0, 0, 0, 0);
  return Math.ceil((vencimento.getTime() - hojeZerado.getTime()) / (1000 * 60 * 60 * 24));
};

export type StatusVencimento = 'vencido' | 'critico' | 'atencao' | 'vigente';

export const statusVencimento = (diasEmDias: number): StatusVencimento => {
  if (diasEmDias < 0) return 'vencido';
  if (diasEmDias <= 30) return 'critico';
  if (diasEmDias <= 90) return 'atencao';
  return 'vigente';
};
