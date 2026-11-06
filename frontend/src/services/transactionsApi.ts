import type { Transaction } from '../types/finance';
import type { TransactionInput } from '../utils/transactions';
let csrfToken = '';
export const setCsrfToken = (value: string) => {
  csrfToken = value;
};
const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
export async function apiRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(10000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (response.status === 204) return undefined as T;
    const payload: unknown = await response.json();
    if (response.status === 401 && typeof window !== 'undefined')
      window.dispatchEvent(new Event('finantrack:unauthorized'));
    if (!response.ok)
      throw new Error(
        isObject(payload) &&
          isObject(payload.error) &&
          typeof payload.error.message === 'string'
          ? payload.error.message
          : `Não foi possível concluir a operação (HTTP ${response.status}).`,
      );
    if (!isObject(payload) || !Object.hasOwn(payload, 'data'))
      throw new Error('A API retornou uma resposta inesperada.');
    return payload.data as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted)
      throw new Error(
        'A API demorou para responder. Confira o backend e tente novamente.',
      );
    if (error instanceof TypeError || error instanceof SyntaxError)
      throw new Error(
        'Não foi possível conectar à API. Verifique se o backend está em execução.',
      );
    throw error;
  }
}
export const transactionsApi = {
  list: (signal?: AbortSignal) =>
    apiRequest<Transaction[]>('/transactions', 'GET', undefined, signal),
  create: (input: TransactionInput) =>
    apiRequest<Transaction>('/transactions', 'POST', input),
  update: (id: string, input: TransactionInput) =>
    apiRequest<Transaction>(
      `/transactions/${encodeURIComponent(id)}`,
      'PUT',
      input,
    ),
  remove: (id: string) =>
    apiRequest<void>(`/transactions/${encodeURIComponent(id)}`, 'DELETE'),
};
