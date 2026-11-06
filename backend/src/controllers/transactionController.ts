import type { Request, Response } from 'express';
import type { TransactionService } from '../services/transactionService.js';
import { idSchema, transactionSchema } from '../schemas/transactionSchema.js';
export class TransactionController {
  constructor(private readonly service: TransactionService) {}
  list = async (_req: Request, res: Response) => {
    res.json({ data: await this.service.list() });
  };
  get = async (req: Request, res: Response) => {
    res.json({ data: await this.service.get(idSchema.parse(req.params.id)) });
  };
  create = async (req: Request, res: Response) => {
    const item = await this.service.create(transactionSchema.parse(req.body));
    res
      .location(`/api/transactions/${item.id}`)
      .status(201)
      .json({ data: item });
  };
  update = async (req: Request, res: Response) => {
    const id = idSchema.parse(req.params.id);
    res.json({
      data: await this.service.update(id, transactionSchema.parse(req.body)),
    });
  };
  delete = async (req: Request, res: Response) => {
    await this.service.delete(idSchema.parse(req.params.id));
    res.status(204).send();
  };
}
