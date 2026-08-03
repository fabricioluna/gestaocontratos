// src/utils/statusContrato.ts
import type { CSSProperties } from 'react';
import { diasAteVencimento, statusVencimento } from '../domain/vencimento';
import type { StatusVencimento } from '../domain/vencimento';

// Estilo e texto de status por vencimento — usado na tabela do painel
// (cor da linha) e no relatório Excel (coluna "Status Atual"). Uma função
// só computando o status uma vez e devolvendo os dois valores juntos, em
// vez de duas funções que cada uma recalculava `statusVencimento` (achado
// do /simplify, Fase 7 — a tabela chamava as duas por linha renderizada).
const INFO_POR_STATUS: Record<StatusVencimento, { style: CSSProperties; titulo: string }> = {
  vencido: { style: { backgroundColor: '#64748b', color: '#ffffff' }, titulo: 'Contrato Vencido' },
  critico: { style: { backgroundColor: '#ffd5d5', color: '#900' }, titulo: 'Atenção: Vencimento em menos de 30 dias' },
  atencao: { style: { backgroundColor: '#fff9c4', color: '#856404' }, titulo: 'Aviso: Vencimento em menos de 3 meses' },
  vigente: { style: {}, titulo: 'Vigente' },
};

export const infoVencimento = (dataFim: string): { style: CSSProperties; titulo: string } => {
  if (!dataFim) return { style: {}, titulo: 'Status Desconhecido' };
  return INFO_POR_STATUS[statusVencimento(diasAteVencimento(dataFim))];
};
