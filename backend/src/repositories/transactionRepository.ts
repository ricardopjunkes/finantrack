import type { StoredTransaction } from '../types/transaction.js';
export interface TransactionRepository {
  findAll(): Promise<StoredTransaction[]>;
  findById(id: string): Promise<StoredTransaction | undefined>;
  create(transaction: StoredTransaction): Promise<StoredTransaction>;
  update(
    transaction: StoredTransaction,
  ): Promise<StoredTransaction | undefined>;
  delete(id: string): Promise<boolean>;
}
// Cada instância possui seus próprios dados; nada é compartilhado entre testes.
export class MemoryTransactionRepository implements TransactionRepository {
  private readonly items = new Map<string, StoredTransaction>();
  async findAll() {
    return [...this.items.values()].map((item) => ({ ...item }));
  }
  async findById(id: string) {
    const item = this.items.get(id);
    return item ? { ...item } : undefined;
  }
  async create(transaction: StoredTransaction) {
    this.items.set(transaction.id, { ...transaction });
    return { ...transaction };
  }
  async update(transaction: StoredTransaction) {
    if (!this.items.has(transaction.id)) return undefined;
    this.items.set(transaction.id, { ...transaction });
    return { ...transaction };
  }
  async delete(id: string) {
    return this.items.delete(id);
  }
}
