// Contrato público: amount é expresso em reais, como no frontend.
export type TransactionInput = {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  categoryId?: string;
  notes?: string | null;
  date: string;
};
export type Transaction = TransactionInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
// Somente a camada de armazenamento utiliza amountCents.
export type StoredTransaction = Omit<Transaction, 'amount'> & {
  amountCents: number;
};
