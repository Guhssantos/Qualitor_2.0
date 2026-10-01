import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, X, Info } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((type, message) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => remove(id), type === 'error' ? 7000 : 4000);
  }, [remove]);
  const toast = {
    success: (m) => push('success', m),
    error: (m) => push('error', m instanceof Error ? m.message : m),
    info: (m) => push('info', m),
  };
  const icons = { success: CheckCircle2, error: AlertTriangle, info: Info };
  const colors = {
    success: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
    error: 'border-red-500/40 text-red-600 dark:text-red-400',
    info: 'border-brand-500/40 text-brand-600 dark:text-brand-400',
  };
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div key={t.id} role="status" className={`card pointer-events-auto flex items-start gap-3 border-l-4 p-3 ${colors[t.type]}`}>
              <Icon size={18} className="mt-0.5 shrink-0" />
              <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">{t.message}</p>
              <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-slate-600" aria-label="Fechar"><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
