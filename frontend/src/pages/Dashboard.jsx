import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Ticket, MessageSquareReply, CheckCircle2, Inbox, UserCheck, ArrowRight } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, PageLoader, PriorityBadge, SlaBadge, StatCard, StatusBadge } from '../components/ui';
import { ChartsGrid, KpiCards } from '../components/Indicators';
import AiAssistant from '../components/AiAssistant';
import { fmtRelative } from '../lib/format';

function TicketMiniList({ title, view, query = {}, emptyText }) {
  const [items, setItems] = useState(null);
  useEffect(() => { api.get('/tickets', { view, pageSize: 6, ...query }).then((r) => setItems(r.items)).catch(() => setItems([])); }, [view]); // eslint-disable-line
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <Link to={`/tickets/${view}`} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Ver todos <ArrowRight size={12} /></Link>
      </div>
      {!items ? <PageLoader /> : items.length === 0 ? <EmptyState title={emptyText} /> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((t) => (
            <li key={t.id}>
              <Link to={`/tickets/view/${t.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-slate-50 dark:hover:bg-ink-850">
                <span className="font-mono text-xs muted">{t.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
                <SlaBadge sla={t.sla} />
                <span className="w-16 text-right text-xs muted">{fmtRelative(t.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StaffDashboard() {
  const [data, setData] = useState(null);
  const toast = useToast();
  const { user, can } = useAuth();
  useEffect(() => { api.get('/reports/dashboard').then(setData).catch((e) => toast.error(e)); }, []); // eslint-disable-line
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Olá, {user.name.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">{can('tickets.view_all') ? 'Visão geral de toda a operação' : 'Indicadores das categorias e equipes que você atende'}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/tickets/queue" className="btn-secondary"><Inbox size={16} /> Minha fila</Link>
          {can('tickets.create') && <Link to="/tickets/new" className="btn-primary"><PlusCircle size={16} /> Abrir chamado</Link>}
        </div>
      </div>
      {!data ? <PageLoader /> : (
        <>
          <KpiCards data={data} />
          <div className="grid gap-4 lg:grid-cols-2">
            <TicketMiniList title="Fila de atendimento" view="queue" emptyText="Fila vazia 🎉" />
            <TicketMiniList title="Meus chamados" view="mine" emptyText="Nenhum chamado atribuído a você" />
          </div>
          <ChartsGrid data={data} />
        </>
      )}
    </div>
  );
}

function RequesterDashboard() {
  const [counters, setCounters] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { api.get('/tickets/counters').then(setCounters).catch(() => {}); }, []);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Olá, {user.name.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Como podemos ajudar hoje?</p>
        </div>
        <Link to="/tickets/new" className="btn-primary"><PlusCircle size={16} /> Abrir chamado</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Meus chamados" value={counters?.requested} icon={Ticket} onClick={() => navigate('/tickets/requested')} />
        <StatCard label="Em andamento" value={counters?.open} icon={UserCheck} tone="violet" onClick={() => navigate('/tickets/requested')} />
        <StatCard label="Aguardando minha resposta" value={counters?.waiting_me} icon={MessageSquareReply} tone="amber" onClick={() => navigate('/tickets/waiting_me')} />
        <StatCard label="Resolvidos" value={counters?.resolved} icon={CheckCircle2} tone="emerald" />
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3"><TicketMiniList title="Meus chamados recentes" view="requested" emptyText="Você ainda não abriu chamados" /></div>
        <div className="xl:col-span-2"><AiAssistant compact /></div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { can } = useAuth();
  return can('reports.view', 'tickets.view_authorized') ? <StaffDashboard /> : <RequesterDashboard />;
}
