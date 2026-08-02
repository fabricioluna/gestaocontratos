import { describe, it, expect } from 'vitest';
import { parseMoeda } from './moeda';

describe('parseMoeda', () => {
  it('trata string vazia como zero', () => {
    expect(parseMoeda('')).toBe(0);
  });

  it('retorna o próprio número quando já é number', () => {
    expect(parseMoeda(1500.5)).toBe(1500.5);
  });

  it('converte string em formato monetário brasileiro (milhar e decimal)', () => {
    expect(parseMoeda('1.500,50')).toBe(1500.5);
  });

  it('converte string só com separador decimal', () => {
    expect(parseMoeda('250,75')).toBe(250.75);
  });

  it('retorna zero para string não numérica', () => {
    expect(parseMoeda('abc')).toBe(0);
  });
});
