import { describe, it, expect } from 'vitest';
import { diasAteVencimento, statusVencimento } from './vencimento';

// `hoje` é passado como new Date(ano, mes-1, dia) — data local, mesma leitura
// que `diasAteVencimento` agora faz internamente para `dataFim` via
// `parseDataLocal` (Fase 5: antes dataFim era lido como UTC via
// `new Date('YYYY-MM-DD')`, o que exigia esse mesmo truque para o teste
// independer do fuso da máquina; hoje ambos os lados são data local, então
// usar `new Date('YYYY-MM-DD')` aqui voltaria a quebrar em fusos != UTC).
describe('diasAteVencimento', () => {
  it('conta dias positivos para uma data futura', () => {
    expect(diasAteVencimento('2026-08-11', new Date(2026, 7, 1))).toBe(10);
  });

  it('conta dias negativos para uma data já vencida', () => {
    expect(diasAteVencimento('2026-07-20', new Date(2026, 7, 1))).toBe(-12);
  });

  it('retorna zero quando vence hoje', () => {
    expect(diasAteVencimento('2026-08-01', new Date(2026, 7, 1))).toBe(0);
  });
});

describe('statusVencimento', () => {
  it('classifica cada faixa de vencimento', () => {
    expect(statusVencimento(-1)).toBe('vencido');
    expect(statusVencimento(15)).toBe('critico');
    expect(statusVencimento(60)).toBe('atencao');
    expect(statusVencimento(120)).toBe('vigente');
  });

  it('respeita os limites exatos de cada faixa', () => {
    expect(statusVencimento(0)).toBe('critico');
    expect(statusVencimento(30)).toBe('critico');
    expect(statusVencimento(31)).toBe('atencao');
    expect(statusVencimento(90)).toBe('atencao');
    expect(statusVencimento(91)).toBe('vigente');
  });
});
