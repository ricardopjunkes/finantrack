import { useState } from 'react';
import { useCategories } from '../hooks/useCategories';
import { useTransactions } from '../hooks/useTransactions';
import { apiRequest } from '../services/transactionsApi';
import type { Category } from '../types/finance';
import { EditorDialog } from '../components/EditorDialog';
export function Categories() {
  const { items, loading, error, reload } = useCategories();
  const { reload: refreshTransactions } = useTransactions();
  const [editing, setEditing] = useState<Category | null | undefined>();
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [message, setMessage] = useState('');
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ORGANIZE DO SEU JEITO</div>
          <h1>
            Categorias<span>.</span>
          </h1>
          <p>Personalize os grupos das suas receitas e despesas.</p>
        </div>
        <button className="primary-button" onClick={() => setEditing(null)}>
          Nova categoria
        </button>
      </div>
      <p role="status" className="success-message">
        {message}
      </p>
      {loading && <p role="status">Carregando categorias…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
          <button
            className="secondary-button"
            onClick={() => void reload().catch(() => {})}
          >
            Tentar novamente
          </button>
        </p>
      )}
      <div className="resource-grid">
        {items.map((item) => (
          <article className="panel" key={item.id}>
            <h2>
              <i style={{ background: item.color }} /> {item.name}
            </h2>
            <p>
              {item.type === 'income' ? 'Receita' : 'Despesa'} ·{' '}
              {item._count?.transactions ?? 0} transações
            </p>
            <div className="form-actions">
              <button
                className="secondary-button"
                aria-label={`Editar ${item.name}`}
                onClick={() => setEditing(item)}
              >
                Editar
              </button>
              <button
                className="secondary-button danger"
                aria-label={`Excluir ${item.name}`}
                onClick={() => setDeleting(item)}
              >
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>
      {!loading && !error && !items.length && (
        <section className="panel empty-state">
          <h2>Nenhuma categoria</h2>
          <p>Crie uma categoria para começar.</p>
        </section>
      )}
      {editing !== undefined && (
        <EditorDialog
          title={editing ? 'Editar categoria' : 'Nova categoria'}
          onClose={() => setEditing(undefined)}
          onSave={async (data) => {
            await apiRequest(
              editing ? `/categories/${editing.id}` : '/categories',
              editing ? 'PATCH' : 'POST',
              {
                name: String(data.get('name')).trim(),
                type: editing?.type ?? String(data.get('type')),
                color: String(data.get('color')),
              },
            );
            await reload().catch(() => {});
            await refreshTransactions(true);
            setMessage('Categoria salva.');
          }}
        >
          <label>
            Nome
            <input
              name="name"
              required
              maxLength={60}
              defaultValue={editing?.name}
            />
          </label>
          <label>
            Tipo
            <select
              name="type"
              defaultValue={editing?.type ?? 'expense'}
              disabled={Boolean(editing)}
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </label>
          {editing && (
            <p className="form-help">
              O tipo é definido na criação para preservar as transações
              vinculadas.
            </p>
          )}
          <label>
            Cor
            <input
              name="color"
              type="color"
              required
              defaultValue={editing?.color ?? '#10B981'}
            />
          </label>
        </EditorDialog>
      )}
      {deleting && (
        <EditorDialog
          title="Excluir categoria?"
          confirmLabel="Excluir categoria"
          onClose={() => setDeleting(null)}
          onSave={async () => {
            await apiRequest(`/categories/${deleting.id}`, 'DELETE');
            await reload();
            setMessage('Categoria excluída.');
          }}
        >
          <p className="form-help">
            Excluir “{deleting.name}”? Categorias com transações ou orçamentos
            vinculados não podem ser excluídas.
          </p>
        </EditorDialog>
      )}
    </>
  );
}
