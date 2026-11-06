import { Router, type RequestHandler, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import {
  AuthService,
  sessionHash,
  publicUser,
} from '../services/authService.js';
import { AppError } from '../utils/AppError.js';
const password = z
  .string()
  .min(12, 'Use pelo menos 12 caracteres.')
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'Use no máximo 72 bytes.',
  );
const email = z.string().trim().toLowerCase().email().max(254);
type Identity = {
  user: { id: string; name: string; email: string };
  sessionId: string;
  csrfToken: string;
};
export function identity(res: Response) {
  return res.locals.identity as Identity;
}
export function authRoutes(
  db: PrismaClient,
  origins: string[],
  production: boolean,
  crossSite: boolean,
) {
  const service = new AuthService(db);
  const router = Router();
  const cookieName = production ? '__Host-ft_session' : 'ft_session';
  const cookie = {
    httpOnly: true,
    secure: production,
    sameSite: crossSite ? ('none' as const) : ('lax' as const),
    path: '/',
  };
  const sensitive = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Muitas tentativas. Tente mais tarde.',
      },
    },
  });
  const origin: RequestHandler = (req, _res, next) => {
    if (!origins.includes(req.get('origin') ?? ''))
      throw new AppError(
        403,
        'ORIGIN_REQUIRED',
        'Origem da requisição não permitida.',
      );
    next();
  };
  const requireSession: RequestHandler = async (req, res, next) => {
    const token: unknown = req.cookies?.[cookieName];
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
      throw new AppError(
        401,
        'UNAUTHENTICATED',
        'Entre na sua conta para continuar.',
      );
    const session = await db.session.findUnique({
      where: { tokenHash: sessionHash(token) },
      include: { user: { select: publicUser } },
    });
    if (!session || session.expiresAt.getTime() <= Date.now())
      throw new AppError(
        401,
        'SESSION_EXPIRED',
        'Sua sessão expirou. Entre novamente.',
      );
    res.locals.identity = {
      user: session.user,
      sessionId: session.id,
      csrfToken: session.csrfToken,
    } satisfies Identity;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const header = req.get('x-csrf-token') ?? '';
      if (
        !origins.includes(req.get('origin') ?? '') ||
        !/^[a-f0-9]{64}$/.test(header) ||
        !timingSafeEqual(Buffer.from(header), Buffer.from(session.csrfToken))
      )
        throw new AppError(
          403,
          'CSRF_INVALID',
          'Atualize a página e tente novamente.',
        );
    }
    next();
  };
  async function issue(
    res: Response,
    user: { id: string; name: string; email: string },
    status: number,
  ) {
    const session = await service.issue(user.id);
    res.cookie(cookieName, session.token, {
      ...cookie,
      expires: session.expiresAt,
    });
    res.status(status).json({ data: { user, csrfToken: session.csrfToken } });
  }
  router.post('/register', sensitive, origin, async (req, res) => {
    const input = z
      .object({ name: z.string().trim().min(1).max(120), email, password })
      .strict()
      .parse(req.body);
    await issue(res, await service.register(input), 201);
  });
  router.post('/login', sensitive, origin, async (req, res) => {
    const input = z
      .object({
        email,
        password: z
          .string()
          .min(1)
          .max(72)
          .refine(
            (value) => Buffer.byteLength(value, 'utf8') <= 72,
            'Use no máximo 72 bytes.',
          ),
      })
      .strict()
      .parse(req.body);
    await issue(res, await service.login(input.email, input.password), 200);
  });
  router.get('/me', requireSession, (_req, res) =>
    res.json({
      data: { user: identity(res).user, csrfToken: identity(res).csrfToken },
    }),
  );
  router.post('/logout', requireSession, async (_req, res) => {
    await db.session.deleteMany({ where: { id: identity(res).sessionId } });
    res.clearCookie(cookieName, cookie);
    res.status(204).send();
  });
  router.patch('/profile', requireSession, async (req, res) => {
    const input = z
      .object({ name: z.string().trim().min(1).max(120) })
      .strict()
      .parse(req.body);
    res.json({
      data: await db.user.update({
        where: { id: identity(res).user.id },
        data: input,
        select: publicUser,
      }),
    });
  });
  router.post('/password', sensitive, requireSession, async (req, res) => {
    const input = z
      .object({
        currentPassword: z
          .string()
          .min(1)
          .max(72)
          .refine(
            (value) => Buffer.byteLength(value, 'utf8') <= 72,
            'Use no máximo 72 bytes.',
          ),
        password,
      })
      .strict()
      .parse(req.body);
    const user = await db.user.findUniqueOrThrow({
      where: { id: identity(res).user.id },
    });
    if (
      !user.passwordHash ||
      !(await bcrypt.compare(input.currentPassword, user.passwordHash))
    )
      throw new AppError(400, 'INVALID_PASSWORD', 'Senha atual incorreta.');
    const passwordHash = await bcrypt.hash(input.password, 12);
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash } }),
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);
    res.clearCookie(cookieName, cookie);
    res.status(204).send();
  });
  return { router, requireSession };
}
