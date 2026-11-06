import { useState } from 'react';
import {
  hasLegacyTransactions,
  readLegacyBackup,
} from '../services/transactionStorage';
export function LegacyTransactionsNotice() {
  const [exists] = useState(hasLegacyTransactions);
  const [error, setError] = useState('');
  if (!exists) return null;
  function download() {
    try {
      const url = URL.createObjectURL(
        new Blob([readLegacyBackup()], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'finantrack-fase2-backup.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setError('');
    } catch {
      setError(
        'Não foi possível exportar. Verifique as permissões do armazenamento do navegador.',
      );
    }
  }
  return (
    <aside className="legacy-notice">
      <p>
        Seus dados da Fase 2 continuam neste navegador e não foram enviados à
        API. A lista atual usa somente o backend com PostgreSQL. Exporte uma
        cópia para preservar os registros antigos.
      </p>
      <button className="secondary-button" onClick={download}>
        Exportar dados da Fase 2
      </button>
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
