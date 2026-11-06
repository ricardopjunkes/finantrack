import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../services/transactionsApi';
import type { Category } from '../types/finance';
export function useCategories() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(
    () =>
      apiRequest<Category[]>('/categories')
        .then((data) => {
          setItems(data);
          setError('');
        })
        .catch((cause) => {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Não foi possível carregar categorias.',
          );
          throw cause;
        })
        .finally(() => setLoading(false)),
    [],
  );
  useEffect(() => {
    let active = true;
    apiRequest<Category[]>('/categories')
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Erro ao carregar categorias.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return { items, loading, error, reload: load };
}
