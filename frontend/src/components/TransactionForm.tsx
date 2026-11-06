import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Transaction, Category } from '../types/finance';
import {
  localDate,
  validTransaction,
  type TransactionInput,
} from '../utils/transactions';
type Props = {
  transaction?: Transaction;
  onClose: () => void;
  onSave: (input: TransactionInput, id?: string) => void | Promise<void>;
  categoryOptions: Category[];
};
export function TransactionForm({
  transaction,
  onClose,
  onSave,
  categoryOptions,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState(transaction?.type ?? 'expense');
  const [categoryId, setCategoryId] = useState(
    transaction?.categoryId ??
      categoryOptions.find(
        (c) => c.name === transaction?.category && c.type === transaction?.type,
      )?.id ??
      '',
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    const input: TransactionInput = {
      description: String(data.get('description')).trim(),
      amount: Number(String(data.get('amount')).replace(',', '.')),
      type: data.get('type') === 'income' ? 'income' : 'expense',
      category: categoryOptions.find((c) => c.id === categoryId)?.name ?? '',
      categoryId,
      notes: String(data.get('notes') ?? '').trim() || null,
      date: String(data.get('date')),
    };
    if (!validTransaction(input)) {
      setError(
        'Preencha todos os campos. Use um valor positivo com até duas casas decimais e uma data válida.',
      );
      return;
    }
    try {
      submitting.current = true;
      setSaving(true);
      await onSave(input, transaction?.id);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível salvar.',
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="transaction-dialog"
      aria-labelledby="form-title"
      onCancel={(event) => {
        if (submitting.current) event.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={submit}>
        <fieldset disabled={saving} aria-busy={saving}>
          <div className="panel-heading">
            <h2 id="form-title">
              {transaction ? 'Editar transação' : 'Nova transação'}
            </h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Fechar formulário"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
          <p className="form-help">Todos os campos são obrigatórios.</p>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <label>
            Descrição
            <input
              name="description"
              autoFocus
              required
              maxLength={120}
              defaultValue={transaction?.description}
              placeholder="Ex.: compras no supermercado"
            />
          </label>
          <div className="form-row">
            <label>
              Valor (R$)
              <input
                name="amount"
                type="number"
                inputMode="decimal"
                required
                min="0.01"
                max="999999999.99"
                step="0.01"
                defaultValue={transaction?.amount}
                placeholder="0,00"
              />
            </label>
            <label>
              Tipo
              <select
                name="type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as 'income' | 'expense');
                  setCategoryId('');
                }}
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </label>
          </div>
          <label>
            Categoria
            <select
              name="categoryId"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="" disabled>
                Selecione uma categoria
              </option>
              {categoryOptions
                .filter((c) => c.type === type)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Data
            <input
              name="date"
              type="date"
              required
              min="1900-01-01"
              max="9999-12-31"
              defaultValue={transaction?.date ?? localDate()}
            />
          </label>
          <label>
            Observação (opcional)
            <textarea
              name="notes"
              maxLength={1000}
              defaultValue={transaction?.notes ?? ''}
              rows={3}
            />
          </label>
          <div className="form-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="primary-button" type="submit">
              {saving ? 'Salvando…' : 'Salvar transação'}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
