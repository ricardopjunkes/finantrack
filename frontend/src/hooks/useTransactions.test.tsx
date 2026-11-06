// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionsProvider, useTransactions } from './useTransactions';
import { transactionsApi } from '../services/transactionsApi';
import { STORAGE_KEY } from '../services/transactionStorage';
vi.mock('../services/transactionsApi', () => ({
  transactionsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));
import { DeleteTransactionDialog } from '../components/DeleteTransactionDialog';
import { TransactionForm } from '../components/TransactionForm';
import type { Transaction } from '../types/finance';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
let store: ReturnType<typeof useTransactions>;
function Probe() {
  const value = useTransactions();
  useEffect(() => {
    store = value;
  }, [value]);
  return <output>{value.transactions.length}</output>;
}
const input = {
  description: 'Compra de teste',
  amount: 12.34,
  type: 'expense' as const,
  category: 'Educação',
  date: '2026-11-05',
};
beforeEach(() => {
  localStorage.clear();
  vi.mocked(transactionsApi.list).mockResolvedValue([]);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  // JSDOM supplies a DOM, but not the native dialog implementation.
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
  vi.restoreAllMocks();
  vi.resetAllMocks();
});
describe('integração React com a API', () => {
  async function mount() {
    await act(async () =>
      root.render(
        <TransactionsProvider>
          <Probe />
        </TransactionsProvider>,
      ),
    );
  }
  it('carrega somente a API e preserva os dados antigos sem migrar', async () => {
    const raw = JSON.stringify([{ ...input, id: 'legacy' }]);
    localStorage.setItem(STORAGE_KEY, raw);
    await mount();
    expect(store.transactions).toEqual([]);
    expect(store.loading).toBe(false);
    expect(transactionsApi.create).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('cria, edita e exclui somente após a confirmação HTTP', async () => {
    await mount();
    const created = {
      ...input,
      id: 'server-id',
      createdAt: '2026-11-05T12:00:00Z',
      updatedAt: '2026-11-05T12:00:00Z',
    };
    vi.mocked(transactionsApi.create).mockResolvedValue(created);
    await act(async () => store.save(input));
    expect(store.transactions).toEqual([created]);
    const edited = { ...created, amount: 99.99, type: 'income' as const };
    vi.mocked(transactionsApi.update).mockResolvedValue(edited);
    await act(async () =>
      store.save({ ...input, amount: 99.99, type: 'income' }, created.id),
    );
    expect(store.transactions).toEqual([edited]);
    expect(transactionsApi.update).toHaveBeenCalledWith(created.id, {
      ...input,
      amount: 99.99,
      type: 'income',
    });
    vi.mocked(transactionsApi.remove).mockResolvedValue(undefined);
    await act(async () => store.remove(created.id));
    expect(store.transactions).toEqual([]);
    expect(transactionsApi.remove).toHaveBeenCalledWith(created.id);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('mantém o estado em falha de gravação e permite tentar novamente', async () => {
    await mount();
    vi.mocked(transactionsApi.create).mockRejectedValueOnce(
      new Error('Backend indisponível'),
    );
    await act(async () => {
      await expect(store.save(input)).rejects.toThrow('Backend indisponível');
    });
    expect(store.transactions).toEqual([]);
    expect(store.error).toBe('Backend indisponível');
    expect(store.saving).toBe(false);
    vi.mocked(transactionsApi.create).mockResolvedValue({
      ...input,
      id: 'new',
    });
    await act(async () => store.save(input));
    expect(store.transactions).toHaveLength(1);
    expect(store.error).toBe('');
  });
  it('trata erro inicial e recarrega pela API', async () => {
    vi.mocked(transactionsApi.list).mockRejectedValueOnce(
      new Error('API offline'),
    );
    await mount();
    expect(store.error).toBe('API offline');
    expect(store.loading).toBe(false);
    vi.mocked(transactionsApi.list).mockResolvedValue([
      { ...input, id: 'loaded' },
    ]);
    await act(async () => store.reload());
    expect(store.transactions[0].id).toBe('loaded');
    expect(store.error).toBe('');
  });
  it('mantém indicador de envio e impede submissão duplicada', async () => {
    await mount();
    let finish!: (value: Transaction) => void;
    vi.mocked(transactionsApi.create).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    let pending!: Promise<void>;
    await act(async () => {
      pending = store.save(input);
    });
    expect(store.saving).toBe(true);
    expect(store.transactions).toEqual([]);
    await expect(store.save(input)).rejects.toThrow('Aguarde');
    expect(transactionsApi.create).toHaveBeenCalledOnce();
    await act(async () => {
      finish({ ...input, id: 'created' });
      await pending;
    });
    expect(store.saving).toBe(false);
  });
  it('rejeita dados inválidos antes de chamar a API', async () => {
    await mount();
    await expect(store.save({ ...input, amount: -1 })).rejects.toThrow(
      'Confira os campos',
    );
    expect(transactionsApi.create).not.toHaveBeenCalled();
    expect(store.transactions).toEqual([]);
  });
});

describe('diálogos de transação', () => {
  const transaction: Transaction = { ...input, id: 'test' };
  it('não exclui antes da confirmação e permite cancelar com foco seguro', async () => {
    const remove = vi.fn();
    const close = vi.fn();
    await act(async () =>
      root.render(
        <DeleteTransactionDialog
          transaction={transaction}
          onClose={close}
          onDelete={remove}
        />,
      ),
    );
    const buttons = container.querySelectorAll('button');
    expect(document.activeElement).toBe(buttons[0]);
    expect(remove).not.toHaveBeenCalled();
    await act(async () => buttons[0].click());
    expect(close).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
    await act(async () => buttons[1].click());
    expect(remove).toHaveBeenCalledOnce();
  });
  it('mantém o diálogo aberto e informa falha de exclusão', async () => {
    await act(async () =>
      root.render(
        <DeleteTransactionDialog
          transaction={transaction}
          onClose={vi.fn()}
          onDelete={() => {
            throw new Error('Falha de armazenamento');
          }}
        />,
      ),
    );
    await act(async () => container.querySelectorAll('button')[1].click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Falha de armazenamento',
    );
    expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(true);
  });
  it('formulário rejeita zero e salva os campos válidos sem perder centavos', async () => {
    const save = vi.fn();
    const close = vi.fn();
    await act(async () =>
      root.render(
        <TransactionForm
          transaction={transaction}
          categoryOptions={[
            { id: 'edu', name: 'Educação', type: 'expense', color: '#10B981' },
          ]}
          onSave={save}
          onClose={close}
        />,
      ),
    );
    const amount =
      container.querySelector<HTMLInputElement>('[name="amount"]')!;
    const form = container.querySelector('form')!;
    amount.value = '0';
    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });
    expect(save).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    amount.value = '45.67';
    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });
    expect(save).toHaveBeenCalledWith(
      { ...input, amount: 45.67, categoryId: 'edu', notes: null },
      transaction.id,
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
