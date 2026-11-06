import type { PrismaClient } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/AppError.js';
type GoalInput = {
  name: string;
  targetAmount: number;
  deadline?: string | null;
  status?: 'active' | 'completed';
};
type BudgetInput = {
  categoryId: string;
  amount: number;
  month: number;
  year: number;
};
const missing = () =>
  new AppError(404, 'NOT_FOUND', 'Registro não encontrado.');
export class FinanceService {
  constructor(
    private readonly db: PrismaClient,
    private readonly userId: string,
  ) {}
  goals() {
    return this.db.goal.findMany({
      where: { userId: this.userId },
      orderBy: { createdAt: 'desc' },
    });
  }
  async saveGoal(input: Partial<GoalInput>, id?: string) {
    const data = {
      ...input,
      ...(input.deadline !== undefined
        ? {
            deadline: input.deadline
              ? new Date(`${input.deadline}T00:00:00Z`)
              : null,
          }
        : {}),
    };
    if (!id)
      return this.db.goal.create({
        data: {
          ...data,
          name: input.name!,
          targetAmount: input.targetAmount!,
          userId: this.userId,
        },
      });
    return this.db.$transaction(async (tx) => {
      const result = await tx.goal.updateMany({
        where: { id, userId: this.userId },
        data,
      });
      if (!result.count) throw missing();
      const goal = await tx.goal.findUniqueOrThrow({ where: { id } });
      if (goal.currentAmount.gte(goal.targetAmount))
        return tx.goal.update({ where: { id }, data: { status: 'completed' } });
      return goal;
    });
  }
  async contribute(id: string, amount: number) {
    return this.db.$transaction(async (tx) => {
      const changed = await tx.goal.updateMany({
        where: {
          id,
          userId: this.userId,
          status: 'active',
          currentAmount: {
            lte: new Prisma.Decimal('999999999.99').sub(amount),
          },
        },
        data: { currentAmount: { increment: new Prisma.Decimal(amount) } },
      });
      if (!changed.count) {
        const goal = await tx.goal.findFirst({
          where: { id, userId: this.userId },
        });
        if (!goal) throw missing();
        throw new AppError(
          409,
          'GOAL_UNAVAILABLE',
          'A meta está concluída ou a contribuição excede o limite permitido.',
        );
      }
      await tx.contribution.create({ data: { goalId: id, amount } });
      const goal = await tx.goal.findUniqueOrThrow({ where: { id } });
      return goal.currentAmount.gte(goal.targetAmount)
        ? tx.goal.update({ where: { id }, data: { status: 'completed' } })
        : goal;
    });
  }
  async deleteGoal(id: string) {
    if (
      !(await this.db.goal.deleteMany({ where: { id, userId: this.userId } }))
        .count
    )
      throw missing();
  }
  async budgets(month: number, year: number) {
    const rows = await this.db.budget.findMany({
      where: { userId: this.userId, month, year },
      include: { category: { select: { name: true, color: true } } },
      orderBy: { id: 'asc' },
    });
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));
    const spent = await this.db.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId: this.userId,
        type: 'expense',
        date: { gte: from, lt: to },
      },
      _sum: { amount: true },
    });
    return rows.map((row) => {
      const limitCents = row.amount.mul(100).toNumber();
      const usedCents = new Prisma.Decimal(
        spent.find((entry) => entry.categoryId === row.categoryId)?._sum
          .amount ?? 0,
      )
        .mul(100)
        .toNumber();
      const amount = limitCents / 100;
      const used = usedCents / 100;
      const percent = Math.floor((usedCents * 100) / limitCents);
      return {
        ...row,
        amount,
        spent: used,
        percent,
        alert:
          usedCents >= limitCents
            ? 'exceeded'
            : usedCents * 100 >= limitCents * 80
              ? 'near'
              : 'ok',
      };
    });
  }
  async saveBudget(changes: Partial<BudgetInput>, id?: string) {
    const existing = id
      ? await this.db.budget.findFirst({ where: { id, userId: this.userId } })
      : null;
    if (id && !existing) throw missing();
    // POST é validado com todos os campos; PATCH preserva os campos omitidos.
    const input = {
      ...(existing
        ? {
            categoryId: existing.categoryId,
            amount: existing.amount.toNumber(),
            month: existing.month,
            year: existing.year,
          }
        : {}),
      ...changes,
    } as BudgetInput;
    const category = await this.db.category.findFirst({
      where: { id: input.categoryId, userId: this.userId, type: 'expense' },
    });
    if (!category)
      throw new AppError(
        400,
        'INVALID_CATEGORY',
        'Escolha uma categoria de despesa da sua conta.',
      );
    try {
      if (id) {
        const result = await this.db.budget.updateMany({
          where: { id, userId: this.userId },
          data: input,
        });
        if (!result.count) throw missing();
        return this.db.budget.findUniqueOrThrow({ where: { id } });
      }
      return await this.db.budget.create({
        data: { ...input, userId: this.userId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new AppError(
          409,
          'BUDGET_EXISTS',
          'Já existe orçamento para esta categoria e período.',
        );
      throw error;
    }
  }
  async deleteBudget(id: string) {
    if (
      !(await this.db.budget.deleteMany({ where: { id, userId: this.userId } }))
        .count
    )
      throw missing();
  }
  transactions(from: string, to: string) {
    return this.db.transaction.findMany({
      where: {
        userId: this.userId,
        date: {
          gte: new Date(`${from}T00:00:00Z`),
          lte: new Date(`${to}T00:00:00Z`),
        },
      },
      include: { category: { select: { name: true, color: true } } },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });
  }
  async report(from: string, to: string) {
    const items = await this.transactions(from, to);
    let income = 0,
      expense = 0;
    const months = new Map<
      string,
      { month: string; income: number; expense: number }
    >();
    const categories = new Map<
      string,
      { name: string; color: string; value: number }
    >();
    for (const item of items) {
      const cents = item.amount.mul(100).toNumber();
      const month = item.date.toISOString().slice(0, 7);
      const bucket = months.get(month) ?? { month, income: 0, expense: 0 };
      if (item.type === 'income') {
        income += cents;
        bucket.income += cents;
      } else {
        expense += cents;
        bucket.expense += cents;
        const c = categories.get(item.categoryId) ?? {
          name: item.category.name,
          color: item.category.color,
          value: 0,
        };
        c.value += cents;
        categories.set(item.categoryId, c);
      }
      months.set(month, bucket);
    }
    const opening = await this.db.transaction.groupBy({
      by: ['type'],
      where: {
        userId: this.userId,
        date: { lt: new Date(`${from}T00:00:00Z`) },
      },
      _sum: { amount: true },
    });
    let balance = opening.reduce(
      (sum, row) =>
        sum +
        new Prisma.Decimal(row._sum.amount ?? 0).mul(100).toNumber() *
          (row.type === 'income' ? 1 : -1),
      0,
    );
    const monthly = [...months.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => {
        balance += row.income - row.expense;
        return {
          month: row.month,
          income: row.income / 100,
          expense: row.expense / 100,
          balance: balance / 100,
        };
      });
    const begin = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    const previousFrom = new Date(
      begin.getTime() - (end.getTime() - begin.getTime() + 86400000),
    );
    const previousTo = new Date(begin.getTime() - 86400000);
    const previousRows = await this.db.transaction.groupBy({
      by: ['type'],
      where: {
        userId: this.userId,
        date: { gte: previousFrom, lte: previousTo },
      },
      _sum: { amount: true },
    });
    const previous = {
      from: previousFrom.toISOString().slice(0, 10),
      to: previousTo.toISOString().slice(0, 10),
      income: Number(
        previousRows.find((row) => row.type === 'income')?._sum.amount ?? 0,
      ),
      expense: Number(
        previousRows.find((row) => row.type === 'expense')?._sum.amount ?? 0,
      ),
    };
    return {
      from,
      to,
      income: income / 100,
      expense: expense / 100,
      balance: (income - expense) / 100,
      closingBalance: balance / 100,
      previous,
      savingsRate: income
        ? Math.round(((income - expense) / income) * 100)
        : null,
      monthly,
      spending: [...categories.values()]
        .map((c) => ({ ...c, value: c.value / 100 }))
        .sort((a, b) => b.value - a.value),
      count: items.length,
    };
  }
}
export function csvCell(value: string) {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
