import { Router } from 'express';
import { TransactionController } from '../controllers/transactionController.js';
import type { TransactionService } from '../services/transactionService.js';
export function transactionRoutes(service: TransactionService) {
  const router = Router();
  const controller = new TransactionController(service);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);
  return router;
}
