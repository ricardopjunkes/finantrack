import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/transactionsApi';
import { monthRange, type Report } from '../services/reportsApi';
import { ReportCharts } from './ReportCharts';
import type { Budget } from '../pages/Budgets';
import { currency } from '../utils/format';
export function DashboardDetails({ month }: { month: string }) {
  const [data, setData] = useState<{
    month: string;
    report: Report;
    budgets: Budget[];
    goals: {
      id: string;
      name: string;
      targetAmount: string;
      currentAmount: string;
      status: string;
    }[];
  } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const [y, m] = month.split('-').map(Number);
    const rawFrom = new Date(Date.UTC(y, m - 6, 1)).toISOString().slice(0, 10);
    const from = rawFrom < '1900-01-01' ? '1900-01-01' : rawFrom;
    const to = monthRange(month).to;
    Promise.all([
      apiRequest<Report>(`/dashboard?${new URLSearchParams({ from, to })}`),
      apiRequest<Budget[]>(`/budgets?year=${y}&month=${m}`),
      apiRequest<
        {
          id: string;
          name: string;
          targetAmount: string;
          currentAmount: string;
          status: string;
        }[]
      >('/goals'),
    ])
      .then(([report, budgets, goals]) => {
        if (active) {
          setData({ month, report, budgets, goals });
          setError('');
        }
      })
      .catch((c) => {
        if (active) setError(c.message);
      });
    return () => {
      active = false;
    };
  }, [month]);
  if (error)
    return (
      <p className="error-message" role="alert">
        Não foi possível carregar os detalhes: {error}
      </p>
    );
  if (!data || data.month !== month)
    return <p role="status">Carregando evolução e planos…</p>;
  const [y, m] = month.split('-').map(Number);
  const previous = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const expense =
    data.report.monthly.find((r) => r.month === month)?.expense ?? 0;
  const old =
    data.report.monthly.find((r) => r.month === previous)?.expense ?? 0;
  return (
    <>
      <section className="panel comparison">
        <h2>Comparação com o mês anterior</h2>
        <p>
          Despesas: {currency(expense)} · mês anterior: {currency(old)} ·
          variação:{' '}
          {old
            ? `${Math.round(((expense - old) / old) * 100)}%`
            : 'sem base para comparação percentual'}
        </p>
      </section>
      <ReportCharts monthly={data.report.monthly} />
      <div className="charts">
        <section className="panel">
          <div className="panel-heading">
            <h2>Suas metas</h2>
            <Link className="text-link" to="/goals">
              Gerenciar
            </Link>
          </div>
          {data.goals.slice(0, 3).map((g) => (
            <div key={g.id}>
              <p>
                {g.name} ·{' '}
                {g.status === 'completed'
                  ? 'Concluída'
                  : `${currency(Number(g.currentAmount))} de ${currency(Number(g.targetAmount))}`}
              </p>
              <progress
                aria-label={`Meta ${g.name}`}
                max={100}
                value={Math.min(
                  100,
                  (Number(g.currentAmount) / Number(g.targetAmount)) * 100,
                )}
              />
            </div>
          ))}
          {!data.goals.length && (
            <p className="form-help">
              Crie uma meta para acompanhar seus planos.
            </p>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Alertas de orçamento</h2>
            <Link className="text-link" to="/budgets">
              Gerenciar
            </Link>
          </div>
          {data.budgets
            .filter((b) => b.alert !== 'ok')
            .map((b) => (
              <p key={b.id} className={b.alert === 'exceeded' ? 'expense' : ''}>
                {b.category.name}: {b.percent}% do limite ({currency(b.spent)})
              </p>
            ))}
          {!data.budgets.some((b) => b.alert !== 'ok') && (
            <p className="form-help">
              Nenhum limite próximo ou ultrapassado neste mês.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
