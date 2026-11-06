import 'dotenv/config';
import { z } from 'zod';
import { createApp } from './app.js';
import { createPrismaClient } from './database/client.js';
const config = z
  .object({
    DATABASE_URL: z
      .string()
      .url()
      .refine((value) =>
        ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
      ),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z
      .enum(['127.0.0.1', 'localhost', '::1', '0.0.0.0'])
      .default('127.0.0.1'),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    COOKIE_CROSS_SITE: z.enum(['true', 'false']).default('false'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
    FRONTEND_ORIGINS: z
      .string()
      .default('http://127.0.0.1:5173,http://localhost:5173')
      .transform((value) => value.split(',').map((origin) => origin.trim()))
      .pipe(
        z
          .array(
            z
              .url()
              .refine(
                (value) => new URL(value).origin === value,
                'Informe somente a origem, sem caminhos.',
              ),
          )
          .min(1),
      ),
  })
  .safeParse(process.env);
if (!config.success) {
  console.error(
    'Configuração inválida. Confira DATABASE_URL, PORT, HOST e FRONTEND_ORIGINS no .env.',
  );
  process.exit(1);
}
const { PORT, HOST, FRONTEND_ORIGINS, DATABASE_URL } = config.data;
const client = createPrismaClient(
  DATABASE_URL,
  new URL(DATABASE_URL).searchParams.get('schema') ?? 'public',
);
try {
  await client.$connect();
  await client.session.findFirst({ select: { id: true } });
} catch {
  console.error(
    'Não foi possível preparar o banco. Confira a conexão e execute db:deploy e db:seed.',
  );
  await client.$disconnect();
  process.exit(1);
}
const server = createApp({
  frontendOrigins: FRONTEND_ORIGINS,
  client,
  production: config.data.NODE_ENV === 'production',
  crossSite: config.data.COOKIE_CROSS_SITE === 'true',
  trustProxyHops: config.data.TRUST_PROXY_HOPS,
  storage: 'postgresql',
  checkStorage: async () => {
    await client.$queryRaw`SELECT 1`;
  },
}).listen(PORT, HOST, () => {
  console.log(`FinanTrack API local: http://${HOST}:${PORT}/api`);
  console.log('Persistência PostgreSQL e autenticação por sessão ativas.');
});
server.on('error', () => {
  console.error(
    'Não foi possível iniciar a API. Verifique se a porta está disponível.',
  );
  process.exit(1);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () =>
    server.close(async () => {
      await client.$disconnect();
      process.exit(0);
    }),
  );
