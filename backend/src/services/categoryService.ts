import type { PrismaClient } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/AppError.js';
export type CategoryInput = {
  name: string;
  type: 'income' | 'expense';
  color: string;
};
export class CategoryService {
  constructor(
    private readonly db: PrismaClient,
    private readonly userId: string,
  ) {}
  list() {
    return this.db.category.findMany({
      where: { userId: this.userId },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        _count: { select: { transactions: true } },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }
  private async owned(id: string) {
    const category = await this.db.category.findFirst({
      where: { id, userId: this.userId },
    });
    if (!category)
      throw new AppError(404, 'NOT_FOUND', 'Categoria não encontrada.');
    return category;
  }
  private fail(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new AppError(
          409,
          'CATEGORY_EXISTS',
          'Já existe uma categoria desse nome e tipo.',
        );
      if (error.code === 'P2003')
        throw new AppError(
          409,
          'CATEGORY_IN_USE',
          'Esta categoria possui transações ou orçamentos vinculados e não pode ser excluída.',
        );
      if (error.code === 'P2025')
        throw new AppError(404, 'NOT_FOUND', 'Categoria não encontrada.');
    }
    throw error;
  }
  async create(input: CategoryInput) {
    try {
      return await this.db.category.create({
        data: { ...input, userId: this.userId },
      });
    } catch (error) {
      this.fail(error);
    }
  }
  async update(id: string, input: Partial<CategoryInput>) {
    const current = await this.owned(id);
    if (input.type && input.type !== current.type)
      throw new AppError(
        409,
        'CATEGORY_TYPE_IMMUTABLE',
        'O tipo é definido na criação. Crie outra categoria para usar um tipo diferente.',
      );
    try {
      return await this.db.category.update({
        where: { id, userId: this.userId },
        data: input,
      });
    } catch (error) {
      this.fail(error);
    }
  }
  async delete(id: string) {
    await this.owned(id);
    try {
      await this.db.category.delete({ where: { id, userId: this.userId } });
    } catch (error) {
      this.fail(error);
    }
  }
}
