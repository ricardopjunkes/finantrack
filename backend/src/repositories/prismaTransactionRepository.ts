import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import type { TransactionRepository } from './transactionRepository.js';
import type { StoredTransaction } from '../types/transaction.js';
import { AppError } from '../utils/AppError.js';
type Row = Prisma.TransactionGetPayload<{ include: { category: true } }>;
function stored(row: Row): StoredTransaction {
  return {
    id: row.id,
    description: row.description,
    amountCents: row.amount.mul(100).toNumber(),
    type: row.type,
    category: row.category.name,
    categoryId: row.categoryId,
    notes: row.notes,
    date: row.date.toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
function isMissing(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}
export class PrismaTransactionRepository implements TransactionRepository {
  constructor(
    private readonly client: PrismaClient,
    private readonly userId: string,
  ) {}
  async findAll() {
    return (
      await this.client.transaction.findMany({
        where: { userId: this.userId },
        include: { category: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      })
    ).map(stored);
  }
  async findById(id: string) {
    const row = await this.client.transaction.findFirst({
      where: { id, userId: this.userId },
      include: { category: true },
    });
    return row ? stored(row) : undefined;
  }
  private async write(item: StoredTransaction, update: boolean) {
    return this.client.$transaction(async (tx) => {
      const category = await tx.category.findFirst({
        where: {
          userId: this.userId,
          type: item.type,
          ...(item.categoryId
            ? { id: item.categoryId }
            : { name: item.category }),
        },
      });
      if (!category)
        throw new AppError(
          400,
          'INVALID_CATEGORY',
          'Selecione uma categoria existente do mesmo tipo e da sua conta.',
        );
      const data = {
        notes: item.notes ?? null,
        description: item.description,
        amount: new Prisma.Decimal(item.amountCents).div(100),
        type: item.type,
        date: new Date(`${item.date}T00:00:00Z`),
        categoryId: category.id,
        userId: this.userId,
        updatedAt: new Date(item.updatedAt),
      };
      const row = update
        ? await tx.transaction.update({
            where: { id: item.id, userId: this.userId },
            data,
            include: { category: true },
          })
        : await tx.transaction.create({
            data: { ...data, id: item.id, createdAt: new Date(item.createdAt) },
            include: { category: true },
          });
      return stored(row);
    });
  }
  async create(item: StoredTransaction) {
    return this.write(item, false);
  }
  async update(item: StoredTransaction) {
    try {
      return await this.write(item, true);
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }
  async delete(id: string) {
    return (
      (
        await this.client.transaction.deleteMany({
          where: { id, userId: this.userId },
        })
      ).count === 1
    );
  }
}
