// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { Categories } from './Categories';
import { Goals } from './Goals';
import { Budgets } from './Budgets';
import { apiRequest } from '../services/transactionsApi';
vi.mock('../services/transactionsApi', () => ({ apiRequest: vi.fn() }));
vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => ({ reload: vi.fn().mockResolvedValue(undefined) }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.resetAllMocks();
});
function button(text: string) {
  const found = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === text,
  );
  if (!found) throw new Error('Botão ausente: ' + text);
  return found;
}
async function submit() {
  await act(async () => {
    container
      .querySelector('dialog form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}
it('cria categoria pela API, atualiza a lista e cancelar exclusão não altera dados', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce([]);
  await act(async () => root.render(<Categories />));
  await act(async () => button('Nova categoria').click());
  container.querySelector<HTMLInputElement>('[name="name"]')!.value = 'Pets';
  const item = {
    id: 'pets',
    name: 'Pets',
    type: 'expense',
    color: '#10B981',
    _count: { transactions: 0 },
  };
  vi.mocked(apiRequest)
    .mockResolvedValueOnce(item)
    .mockResolvedValueOnce([item]);
  await submit();
  expect(apiRequest).toHaveBeenCalledWith('/categories', 'POST', {
    name: 'Pets',
    type: 'expense',
    color: '#10b981',
  });
  expect(container.textContent).toContain('Categoria salva.');
  expect(container.textContent).toContain('Pets');
  await act(async () => button('Excluir').click());
  await act(async () => button('Cancelar').click());
  expect(apiRequest).not.toHaveBeenCalledWith('/categories/pets', 'DELETE');
});
it('contribui com centavos na meta e atualiza o progresso após confirmação HTTP', async () => {
  const goal = {
    id: 'goal',
    name: 'Reserva',
    targetAmount: '100',
    currentAmount: '0',
    deadline: null,
    status: 'active',
  };
  vi.mocked(apiRequest).mockResolvedValueOnce([goal]);
  await act(async () => root.render(<Goals />));
  await act(async () => button('Contribuir').click());
  container.querySelector<HTMLInputElement>('[name="amount"]')!.value = '25.35';
  vi.mocked(apiRequest)
    .mockResolvedValueOnce({ ...goal, currentAmount: '25.35' })
    .mockResolvedValueOnce([{ ...goal, currentAmount: '25.35' }]);
  await submit();
  expect(apiRequest).toHaveBeenCalledWith('/goals/goal/contributions', 'POST', {
    amount: 25.35,
  });
  expect(container.querySelector('progress')?.value).toBe(25);
});
it('formulário de orçamento usa categoria real e o mês/ano exibidos', async () => {
  const category = {
    id: 'edu',
    name: 'Educação',
    type: 'expense',
    color: '#10b981',
  };
  vi.mocked(apiRequest)
    .mockResolvedValueOnce([category])
    .mockResolvedValueOnce([]);
  await act(async () => root.render(<Budgets />));
  await act(async () => button('Novo orçamento').click());
  container.querySelector<HTMLSelectElement>('[name="categoryId"]')!.value =
    'edu';
  container.querySelector<HTMLInputElement>('[name="amount"]')!.value =
    '200.50';
  vi.mocked(apiRequest).mockResolvedValueOnce({}).mockResolvedValueOnce([]);
  await submit();
  const now = new Date();
  expect(apiRequest).toHaveBeenCalledWith('/budgets', 'POST', {
    categoryId: 'edu',
    amount: 200.5,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  expect(container.textContent).toContain('Orçamento salvo.');
});
it('mostra falha de carregamento sem inventar registros', async () => {
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error('API indisponível'));
  await act(async () => root.render(<Categories />));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    'API indisponível',
  );
  expect(container.querySelectorAll('article')).toHaveLength(0);
});
