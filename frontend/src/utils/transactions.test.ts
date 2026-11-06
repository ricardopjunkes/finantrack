import { describe, expect, it } from 'vitest';
import {
  dashboardData,
  filterTransactions,
  totals,
  validDate,
  validTransaction,
} from './transactions';
import type { Transaction } from '../types/finance';
const income: Transaction = {
  id: 'a',
  description: 'Salário',
  amount: 100,
  type: 'income',
  category: 'Salário',
  date: '2026-11-05',
};
const expense: Transaction = {
  id: 'b',
  description: 'Mercado',
  amount: 25.35,
  type: 'expense',
  category: 'Alimentação',
  date: '2026-11-02',
};
describe('regras de transações', () => {
  it('combina intervalo personalizado e ordenação por valor sem alterar a lista original', () => {
    const items = [
      { ...income, date: '2026-11-05', amount: 100 },
      { ...expense, date: '2026-11-02', amount: 50 },
      { ...expense, id: 'c', date: '2026-10-31', amount: 999 },
    ];
    const filters = {
      search: '',
      type: '',
      category: '',
      month: '',
      order: 'amount-desc',
      from: '2026-11-01',
      to: '2026-11-30',
    };
    expect(filterTransactions(items, filters).map((t) => t.amount)).toEqual([
      100, 50,
    ]);
    expect(
      filterTransactions(items, { ...filters, order: 'amount-asc' }).map(
        (t) => t.amount,
      ),
    ).toEqual([50, 100]);
    expect(items[0].amount).toBe(100);
  });
  it('aceita receita e despesa válidas e rejeita valores inválidos', () => {
    expect(validTransaction(income)).toBe(true);
    expect(validTransaction(expense)).toBe(true);
    for (const amount of [
      0,
      -1,
      NaN,
      Infinity,
      0.001,
      0.0000001,
      1.0000001,
      1000000000,
    ])
      expect(validTransaction({ ...income, amount })).toBe(false);
    for (const input of [
      { description: '  ' },
      { category: '' },
      { type: 'transfer' },
      { date: '2026-02-30' },
      { date: '2026-99-99' },
    ])
      expect(validTransaction({ ...income, ...input })).toBe(false);
  });
  it('valida datas reais inclusive anos bissextos sem lançar erros', () => {
    expect(validDate('2024-02-29')).toBe(true);
    expect(validDate('2026-02-29')).toBe(false);
    expect(validDate('invalida')).toBe(false);
  });
  it('calcula dinheiro em centavos, inclusive saldo negativo', () => {
    expect(
      totals([
        { ...income, amount: 0.1 },
        { ...income, id: 'c', amount: 0.2 },
        { ...expense, amount: 0.3 },
      ]),
    ).toEqual({ income: 0.3, expense: 0.3, balance: 0 });
    expect(totals([expense]).balance).toBe(-25.35);
  });
  it('combina pesquisa, tipo, categoria e mês e ordena sem alterar a origem', () => {
    const items = [
      income,
      expense,
      { ...expense, id: 'c', date: '2026-10-01' },
    ];
    expect(
      filterTransactions(items, {
        search: ' MERCADO ',
        type: 'expense',
        category: 'Alimentação',
        month: '2026-11',
        order: 'oldest',
      }),
    ).toEqual([expense]);
    expect(
      filterTransactions(items, {
        search: '',
        type: '',
        category: '',
        month: '',
        order: 'oldest',
      }).map((t) => t.id),
    ).toEqual(['c', 'b', 'a']);
    expect(items[0]).toBe(income);
  });
  it('separa saldo acumulado de indicadores mensais e exclui meses futuros', () => {
    const data = dashboardData(
      [
        income,
        expense,
        { ...income, id: 'c', date: '2026-10-01', amount: 10 },
        { ...income, id: 'd', date: '2026-12-01', amount: 500 },
      ],
      '2026-11',
    );
    expect(data.balance).toBe(84.65);
    expect(data.income).toBe(100);
    expect(data.expense).toBe(25.35);
    expect(data.spending).toEqual([
      { name: 'Alimentação', value: 25.35, color: '#3B82F6' },
    ]);
    expect(data.monthlyFlow).toHaveLength(6);
    expect(data.monthlyFlow.at(-1)?.balance).toBe(74.65);
    expect(data.recent).toEqual([income, expense]);
  });
  it('recalcula dashboard após edição e exclusão e suporta lista vazia', () => {
    expect(
      dashboardData([income, { ...expense, amount: 50 }], '2026-11').balance,
    ).toBe(50);
    expect(dashboardData([income], '2026-11').spending).toEqual([]);
    const empty = dashboardData([], '2026-11');
    expect(empty.balance).toBe(0);
    expect(empty.income).toBe(0);
    expect(empty.expense).toBe(0);
    expect(empty.recent).toEqual([]);
  });
});
