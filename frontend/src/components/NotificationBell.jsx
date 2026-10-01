import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../api/client';
import { fmtRelative } from '../lib/format';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(() => api.get('/notifications', { pageSize: 15 }).then(setData).catch(() => {}), []);
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const openItem = async (n) => {
    if (!n.readAt) await api.post(`/notifications/${n.id}/read`).catch(() => {});
    setOpen(false);
    load();
    if (n.ticketId) navigate(`/tickets/view/${n.ticketId}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost btn-icon relative" onClick={() => { setOpen((o) => !o); load(); }} aria-label="Notificações">
        <Bell size={18} />
        {data.unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{data.unread > 99 ? '99+' : data.unread}</span>}
      </button>
      {open && (
        <div className="card fixed inset-x-2 top-16 z-50 overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
          <div className="card-header">
            <span className="card-title">Notificações</span>
            {data.unread > 0 && (
              <button className="btn-ghost btn-sm" onClick={async () => { await api.post('/notifications/read-all'); load(); }}><CheckCheck size={14} /> Marcar todas</button>
            )}
          </div>
          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {data.items.length === 0 && <li className="p-6 text-center text-sm muted">Nenhuma notificação</li>}
            {data.items.map((n) => (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className={clsx('flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-ink-850', !n.readAt && 'bg-brand-500/5')}>
                  <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand-500')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{n.title}</span>
                    <span className="block truncate text-xs muted">{n.message}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{fmtRelative(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
