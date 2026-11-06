import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../services/transactionsApi';
import { currentMonth } from '../utils/transactions';
import { currency } from '../utils/format';
import { monthRange, exportCsv, type Report } from '../services/reportsApi';
import { ReportCharts } from '../components/ReportCharts';
export function Reports() {
  const [range, setRange] = useState(() => monthRange(currentMonth()));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  useEffect(() => {
    let active = true;
    apiRequest<Report>(`/reports?${new URLSearchParams(range)}`)
      .then((data) => {
        if (active) {
          setReport(data);
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
  }, [range]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const from = String(data.get('from'));
    const to = String(data.get('to'));
    if (from > to) {
      setError('A data inicial deve ser anterior à final.');
      return;
    }
    setLoading(true);
    setRange({ from, to });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DA INFORMAÇÃO À DECISÃO</div>
          <h1>
            Relatórios<span>.</span>
          </h1>
          <p>Resumo financeiro e exportação dos dados da sua conta.</p>
        </div>
        <button
          className="primary-button"
          disabled={loading || exporting || Boolean(error)}
          onClick={async () => {
            setExporting(true);
            try {
              await exportCsv(range.from, range.to);
            } catch (c) {
              setError(c instanceof Error ? c.message : 'Erro na exportação.');
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>
      <section className="panel">
        <button
          className="secondary-button print-button"
          disabled={loading || Boolean(error)}
          onClick={() => window.print()}
        >
          Imprimir / salvar PDF
        </button>
        <label>
          Mês de referência
          <input
            type="month"
            min="1900-01"
            max="9999-12"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
                setLoading(true);
                setRange(monthRange(e.target.value));
              }
            }}
          />
        </label>
        <button
          className="secondary-button"
          onClick={() => {
            setLoading(true);
            setRange({
              from: month.slice(0, 4) + '-01-01',
              to: month.slice(0, 4) + '-12-31',
            });
          }}
        >
          Ver ano completo
        </button>
        <form
          key={`${range.from}:${range.to}`}
          onSubmit={submit}
          className="report-filters"
        >
          <label>
            Data inicial
            <input
              name="from"
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              defaultValue={range.from}
              required
            />
          </label>
          <label>
            Data final
            <input
              name="to"
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              defaultValue={range.to}
              required
            />
          </label>
          <button className="secondary-button">Aplicar intervalo</button>
        </form>
      </section>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="loading-state">
          Carregando relatório…
        </p>
      ) : (
        !error &&
        report && (
          <>
            <p className="form-help">
              Período: {report.from} a {report.to} · {report.count} transações
            </p>
            <div className="stats">
              {[
                ['Receitas', currency(report.income)],
                ['Despesas', currency(report.expense)],
                ['Resultado do período', currency(report.balance)],
                [
                  'Taxa de economia',
                  report.savingsRate === null
                    ? 'Sem receitas'
                    : `${report.savingsRate}%`,
                ],
              ].map(([title, value]) => (
                <article className="stat-card" key={title}>
                  <div className="stat-top">{title}</div>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
            <section className="panel comparison">
              <h2>Comparação com o intervalo anterior</h2>
              <p>
                Base: {report.previous.from} a {report.previous.to} (mesma
                quantidade de dias). Receitas anteriores:{' '}
                {currency(report.previous.income)} · despesas anteriores:{' '}
                {currency(report.previous.expense)}.
              </p>
            </section>
            <ReportCharts monthly={report.monthly} />
            <section className="panel">
              <h2>Maiores gastos por categoria</h2>
              {report.spending.length ? (
                <ul className="category-list">
                  {report.spending.map((c) => (
                    <li key={c.name}>
                      <span>
                        <i style={{ background: c.color }} />
                        {c.name}
                      </span>
                      <strong>{currency(c.value)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state">Nenhuma despesa no período.</p>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
