import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Transaction } from '../types/finance';
import { transactionsApi } from '../services/transactionsApi';
import { validTransaction, type TransactionInput } from '../utils/transactions';
type Store = {
  transactions: Transaction[];
  loading: boolean;
  saving: boolean;
  error: string;
  reload: (background?: boolean) => Promise<void>;
  save: (input: TransactionInput, id?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};
const Context = createContext<Store | null>(null);
const message = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : 'Não foi possível concluir a operação.';
export function TransactionsProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const requestId = useRef(0);
  const pendingRead = useRef<AbortController | null>(null);
  const load = useCallback((controller: AbortController) => {
    pendingRead.current?.abort();
    pendingRead.current = controller;
    const id = ++requestId.current;
    return transactionsApi
      .list(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted && id === requestId.current)
          setTransactions(items);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted && id === requestId.current)
          setError(message(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted && id === requestId.current)
          setLoading(false);
      });
  }, []);
  const reload = useCallback(
    (background = false) => {
      if (!background) setLoading(true);
      setError('');
      return load(new AbortController());
    },
    [load],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller);
    return () => controller.abort();
  }, [load]);
  async function mutate(operation: () => Promise<void>) {
    if (busy.current || loading)
      throw new Error('Aguarde a operação em andamento.');
    busy.current = true;
    setSaving(true);
    setError('');
    pendingRead.current?.abort();
    requestId.current++;
    try {
      await operation();
    } catch (cause) {
      setError(message(cause));
      throw new Error(message(cause));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function save(input: TransactionInput, id?: string) {
    if (!validTransaction(input))
      throw new Error('Confira os campos da transação.');
    const clean = {
      ...input,
      description: input.description.trim(),
      category: input.category.trim(),
    };
    await mutate(async () => {
      const item = id
        ? await transactionsApi.update(id, clean)
        : await transactionsApi.create(clean);
      setTransactions((previous) =>
        id
          ? previous.map((t) => (t.id === id ? item : t))
          : [...previous, item],
      );
    });
  }
  async function remove(id: string) {
    await mutate(async () => {
      await transactionsApi.remove(id);
      setTransactions((previous) => previous.filter((t) => t.id !== id));
    });
  }
  return (
    <Context.Provider
      value={{ transactions, loading, saving, error, reload, save, remove }}
    >
      {children}
    </Context.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useTransactions() {
  const store = useContext(Context);
  if (!store) throw new Error('TransactionsProvider ausente.');
  return store;
}
