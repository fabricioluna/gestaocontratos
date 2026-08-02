import { describe, it, expect } from 'vitest';
import {
  calcularResumoValorGlobal,
  calcularValorAlteracaoAditivo,
  excedeLimite25,
  recalcularValorTotalComAditivo,
  substituirAditivo,
} from './aditivos';
import type { Aditivo } from '../types/types';

const aditivo = (overrides: Partial<Aditivo>): Aditivo => ({
  id: '1',
  descricao: 'Termo Aditivo',
  tipo: 'valor',
  dataAditivo: '2026-01-01',
  valorAditivado: 0,
  ...overrides,
});

describe('calcularResumoValorGlobal', () => {
  it('retorna zeros quando não há contrato', () => {
    expect(calcularResumoValorGlobal(null)).toEqual({
      valorGlobalAtualizado: 0,
      totalAditivosAplicados: 0,
      valorOriginal: 0,
    });
  });

  it('sem aditivos, valor original é igual ao valor global', () => {
    const resumo = calcularResumoValorGlobal({ valorTotal: 10000, aditivos: [] });
    expect(resumo).toEqual({
      valorGlobalAtualizado: 10000,
      totalAditivosAplicados: 0,
      valorOriginal: 10000,
    });
  });

  it('soma acréscimos e supressões para achar o valor original', () => {
    const resumo = calcularResumoValorGlobal({
      valorTotal: 12000,
      aditivos: [aditivo({ valorAditivado: 3000 }), aditivo({ id: '2', valorAditivado: -1000 })],
    });
    expect(resumo).toEqual({
      valorGlobalAtualizado: 12000,
      totalAditivosAplicados: 2000,
      valorOriginal: 10000,
    });
  });
});

describe('calcularValorAlteracaoAditivo', () => {
  it('acréscimo gera valor positivo, supressão gera valor negativo', () => {
    expect(calcularValorAlteracaoAditivo('acrescimo', 500)).toBe(500);
    expect(calcularValorAlteracaoAditivo('supressao', 500)).toBe(-500);
  });
});

describe('excedeLimite25', () => {
  it('respeita o limite de 25% do valor base', () => {
    expect(excedeLimite25(2501, 10000)).toBe(true);
    expect(excedeLimite25(2500, 10000)).toBe(false);
    expect(excedeLimite25(1000, 10000)).toBe(false);
  });
});

describe('recalcularValorTotalComAditivo', () => {
  it('aplica a alteração de um aditivo novo (sem valor anterior)', () => {
    expect(recalcularValorTotalComAditivo(10000, 0, 2000)).toBe(12000);
  });

  it('desfaz o valor do aditivo anterior antes de aplicar o novo, ao editar', () => {
    expect(recalcularValorTotalComAditivo(12000, 2000, 5000)).toBe(15000);
  });

  it('exclusão de aditivo só desfaz o valor anterior (nova alteração zero)', () => {
    expect(recalcularValorTotalComAditivo(12000, 2000, 0)).toBe(10000);
  });
});

describe('substituirAditivo', () => {
  it('acrescenta um aditivo novo ao final da lista', () => {
    const existente = [aditivo({ id: '1' })];
    const novo = aditivo({ id: '2' });
    expect(substituirAditivo(existente, novo, false)).toEqual([existente[0], novo]);
  });

  it('substitui o aditivo em edição pelo id', () => {
    const existente = [aditivo({ id: '1', descricao: 'Original' }), aditivo({ id: '2' })];
    const editado = aditivo({ id: '1', descricao: 'Editado' });
    const resultado = substituirAditivo(existente, editado, true, '1');
    expect(resultado).toEqual([editado, existente[1]]);
  });

  it('em edição, se o id não é encontrado a lista permanece igual (comportamento preservado)', () => {
    const existente = [aditivo({ id: '1' })];
    const editado = aditivo({ id: '999' });
    expect(substituirAditivo(existente, editado, true, '999')).toEqual(existente);
  });
});
