import { useEffect, useState } from 'react';
import { Save, Bot, Mail, MessageCircle, Send, Users as TeamsIcon, BarChart3 } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Field, PageLoader, Toggle } from '../../components/ui';

export default function Settings() {
  const toast = useToast();
  const { reloadUser } = useAuth();
  const [data, setData] = useState(null);
  const [s, setS] = useState({});

  useEffect(() => { api.get('/settings').then((r) => { setData(r); setS(r.settings); }).catch((e) => toast.error(e)); }, []); // eslint-disable-line
  if (!data) return <PageLoader />;
  const set = (k, v) => setS((x) => ({ ...x, [k]: String(v) }));
  const save = async () => {
    try { await api.put('/settings', { settings: s }); toast.success('Configurações salvas.'); reloadUser(); } catch (err) { toast.error(err); }
  };
  const channels = data.integrations.notificationChannels;
  const integrations = [
    { icon: Mail, name: 'E-mail (SMTP / Microsoft Graph)', key: 'email' },
    { icon: TeamsIcon, name: 'Microsoft Teams', key: 'teams' },
    { icon: MessageCircle, name: 'WhatsApp', key: 'whatsapp' },
    { icon: Send, name: 'Telegram', key: 'telegram' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Configurações</h1><p className="page-subtitle">Parâmetros gerais do sistema.</p></div>
        <button className="btn-primary" onClick={save}><Save size={16} /> Salvar</button>
      </div>
      <div className="card space-y-4 p-5">
        <h2 className="card-title">Geral</h2>
        <Field label="Nome da empresa / portal"><input className="input" value={s['company.name'] || ''} onChange={(e) => set('company.name', e.target.value)} /></Field>
        <Toggle checked={s['tickets.requesterCanSetPriority'] === 'true'} onChange={(v) => set('tickets.requesterCanSetPriority', v)} label="Solicitante pode escolher a prioridade ao abrir chamado" />
      </div>
      <div className="card space-y-4 p-5">
        <h2 className="card-title">Chamados e SLA</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Encerrar automaticamente após (dias resolvido)" hint="0 desativa o encerramento automático."><input type="number" min={0} className="input" value={s['tickets.autoCloseDays'] || ''} onChange={(e) => set('tickets.autoCloseDays', e.target.value)} /></Field>
          <Field label="Alerta de SLA próximo do vencimento (%)" hint="Percentual do prazo consumido para alertar."><input type="number" min={10} max={99} className="input" value={s['sla.warningThresholdPercent'] || ''} onChange={(e) => set('sla.warningThresholdPercent', e.target.value)} /></Field>
        </div>
        <Toggle checked={s['sla.pauseOnWaitingUser'] === 'true'} onChange={(v) => set('sla.pauseOnWaitingUser', v)} label="Pausar SLA enquanto o chamado estiver “Aguardando usuário”" />
      </div>
      <div className="card p-5">
        <h2 className="card-title mb-1">Integrações</h2>
        <p className="mb-4 text-xs muted">Configuradas via variáveis de ambiente do backend (nenhuma chave é armazenada no banco ou exibida aqui).</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <Bot size={20} className="text-brand-500" />
            <div className="flex-1"><p className="text-sm font-medium">Inteligência Artificial</p><p className="text-xs muted">Provedor ativo: {data.integrations.ai.active}{data.integrations.ai.configured !== data.integrations.ai.active ? ` (configurado: ${data.integrations.ai.configured})` : ''}</p></div>
          </div>
          {integrations.map((i) => (
            <div key={i.key} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <i.icon size={20} className="text-slate-400" />
              <div className="flex-1"><p className="text-sm font-medium">{i.name}</p><p className="text-xs muted">{channels.includes(i.key) ? 'Ativo' : 'Não configurado'}</p></div>
              <span className={`h-2 w-2 rounded-full ${channels.includes(i.key) ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
            </div>
          ))}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <BarChart3 size={20} className="text-amber-500" />
            <div className="flex-1"><p className="text-sm font-medium">Power BI</p><p className="text-xs muted">Via API REST /api/reports ou exportação CSV</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
