import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { FinanceService, csvCell } from '../services/financeService.js';
import { identity } from './auth.js';
import { idSchema, transactionSchema } from '../schemas/transactionSchema.js';
const money = transactionSchema.shape.amount;
const date = transactionSchema.shape.date;
const goal = z
  .object({
    name: z.string().trim().min(1).max(120),
    targetAmount: money,
    deadline: date.nullable().optional(),
    status: z.enum(['active', 'completed']).optional(),
  })
  .strict();
const period = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1900).max(9999),
});
const budget = period.extend({ categoryId: idSchema, amount: money }).strict();
const range = z
  .object({ from: date, to: date })
  .refine((v) => v.from <= v.to, 'O início deve ser anterior ao fim.');
export function financeRoutes(db: PrismaClient) {
  const router = Router();
  const service = (userId: string) => new FinanceService(db, userId);
  router.get('/goals', async (_req, res) =>
    res.json({ data: await service(identity(res).user.id).goals() }),
  );
  router.post('/goals', async (req, res) =>
    res.status(201).json({
      data: await service(identity(res).user.id).saveGoal(goal.parse(req.body)),
    }),
  );
  router.patch('/goals/:id', async (req, res) =>
    res.json({
      data: await service(identity(res).user.id).saveGoal(
        goal
          .partial()
          .refine((v) => Object.keys(v).length > 0)
          .parse(req.body),
        idSchema.parse(req.params.id),
      ),
    }),
  );
  router.post('/goals/:id/contributions', async (req, res) =>
    res.status(201).json({
      data: await service(identity(res).user.id).contribute(
        idSchema.parse(req.params.id),
        z.object({ amount: money }).strict().parse(req.body).amount,
      ),
    }),
  );
  router.delete('/goals/:id', async (req, res) => {
    await service(identity(res).user.id).deleteGoal(
      idSchema.parse(req.params.id),
    );
    res.status(204).send();
  });
  router.get('/budgets', async (req, res) => {
    const p = period.parse(req.query);
    res.json({
      data: await service(identity(res).user.id).budgets(p.month, p.year),
    });
  });
  router.post('/budgets', async (req, res) =>
    res.status(201).json({
      data: await service(identity(res).user.id).saveBudget(
        budget.parse(req.body),
      ),
    }),
  );
  router.patch('/budgets/:id', async (req, res) =>
    res.json({
      data: await service(identity(res).user.id).saveBudget(
        budget
          .partial()
          .refine((value) => Object.keys(value).length > 0, 'Informe um campo.')
          .parse(req.body),
        idSchema.parse(req.params.id),
      ),
    }),
  );
  router.delete('/budgets/:id', async (req, res) => {
    await service(identity(res).user.id).deleteBudget(
      idSchema.parse(req.params.id),
    );
    res.status(204).send();
  });
  router.get(['/reports', '/dashboard'], async (req, res) => {
    const r = range.parse(req.query);
    res.json({
      data: await service(identity(res).user.id).report(r.from, r.to),
    });
  });
  router.get('/reports/export', async (req, res) => {
    const r = range.parse(req.query);
    const items = await service(identity(res).user.id).transactions(
      r.from,
      r.to,
    );
    const rows = [
      ['Descrição', 'Tipo', 'Categoria', 'Data', 'Valor (BRL)', 'Observação'],
      ...items.map((t) => [
        t.description,
        t.type,
        t.category.name,
        t.date.toISOString().slice(0, 10),
        t.amount.toFixed(2),
        t.notes ?? '',
      ]),
    ];
    res
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="finantrack.csv"',
      })
      .send(
        '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n'),
      );
  });
  return router;
}
