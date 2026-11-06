import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { Report } from '../services/reportsApi';
import { currency } from '../utils/format';
export function ReportCharts({ monthly }: { monthly: Report['monthly'] }) {
  const tooltip = {
    background: '#151E30',
    border: '1px solid #334155',
    color: '#f8fafc',
  };
  return (
    <div className="charts">
      <section className="panel">
        <h2>Evolução do saldo</h2>
        <p className="form-help">
          Saldo acumulado no encerramento de cada mês com movimentações.
        </p>
        <div
          className="flow-chart"
          role="img"
          aria-label="Evolução mensal do saldo acumulado"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly}>
              <CartesianGrid stroke="#253046" vertical={false} />
              <XAxis dataKey="month" stroke="#94A3B8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} width={65} />
              <Tooltip
                contentStyle={tooltip}
                formatter={(v) => currency(Number(v))}
              />
              <Line
                name="Saldo"
                dataKey="balance"
                stroke="#10B981"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {!monthly.length && (
          <p className="form-help">Nenhuma movimentação no período.</p>
        )}
      </section>
      <section className="panel">
        <h2>Evolução mensal de gastos</h2>
        <div
          className="flow-chart"
          role="img"
          aria-label="Receitas e despesas por mês"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid stroke="#253046" vertical={false} />
              <XAxis dataKey="month" stroke="#94A3B8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} width={65} />
              <Tooltip
                contentStyle={tooltip}
                formatter={(v) => currency(Number(v))}
              />
              <Legend />
              <Bar name="Receitas" dataKey="income" fill="#10B981" />
              <Bar name="Despesas" dataKey="expense" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!monthly.length && (
          <p className="form-help">Nenhuma movimentação no período.</p>
        )}
      </section>
    </div>
  );
}
