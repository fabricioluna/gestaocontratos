// src/domain/vencimento.ts

// "YYYY-MM-DD" interpretado como data local (meia-noite no fuso da
// máquina), não UTC — `new Date("YYYY-MM-DD")` faz o JS interpretar como
// UTC, o que divergia em até 1 dia do parsing manual que
// api/cron-vencimentos.ts já fazia (ver CLAUDE.md, problema conhecido nº 2,
// corrigido na Fase 5 alinhando o cliente ao cron, não o contrário).
export const parseDataLocal = (dataStr: string): Date => {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
};

export const diasAteVencimento = (dataFim: string, hoje: Date = new Date()): number => {
  const hojeZerado = new Date(hoje);
  hojeZerado.setHours(0, 0, 0, 0);
  const vencimento = parseDataLocal(dataFim);
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
