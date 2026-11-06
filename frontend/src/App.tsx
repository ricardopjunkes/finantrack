import { Route, Routes, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthPage } from './pages/Auth';
import { Goals } from './pages/Goals';
import { Budgets } from './pages/Budgets';
import { Reports } from './pages/Reports';
import { Categories } from './pages/Categories';
import { Profile } from './pages/Profile';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { TransactionsProvider, useTransactions } from './hooks/useTransactions';
import { LegacyTransactionsNotice } from './components/LegacyTransactionsNotice';
function Upcoming({ title }: { title: string }) {
  return (
    <section className="panel upcoming">
      <span className="eyebrow">PÁGINA NÃO ENCONTRADA</span>
      <h1>{title}</h1>
      <p>O endereço solicitado não existe. Use a navegação para continuar.</p>
      <Link className="text-link" to="/">
        Voltar à visão geral →
      </Link>
    </section>
  );
}
function Pages() {
  const { error, loading, saving, reload } = useTransactions();
  return (
    <Layout>
      <LegacyTransactionsNotice />
      {error && (
        <p className="error-message" role="alert">
          {error}
          <button
            className="secondary-button"
            disabled={loading || saving}
            onClick={() => void reload()}
          >
            Tentar novamente
          </button>
        </p>
      )}
      {loading ? (
        <div className="loading-state" role="status">
          Carregando transações da API…
        </div>
      ) : (
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Profile />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route
            path="*"
            element={<Upcoming title="Página não encontrada" />}
          />
        </Routes>
      )}
    </Layout>
  );
}
function AuthenticatedApp() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div role="status" className="loading-state">
        Verificando sessão…
      </div>
    );
  if (!user)
    return (
      <Routes>
        <Route
          path="/register"
          element={<AuthPage key="register" register />}
        />
        <Route path="*" element={<AuthPage key="login" />} />
      </Routes>
    );
  return (
    <TransactionsProvider key={user.id}>
      <Pages />
    </TransactionsProvider>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
