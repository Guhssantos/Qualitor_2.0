import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Ticket, User, FolderTree } from 'lucide-react';
import { api } from '../api/client';
import { StatusBadge, Spinner } from './ui';

export default function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { if (!open) { setQ(''); setRes(null); } }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return undefined; }
    setLoading(true);
    const id = setTimeout(() => api.get('/search', { q }).then(setRes).catch(() => {}).finally(() => setLoading(false)), 250);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;
  const go = (path) => { onClose(); navigate(path); };
  const empty = res && !res.tickets.length && !res.users.length && !res.categories.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 pt-[10vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
          <Search size={18} className="text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número do chamado, título, usuário..." className="w-full bg-transparent py-4 text-sm outline-none" />
          {loading && <Spinner />}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!res && <p className="p-4 text-center text-sm muted">Digite ao menos 2 caracteres. Resultados respeitam suas permissões.</p>}
          {empty && <p className="p-4 text-center text-sm muted">Nenhum resultado para “{q}”.</p>}
          {res?.tickets.length > 0 && <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase muted">Chamados</p>}
          {res?.tickets.map((t) => (
            <button key={t.id} onClick={() => go(`/tickets/view/${t.id}`)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-ink-800">
              <Ticket size={16} className="text-brand-500" />
              <span className="font-mono text-xs muted">{t.code}</span>
              <span className="flex-1 truncate text-sm">{t.title}</span>
              <StatusBadge status={t.status} />
            </button>
          ))}
          {res?.users.length > 0 && <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase muted">Usuários</p>}
          {res?.users.map((u) => (
            <button key={u.id} onClick={() => go(`/admin/users?search=${encodeURIComponent(u.email)}`)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-ink-800">
              <User size={16} className="text-emerald-500" /><span className="text-sm">{u.name}</span><span className="text-xs muted">{u.email}</span>
            </button>
          ))}
          {res?.categories.length > 0 && <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase muted">Categorias</p>}
          {res?.categories.map((c) => (
            <button key={c.id} onClick={() => go('/admin/categories')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-ink-800">
              <FolderTree size={16} className="text-violet-500" /><span className="text-sm">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
