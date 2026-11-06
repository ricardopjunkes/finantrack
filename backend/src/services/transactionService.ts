import { randomUUID } from 'node:crypto';
import type { TransactionRepository } from '../repositories/transactionRepository.js';
import type {
  StoredTransaction,
  Transaction,
  TransactionInput,
} from '../types/transaction.js';
import { AppError } from '../utils/AppError.js';
import { toCents, fromCents } from '../utils/money.js';
function present(item: StoredTransaction): Transaction {
  const { amountCents, ...rest } = item;
  return { ...rest, amount: fromCents(amountCents) };
}
const notFound = () =>
  new AppError(404, 'NOT_FOUND', 'Transação não encontrada.');
export class TransactionService {
  constructor(private readonly repository: TransactionRepository) {}
  async list() {
    return (await this.repository.findAll())
      .map(present)
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.createdAt.localeCompare(a.createdAt) ||
          a.id.localeCompare(b.id),
      );
  }
  async get(id: string) {
    const item = await this.repository.findById(id);
    if (!item) throw notFound();
    return present(item);
  }
  async create(input: TransactionInput) {
    const { amount, ...fields } = input;
    const now = new Date().toISOString();
    return present(
      await this.repository.create({
        ...fields,
        id: randomUUID(),
        amountCents: toCents(amount),
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
  async update(id: string, input: TransactionInput) {
    const old = await this.repository.findById(id);
    if (!old) throw notFound();
    const { amount, ...fields } = input;
    const updated = await this.repository.update({
      ...old,
      ...fields,
      categoryId: input.categoryId,
      amountCents: toCents(amount),
      updatedAt: new Date().toISOString(),
    });
    if (!updated) throw notFound();
    return present(updated);
  }
  async delete(id: string) {
    if (!(await this.repository.delete(id))) throw notFound();
  }
}
