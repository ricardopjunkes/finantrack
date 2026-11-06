// Leitura somente para aviso e backup da Fase 2. Não é fonte de dados da interface.
export const STORAGE_KEY = 'finantrack.transactions.v1';
export function hasLegacyTransactions() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
export function readLegacyBackup() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null)
    throw new Error('Nenhum dado da Fase 2 foi encontrado neste endereço.');
  return raw;
}
