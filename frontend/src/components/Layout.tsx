import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  ChartNoAxesCombined,
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  Target,
  ChartPie,
  UserRound,
  ChevronRight,
  Sprout,
  Wallet,
} from 'lucide-react';
const navigation = [
  { name: 'Visão geral', path: '/', icon: LayoutDashboard },
  { name: 'Transações', path: '/transactions', icon: ArrowLeftRight },
  { name: 'Categorias', path: '/categories', icon: Tags },
  { name: 'Metas financeiras', path: '/goals', icon: Target },
  { name: 'Orçamentos', path: '/budgets', icon: Wallet },
  { name: 'Relatórios', path: '/reports', icon: ChartPie },
];
export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Pular para conteúdo
      </a>
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brand-icon">
            <ChartNoAxesCombined size={23} />
          </span>
          Finan<span>Track</span>
        </a>
        <p className="nav-label">SEU FINANCEIRO</p>
        <nav aria-label="Navegação principal">
          {navigation.map(({ name, path, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === '/'}>
              <Icon size={19} />
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-tip">
          <Sprout size={25} />
          <strong>
            Pequenos passos.
            <br />
            Grandes conquistas.
          </strong>
          <p>Organizar hoje é investir no seu amanhã.</p>
          <span>
            Seu futuro começa aqui <ChevronRight size={14} />
          </span>
        </div>
        <NavLink className="profile" to="/profile">
          <span className="avatar">{user?.name.slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{user?.name}</strong>
            <small>Minha conta</small>
          </span>
          <UserRound size={17} />
        </NavLink>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>Meu espaço financeiro</span>
          <span className="demo-badge">
            <span /> API local · PostgreSQL
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer>
          FinanTrack <span>Mais clareza. Melhores escolhas.</span>
          <small>Seus dados, organizados</small>
        </footer>
      </div>
    </div>
  );
}
