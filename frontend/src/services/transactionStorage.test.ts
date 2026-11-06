import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasLegacyTransactions,
  readLegacyBackup,
  STORAGE_KEY,
} from './transactionStorage';
describe('preservação da Fase 2', () => {
  let storage: Map<string, string>;
  let write: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    storage = new Map();
    write = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: write,
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('não cria dados de demonstração nem grava localStorage', () => {
    expect(hasLegacyTransactions()).toBe(false);
    expect(() => readLegacyBackup()).toThrow('Nenhum dado');
    expect(write).not.toHaveBeenCalled();
  });
  it('detecta inclusive lista vazia e exporta a cópia original sem alterar nada', () => {
    for (const raw of ['[]', '[{"id":"antigo"}]', '{corrompido']) {
      storage.set(STORAGE_KEY, raw);
      expect(hasLegacyTransactions()).toBe(true);
      expect(readLegacyBackup()).toBe(raw);
      expect(storage.get(STORAGE_KEY)).toBe(raw);
    }
    expect(write).not.toHaveBeenCalled();
  });
  it('não impede o uso da API quando o armazenamento do navegador está bloqueado', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
    });
    expect(hasLegacyTransactions()).toBe(false);
  });
});
