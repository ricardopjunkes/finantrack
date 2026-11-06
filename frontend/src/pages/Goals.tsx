import { useEffect, useState } from 'react';
import { apiRequest } from '../services/transactionsApi';
import { EditorDialog } from '../components/EditorDialog';
import { currency } from '../utils/format';
type Goal = {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string | null;
  status: 'active' | 'completed';
};
export function Goals() {
  const [items, setItems] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<Goal | null | undefined>();
  const [action, setAction] = useState<{
    goal: Goal;
    type: 'contribute' | 'delete' | 'complete';
  } | null>(null);
  function load() {
    return apiRequest<Goal[]>('/goals')
      .then((data) => {
        setItems(data);
        setError('');
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    let active = true;
    apiRequest<Goal[]>('/goals')
      .then((data) => {
        if (active) setItems(data);
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
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PLANOS QUE GANHAM FORMA</div>
          <h1>
            Metas financeiras<span>.</span>
          </h1>
          <p>
            As contribuições acompanham sua reserva e não criam movimentações na
            conta.
          </p>
        </div>
        <button className="primary-button" onClick={() => setEditing(null)}>
          Nova meta
        </button>
      </div>
      <p role="status" className="success-message">
        {message}
      </p>
      {loading && <p role="status">Carregando metas…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
          <button onClick={() => void load().catch((c) => setError(c.message))}>
            Tentar novamente
          </button>
        </p>
      )}
      <div className="resource-grid">
        {items.map((goal) => {
          const progress = Math.round(
            (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100,
          );
          return (
            <article className="panel" key={goal.id}>
              <h2>{goal.name}</h2>
              <p>
                {currency(Number(goal.currentAmount))} de{' '}
                {currency(Number(goal.targetAmount))}
              </p>
              <progress
                max={100}
                value={Math.min(100, progress)}
                aria-label={`Progresso de ${goal.name}`}
              />
              <p>
                {progress}% ·{' '}
                {goal.status === 'completed' ? 'Concluída' : 'Em andamento'}
                {goal.deadline
                  ? ` · Prazo: ${new Date(goal.deadline).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
                  : ''}
              </p>
              <div className="resource-actions">
                {goal.status === 'active' && (
                  <>
                    <button
                      className="primary-button"
                      onClick={() => setAction({ goal, type: 'contribute' })}
                    >
                      Contribuir
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => setAction({ goal, type: 'complete' })}
                    >
                      Concluir
                    </button>
                  </>
                )}
                <button
                  className="secondary-button"
                  onClick={() => setEditing(goal)}
                >
                  Editar
                </button>
                <button
                  className="secondary-button danger"
                  onClick={() => setAction({ goal, type: 'delete' })}
                >
                  Excluir
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!loading && !error && !items.length && (
        <div className="panel empty-state">
          <h2>Qual será sua próxima conquista?</h2>
          <p>Crie uma meta e acompanhe suas contribuições.</p>
        </div>
      )}
      {editing !== undefined && (
        <EditorDialog
          title={editing ? 'Editar meta' : 'Nova meta'}
          onClose={() => setEditing(undefined)}
          onSave={async (data) => {
            await apiRequest(
              editing ? `/goals/${editing.id}` : '/goals',
              editing ? 'PATCH' : 'POST',
              {
                name: String(data.get('name')).trim(),
                targetAmount: Number(data.get('targetAmount')),
                deadline: data.get('deadline') || null,
              },
            );
            await load().catch((c) =>
              setError(
                'Operação salva. Falha ao atualizar a lista: ' + c.message,
              ),
            );
            setMessage('Meta salva.');
          }}
        >
          <label>
            Nome
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={editing?.name}
            />
          </label>
          <label>
            Valor desejado (R$)
            <input
              name="targetAmount"
              type="number"
              required
              min="0.01"
              max="999999999.99"
              step="0.01"
              defaultValue={editing?.targetAmount}
            />
          </label>
          <label>
            Prazo (opcional)
            <input
              name="deadline"
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              defaultValue={editing?.deadline?.slice(0, 10)}
            />
          </label>
        </EditorDialog>
      )}
      {action && (
        <EditorDialog
          title={
            action.type === 'contribute'
              ? 'Registrar contribuição'
              : action.type === 'complete'
                ? 'Concluir meta?'
                : 'Excluir meta?'
          }
          confirmLabel={action.type === 'delete' ? 'Excluir' : 'Confirmar'}
          onClose={() => setAction(null)}
          onSave={async (data) => {
            await apiRequest(
              `/goals/${action.goal.id}${action.type === 'contribute' ? '/contributions' : ''}`,
              action.type === 'delete'
                ? 'DELETE'
                : action.type === 'complete'
                  ? 'PATCH'
                  : 'POST',
              action.type === 'delete'
                ? undefined
                : action.type === 'complete'
                  ? { status: 'completed' }
                  : { amount: Number(data.get('amount')) },
            );
            await load();
            setMessage('Meta atualizada.');
          }}
        >
          <p className="form-help">
            {action.goal.name}
            {action.type === 'delete'
              ? ' — a meta e o histórico de contribuições serão excluídos.'
              : ''}
          </p>
          {action.type === 'contribute' && (
            <label>
              Contribuição (R$)
              <input
                name="amount"
                type="number"
                required
                min="0.01"
                step="0.01"
                max="999999999.99"
              />
            </label>
          )}
        </EditorDialog>
      )}
    </>
  );
}
