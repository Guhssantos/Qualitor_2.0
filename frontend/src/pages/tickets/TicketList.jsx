import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Filter, RefreshCw, PlusCircle, X, HandMetal, ArrowUpDown } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState, PageLoader, Pagination, PriorityBadge, SlaBadge, SlaBar, StatusBadge } from '../../components/ui';
import { VIEW_TITLES } from '../../lib/menu';
import { PRIORITIES, SLA_STYLE, STATUSES } from '../../lib/labels';
import { fmtDateTime, fmtRelative } from '../../lib/format';

const EMPTY = { number: '', q: '', status: '', categoryId: '', subcategoryId: '', priority: '', requester: '', department: '', assigneeId: '', teamId: '', dateFrom: '', dateTo: '', sla: '' };

export default function TicketList() {
  const { view = 'all' } = useParams();
  const { isStaff, can, statusLabel, priorityLabel } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { reloadCounters } = useOutletContext() || {};
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sort: 'createdAt', order: 'desc' });
  const [data, setData] = useState(null);
  const [options, setOptions] = useState({ categories: [], teams: [], agents: [] });

  const title = VIEW_TITLES[view] || VIEW_TITLES.all;
  const staffView = isStaff && !['requested', 'waiting_me'].includes(view);

  useEffect(() => {
    api.get('/categories', staffView && !can('tickets.view_all') ? { scope: 'authorized' } : { scope: 'active' }).then((categories) => setOptions((o) => ({ ...o, categories }))).catch(() => {});
    if (staffView) {
      api.get('/teams').then((teams) => setOptions((o) => ({ ...o, teams }))).catch(() => {});
      if (can('tickets.assign', 'tickets.transfer', 'tickets.assume')) api.get('/users/assignable').then((agents) => setOptions((o) => ({ ...o, agents }))).catch(() => {});
    }
  }, [staffView]); // eslint-disable-line

  const load = useCallback(() => {
    setData(null);
    api.get('/tickets', { view, page, pageSize: 20, ...sort, ...applied })
      .then(setData)
      .catch((e) => { toast.error(e); setData({ items: [], total: 0, page: 1, totalPages: 1 }); });
  }, [view, page, sort, applied]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); setApplied(EMPTY); setFilters(EMPTY); }, [view]);

  const activeCount = Object.values(applied).filter(Boolean).length;
  const subcategories = useMemo(() => options.categories.find((c) => c.id === filters.categoryId)?.subcategories || [], [options.categories, filters.categoryId]);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value, ...(k === 'categoryId' ? { subcategoryId: '' } : {}) }));
  const apply = (e) => { e?.preventDefault(); setPage(1); setApplied(filters); };
  const clear = () => { setFilters(EMPTY); setApplied(EMPTY); setPage(1); };
  const toggleSort = (field) => setSort((s) => ({ sort: field, order: s.sort === field && s.order === 'desc' ? 'asc' : 'desc' }));

  const assume = async (e, t) => {
    e.preventDefault(); e.stopPropagation();
    try {
      await api.post(`/tickets/${t.id}/assume`);
      toast.success(`${t.code} assumido.`);
      reloadCounters?.();
      navigate(`/tickets/view/${t.id}`);
    } catch (err) { toast.error(err); }
  };

  const Th = ({ field, children, className }) => (
    <th className={className}>
      {field ? <button className="inline-flex items-center gap-1 uppercase" onClick={() => toggleSort(field)}>{children}<ArrowUpDown size={12} className={clsx(sort.sort === field ? 'text-brand-500' : 'opacity-40')} /></button> : children}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{title.title}</h1>
          <p className="page-subtitle">{title.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setShowFilters((s) => !s)}>
            <Filter size={16} /> Filtros {activeCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] text-white">{activeCount}</span>}
          </button>
          <button className="btn-secondary btn-icon" onClick={load} aria-label="Atualizar"><RefreshCw size={16} /></button>
          {can('tickets.create') && <Link to="/tickets/new" className="btn-primary"><PlusCircle size={16} /> Novo chamado</Link>}
        </div>
      </div>

      {showFilters && (
        <form onSubmit={apply} className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <input className="input" placeholder="Nº (ex.: 15)" value={filters.number} onChange={set('number')} />
          <input className="input sm:col-span-1 xl:col-span-2" placeholder="Buscar no título/descrição" value={filters.q} onChange={set('q')} />
          <select className="input" value={filters.status} onChange={set('status')}>
            <option value="">Todos os status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select className="input" value={filters.priority} onChange={set('priority')}>
            <option value="">Todas as prioridades</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
          </select>
          <select className="input" value={filters.sla} onChange={set('sla')}>
            <option value="">SLA: todos</option>
            {['OK', 'WARNING', 'BREACHED', 'PAUSED', 'MET', 'MISSED'].map((s) => <option key={s} value={s}>{SLA_STYLE[s].label}</option>)}
          </select>
          <select className="input" value={filters.categoryId} onChange={set('categoryId')}>
            <option value="">Todas as categorias</option>
            {options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={filters.subcategoryId} onChange={set('subcategoryId')} disabled={!subcategories.length}>
            <option value="">Todas as subcategorias</option>
            {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {staffView && (
            <>
              <input className="input" placeholder="Solicitante" value={filters.requester} onChange={set('requester')} />
              <input className="input" placeholder="Departamento" value={filters.department} onChange={set('department')} />
              <select className="input" value={filters.assigneeId} onChange={set('assigneeId')}>
                <option value="">Todos os atendentes</option>
                <option value="none">Sem responsável</option>
                {options.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select className="input" value={filters.teamId} onChange={set('teamId')}>
                <option value="">Todas as equipes</option>
                {options.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </>
          )}
          <label className="flex items-center gap-2 text-xs muted">De <input type="date" className="input" value={filters.dateFrom} onChange={set('dateFrom')} /></label>
          <label className="flex items-center gap-2 text-xs muted">Até <input type="date" className="input" value={filters.dateTo} onChange={set('dateTo')} /></label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-6 xl:justify-end">
            <button type="button" className="btn-ghost" onClick={clear}><X size={16} /> Limpar</button>
            <button className="btn-primary">Aplicar filtros</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {!data ? <PageLoader /> : data.items.length === 0 ? (
          <EmptyState title="Nenhum chamado encontrado" description={activeCount ? 'Ajuste os filtros para ver mais resultados.' : 'Quando houver chamados nesta visão, eles aparecerão aqui.'} />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="table">
                <thead>
                  <tr>
                    <Th field="number">Nº</Th>
                    <Th>Título</Th>
                    <Th>Categoria</Th>
                    <Th field="priority">Prioridade</Th>
                    <Th>Status</Th>
                    {staffView && <Th>Solicitante</Th>}
                    <Th>Responsável</Th>
                    <Th field="resolutionDueAt">SLA</Th>
                    <Th field="createdAt">Abertura</Th>
                    {view === 'queue' && <Th />}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((t) => (
                    <tr key={t.id} className="cursor-pointer" onClick={() => navigate(`/tickets/view/${t.id}`)}>
                      <td className="font-mono text-xs muted">{t.code}</td>
                      <td className="max-w-xs"><p className="truncate font-medium text-slate-900 dark:text-slate-100">{t.title}</p>{t.team && <p className="truncate text-xs muted">{t.team.name}</p>}</td>
                      <td><p className="text-sm">{t.category?.name}</p>{t.subcategory && <p className="text-xs muted">{t.subcategory.name}</p>}</td>
                      <td><PriorityBadge priority={t.priority} /></td>
                      <td><StatusBadge status={t.status} /></td>
                      {staffView && <td><p className="text-sm">{t.requester?.name}</p><p className="text-xs muted">{t.department || '—'}</p></td>}
                      <td className="text-sm">{t.assignee?.name || <span className="muted">—</span>}</td>
                      <td className="min-w-[150px]"><SlaBadge sla={t.sla} /><div className="mt-1.5"><SlaBar sla={t.sla} /></div></td>
                      <td className="whitespace-nowrap text-xs muted" title={fmtDateTime(t.createdAt)}>{fmtRelative(t.createdAt)}</td>
                      {view === 'queue' && <td>{can('tickets.assume') && <button className="btn-primary btn-sm" onClick={(e) => assume(e, t)}><HandMetal size={14} /> Assumir</button>}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile / tablet */}
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 lg:hidden">
              {data.items.map((t) => (
                <li key={t.id}>
                  <Link to={`/tickets/view/${t.id}`} className="block space-y-2 p-4 hover:bg-slate-50 dark:hover:bg-ink-850">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs muted">{t.code}</span>
                      <span className="text-xs muted">{fmtRelative(t.createdAt)}</span>
                    </div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{t.title}</p>
                    <p className="text-xs muted">{t.category?.name}{t.subcategory ? ` / ${t.subcategory.name}` : ''}{staffView ? ` · ${t.requester?.name}` : ''}</p>
                    <div className="flex flex-wrap gap-1.5"><StatusBadge status={t.status} /><PriorityBadge priority={t.priority} /><SlaBadge sla={t.sla} /></div>
                    {view === 'queue' && can('tickets.assume') && <button className="btn-primary btn-sm" onClick={(e) => assume(e, t)}><HandMetal size={14} /> Assumir</button>}
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
