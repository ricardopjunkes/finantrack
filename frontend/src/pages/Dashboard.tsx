import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  TrendingUp,
  PiggyBank,
  CalendarDays,
  CircleHelp,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/StatCard';
import { DashboardDetails } from '../components/DashboardDetails';
import { useState } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { currentMonth, dashboardData } from '../utils/transactions';
import { currency, dateLabel } from '../utils/format';
export function Dashboard() {
  const { transactions } = useTransactions();
  const [month, setMonth] = useState(currentMonth);
  const { income, expense, balance, period, recent, monthlyFlow, spending } =
    dashboardData(transactions, month);
  const savingsRate =
    income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  const monthLabel = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month}-01T12:00:00`));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CADA ESCOLHA CONTA</div>
          <h1>
            Seu dinheiro, com mais clareza<span>.</span>
          </h1>
          <p>Acompanhe seu presente. Planeje seu próximo passo.</p>
        </div>
        <label className="period">
          <CalendarDays size={17} />
          <span className="sr-only">Mês do dashboard</span>
          <input
            type="month"
            min="1900-01"
            max="9999-12"
            value={month}
            onChange={(e) => {
              if (/^\d{4}-\d{2}$/.test(e.target.value))
                setMonth(e.target.value);
            }}
          />
        </label>
      </div>
      <div className="stats">
        <StatCard
          label="Saldo disponível"
          value={balance}
          icon={Wallet}
          tone="green"
          caption={`Acumulado até ${monthLabel}`}
        />
        <StatCard
          label="Receitas do mês"
          value={income}
          icon={ArrowDownLeft}
          tone="blue"
          caption={`${period.filter((t) => t.type === 'income').length} entradas em ${monthLabel}`}
        />
        <StatCard
          label="Despesas do mês"
          value={expense}
          icon={ArrowUpRight}
          tone="red"
          caption={`${period.filter((t) => t.type === 'expense').length} saídas em ${monthLabel}`}
        />
        <StatCard
          label="Economia do mês"
          value={income - expense}
          icon={PiggyBank}
          tone="purple"
          caption={
            income > 0
              ? `${savingsRate}% das receitas no mês`
              : 'Sem receitas neste mês'
          }
        />
      </div>
      <div className="charts">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Seu fluxo financeiro</h2>
              <p>Uma visão das suas entradas e saídas</p>
            </div>
            <span className="subtle-tag">
              6 meses até o período selecionado
            </span>
          </div>
          <div className="legend">
            <span>
              <i className="green-dot" />
              Receitas
            </span>
            <span>
              <i className="blue-dot" />
              Despesas
            </span>
          </div>
          <div
            className="flow-chart"
            role="img"
            aria-label={`Receitas e despesas dos seis meses até ${monthLabel}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthlyFlow}
                margin={{ top: 15, right: 12, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.23} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#263247"
                  vertical={false}
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  tickFormatter={(value) => `${value / 1000} mil`}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  width={48}
                />
                <Tooltip
                  formatter={(value) => currency(Number(value))}
                  contentStyle={{
                    background: '#151E30',
                    border: '1px solid #334155',
                    borderRadius: 10,
                  }}
                  labelStyle={{ color: '#F8FAFC' }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Receitas"
                  stroke="#10B981"
                  strokeWidth={3}
                  fill="url(#income)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Despesas"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Para onde vai seu dinheiro</h2>
              <p>Despesas por categoria · {monthLabel}</p>
            </div>
          </div>
          {expense === 0 && (
            <p className="empty-state">Sem despesas neste mês.</p>
          )}
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={spending}
                  dataKey="value"
                  innerRadius={68}
                  outerRadius={86}
                  paddingAngle={5}
                  stroke="none"
                >
                  {spending.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => currency(Number(value))}
                  contentStyle={{
                    background: '#151E30',
                    border: '1px solid #334155',
                    borderRadius: 10,
                  }}
                  itemStyle={{ color: '#F8FAFC' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-label">
              <small>Total de despesas</small>
              <strong>{currency(expense)}</strong>
            </div>
          </div>
          <ul className="category-list">
            {spending.map((item) => (
              <li key={item.name}>
                <span>
                  <i style={{ background: item.color }} />
                  {item.name}
                </span>
                <strong>{currency(item.value)}</strong>
                <small>{Math.round((item.value / expense) * 100)}%</small>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <DashboardDetails month={month} />
      <div className="bottom-grid">
        <section className="panel transactions">
          <div className="panel-heading">
            <div>
              <h2>Últimas transações</h2>
              <p>Movimentos de {monthLabel}</p>
            </div>
            <Link to="/transactions" className="text-link">
              Ver todas <ArrowRight size={15} />
            </Link>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Data</th>
                  <th className="amount">Valor</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={4}>Nenhuma transação neste mês.</td>
                  </tr>
                )}
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className={`transaction-icon ${t.type}`}>
                        {t.type === 'income' ? (
                          <ArrowDownLeft size={17} />
                        ) : (
                          <ArrowUpRight size={17} />
                        )}
                      </span>
                      {t.description}
                    </td>
                    <td>
                      <span className="category-tag">{t.category}</span>
                    </td>
                    <td>{dateLabel(t.date)}</td>
                    <td className={`amount ${t.type}`}>
                      {t.type === 'income' ? '+' : '−'} {currency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="month-summary">
          <span className="summary-icon">
            <TrendingUp size={23} />
          </span>
          <span className="eyebrow">SEU MÊS EM PERSPECTIVA</span>
          <h2>
            Mais espaço para
            <br />
            seus planos.
          </h2>
          <p>
            Resultado de {monthLabel}:{' '}
            <strong>
              {income > 0
                ? `${savingsRate}% da receita preservada`
                : 'sem receitas registradas'}
            </strong>
            . Cada escolha aproxima você dos seus objetivos.
          </p>
          <div className="savings-bar">
            <span
              style={{ width: `${Math.max(0, Math.min(100, savingsRate))}%` }}
            />
          </div>
          <div className="summary-foot">
            <span>Resultado do mês</span>
            <strong>{currency(income - expense)}</strong>
          </div>
          <div className="info-note">
            <CircleHelp size={15} />
            <span>
              Dados persistidos no PostgreSQL, vinculados à sua conta.
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
