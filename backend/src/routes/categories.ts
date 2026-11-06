import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { CategoryService } from '../services/categoryService.js';
import { identity } from './auth.js';
import { idSchema } from '../schemas/transactionSchema.js';
const schema = z
  .object({
    name: z.string().trim().min(1).max(60),
    type: z.enum(['income', 'expense']),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  })
  .strict();
export function categoryRoutes(db: PrismaClient) {
  const router = Router();
  router.get('/', async (_req, res) =>
    res.json({
      data: await new CategoryService(db, identity(res).user.id).list(),
    }),
  );
  router.post('/', async (req, res) =>
    res.status(201).json({
      data: await new CategoryService(db, identity(res).user.id).create(
        schema.parse(req.body),
      ),
    }),
  );
  router.patch('/:id', async (req, res) =>
    res.json({
      data: await new CategoryService(db, identity(res).user.id).update(
        idSchema.parse(req.params.id),
        schema
          .partial()
          .refine(
            (v) => Object.keys(v).length > 0,
            'Informe ao menos um campo.',
          )
          .parse(req.body),
      ),
    }),
  );
  router.delete('/:id', async (req, res) => {
    await new CategoryService(db, identity(res).user.id).delete(
      idSchema.parse(req.params.id),
    );
    res.status(204).send();
  });
  return router;
}
