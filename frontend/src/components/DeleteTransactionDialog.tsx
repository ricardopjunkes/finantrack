import { useEffect, useRef, useState } from 'react';
import type { Transaction } from '../types/finance';
import { currency } from '../utils/format';
export function DeleteTransactionDialog({
  transaction,
  onClose,
  onDelete,
}: {
  transaction: Transaction;
  onClose: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    cancel.current?.focus();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="transaction-dialog"
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      onCancel={(event) => {
        if (submitting.current) event.preventDefault();
        else onClose();
      }}
    >
      <h2 id="delete-title">Excluir transação?</h2>
      <p id="delete-description" className="form-help">
        “{transaction.description}”, de {currency(transaction.amount)}, será
        excluída. Esta ação não pode ser desfeita.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          ref={cancel}
          className="secondary-button"
          onClick={onClose}
          disabled={deleting}
        >
          Cancelar
        </button>
        <button
          className="secondary-button danger"
          disabled={deleting}
          onClick={async () => {
            if (submitting.current) return;
            try {
              submitting.current = true;
              setDeleting(true);
              await onDelete();
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'Não foi possível excluir.',
              );
            } finally {
              submitting.current = false;
              setDeleting(false);
            }
          }}
        >
          {deleting ? 'Excluindo…' : 'Excluir transação'}
        </button>
      </div>
    </dialog>
  );
}
