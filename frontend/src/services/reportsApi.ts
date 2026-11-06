export type Report = {
  previous: { from: string; to: string; income: number; expense: number };
  from: string;
  to: string;
  income: number;
  expense: number;
  balance: number;
  closingBalance: number;
  savingsRate: number | null;
  count: number;
  monthly: {
    month: string;
    income: number;
    expense: number;
    balance: number;
  }[];
  spending: { name: string; color: string; value: number }[];
};
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  return {
    from: `${month}-01`,
    to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
  };
}
export async function exportCsv(from: string, to: string) {
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  const response = await fetch(
    `${base}/reports/export?${new URLSearchParams({ from, to })}`,
    { credentials: 'include', signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event('finantrack:unauthorized'));
    throw new Error(
      'Não foi possível exportar o relatório. Confira sua sessão e a conexão.',
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `finantrack-${from}-${to}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
