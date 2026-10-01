import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PageLoader, PriorityBadge, SlaBadge } from '../../components/ui';
import { PRIORITIES } from '../../lib/labels';
import { fmtMinutes } from '../../lib/format';

export default function Sla() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});

  const load = () => api.get('/sla').then((r) => {
    setData(r);
    const g = Object.fromEntries(PRIORITIES.map((p) => {
      const pol = r.policies.find((x) => !x.categoryId && x.priority === p) || r.fallback[p];
      return [p, { firstResponseMinutes: pol.firstResponseMinutes, resolutionMinutes: pol.resolutionMinutes, businessDaysOnly: pol.businessDaysOnly }];
    }));
    setForm(g);
  }).catch((e) => toast.error(e));
  useEffect(() => { load(); }, []); // eslint-disable-line

  const save = async () => {
    try {
      await api.put('/sla', { policies: PRIORITIES.map((p) => ({ categoryId: null, priority: p, firstResponseMinutes: Number(form[p].firstResponseMinutes), resolutionMinutes: Number(form[p].resolutionMinutes), businessDaysOnly: !!form[p].businessDaysOnly })) });
      toast.success('SLA global atualizado. Novos chamados usarão os novos prazos.');
      load();
    } catch (err) { toast.error(err); }
  };
  const remove = async (id) => { try { await api.del(`/sla/${id}`); load(); } catch (err) { toast.error(err); } };
  const set = (p, k, v) => setForm((f) => ({ ...f, [p]: { ...f[p], [k]: v } }));

  if (!data) return <PageLoader />;
  const specific = data.policies.filter((p) => p.categoryId);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">SLA</h1><p className="page-subtitle">Prazos de primeira resposta e resolução por prioridade e categoria.</p></div>
        <button className="btn-primary" onClick={save}><Save size={16} /> Salvar SLA global</button>
      </div>
      <div className="card overflow-x-auto">
        <div className="card-header"><span className="card-title">SLA global por prioridade</span></div>
        <table className="table">
          <thead><tr><th>Prioridade</th><th>1ª resposta (minutos)</th><th>Resolução (minutos)</th><th>Somente dias úteis</th><th>Resumo</th></tr></thead>
          <tbody>
            {PRIORITIES.slice().reverse().map((p) => (
              <tr key={p}>
                <td><PriorityBadge priority={p} /></td>
                <td><input type="number" min={1} className="input w-32" value={form[p]?.firstResponseMinutes || ''} onChange={(e) => set(p, 'firstResponseMinutes', e.target.value)} /></td>
                <td><input type="number" min={1} className="input w-32" value={form[p]?.resolutionMinutes || ''} onChange={(e) => set(p, 'resolutionMinutes', e.target.value)} /></td>
                <td><input type="checkbox" className="checkbox" checked={!!form[p]?.businessDaysOnly} onChange={(e) => set(p, 'businessDaysOnly', e.target.checked)} /></td>
                <td className="text-sm muted">{fmtMinutes(Number(form[p]?.firstResponseMinutes))} / {fmtMinutes(Number(form[p]?.resolutionMinutes))}{form[p]?.businessDaysOnly ? ' (úteis)' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card overflow-x-auto">
        <div className="card-header"><span className="card-title">SLA específico por categoria</span><span className="text-xs muted">Edite em Categorias</span></div>
        {specific.length === 0 ? <p className="p-4 text-sm muted">Nenhuma categoria com SLA personalizado.</p> : (
          <table className="table">
            <thead><tr><th>Categoria</th><th>Prioridade</th><th>1ª resposta</th><th>Resolução</th><th /></tr></thead>
            <tbody>
              {specific.map((p) => (
                <tr key={p.id}>
                  <td>{p.category?.name}</td><td><PriorityBadge priority={p.priority} /></td>
                  <td>{fmtMinutes(p.firstResponseMinutes)}</td><td>{fmtMinutes(p.resolutionMinutes)}{p.businessDaysOnly ? ' (úteis)' : ''}</td>
                  <td><button className="btn-ghost btn-sm text-red-500" onClick={() => remove(p.id)}>Remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
        <Info size={16} className="text-brand-500" /> Estados exibidos:
        <SlaBadge sla={{ status: 'OK' }} /><SlaBadge sla={{ status: 'WARNING' }} /><SlaBadge sla={{ status: 'BREACHED' }} /><SlaBadge sla={{ status: 'PAUSED' }} />
        <span className="muted">— o limite de “próximo do vencimento” e a pausa em “Aguardando usuário” são definidos em Configurações.</span>
      </div>
    </div>
  );
}
