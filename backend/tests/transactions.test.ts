import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { MemoryTransactionRepository } from '../src/repositories/transactionRepository.js';
const input = {
  description: 'Mercado',
  amount: 123.45,
  type: 'expense',
  category: 'Alimentação',
  date: '2026-11-05',
};
let repository: MemoryTransactionRepository;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  repository = new MemoryTransactionRepository();
  app = createApp({ repository });
});
describe('API local FinanTrack', () => {
  it('informa indisponibilidade do banco no endpoint de saúde sem expor detalhes', async () => {
    const unavailable = createApp({
      repository,
      storage: 'postgresql',
      checkStorage: async () => {
        throw new Error('secret connection');
      },
    });
    expect(
      (await request(unavailable).get('/api/health').expect(503)).body,
    ).toEqual({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Banco de dados indisponível. Tente novamente.',
      },
    });
  });
  it('padroniza URL malformada e corpo acima do limite', async () => {
    expect(
      (await request(app).get('/api/transactions/%ZZ').expect(400)).body.error
        .code,
    ).toBe('INVALID_URL');
    expect(
      (
        await request(app)
          .post('/api/transactions')
          .send({ ...input, description: 'x'.repeat(17000) })
          .expect(413)
      ).body.error.code,
    ).toBe('PAYLOAD_TOO_LARGE');
  });
  it('retorna saúde e lista vazia sem inserir exemplos', async () => {
    const health = await request(app).get('/api/health').expect(200);
    expect(health.body).toEqual({ data: { status: 'ok', storage: 'memory' } });
    expect(
      (await request(app).get('/api/transactions').expect(200)).body,
    ).toEqual({ data: [] });
  });
  it.each(['income', 'expense'])(
    'cria %s, informa Location e permite consultar pelo UUID',
    async (type) => {
      const response = await request(app)
        .post('/api/transactions')
        .send({ ...input, type, description: ' Mercado ' })
        .expect(201);
      expect(response.body.data).toMatchObject({
        ...input,
        type,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      const item = response.body.data;
      expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(Number.isNaN(Date.parse(item.createdAt))).toBe(false);
      expect(response.headers.location).toBe(`/api/transactions/${item.id}`);
      expect(
        (await request(app).get(response.headers.location).expect(200)).body
          .data,
      ).toEqual(item);
      expect((await repository.findById(item.id))?.amountCents).toBe(12345);
      expect(item).not.toHaveProperty('amountCents');
    },
  );
  it('lista transações por data decrescente e mantém centavos de 0,10 e 0,20', async () => {
    await request(app)
      .post('/api/transactions')
      .send({ ...input, amount: 0.1, date: '2026-10-01' })
      .expect(201);
    await request(app)
      .post('/api/transactions')
      .send({ ...input, amount: 0.2 })
      .expect(201);
    const list = (await request(app).get('/api/transactions').expect(200)).body
      .data;
    expect(list.map((item: { amount: number }) => item.amount)).toEqual([
      0.2, 0.1,
    ]);
    expect(
      (await repository.findAll()).reduce((sum, t) => sum + t.amountCents, 0),
    ).toBe(30);
  });
  it.each([
    { description: '' },
    { description: '   ' },
    { description: 'x'.repeat(121) },
    { amount: 0 },
    { amount: -1 },
    { amount: 1.001 },
    { amount: 0.0000001 },
    { amount: 1.0000001 },
    { amount: '12.34' },
    { amount: null },
    { amount: 1000000000 },
    { category: '' },
    { type: 'transfer' },
    { date: '2026-02-29' },
    { date: '2026-02-30' },
    { date: '2026-99-99' },
    { date: '05/11/2026' },
    { date: '1899-12-31' },
    { id: randomUUID() },
    { createdAt: '2026-01-01' },
  ])('rejeita campos inválidos: %j', async (changes) => {
    const response = await request(app)
      .post('/api/transactions')
      .send({ ...input, ...changes })
      .expect(400);
    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.any(String),
      details: expect.any(Array),
    });
    expect(await repository.findAll()).toEqual([]);
  });
  it('rejeita corpo vazio e JSON malformado com erro consistente', async () => {
    await request(app).post('/api/transactions').send({}).expect(400);
    const response = await request(app)
      .post('/api/transactions')
      .set('Content-Type', 'application/json')
      .send('{broken')
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(response.body.error).not.toHaveProperty('stack');
  });
  it('aceita data bissexta válida e o limite monetário', async () => {
    await request(app)
      .post('/api/transactions')
      .send({ ...input, date: '2024-02-29', amount: 999999999.99 })
      .expect(201);
  });
  it('atualiza integralmente preservando UUID e criação e valida o PUT', async () => {
    const original = (await request(app).post('/api/transactions').send(input))
      .body.data;
    const updated = await request(app)
      .put(`/api/transactions/${original.id}`)
      .send({
        ...input,
        description: 'Curso',
        amount: 400.01,
        type: 'income',
        category: 'Educação',
        date: '2026-12-01',
      })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      id: original.id,
      createdAt: original.createdAt,
      description: 'Curso',
      amount: 400.01,
      type: 'income',
      category: 'Educação',
      date: '2026-12-01',
    });
    expect(Date.parse(updated.body.data.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(original.updatedAt),
    );
    await request(app)
      .put(`/api/transactions/${original.id}`)
      .send({ amount: 200 })
      .expect(400);
    expect(
      (await request(app).get(`/api/transactions/${original.id}`)).body.data
        .amount,
    ).toBe(400.01);
  });
  it('exclui sem corpo e depois retorna 404', async () => {
    const id = (await request(app).post('/api/transactions').send(input)).body
      .data.id;
    expect(
      (await request(app).delete(`/api/transactions/${id}`).expect(204)).text,
    ).toBe('');
    await request(app).get(`/api/transactions/${id}`).expect(404);
    await request(app).delete(`/api/transactions/${id}`).expect(404);
    expect((await request(app).get('/api/transactions')).body.data).toEqual([]);
  });
  it.each(['get', 'put', 'delete'] as const)(
    '%s diferencia UUID inexistente de identificador inválido',
    async (method) => {
      const missing = request(app)[method](`/api/transactions/${randomUUID()}`);
      if (method === 'put') missing.send(input);
      expect((await missing.expect(404)).body.error.code).toBe('NOT_FOUND');
      const invalid = request(app)[method]('/api/transactions/not-an-id');
      if (method === 'put') invalid.send(input);
      expect((await invalid.expect(400)).body.error.code).toBe(
        'VALIDATION_ERROR',
      );
    },
  );
  it('isola instâncias do repositório e protege os dados de mutações por referência', async () => {
    const id = (await request(app).post('/api/transactions').send(input)).body
      .data.id;
    expect(
      (
        await request(
          createApp({ repository: new MemoryTransactionRepository() }),
        ).get('/api/transactions')
      ).body.data,
    ).toEqual([]);
    const item = (await repository.findById(id))!;
    item.amountCents = 0;
    expect((await repository.findById(id))?.amountCents).toBe(12345);
  });
  it('configura CORS e o preflight para as origens locais permitidas', async () => {
    expect(
      (
        await request(app)
          .get('/api/health')
          .set('Origin', 'http://127.0.0.1:5173')
          .expect(200)
      ).headers['access-control-allow-origin'],
    ).toBe('http://127.0.0.1:5173');
    await request(app)
      .options('/api/transactions')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'PUT')
      .expect(204);
    const denied = await request(app)
      .get('/api/health')
      .set('Origin', 'http://untrusted.example')
      .expect(403);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    expect(denied.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });
  it('responde JSON em rota desconhecida e oculta detalhes de falhas inesperadas', async () => {
    expect(
      (await request(app).get('/api/missing').expect(404)).body.error.code,
    ).toBe('NOT_FOUND');
    vi.spyOn(repository, 'findAll').mockRejectedValueOnce(
      new Error('SECRET database details'),
    );
    const response = await request(app).get('/api/transactions').expect(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocorreu um erro interno. Tente novamente.',
      },
    });
  });
});
