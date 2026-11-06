import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest, setCsrfToken } from '../services/transactionsApi';
export type Account = { id: string; name: string; email: string };
type Session = { user: Account; csrfToken: string };
type Auth = {
  user: Account | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  signIn: (
    register: boolean,
    data: { name?: string; email: string; password: string },
  ) => Promise<void>;
  logout: () => Promise<void>;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  function apply(session: Session) {
    setCsrfToken(session.csrfToken);
    setUser(session.user);
    setError('');
  }
  async function refresh() {
    try {
      apply(await apiRequest<Session>('/auth/me'));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível carregar sua conta.',
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    function expired() {
      setCsrfToken('');
      setUser(null);
    }
    window.addEventListener('finantrack:unauthorized', expired);
    apiRequest<Session>('/auth/me')
      .then((session) => {
        if (active) apply(session);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Não foi possível carregar a conta.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener('finantrack:unauthorized', expired);
    };
  }, []);
  async function signIn(
    register: boolean,
    data: { name?: string; email: string; password: string },
  ) {
    apply(
      await apiRequest<Session>(
        register ? '/auth/register' : '/auth/login',
        'POST',
        data,
      ),
    );
  }
  async function logout() {
    await apiRequest('/auth/logout', 'POST');
    setCsrfToken('');
    setUser(null);
  }
  return (
    <Context.Provider value={{ user, loading, error, refresh, signIn, logout }}>
      {children}
    </Context.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider ausente.');
  return value;
}
