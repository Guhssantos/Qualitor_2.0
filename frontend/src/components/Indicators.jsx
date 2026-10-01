import { useNavigate } from 'react-router-dom';
import {
  Inbox, Wrench, Hourglass, CheckCircle2, Archive, AlertTriangle, Clock, Timer, Star, ShieldCheck,
} from 'lucide-react';
import { StatCard } from './ui';
import { DonutChart, HBarChart, SeriesChart } from './Charts';
import { fmtMinutes } from '../lib/format';

export function KpiCards({ data }) {
  const navigate = useNavigate();
  const c = data.cards;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatCard label="Abertos / triagem" value={c.open} icon={Inbox} tone="brand" hint={`${c.unassigned} sem responsável`} onClick={() => navigate('/tickets/queue')} />
      <StatCard label="Em atendimento" value={c.inProgress} icon={Wrench} tone="violet" onClick={() => navigate('/tickets/in_progress')} />
      <StatCard label="Aguardando usuário" value={c.waitingUser} icon={Hourglass} tone="amber" onClick={() => navigate('/tickets/waiting')} />
      <StatCard label="Resolvidos" value={c.resolved + c.validation} icon={CheckCircle2} tone="emerald" hint={`${c.validation} em validação`} onClick={() => navigate('/tickets/resolved')} />
      <StatCard label="Encerrados" value={c.closed} icon={Archive} tone="slate" hint={`${c.cancelled} cancelados`} />
      <StatCard label="Atrasados (SLA vencido)" value={c.overdue} icon={AlertTriangle} tone="red" hint={`${c.slaWarning} próximos do vencimento`} />
      <StatCard label="Tempo médio 1ª resposta" value={fmtMinutes(data.avgFirstResponseMinutes)} icon={Clock} tone="teal" />
      <StatCard label="Tempo médio de resolução" value={fmtMinutes(data.avgResolutionMinutes)} icon={Timer} tone="brand" />
      <StatCard label="Cumprimento de SLA" value={data.slaCompliancePercent != null ? `${data.slaCompliancePercent}%` : '—'} icon={ShieldCheck} tone="emerald" />
      <StatCard label="Satisfação média" value={data.avgRating != null ? `${data.avgRating} / 5` : '—'} icon={Star} tone="amber" />
    </div>
  );
}

export function ChartsGrid({ data }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="card xl:col-span-2">
        <div className="card-header"><span className="card-title">Abertos x resolvidos — últimos 30 dias</span></div>
        <div className="p-3"><SeriesChart data={data.series} /></div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Por prioridade</span></div>
        <div className="p-3"><DonutChart data={data.byPriority} priority /></div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Por categoria</span></div>
        <div className="p-3"><HBarChart data={data.byCategory} /></div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Por atendente</span></div>
        <div className="p-3"><HBarChart data={data.byAssignee} /></div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Por departamento</span></div>
        <div className="p-3"><HBarChart data={data.byDepartment} /></div>
      </div>
    </div>
  );
}
