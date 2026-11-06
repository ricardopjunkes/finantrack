import { useState } from 'react';
import { useCategories } from '../hooks/useCategories';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useTransactions } from '../hooks/useTransactions';
import { TransactionForm } from '../components/TransactionForm';
import { DeleteTransactionDialog } from '../components/DeleteTransactionDialog';
import type { Transaction } from '../types/finance';
import { filterTransactions, type Filters } from '../utils/transactions';
import { currency, dateLabel } from '../utils/format';
const emptyFilters: Filters = {
  search: '',
  type: '',
  category: '',
  month: '',
  order: 'newest',
  from: '',
  to: '',
};
export function Transactions() {
  const { transactions, save, remove, saving } = useTransactions();
  const categories = useCategories();
  const [filters, setFilters] = useState(emptyFilters);
  const [editing, setEditing] = useState<Transaction | null | undefined>(
    undefined,
  );
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const items = filterTransactions(transactions, filters);
  const lastPage = Math.max(1, Math.ceil(items.length / 15));
  const currentPage = Math.min(page, lastPage);
  const visible = items.slice((currentPage - 1) * 15, currentPage * 15);
  const categoryOptions = [
    ...new Set(transactions.map((t) => t.category)),
  ].sort();
  function filter(key: keyof Filters, value: string) {
    setPage(1);
    setFilters((previous) => ({ ...previous, [key]: value }));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CADA MOVIMENTO IMPORTA</div>
          <h1>
            Transações<span>.</span>
          </h1>
          <p>Organize suas receitas e despesas em um só lugar.</p>
        </div>
        <button
          className="primary-button"
          disabled={saving || categories.loading || Boolean(categories.error)}
          onClick={() => setEditing(null)}
        >
          <Plus size={18} />
          Nova transação
        </button>
      </div>
      <div role="status" className="success-message">
        {message}
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {categories.error && (
        <p role="alert" className="error-message">
          {categories.error}
          <button onClick={() => void categories.reload().catch(() => {})}>
            Tentar novamente
          </button>
        </p>
      )}
      {filters.from && filters.to && filters.from > filters.to && (
        <p role="alert" className="error-message">
          A data inicial deve ser anterior à final.
        </p>
      )}
      <section className="panel">
        <div className="filters">
          <label>
            Pesquisar descrição
            <input
              type="search"
              placeholder="Buscar transação…"
              value={filters.search}
              onChange={(e) => filter('search', e.target.value)}
            />
          </label>
          <label>
            Tipo
            <select
              value={filters.type}
              onChange={(e) => filter('type', e.target.value)}
            >
              <option value="">Todos os tipos</option>
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
          </label>
          <label>
            Categoria
            <select
              value={filters.category}
              onChange={(e) => filter('category', e.target.value)}
            >
              <option value="">Todas as categorias</option>
              {categoryOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Mês
            <input
              type="month"
              min="1900-01"
              max="9999-12"
              value={filters.month}
              onChange={(e) => filter('month', e.target.value)}
            />
          </label>
          <label>
            Ordenação
            <select
              value={filters.order}
              onChange={(e) => filter('order', e.target.value)}
            >
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
              <option value="amount-desc">Maior valor</option>
              <option value="amount-asc">Menor valor</option>
            </select>
          </label>
        </div>
        <div className="report-filters">
          <label>
            De
            <input
              aria-label="Data inicial"
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              value={filters.from ?? ''}
              onChange={(e) => filter('from', e.target.value)}
            />
          </label>
          <label>
            Até
            <input
              aria-label="Data final"
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              value={filters.to ?? ''}
              onChange={(e) => filter('to', e.target.value)}
            />
          </label>
        </div>
        <div className="results-heading">
          <p>
            {items.length} de {transactions.length} transações
          </p>
          <button
            className="secondary-button"
            onClick={() => {
              setFilters(emptyFilters);
              setPage(1);
            }}
          >
            Limpar filtros
          </button>
        </div>
        {items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th className="amount">Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.description}
                      {t.notes && <p className="form-help">{t.notes}</p>}
                    </td>
                    <td>
                      <span className="category-tag">{t.category}</span>
                    </td>
                    <td>{dateLabel(t.date)}</td>
                    <td className={t.type}>
                      {t.type === 'income' ? 'Receita' : 'Despesa'}
                    </td>
                    <td className={`amount ${t.type}`}>
                      {t.type === 'income' ? '+' : '−'} {currency(t.amount)}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          disabled={saving}
                          aria-label={`Editar ${t.description}`}
                          onClick={() => setEditing(t)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          disabled={saving}
                          aria-label={`Excluir ${t.description}`}
                          onClick={() => setDeleting(t)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h2>
              {transactions.length
                ? 'Nenhuma transação encontrada'
                : 'Seu próximo passo começa aqui'}
            </h2>
            <p>
              {transactions.length
                ? 'Experimente ajustar os filtros ou a pesquisa.'
                : 'Adicione sua primeira receita ou despesa para acompanhar suas finanças.'}
            </p>
          </div>
        )}
      </section>
      {items.length > 15 && (
        <nav className="pagination" aria-label="Paginação">
          <button
            className="secondary-button"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </button>
          <span>
            Página {currentPage} de {lastPage}
          </span>
          <button
            className="secondary-button"
            disabled={currentPage === lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
      {editing !== undefined && (
        <TransactionForm
          transaction={editing ?? undefined}
          categoryOptions={categories.items}
          onClose={() => setEditing(undefined)}
          onSave={async (input, id) => {
            await save(input, id);
            setMessage(id ? 'Transação atualizada.' : 'Transação adicionada.');
            setError('');
          }}
        />
      )}
      {deleting && (
        <DeleteTransactionDialog
          transaction={deleting}
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            await remove(deleting.id);
            setDeleting(null);
            setMessage('Transação excluída.');
            setError('');
          }}
        />
      )}
    </>
  );
}
