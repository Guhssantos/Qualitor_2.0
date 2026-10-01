import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageLoader } from '../components/ui';
import { ChartsGrid, KpiCards } from '../components/Indicators';
import { HBarChart } from '../components/Charts';

function GroupTable({ title, rows }) {
  return (
    <div className="card overflow-hidden">
      <div className="card-header"><span className="card-title">{title}</span></div>
      <div className="max-h-80 overflow-auto">
        <table className="table">
          <thead><tr><th>Item</th><th className="text-right">Total</th><th className="text-right">Em aberto</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.key}><td>{r.label}</td><td className="text-right font-medium">{r.total}</td><td className="text-right muted">{r.open}</td></tr>)}
            {!rows.length && <tr><td colSpan={3} className="text-center muted">Sem dados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Reports() {
  const { can } = useAuth();
  const toast = useToast();
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', categoryId: '', teamId: '' });
  const [data, setData] = useState(null);
  const [opts, setOpts] = useState({ categories: [], teams: [] });

  const load = () => { setData(null); api.get('/reports/dashboard', filters).then(setData).catch((e) => toast.error(e)); };
  useEffect(() => {
    load();
    api.get('/categories', can('tickets.view_all') ? { scope: 'active' } : { scope: 'authorized' }).then((categories) => setOpts((o) => ({ ...o, categories }))).catch(() => {});
    api.get('/teams').then((teams) => setOpts((o) => ({ ...o, teams }))).catch(() => {});
  }, []); // eslint-disable-line
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Relatórios e indicadores</h1>
          <p className="page-subtitle">{can('tickets.view_all') ? 'Toda a operação' : 'Restrito às categorias e equipes que você pode visualizar'}</p>
        </div>
        <button className="btn-secondary" onClick={() => api.download('/reports/tickets.csv', 'chamados.csv', filters).catch((e) => toast.error(e))}><Download size={16} /> Exportar CSV (Excel / Power BI)</button>
      </div>
      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs muted">De<input type="date" className="input mt-1" value={filters.dateFrom} onChange={set('dateFrom')} /></label>
        <label className="text-xs muted">Até<input type="date" className="input mt-1" value={filters.dateTo} onChange={set('dateTo')} /></label>
        <label className="text-xs muted">Categoria
          <select className="input mt-1" value={filters.categoryId} onChange={set('categoryId')}><option value="">Todas</option>{opts.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label className="text-xs muted">Equipe
          <select className="input mt-1" value={filters.teamId} onChange={set('teamId')}><option value="">Todas</option>{opts.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </label>
        <div className="flex items-end"><button className="btn-primary w-full" onClick={load}><RefreshCw size={16} /> Atualizar</button></div>
      </div>
      {!data ? <PageLoader /> : (
        <>
          <KpiCards data={data} />
          <ChartsGrid data={data} />
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <GroupTable title="Por categoria" rows={data.byCategory} />
            <GroupTable title="Por atendente" rows={data.byAssignee} />
            <GroupTable title="Por equipe" rows={data.byTeam} />
            <GroupTable title="Por departamento" rows={data.byDepartment} />
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Por equipe</span></div>
            <div className="p-3"><HBarChart data={data.byTeam} /></div>
          </div>
        </>
      )}
    </div>
  );
}
