import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { EmptyState, PageLoader, Pagination } from '../../components/ui';
import { ACTION_LABELS } from '../../lib/labels';
import { fmtDateTime } from '../../lib/format';

export default function Audit() {
  const toast = useToast();
  const [filters, setFilters] = useState({ action: '', q: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => api.get('/audit', { ...filters, page, pageSize: 30 }).then(setData).catch((e) => toast.error(e)), [filters, page]); // eslint-disable-line
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);
  const set = (k) => (e) => { setPage(1); setFilters((f) => ({ ...f, [k]: e.target.value })); };

  return (
    <div className="space-y-4">
      <div><h1 className="page-title">Auditoria</h1><p className="page-subtitle">Registro de logins, alterações administrativas e ações em chamados.</p></div>
      <div className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <select className="input" value={filters.action} onChange={set('action')}>
          <option value="">Todas as ações</option>
          <option value="auth.">Autenticação</option><option value="user.">Usuários</option><option value="role.">Perfis</option>
          <option value="team.">Equipes</option><option value="category.">Categorias</option><option value="ticket.">Chamados</option>
          <option value="sla.">SLA</option><option value="settings.">Configurações</option>
          {data?.actions?.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
        </select>
        <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className="input pl-9" placeholder="Texto, IP..." value={filters.q} onChange={set('q')} /></div>
        <input type="date" className="input" value={filters.dateFrom} onChange={set('dateFrom')} />
        <input type="date" className="input" value={filters.dateTo} onChange={set('dateTo')} />
      </div>
      <div className="card overflow-hidden">
        {!data ? <PageLoader /> : data.items.length === 0 ? <EmptyState title="Nenhum registro" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th /><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>IP</th></tr></thead>
                <tbody>
                  {data.items.map((l) => (
                    <Fragment key={l.id}>
                      <tr className="cursor-pointer" onClick={() => setOpen(open === l.id ? null : l.id)}>
                        <td className="w-8">{l.details ? (open === l.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}</td>
                        <td className="whitespace-nowrap text-xs">{fmtDateTime(l.createdAt)}</td>
                        <td className="text-sm">{l.user?.name || <span className="muted">Sistema</span>}</td>
                        <td><span className="badge bg-slate-500/10 ring-slate-500/20">{ACTION_LABELS[l.action] || l.action}</span></td>
                        <td className="text-xs muted">{l.entity}{l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ''}</td>
                        <td className="font-mono text-xs muted">{l.ip || '—'}</td>
                      </tr>
                      {open === l.id && l.details && (
                        <tr className="hover:bg-transparent"><td colSpan={6} className="bg-slate-50 dark:bg-ink-850/50"><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(l.details, null, 2)}</pre>{l.userAgent && <p className="mt-2 text-[11px] muted">{l.userAgent}</p>}</td></tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
