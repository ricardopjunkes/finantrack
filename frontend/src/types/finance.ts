export type Transaction = {
  id: string;
  description: string;
  category: string;
  categoryId?: string;
  notes?: string | null;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  createdAt?: string;
  updatedAt?: string;
};
export type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  _count?: { transactions: number };
};
