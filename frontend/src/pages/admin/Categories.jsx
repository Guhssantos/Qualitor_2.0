import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Plus, Pencil, FolderTree, Users as UsersIcon, Timer } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ActiveBadge, EmptyState, Field, Modal, PageLoader, PriorityBadge, Spinner } from '../../components/ui';
import { PRIORITIES } from '../../lib/labels';
import { fmtMinutes } from '../../lib/format';

const EMPTY = { name: '', description: '', active: true, defaultPriority: 'MEDIUM', teamId: '', userIds: [], subcategories: '', sla: {} };

export default function Categories() {
  const toast = useToast();
  const { priorityLabel } = useAuth();
  const [cats, setCats] = useState(null);
  const [teams, setTeams] = useState([]);
  const [agents, setAgents] = useState([]);
  const [globalSla, setGlobalSla] = useState({});
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/categories').then(setCats).catch((e) => toast.error(e));
    api.get('/sla').then((r) => setGlobalSla(Object.fromEntries(r.policies.filter((p) => !p.categoryId).map((p) => [p.priority, p])))).catch(() => {});
  };
  useEffect(() => {
    load();
    api.get('/teams').then(setTeams).catch(() => {});
    api.get('/users', { pageSize: 100, status: 'active' }).then((r) => setAgents(r.items.filter((u) => u.role.key !== 'REQUESTER'))).catch(() => {});
  }, []); // eslint-disable-line

  const open = (c) => {
    setEditing(c || {});
    setForm(c ? {
      name: c.name, description: c.description || '', active: c.active, defaultPriority: c.defaultPriority, teamId: c.team?.id || '',
      userIds: c.users.map((u) => u.id), subcategories: '',
      sla: Object.fromEntries(c.slaPolicies.map((p) => [p.priority, { firstResponseMinutes: p.firstResponseMinutes, resolutionMinutes: p.resolutionMinutes, businessDaysOnly: p.businessDaysOnly }])),
    } : EMPTY);
  };

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const base = { name: form.name, description: form.description || null, active: form.active, defaultPriority: form.defaultPriority, teamId: form.teamId || null, userIds: form.userIds };
      const saved = editing.id
        ? await api.put(`/categories/${editing.id}`, base)
        : await api.post('/categories', { ...base, subcategories: form.subcategories.split(',').map((s) => s.trim()).filter(Boolean) });
      const policies = Object.entries(form.sla).filter(([, v]) => v?.firstResponseMinutes && v?.resolutionMinutes)
        .map(([priority, v]) => ({ categoryId: saved.id, priority, firstResponseMinutes: Number(v.firstResponseMinutes), resolutionMinutes: Number(v.resolutionMinutes), businessDaysOnly: !!v.businessDaysOnly }));
      if (policies.length) await api.put('/sla', { policies });
      toast.success('Categoria salva.');
      setEditing(null);
      load();
    } catch (err) { toast.error(err); } finally { setSaving(false); }
  };

  const setSla = (p, k, v) => setForm((f) => ({ ...f, sla: { ...f.sla, [p]: { ...f.sla[p], [k]: v } } }));
  const toggleUser = (id) => setForm((f) => ({ ...f, userIds: f.userIds.includes(id) ? f.userIds.filter((x) => x !== id) : [...f.userIds, id] }));
  const effectiveSla = (c) => {
    const p = c.slaPolicies.find((x) => x.priority === c.defaultPriority) || globalSla[c.defaultPriority];
    return p ? `${fmtMinutes(p.firstResponseMinutes)} / ${fmtMinutes(p.resolutionMinutes)}` : '—';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Categorias</h1><p className="page-subtitle">Tipos de atendimento, equipe responsável, atendentes autorizados e SLA.</p></div>
        <button className="btn-primary" onClick={() => open(null)}><Plus size={16} /> Nova categoria</button>
      </div>
      <div className="card overflow-hidden">
        {!cats ? <PageLoader /> : cats.length === 0 ? <EmptyState icon={FolderTree} title="Nenhuma categoria" /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Categoria</th><th>Subcategorias</th><th>Prioridade padrão</th><th>SLA (1ª resp. / resolução)</th><th>Equipe responsável</th><th>Atendentes</th><th>Status</th><th /></tr></thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.id}>
                    <td><p className="font-medium text-slate-900 dark:text-slate-100">{c.name}</p><p className="max-w-xs truncate text-xs muted">{c.description}</p></td>
                    <td className="max-w-xs"><div className="flex flex-wrap gap-1">{c.subcategories.slice(0, 5).map((s) => <span key={s.id} className={clsx('badge ring-slate-500/20', s.active ? 'bg-slate-500/10' : 'bg-transparent line-through opacity-60')}>{s.name}</span>)}{c.subcategories.length > 5 && <span className="text-xs muted">+{c.subcategories.length - 5}</span>}</div></td>
                    <td><PriorityBadge priority={c.defaultPriority} /></td>
                    <td className="whitespace-nowrap text-sm"><Timer size={13} className="mr-1 inline muted" />{effectiveSla(c)}{c.slaPolicies.length > 0 && <span className="ml-1 text-[10px] text-brand-500">personalizado</span>}</td>
                    <td className="text-sm">{c.team?.name || '—'}{c.teams.length > 1 && <span className="text-xs muted"> +{c.teams.length - 1}</span>}</td>
                    <td className="text-sm"><UsersIcon size={13} className="mr-1 inline muted" />{c.users.length} direto(s)</td>
                    <td><ActiveBadge active={c.active} /></td>
                    <td><button className="btn-ghost btn-icon" onClick={() => open(c)} aria-label="Editar"><Pencil size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Editar categoria — ${editing.name}` : 'Nova categoria'} size="lg"
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary" onClick={save} disabled={saving}>{saving && <Spinner className="text-white" />} Salvar</button></>}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome *"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Status"><select className="input" value={String(form.active)} onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Ativa</option><option value="false">Inativa</option></select></Field>
            <Field label="Descrição" className="sm:col-span-2"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Prioridade padrão"><select className="input" value={form.defaultPriority} onChange={(e) => setForm({ ...form, defaultPriority: e.target.value })}>{PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}</select></Field>
            <Field label="Equipe responsável" hint="Chamados são encaminhados automaticamente para esta equipe."><select className="input" value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}><option value="">—</option>{teams.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            {!editing?.id && <Field label="Subcategorias" hint="Separe por vírgula. Ex.: Notebook, Desktop, Monitor" className="sm:col-span-2"><input className="input" value={form.subcategories} onChange={(e) => setForm({ ...form, subcategories: e.target.value })} /></Field>}
          </div>
          <div>
            <p className="label">Atendentes autorizados (diretamente)</p>
            <p className="mb-2 text-xs muted">Além destes, todos os membros das equipes que atendem a categoria têm acesso.</p>
            <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700 sm:grid-cols-2">
              {agents.map((u) => <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-ink-850"><input type="checkbox" className="checkbox" checked={form.userIds.includes(u.id)} onChange={() => toggleUser(u.id)} />{u.name}<span className="text-xs muted">{u.role.name}</span></label>)}
            </div>
          </div>
          <div>
            <p className="label">SLA específico da categoria (opcional)</p>
            <p className="mb-2 text-xs muted">Em branco = usa o SLA global da prioridade. Valores em minutos.</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="table">
                <thead><tr><th>Prioridade</th><th>1ª resposta (min)</th><th>Resolução (min)</th><th>Dias úteis</th></tr></thead>
                <tbody>
                  {PRIORITIES.map((p) => (
                    <tr key={p}>
                      <td><PriorityBadge priority={p} /></td>
                      <td><input type="number" min={1} className="input w-28 py-1" placeholder={globalSla[p]?.firstResponseMinutes} value={form.sla[p]?.firstResponseMinutes || ''} onChange={(e) => setSla(p, 'firstResponseMinutes', e.target.value)} /></td>
                      <td><input type="number" min={1} className="input w-28 py-1" placeholder={globalSla[p]?.resolutionMinutes} value={form.sla[p]?.resolutionMinutes || ''} onChange={(e) => setSla(p, 'resolutionMinutes', e.target.value)} /></td>
                      <td><input type="checkbox" className="checkbox" checked={!!form.sla[p]?.businessDaysOnly} onChange={(e) => setSla(p, 'businessDaysOnly', e.target.checked)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
