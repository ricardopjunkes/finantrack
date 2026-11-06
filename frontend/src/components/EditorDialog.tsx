import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from 'react';
export function EditorDialog({
  title,
  children,
  onSave,
  onClose,
  confirmLabel = 'Salvar',
}: {
  title: string;
  children: ReactNode;
  onSave: (data: FormData) => Promise<void>;
  onClose: () => void;
  confirmLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onSave(data);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível salvar.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="transaction-dialog"
      aria-labelledby="editor-title"
      onCancel={(event) => {
        if (pending.current) event.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={submit}>
        <h2 id="editor-title">{title}</h2>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <fieldset disabled={busy}>
          {children}
          <div className="form-actions">
            <button
              type="button"
              autoFocus
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="primary-button">
              {busy ? 'Aguarde…' : confirmLabel}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
