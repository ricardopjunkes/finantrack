import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/AppError.js';
export const sessionHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const publicUser = { id: true, name: true, email: true } as const;
const initial = {
  income: ['Salário', 'Freelance', 'Investimentos', 'Outros'],
  expense: [
    'Alimentação',
    'Transporte',
    'Moradia',
    'Educação',
    'Lazer',
    'Saúde',
    'Outros',
  ],
};
export class AuthService {
  constructor(private readonly db: PrismaClient) {}
  async register(input: { name: string; email: string; password: string }) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      return await this.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          categories: {
            create: Object.entries(initial).flatMap(([type, names]) =>
              names.map((name) => ({
                name,
                type: type as 'income' | 'expense',
              })),
            ),
          },
        },
        select: publicUser,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new AppError(
          409,
          'ACCOUNT_EXISTS',
          'Não foi possível cadastrar esse email.',
        );
      throw error;
    }
  }
  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({ where: { email } });
    // Trabalho equivalente para contas ausentes ou locais sem senha.
    const fallback =
      '$2b$12$C6UzMDM.H6dfI/f/IKcEe.9W8ID5jrT1pG1uK/X/3K8vZ9.nDaQxS';
    const valid = await bcrypt.compare(
      password,
      user?.passwordHash ?? fallback,
    );
    if (!user?.passwordHash || !valid)
      throw new AppError(
        401,
        'INVALID_CREDENTIALS',
        'Email ou senha incorretos.',
      );
    return { id: user.id, name: user.name, email: user.email };
  }
  async issue(userId: string) {
    const token = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await this.db.session.create({
      data: { userId, tokenHash: sessionHash(token), csrfToken, expiresAt },
    });
    return { token, csrfToken, expiresAt };
  }
}
