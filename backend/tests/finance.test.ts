import { describe, it, expect } from 'vitest';
import { csvCell } from '../src/services/financeService.js';
describe('CSV seguro', () => {
  it('escapa aspas, separadores e quebras de linha sem perder texto', () => {
    expect(csvCell('Texto;com "aspas"\ne linha')).toBe(
      '"Texto;com ""aspas""\ne linha"',
    );
  });
  it.each([
    '=SUM(A1:A2)',
    '+1',
    '-1',
    '@formula',
    '  =formula',
    '\tformula',
    '\rformula',
  ])('neutraliza fórmulas: %j', (value) => {
    expect(csvCell(value)).toBe(`"'${value}"`);
  });
});
