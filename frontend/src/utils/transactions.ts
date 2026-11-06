import type { Transaction } from '../types/finance';
export type TransactionInput = Omit<
  Transaction,
  'id' | 'createdAt' | 'updatedAt'
>;
export const categories = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Lazer',
  'Saúde',
  'Educação',
  'Salário',
  'Trabalho',
  'Investimentos',
  'Outros',
];
export const currentMonth = () => localDate().slice(0, 7);
export function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function validDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '1900-01-01' &&
    value <= '9999-12-31' &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
export function validTransaction(value: unknown): value is TransactionInput {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.description === 'string' &&
    t.description.trim().length > 0 &&
    t.description.length <= 120 &&
    typeof t.category === 'string' &&
    t.category.trim().length > 0 &&
    t.category.length <= 60 &&
    (t.type === 'income' || t.type === 'expense') &&
    typeof t.amount === 'number' &&
    Number.isFinite(t.amount) &&
    t.amount >= 0.01 &&
    t.amount <= 999999999.99 &&
    Math.round(t.amount * 100) / 100 === t.amount &&
    typeof t.date === 'string' &&
    validDate(t.date)
  );
}
export const cents = (value: number) => Math.round(value * 100);
export function totals(items: Transaction[]) {
  const income = items
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + cents(t.amount), 0);
  const expense = items
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + cents(t.amount), 0);
  return {
    income: income / 100,
    expense: expense / 100,
    balance: (income - expense) / 100,
  };
}
export type Filters = {
  search: string;
  type: string;
  category: string;
  month: string;
  order: string;
  from?: string;
  to?: string;
};
export function filterTransactions(items: Transaction[], filters: Filters) {
  return items
    .filter(
      (t) =>
        t.description
          .toLocaleLowerCase('pt-BR')
          .includes(filters.search.trim().toLocaleLowerCase('pt-BR')) &&
        (!filters.type || t.type === filters.type) &&
        (!filters.category || t.category === filters.category) &&
        (!filters.month || t.date.startsWith(filters.month)) &&
        (!filters.from || t.date >= filters.from) &&
        (!filters.to || t.date <= filters.to),
    )
    .sort(
      (a, b) =>
        (filters.order === 'amount-desc'
          ? b.amount - a.amount
          : filters.order === 'amount-asc'
            ? a.amount - b.amount
            : (filters.order === 'oldest' ? 1 : -1) *
              a.date.localeCompare(b.date)) || a.id.localeCompare(b.id),
    );
}
export function dashboardData(items: Transaction[], month: string) {
  const period = items.filter((t) => t.date.startsWith(month));
  const summary = totals(period);
  const colors = [
    '#3B82F6',
    '#10B981',
    '#A78BFA',
    '#F59E0B',
    '#FB7185',
    '#22D3EE',
  ];
  const grouped = new Map<string, number>();
  period
    .filter((t) => t.type === 'expense')
    .forEach((t) =>
      grouped.set(t.category, (grouped.get(t.category) ?? 0) + cents(t.amount)),
    );
  const spending = [...grouped]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name,
      value: value / 100,
      color: colors[i % colors.length],
    }));
  const [year, number] = month.split('-').map(Number);
  const monthlyFlow = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, number - 6 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      month: new Intl.DateTimeFormat('pt-BR', {
        month: 'short',
        year: '2-digit',
      }).format(date),
      ...totals(items.filter((t) => t.date.startsWith(key))),
    };
  });
  const balance = totals(
    items.filter((t) => t.date.slice(0, 7) <= month),
  ).balance;
  return {
    ...summary,
    balance,
    period,
    spending,
    monthlyFlow,
    recent: [...period]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5),
  };
}
