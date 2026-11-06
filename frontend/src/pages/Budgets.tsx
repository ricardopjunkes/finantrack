import { useEffect, useState } from 'react';
import { apiRequest } from '../services/transactionsApi';
import { useCategories } from '../hooks/useCategories';
import { EditorDialog } from '../components/EditorDialog';
import { currency } from '../utils/format';
import { currentMonth } from '../utils/transactions';
export type Budget = {
  id: string;
  categoryId: string;
  amount: number;
  spent: number;
  percent: number;
  alert: 'ok' | 'near' | 'exceeded';
  month: number;
  year: number;
  category: { name: string; color: string };
};
export function Budgets() {
  const [period, setPeriod] = useState(currentMonth);
  const [items, setItems] = useState<Budget[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<Budget | null | undefined>();
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const categories = useCategories();
  const [year, month] = period.split('-').map(Number);
  const path = `/budgets?month=${month}&year=${year}`;
  function load() {
    return apiRequest<Budget[]>(path)
      .then((data) => {
        setItems(data);
        setError('');
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    let active = true;
    apiRequest<Budget[]>(path)
      .then((data) => {
        if (active) {
          setItems(data);
          setError('');
        }
      })
      .catch((c) => {
        if (active) setError(c.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PLANEJE ANTES DE GASTAR</div>
          <h1>
            Orçamentos<span>.</span>
          </h1>
          <p>Limites por categoria, mês e ano.</p>
        </div>
        <label>
          Mês
          <input
            type="month"
            min="1900-01"
            max="9999-12"
            value={period}
            onChange={(e) => {
              if (e.target.value) {
                setPeriod(e.target.value);
                setLoading(true);
              }
            }}
          />
        </label>
        <button
          className="primary-button"
          disabled={categories.loading || Boolean(categories.error)}
          onClick={() => setEditing(null)}
        >
          Novo orçamento
        </button>
      </div>
      <p role="status" className="success-message">
        {message}
      </p>
      {(error || categories.error) && (
        <p role="alert" className="error-message">
          {error || categories.error}
          <button
            onClick={() =>
              void Promise.all([load(), categories.reload()]).catch((c) =>
                setError(c.message),
              )
            }
          >
            Tentar novamente
          </button>
        </p>
      )}
      {loading && <p role="status">Carregando orçamentos…</p>}
      <div className="resource-grid">
        {!loading &&
          !error &&
          items.map((item) => (
            <article className="panel" key={item.id}>
              <h2>{item.category.name}</h2>
              <p>
                {currency(item.spent)} de {currency(item.amount)}
              </p>
              <progress
                max={100}
                value={Math.min(100, item.percent)}
                aria-label={`Utilização de ${item.category.name}`}
              />
              <p className={item.alert === 'exceeded' ? 'expense' : ''}>
                {item.percent}% utilizado ·{' '}
                {item.alert === 'exceeded'
                  ? 'Limite atingido ou ultrapassado'
                  : item.alert === 'near'
                    ? 'Próximo do limite'
                    : 'Dentro do limite'}
              </p>
              <div className="resource-actions">
                <button
                  className="secondary-button"
                  onClick={() => setEditing(item)}
                >
                  Editar
                </button>
                <button
                  className="secondary-button danger"
                  onClick={() => setDeleting(item)}
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
      </div>
      {!loading && !error && !items.length && (
        <div className="panel empty-state">
          <h2>Nenhum orçamento neste mês</h2>
          <p>Defina um limite para acompanhar seus gastos.</p>
        </div>
      )}
      {editing !== undefined && (
        <EditorDialog
          title={editing ? 'Editar orçamento' : 'Novo orçamento'}
          onClose={() => setEditing(undefined)}
          onSave={async (data) => {
            await apiRequest(
              editing ? `/budgets/${editing.id}` : '/budgets',
              editing ? 'PATCH' : 'POST',
              {
                categoryId: String(data.get('categoryId')),
                amount: Number(data.get('amount')),
                month,
                year,
              },
            );
            await load().catch((c) =>
              setError(
                'Operação salva. Falha ao atualizar a lista: ' + c.message,
              ),
            );
            setMessage('Orçamento salvo.');
          }}
        >
          <label>
            Categoria de despesa
            <select
              name="categoryId"
              required
              defaultValue={editing?.categoryId ?? ''}
            >
              <option value="" disabled>
                Selecione
              </option>
              {categories.items
                .filter((c) => c.type === 'expense')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Limite (R$)
            <input
              name="amount"
              type="number"
              required
              min="0.01"
              max="999999999.99"
              step="0.01"
              defaultValue={editing?.amount}
            />
          </label>
          <p className="form-help">Período: {period}</p>
        </EditorDialog>
      )}
      {deleting && (
        <EditorDialog
          title="Excluir orçamento?"
          confirmLabel="Excluir"
          onClose={() => setDeleting(null)}
          onSave={async () => {
            await apiRequest(`/budgets/${deleting.id}`, 'DELETE');
            await load();
            setMessage('Orçamento excluído.');
          }}
        >
          <p>
            Excluir o limite de {deleting.category.name}? As transações serão
            preservadas.
          </p>
        </EditorDialog>
      )}
    </>
  );
}
