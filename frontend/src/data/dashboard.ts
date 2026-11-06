import type { Transaction } from '../types/finance';
// Exemplos usados apenas quando a chave de armazenamento ainda não existe.
export const transactions: Transaction[] = [
  {
    id: '1',
    description: 'Salário mensal',
    category: 'Salário',
    date: '2026-11-05',
    amount: 6500,
    type: 'income',
  },
  {
    id: '2',
    description: 'Supermercado',
    category: 'Alimentação',
    date: '2026-11-04',
    amount: 480,
    type: 'expense',
  },
  {
    id: '3',
    description: 'Aluguel do apartamento',
    category: 'Moradia',
    date: '2026-11-03',
    amount: 1800,
    type: 'expense',
  },
  {
    id: '4',
    description: 'Projeto freelance',
    category: 'Trabalho',
    date: '2026-11-02',
    amount: 1200,
    type: 'income',
  },
  {
    id: '5',
    description: 'Transporte e mobilidade',
    category: 'Transporte',
    date: '2026-11-01',
    amount: 220,
    type: 'expense',
  },
];
