import express from 'express';
import cors from 'cors';
import type { TransactionRepository } from './repositories/transactionRepository.js';
import { TransactionService } from './services/transactionService.js';
import { transactionRoutes } from './routes/transactions.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { AppError } from './utils/AppError.js';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { PrismaClient } from './generated/prisma/client.js';
import { authRoutes, identity } from './routes/auth.js';
import { PrismaTransactionRepository } from './repositories/prismaTransactionRepository.js';
import { categoryRoutes } from './routes/categories.js';
import { financeRoutes } from './routes/finance.js';
type Options = {
  repository?: TransactionRepository;
  client?: PrismaClient;
  production?: boolean;
  crossSite?: boolean;
  frontendOrigins?: string[];
  storage?: 'memory' | 'postgresql';
  checkStorage?: () => Promise<void>;
  trustProxyHops?: number;
};
export function createApp({
  repository,
  client,
  production = false,
  crossSite = false,
  storage = 'memory',
  checkStorage,
  trustProxyHops = 0,
  frontendOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173'],
}: Options) {
  const app = express();
  app.set('trust proxy', trustProxyHops);
  if (crossSite && !production)
    throw new Error('Cookies cross-site exigem HTTPS em produção.');
  if (!client && !repository)
    throw new Error('Configure um repository de testes ou cliente PostgreSQL.');
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || frontendOrigins.includes(origin)) callback(null, true);
        else
          callback(
            new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não permitida.'),
          );
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', async (_req, res) => {
    try {
      await checkStorage?.();
    } catch {
      throw new AppError(
        503,
        'DATABASE_UNAVAILABLE',
        'Banco de dados indisponível. Tente novamente.',
      );
    }
    res.json({ data: { status: 'ok', storage } });
  });
  if (client) {
    const auth = authRoutes(client, frontendOrigins, production, crossSite);
    app.use('/api/auth', auth.router);
    app.use('/api/categories', auth.requireSession, categoryRoutes(client));
    app.use('/api/transactions', auth.requireSession, (req, res, next) => {
      const router = transactionRoutes(
        new TransactionService(
          new PrismaTransactionRepository(client, identity(res).user.id),
        ),
      );
      router(req, res, next);
    });
    app.use('/api', auth.requireSession, financeRoutes(client));
  } else if (repository)
    app.use(
      '/api/transactions',
      transactionRoutes(new TransactionService(repository)),
    );
  app.use((_req, _res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'Rota não encontrada.')),
  );
  app.use(errorHandler);
  return app;
}
