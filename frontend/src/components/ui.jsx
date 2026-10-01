import { useEffect } from 'react';
import clsx from 'clsx';
import { Loader2, X, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PRIORITY_STYLE, SLA_STYLE, STATUS_STYLE } from '../lib/labels';
import { fmtDuration, initials } from '../lib/format';

export function Spinner({ className = '', size = 18 }) {
  return <Loader2 size={size} className={clsx('animate-spin text-brand-500', className)} />;
}

export function PageLoader() {
  return <div className="flex h-64 items-center justify-center"><Spinner size={28} /></div>;
}

export function StatusBadge({ status }) {
  const { statusLabel } = useAuth();
  return <span className={clsx('badge', STATUS_STYLE[status])}>{statusLabel(status)}</span>;
}

export function PriorityBadge({ priority }) {
  const { priorityLabel } = useAuth();
  return <span className={clsx('badge', PRIORITY_STYLE[priority])}>{priority === 'CRITICAL' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}{priorityLabel(priority)}</span>;
}

export function SlaBadge({ sla, showTime = false }) {
  if (!sla) return null;
  const s = SLA_STYLE[sla.status] || SLA_STYLE.NONE;
  return (
    <span className={clsx('badge', s.cls)} title={sla.dueAt ? `Vencimento: ${new Date(sla.dueAt).toLocaleString('pt-BR')}` : undefined}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', s.bar)} />
      {s.label}{showTime && ['OK', 'WARNING', 'BREACHED'].includes(sla.status) ? ` · ${fmtDuration(sla.remainingMs)}` : ''}
    </span>
  );
}

export function SlaBar({ sla }) {
  if (!sla || sla.percent == null) return null;
  const s = SLA_STYLE[sla.status] || SLA_STYLE.NONE;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div className={clsx('h-full rounded-full transition-all', s.bar)} style={{ width: `${Math.min(100, sla.percent)}%` }} />
    </div>
  );
}

export function Avatar({ name, size = 'md' }) {
  const sizes = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm' };
  return (
    <span className={clsx('inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 font-semibold text-white', sizes[size])}>
      {initials(name)}
    </span>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" className={clsx('card flex max-h-[92vh] w-full flex-col rounded-b-none sm:rounded-xl', widths[size])}>
        <div className="card-header">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nada por aqui', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-ink-800"><Icon size={26} /></div>
      <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pagination({ page, totalPages, total, onChange }) {
  if (!total) return null;
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
      <span className="muted">{total} registro(s)</span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost btn-icon" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Anterior"><ChevronLeft size={16} /></button>
        <span className="px-2 muted">{page} / {totalPages}</span>
        <button className="btn-ghost btn-icon" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Próxima"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function Field({ label, children, hint, className }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs muted">{hint}</span>}
    </label>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'brand', hint, onClick }) {
  const tones = {
    brand: 'bg-brand-500/10 text-brand-500', amber: 'bg-amber-500/10 text-amber-500', emerald: 'bg-emerald-500/10 text-emerald-500',
    red: 'bg-red-500/10 text-red-500', violet: 'bg-violet-500/10 text-violet-500', slate: 'bg-slate-500/10 text-slate-500', teal: 'bg-teal-500/10 text-teal-500',
  };
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={clsx('card flex items-center gap-3 p-4 text-left', onClick && 'transition hover:border-brand-500/50')}>
      {Icon && <div className={clsx('rounded-lg p-2.5', tones[tone])}><Icon size={20} /></div>}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium muted">{label}</p>
        <p className="text-2xl font-semibold text-slate-900 dark:text-white">{value ?? '—'}</p>
        {hint && <p className="truncate text-xs muted">{hint}</p>}
      </div>
    </Comp>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={clsx('relative h-5 w-9 rounded-full transition', checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700')}>
        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      {label}
    </label>
  );
}

export function ActiveBadge({ active }) {
  return active
    ? <span className="badge bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300">Ativo</span>
    : <span className="badge bg-slate-500/10 text-slate-500 ring-slate-500/30">Inativo</span>;
}

export function Forbidden() {
  return <EmptyState title="Acesso negado" description="Você não tem permissão para acessar esta área. Fale com o administrador." />;
}
