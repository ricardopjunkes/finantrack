import { afterEach, describe, expect, it, vi } from 'vitest';
import { transactionsApi } from './transactionsApi';
const input = {
  description: 'Curso',
  amount: 123.45,
  type: 'expense' as const,
  category: 'Educação',
  date: '2026-11-05',
};
afterEach(() => vi.unstubAllGlobals());
describe('cliente HTTP de transações', () => {
  it('lista a API e lê o envelope data', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal('fetch', fetcher);
    expect(await transactionsApi.list()).toEqual([]);
    expect(fetcher.mock.calls[0][0]).toBe('/api/transactions');
  });
  it('usa POST e PUT com apenas os campos de entrada e preserva centavos', async () => {
    const item = { ...input, id: 'uuid' };
    const fetcher = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ data: item }), { status: 201 }),
      );
    vi.stubGlobal('fetch', fetcher);
    expect(await transactionsApi.create(input)).toEqual(item);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await transactionsApi.update('uuid', input);
    expect(fetcher.mock.calls[1][1].method).toBe('PUT');
  });
  it('aceita 204 sem tentar ler JSON na exclusão', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    expect(await transactionsApi.remove('uuid')).toBeUndefined();
  });
  it('apresenta a mensagem de erro da API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'NOT_FOUND',
              message: 'Transação não encontrada.',
            },
          }),
          { status: 404 },
        ),
      ),
    );
    await expect(transactionsApi.remove('uuid')).rejects.toThrow(
      'Transação não encontrada',
    );
  });
  it('trata falha de rede e resposta inválida com mensagem compreensível', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network failed'))
      .mockResolvedValueOnce(new Response('<html>Erro</html>'));
    vi.stubGlobal('fetch', fetcher);
    await expect(transactionsApi.list()).rejects.toThrow(
      'backend está em execução',
    );
    await expect(transactionsApi.list()).rejects.toThrow(
      'backend está em execução',
    );
  });
});
