import { useCallback, useState, type ReactNode } from 'react';
import { ToastContext, type Toast } from '@/lib/toast-context';
import { Toaster } from '@/components/ui/toaster';

const AUTO_DISMISS_MS = 4500;
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: Omit<Toast, 'id'>) => {
      counter += 1;
      const id = `toast-${counter}`;
      setToasts((prev) => [...prev, { ...input, id }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
