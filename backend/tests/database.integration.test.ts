import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient, LOCAL_USER_ID } from '../src/database/client.js';
import { PrismaTransactionRepository } from '../src/repositories/prismaTransactionRepository.js';
import { createApp } from '../src/app.js';
const testUrl = process.env.TEST_DATABASE_URL;
const schema = `finantrack_test_${randomUUID().replaceAll('-', '')}`;
const owner = randomUUID();
const other = randomUUID();
const input = {
  description: 'Curso',
  amount: 123.45,
  type: 'expense',
  category: 'Educação',
  date: '2026-11-05',
};
describe.runIf(Boolean(testUrl))('PostgreSQL real (schema isolado)', () => {
  let pool: pg.Pool;
  let client: ReturnType<typeof createPrismaClient>;
  let app: ReturnType<typeof createApp>;
  beforeAll(async () => {
    if (!testUrl || !new URL(testUrl).pathname.toLowerCase().includes('test'))
      throw new Error(
        'Use TEST_DATABASE_URL com um banco exclusivo cujo nome contenha test.',
      );
    if (
      process.env.DATABASE_URL &&
      new URL(testUrl).pathname === new URL(process.env.DATABASE_URL).pathname
    )
      throw new Error(
        'O banco de testes deve ser diferente do banco da aplicação.',
      );
    pool = new pg.Pool({ connectionString: testUrl });
    const connection = await pool.connect();
    try {
      await connection.query(`CREATE SCHEMA "${schema}"`);
      const sql = (
        await readFile(
          new URL(
            '../prisma/migrations/202611050001_initial/migration.sql',
            import.meta.url,
          ),
          'utf8',
        )
      ).replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
      await connection.query(
        `BEGIN; SET LOCAL search_path TO "${schema}"; ${sql} ${await readFile(new URL('../prisma/migrations/202611050002_sessions/migration.sql', import.meta.url), 'utf8')} ${await readFile(new URL('../prisma/migrations/202611050003_finance/migration.sql', import.meta.url), 'utf8')} COMMIT;`,
      );
    } finally {
      connection.release();
    }
    client = createPrismaClient(testUrl, schema);
    app = createApp({
      repository: new PrismaTransactionRepository(client, owner),
      storage: 'postgresql',
      checkStorage: async () => {
        await client.$queryRaw`SELECT 1`;
      },
    });
  }, 30000);
  beforeEach(async () => {
    await client.budget.deleteMany();
    await client.contribution.deleteMany();
    await client.session.deleteMany();
    await client.transaction.deleteMany();
    await client.goal.deleteMany();
    await client.category.deleteMany();
    await client.user.deleteMany();
    await client.user.createMany({
      data: [
        { id: owner, name: 'Local', email: 'local@test.invalid' },
        { id: other, name: 'Outro', email: 'outro@test.invalid' },
      ],
    });
    await client.category.createMany({
      data: [
        { name: 'Educação', type: 'expense', userId: owner },
        { name: 'Trabalho', type: 'income', userId: owner },
      ],
    });
  });
  afterAll(async () => {
    if (client) await client.$disconnect();
    if (pool) {
      if (/^finantrack_test_[a-f0-9]{32}$/.test(schema))
        await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await pool.end();
    }
  });
  async function account() {
    const agent = request.agent(createApp({ client, storage: 'postgresql' }));
    const session = (
      await agent
        .post('/api/auth/register')
        .set('Origin', 'http://127.0.0.1:5173')
        .send({
          name: 'Finance Test',
          email: randomUUID() + '@test.invalid',
          password: 'Strong-test-password-123!',
        })
        .expect(201)
    ).body.data;
    const headers = {
      Origin: 'http://127.0.0.1:5173',
      'X-CSRF-Token': session.csrfToken,
    };
    const categories = (await agent.get('/api/categories').expect(200)).body
      .data as { id: string; name: string; type: string }[];
    const expense = categories.find(
      (c) => c.type === 'expense' && c.name === 'Educação',
    )!;
    return { agent, headers, session, expense };
  }
  it('categorias personalizadas: cria, renomeia, valida cor/tipo, impede duplicação e exclui sem referências', async () => {
    const { agent, headers } = await account();
    const item = (
      await agent
        .post('/api/categories')
        .set(headers)
        .send({ name: 'Pets', type: 'expense', color: '#AABBCC' })
        .expect(201)
    ).body.data;
    await agent
      .post('/api/categories')
      .set(headers)
      .send({ name: 'Pets', type: 'expense', color: '#AABBCC' })
      .expect(409);
    await agent
      .patch('/api/categories/' + item.id)
      .set(headers)
      .send({ color: 'invalid' })
      .expect(400);
    await agent
      .patch('/api/categories/' + item.id)
      .set(headers)
      .send({ type: 'income' })
      .expect(409);
    expect(
      (
        await agent
          .patch('/api/categories/' + item.id)
          .set(headers)
          .send({ name: 'Animais', color: '#112233' })
          .expect(200)
      ).body.data.name,
    ).toBe('Animais');
    await agent
      .delete('/api/categories/' + item.id)
      .set(headers)
      .expect(204);
    await agent
      .delete('/api/categories/' + item.id)
      .set(headers)
      .expect(404);
  });
  it('transações rejeitam categorias inexistentes, de outro tipo ou proprietário e preservam notas', async () => {
    const a = await account();
    const b = await account();
    await a.agent
      .post('/api/transactions')
      .set(a.headers)
      .send({ ...input, category: 'Não existe' })
      .expect(400);
    await a.agent
      .post('/api/transactions')
      .set(a.headers)
      .send({ ...input, categoryId: b.expense.id })
      .expect(400);
    await a.agent
      .post('/api/transactions')
      .set(a.headers)
      .send({ ...input, type: 'income', categoryId: a.expense.id })
      .expect(400);
    const item = (
      await a.agent
        .post('/api/transactions')
        .set(a.headers)
        .send({ ...input, categoryId: a.expense.id, notes: 'Observação real' })
        .expect(201)
    ).body.data;
    expect(item.notes).toBe('Observação real');
    await a.agent
      .delete('/api/categories/' + a.expense.id)
      .set(a.headers)
      .expect(409);
    await a.agent
      .patch('/api/categories/' + a.expense.id)
      .set(a.headers)
      .send({ name: 'Estudos' })
      .expect(200);
    expect(
      (await a.agent.get('/api/transactions/' + item.id).expect(200)).body.data
        .category,
    ).toBe('Estudos');
    await b.agent
      .patch('/api/categories/' + a.expense.id)
      .set(b.headers)
      .send({ name: 'Invadida' })
      .expect(404);
  });
  it('metas registram contribuições concorrentes atomicamente e concluem ao atingir o alvo', async () => {
    const a = await account();
    const id = (
      await a.agent
        .post('/api/goals')
        .set(a.headers)
        .send({ name: 'Reserva', targetAmount: 100, deadline: '2027-01-01' })
        .expect(201)
    ).body.data.id;
    await Promise.all([
      a.agent
        .post('/api/goals/' + id + '/contributions')
        .set(a.headers)
        .send({ amount: 20.1 })
        .expect(201),
      a.agent
        .post('/api/goals/' + id + '/contributions')
        .set(a.headers)
        .send({ amount: 30.2 })
        .expect(201),
    ]);
    const row = await client.goal.findUniqueOrThrow({ where: { id } });
    expect(row.currentAmount.toNumber()).toBe(50.3);
    expect(await client.contribution.count({ where: { goalId: id } })).toBe(2);
    await a.agent
      .post('/api/goals/' + id + '/contributions')
      .set(a.headers)
      .send({ amount: -1 })
      .expect(400);
    await a.agent
      .patch('/api/goals/' + id)
      .set(a.headers)
      .send({ targetAmount: 40 })
      .expect(200);
    expect(
      (await client.goal.findUniqueOrThrow({ where: { id } })).status,
    ).toBe('completed');
    await a.agent
      .post('/api/goals/' + id + '/contributions')
      .set(a.headers)
      .send({ amount: 1 })
      .expect(409);
    await a.agent
      .delete('/api/goals/' + id)
      .set(a.headers)
      .expect(204);
    expect(await client.contribution.count({ where: { goalId: id } })).toBe(0);
  });
  it('metas de outro proprietário não podem ser consultadas, editadas ou receber contribuições', async () => {
    const a = await account();
    const b = await account();
    const id = (
      await a.agent
        .post('/api/goals')
        .set(a.headers)
        .send({ name: 'Reserva', targetAmount: 100 })
        .expect(201)
    ).body.data.id;
    expect((await b.agent.get('/api/goals').expect(200)).body.data).toEqual([]);
    await b.agent
      .patch('/api/goals/' + id)
      .set(b.headers)
      .send({ name: 'Invadida' })
      .expect(404);
    await b.agent
      .post('/api/goals/' + id + '/contributions')
      .set(b.headers)
      .send({ amount: 1 })
      .expect(404);
    await b.agent
      .delete('/api/goals/' + id)
      .set(b.headers)
      .expect(404);
  });
  it('orçamentos são únicos por categoria/mês/ano, alertam gastos e ignoram outros períodos', async () => {
    const a = await account();
    const body = {
      categoryId: a.expense.id,
      amount: 100,
      month: 11,
      year: 2026,
    };
    const id = (
      await a.agent.post('/api/budgets').set(a.headers).send(body).expect(201)
    ).body.data.id;
    await a.agent.post('/api/budgets').set(a.headers).send(body).expect(409);
    await a.agent
      .post('/api/budgets')
      .set(a.headers)
      .send({ ...body, month: 13 })
      .expect(400);
    for (const [amount, date] of [
      [85, '2026-11-05'],
      [999, '2025-11-05'],
      [999, '2026-10-05'],
    ] as const)
      await a.agent
        .post('/api/transactions')
        .set(a.headers)
        .send({ ...input, amount, date, categoryId: a.expense.id })
        .expect(201);
    const budget = (
      await a.agent.get('/api/budgets?month=11&year=2026').expect(200)
    ).body.data[0];
    expect(budget.spent).toBe(85);
    expect(budget.alert).toBe('near');
    await a.agent
      .patch('/api/budgets/' + id)
      .set(a.headers)
      .send({ amount: 50 })
      .expect(200);
    expect(
      (await a.agent.get('/api/budgets?month=11&year=2026')).body.data[0].alert,
    ).toBe('exceeded');
    await a.agent
      .delete('/api/budgets/' + id)
      .set(a.headers)
      .expect(204);
    expect(
      await client.transaction.count({ where: { userId: a.session.user.id } }),
    ).toBe(3);
  });
  it('calcula percentuais de orçamento em centavos sem truncar 0,30 / 0,10 para 299%', async () => {
    const a = await account();
    await a.agent
      .post('/api/budgets')
      .set(a.headers)
      .send({ categoryId: a.expense.id, amount: 0.1, month: 11, year: 2026 })
      .expect(201);
    await a.agent
      .post('/api/transactions')
      .set(a.headers)
      .send({ ...input, categoryId: a.expense.id, amount: 0.3 })
      .expect(201);
    const row = (
      await a.agent.get('/api/budgets?month=11&year=2026').expect(200)
    ).body.data[0];
    expect(row.percent).toBe(300);
    expect(row.alert).toBe('exceeded');
  });
  it('orçamentos validam categoria e impedem acesso por outra conta', async () => {
    const a = await account();
    const b = await account();
    const body = {
      categoryId: a.expense.id,
      amount: 10,
      month: 11,
      year: 2026,
    };
    await b.agent.post('/api/budgets').set(b.headers).send(body).expect(400);
    const id = (await a.agent.post('/api/budgets').set(a.headers).send(body))
      .body.data.id;
    await a.agent
      .delete('/api/categories/' + a.expense.id)
      .set(a.headers)
      .expect(409);
    expect(
      (await b.agent.get('/api/budgets?month=11&year=2026')).body.data,
    ).toEqual([]);
    await b.agent
      .patch('/api/budgets/' + id)
      .set(b.headers)
      .send({ ...body, categoryId: b.expense.id })
      .expect(404);
    await b.agent
      .delete('/api/budgets/' + id)
      .set(b.headers)
      .expect(404);
  });
  it('relatórios calculam período/saldo/CSV e não exportam dados de outras contas', async () => {
    const a = await account();
    const b = await account();
    await a.agent
      .post('/api/transactions')
      .set(a.headers)
      .send({
        ...input,
        amount: 42.35,
        categoryId: a.expense.id,
        description: '=HYPERLINK("teste")',
        notes: 'texto;com "aspas"',
      })
      .expect(201);
    const range = '?from=2026-11-01&to=2026-11-30';
    const report = (await a.agent.get('/api/reports' + range).expect(200)).body
      .data;
    expect(report.expense).toBe(42.35);
    expect(report.balance).toBe(-42.35);
    expect(report.income).toBe(0);
    expect(report.savingsRate).toBeNull();
    expect(report.monthly[0].balance).toBe(-42.35);
    const exported = await a.agent
      .get('/api/reports/export' + range)
      .expect(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.text).toContain("'=HYPERLINK");
    expect(exported.text).toContain('42.35');
    expect((await b.agent.get('/api/reports' + range)).body.data.count).toBe(0);
    expect(
      (await b.agent.get('/api/reports/export' + range)).text,
    ).not.toContain('HYPERLINK');
    await a.agent.get('/api/reports?from=2026-12-01&to=2026-11-01').expect(400);
  });
  it('retorna saúde PostgreSQL e CRUD completo pelo mesmo contrato', async () => {
    expect(
      (await request(app).get('/api/health').expect(200)).body.data.storage,
    ).toBe('postgresql');
    const item = (
      await request(app).post('/api/transactions').send(input).expect(201)
    ).body.data;
    expect(item).toMatchObject(input);
    expect(
      (await request(app).get('/api/transactions').expect(200)).body.data,
    ).toEqual([item]);
    const update = await request(app)
      .put(`/api/transactions/${item.id}`)
      .send({ ...input, amount: 234.56, category: 'Trabalho', type: 'income' })
      .expect(200);
    expect(update.body.data).toMatchObject({
      id: item.id,
      createdAt: item.createdAt,
      amount: 234.56,
      category: 'Trabalho',
      type: 'income',
    });
    await request(app).delete(`/api/transactions/${item.id}`).expect(204);
    await request(app).get(`/api/transactions/${item.id}`).expect(404);
  });
  it('persiste depois de desconectar e criar outro cliente e aplicação', async () => {
    const item = (await request(app).post('/api/transactions').send(input)).body
      .data;
    await client.$disconnect();
    const reopened = createPrismaClient(testUrl!, schema);
    try {
      const newApp = createApp({
        repository: new PrismaTransactionRepository(reopened, owner),
        storage: 'postgresql',
      });
      expect(
        (await request(newApp).get(`/api/transactions/${item.id}`).expect(200))
          .body.data,
      ).toEqual(item);
    } finally {
      await reopened.$disconnect();
    }
  });
  it('mantém dados depois de encerrar e reiniciar o processo real da API', async () => {
    await client.user.create({
      data: { id: LOCAL_USER_ID, name: 'Local API', email: 'api@test.invalid' },
    });
    const databaseUrl = new URL(testUrl!);
    databaseUrl.searchParams.set('schema', schema);
    async function start() {
      const port = await new Promise<number>((resolve, reject) => {
        const probe = createServer();
        probe.on('error', reject);
        probe.listen(0, '127.0.0.1', () => {
          const address = probe.address();
          const value =
            address && typeof address === 'object' ? address.port : 0;
          probe.close(() => resolve(value));
        });
      });
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'src/server.ts'],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            DATABASE_URL: databaseUrl.toString(),
            PORT: String(port),
            HOST: '127.0.0.1',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        },
      );
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('A API de teste não iniciou no prazo.')),
            10000,
          );
          child.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          child.once('exit', () => {
            clearTimeout(timeout);
            reject(new Error('A API de teste encerrou antes de iniciar.'));
          });
          child.stdout?.on('data', (data: Buffer) => {
            if (data.toString().includes('FinanTrack API local:')) {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      } catch (error) {
        child.kill();
        throw error;
      }
      return { child, url: `http://127.0.0.1:${port}` };
    }
    async function stop(child: ChildProcess) {
      if (child.exitCode !== null) return;
      await new Promise<void>((resolve) => {
        child.once('exit', () => resolve());
        child.kill();
      });
    }
    const first = await start();
    let id: string;
    let cookie: string;
    try {
      const session = await request(first.url)
        .post('/api/auth/register')
        .set('Origin', 'http://127.0.0.1:5173')
        .send({
          name: 'API Restart',
          email: 'restart@test.invalid',
          password: 'Long-test-password-123!',
        })
        .expect(201);
      cookie = session.headers['set-cookie'][0].split(';')[0];
      id = (
        await request(first.url)
          .post('/api/transactions')
          .set('Cookie', cookie)
          .set('Origin', 'http://127.0.0.1:5173')
          .set('X-CSRF-Token', session.body.data.csrfToken)
          .send(input)
          .expect(201)
      ).body.data.id;
    } finally {
      await stop(first.child);
    }
    const second = await start();
    try {
      expect(
        (
          await request(second.url)
            .get(`/api/transactions/${id}`)
            .set('Cookie', cookie)
            .expect(200)
        ).body.data,
      ).toMatchObject({ ...input, id });
    } finally {
      await stop(second.child);
    }
  }, 30000);
  it('autentica, protege transações, verifica CSRF e encerra a sessão', async () => {
    const secured = createApp({ client, storage: 'postgresql' });
    const browser = request.agent(secured);
    const origin = 'http://127.0.0.1:5173';
    await browser.get('/api/transactions').expect(401);
    await browser
      .post('/api/auth/register')
      .send({
        name: 'Ana',
        email: 'ana@test.invalid',
        password: 'Strong-test-password-123!',
      })
      .expect(403);
    const signup = await browser
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({
        name: 'Ana',
        email: 'ANA@test.invalid',
        password: 'Strong-test-password-123!',
      })
      .expect(201);
    expect(signup.body.data.user.email).toBe('ana@test.invalid');
    expect(signup.body.data.user).not.toHaveProperty('passwordHash');
    expect(signup.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(signup.headers['set-cookie'][0]).toContain('SameSite=Lax');
    const user = await client.user.findUniqueOrThrow({
      where: { email: 'ana@test.invalid' },
    });
    expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await client.category.count({ where: { userId: user.id } })).toBe(
      11,
    );
    const csrf = signup.body.data.csrfToken;
    await browser
      .post('/api/transactions')
      .set('Origin', origin)
      .send(input)
      .expect(403);
    await browser
      .post('/api/transactions')
      .set('Origin', origin)
      .set('X-CSRF-Token', 'f'.repeat(64))
      .send(input)
      .expect(403);
    await browser
      .post('/api/transactions')
      .set('Origin', origin)
      .set('X-CSRF-Token', csrf)
      .send(input)
      .expect(201);
    await browser.get('/api/auth/me').expect(200);
    await browser
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('X-CSRF-Token', csrf)
      .expect(204);
    await browser.get('/api/transactions').expect(401);
  });
  it('nega edição e exclusão entre usuários autenticados e detecta sessão expirada', async () => {
    const secured = createApp({ client });
    const a = request.agent(secured);
    const b = request.agent(secured);
    const origin = 'http://127.0.0.1:5173';
    const register = async (
      browser: ReturnType<typeof request.agent>,
      email: string,
    ) =>
      (
        await browser
          .post('/api/auth/register')
          .set('Origin', origin)
          .send({ name: 'Teste', email, password: 'Strong-test-password-123!' })
          .expect(201)
      ).body.data;
    const sa = await register(a, 'a@test.invalid');
    const sb = await register(b, 'b@test.invalid');
    const item = (
      await a
        .post('/api/transactions')
        .set('Origin', origin)
        .set('X-CSRF-Token', sa.csrfToken)
        .send(input)
        .expect(201)
    ).body.data;
    expect((await b.get('/api/transactions').expect(200)).body.data).toEqual(
      [],
    );
    await b
      .put(`/api/transactions/${item.id}`)
      .set('Origin', origin)
      .set('X-CSRF-Token', sb.csrfToken)
      .send(input)
      .expect(404);
    await b
      .delete(`/api/transactions/${item.id}`)
      .set('Origin', origin)
      .set('X-CSRF-Token', sb.csrfToken)
      .expect(404);
    await client.session.updateMany({
      where: { userId: sb.user.id },
      data: { expiresAt: new Date(0) },
    });
    await b.get('/api/auth/me').expect(401);
  });
  it('login rejeita senha incorreta, perfil funciona e troca de senha revoga sessões', async () => {
    const secured = createApp({ client });
    const origin = 'http://127.0.0.1:5173';
    const browser = request.agent(secured);
    const data = {
      name: 'Ana',
      email: 'ana@test.invalid',
      password: 'Strong-test-password-123!',
    };
    await browser
      .post('/api/auth/register')
      .set('Origin', origin)
      .send(data)
      .expect(201);
    await browser
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: data.email, password: 'incorreta' })
      .expect(401);
    const session = (
      await browser
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ email: data.email, password: data.password })
        .expect(200)
    ).body.data;
    expect(
      (
        await browser
          .patch('/api/auth/profile')
          .set('Origin', origin)
          .set('X-CSRF-Token', session.csrfToken)
          .send({ name: 'Ana Maria' })
          .expect(200)
      ).body.data.name,
    ).toBe('Ana Maria');
    await browser
      .post('/api/auth/password')
      .set('Origin', origin)
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        currentPassword: data.password,
        password: 'New-strong-password-456!',
      })
      .expect(204);
    expect(
      await client.session.count({ where: { userId: session.user.id } }),
    ).toBe(0);
    await browser.get('/api/auth/me').expect(401);
    await browser
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: data.email, password: 'New-strong-password-456!' })
      .expect(200);
  }, 15000);
  it('limita tentativas nas rotas sensíveis', async () => {
    const secured = createApp({ client });
    for (let index = 0; index < 20; index++)
      await request(secured)
        .post('/api/auth/login')
        .set('Origin', 'http://127.0.0.1:5173')
        .send({})
        .expect(400);
    const blocked = await request(secured)
      .post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:5173')
      .send({})
      .expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
  });
  it('valida cadastro, evita duplicação e usa cookies Secure em produção', async () => {
    const production = createApp({ client, production: true, crossSite: true });
    const origin = 'http://127.0.0.1:5173';
    const data = {
      name: 'Teste',
      email: 'secure@test.invalid',
      password: 'Strong-test-password-123!',
    };
    await request(production)
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ ...data, password: 'curta' })
      .expect(400);
    const response = await request(production)
      .post('/api/auth/register')
      .set('Origin', origin)
      .send(data)
      .expect(201);
    expect(response.headers['set-cookie'][0]).toContain('__Host-ft_session=');
    expect(response.headers['set-cookie'][0]).toContain('Secure');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=None');
    await request(production)
      .post('/api/auth/register')
      .set('Origin', origin)
      .send(data)
      .expect(409);
  });
  it('preserva centavos, limites, datas e reutiliza categoria sem duplicar', async () => {
    for (const amount of [0.01, 0.1, 0.2, 999999999.99]) {
      const item = (
        await request(app)
          .post('/api/transactions')
          .send({ ...input, amount, date: '2024-02-29' })
          .expect(201)
      ).body.data;
      expect(item.amount).toBe(amount);
      expect(item.date).toBe('2024-02-29');
    }
    expect(
      await client.category.count({
        where: { userId: owner, name: 'Educação' },
      }),
    ).toBe(1);
    expect(
      (await client.transaction.findMany()).every(
        (t) => t.amount.toFixed(2).split('.')[1].length === 2,
      ),
    ).toBe(true);
  });
  it('limita consultas e mutações ao proprietário do repository', async () => {
    const item = (await request(app).post('/api/transactions').send(input)).body
      .data;
    const otherApp = createApp({
      repository: new PrismaTransactionRepository(client, other),
      storage: 'postgresql',
    });
    expect(
      (await request(otherApp).get('/api/transactions')).body.data,
    ).toEqual([]);
    await request(otherApp).get(`/api/transactions/${item.id}`).expect(404);
    await request(otherApp)
      .put(`/api/transactions/${item.id}`)
      .send(input)
      .expect(404);
    await request(otherApp).delete(`/api/transactions/${item.id}`).expect(404);
    expect(await client.transaction.count()).toBe(1);
  });
  it('o banco rejeita valores negativos e categorias de outro usuário ou tipo', async () => {
    const item = (await request(app).post('/api/transactions').send(input)).body
      .data;
    await expect(
      client.transaction.update({
        where: { id: item.id },
        data: { amount: -1 },
      }),
    ).rejects.toThrow();
    const category = await client.category.create({
      data: { userId: other, name: 'Outra', type: 'expense' },
    });
    await expect(
      client.transaction.update({
        where: { id: item.id },
        data: { categoryId: category.id },
      }),
    ).rejects.toThrow();
    await expect(
      client.transaction.update({
        where: { id: item.id },
        data: { type: 'income' },
      }),
    ).rejects.toThrow();
  });
  it('valida entradas antes de persistir e responde 404 para UUID inexistente', async () => {
    await request(app)
      .post('/api/transactions')
      .send({ ...input, amount: 0.0000001 })
      .expect(400);
    expect(await client.transaction.count()).toBe(0);
    await request(app).get(`/api/transactions/${randomUUID()}`).expect(404);
  });
});
