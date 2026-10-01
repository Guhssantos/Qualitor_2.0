import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Plus, Pencil, UsersRound, Mail, Crown } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { ActiveBadge, Avatar, EmptyState, Field, Modal, PageLoader, Spinner } from '../../components/ui';

const EMPTY = { name: '', description: '', email: '', active: true, leaderId: '', categoryIds: [], members: [] };

export default function Teams() {
  const toast = useToast();
  const [teams, setTeams] = useState(null);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  const load = () => api.get('/teams').then(setTeams).catch((e) => toast.error(e));
  useEffect(() => {
    load();
    api.get('/categories').then(setCategories).catch(() => {});
    api.get('/users', { pageSize: 100, status: 'active' }).then((r) => setUsers(r.items.filter((u) => u.role.key !== 'REQUESTER'))).catch(() => {});
  }, []); // eslint-disable-line

  const open = (t) => {
    setMemberSearch('');
    setEditing(t || {});
    setForm(t ? {
      name: t.name, description: t.description || '', email: t.email || '', active: t.active, leaderId: t.leader?.id || '',
      categoryIds: t.categories.map((c) => c.id), members: t.members.map((m) => ({ userId: m.id, isSupervisor: m.isSupervisor })),
    } : EMPTY);
  };

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, leaderId: form.leaderId || null, email: form.email || null, description: form.description || null };
      if (editing.id) await api.put(`/teams/${editing.id}`, payload); else await api.post('/teams', payload);
      toast.success('Equipe salva. Membros herdam as categorias imediatamente.');
      setEditing(null);
      load();
    } catch (err) { toast.error(err); } finally { setSaving(false); }
  };

  const toggleMember = (id) => setForm((f) => ({ ...f, members: f.members.some((m) => m.userId === id) ? f.members.filter((m) => m.userId !== id) : [...f.members, { userId: id, isSupervisor: false }] }));
  const toggleSup = (id) => setForm((f) => ({ ...f, members: f.members.map((m) => (m.userId === id ? { ...m, isSupervisor: !m.isSupervisor } : m)) }));
  const toggleCat = (id) => setForm((f) => ({ ...f, categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter((x) => x !== id) : [...f.categoryIds, id] }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Equipes</h1><p className="page-subtitle">Membros de uma equipe atendem as categorias atribuídas a ela.</p></div>
        <button className="btn-primary" onClick={() => open(null)}><Plus size={16} /> Nova equipe</button>
      </div>
      {!teams ? <PageLoader /> : teams.length === 0 ? <div className="card"><EmptyState icon={UsersRound} title="Nenhuma equipe cadastrada" /></div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => (
            <div key={t.id} className={clsx('card flex flex-col p-4', !t.active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white">{t.name}</p>
                  <p className="text-sm muted">{t.description || 'Sem descrição'}</p>
                </div>
                <div className="flex items-center gap-1"><ActiveBadge active={t.active} /><button className="btn-ghost btn-icon" onClick={() => open(t)} aria-label="Editar"><Pencil size={15} /></button></div>
              </div>
              {t.email && <p className="mt-2 flex items-center gap-1.5 text-xs muted"><Mail size={12} /> {t.email}</p>}
              {t.leader && <p className="mt-1 flex items-center gap-1.5 text-xs muted"><Crown size={12} className="text-amber-500" /> Líder: {t.leader.name}</p>}
              <div className="mt-3">
                <p className="mb-1 text-[11px] font-semibold uppercase muted">Categorias</p>
                <div className="flex flex-wrap gap-1">{t.categories.map((c) => <span key={c.id} className="badge bg-brand-500/10 text-brand-600 ring-brand-500/30 dark:text-brand-300">{c.name}</span>)}{!t.categories.length && <span className="text-xs muted">Nenhuma</span>}</div>
              </div>
              <div className="mt-3 flex-1">
                <p className="mb-1 text-[11px] font-semibold uppercase muted">Membros ({t.members.length})</p>
                <div className="flex -space-x-2">{t.members.slice(0, 8).map((m) => <span key={m.id} title={`${m.name}${m.isSupervisor ? ' (supervisor)' : ''}`} className="rounded-full ring-2 ring-white dark:ring-ink-900"><Avatar name={m.name} size="sm" /></span>)}</div>
              </div>
              <p className="mt-3 text-xs muted">{t.ticketCount} chamado(s) vinculados</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Editar equipe — ${editing.name}` : 'Nova equipe'} size="lg"
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary" onClick={save} disabled={saving}>{saving && <Spinner className="text-white" />} Salvar</button></>}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome *"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="E-mail da equipe"><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Descrição" className="sm:col-span-2"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Líder">
              <select className="input" value={form.leaderId} onChange={(e) => setForm({ ...form, leaderId: e.target.value })}>
                <option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="input" value={String(form.active)} onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Ativa</option><option value="false">Inativa</option></select>
            </Field>
          </div>
          <div>
            <p className="label">Categorias atendidas pela equipe</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {categories.map((c) => (
                <label key={c.id} className={clsx('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm', form.categoryIds.includes(c.id) ? 'border-brand-500/50 bg-brand-500/5' : 'border-slate-200 dark:border-slate-700')}>
                  <input type="checkbox" className="checkbox" checked={form.categoryIds.includes(c.id)} onChange={() => toggleCat(c.id)} />{c.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Membros</p>
            <input className="input mb-2" placeholder="Filtrar atendentes..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
            <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {users.filter((u) => u.name.toLowerCase().includes(memberSearch.toLowerCase())).map((u) => {
                const m = form.members.find((x) => x.userId === u.id);
                return (
                  <div key={u.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="checkbox" checked={!!m} onChange={() => toggleMember(u.id)} />{u.name}<span className="text-xs muted">{u.role.name}</span></label>
                    {m && <label className="flex items-center gap-1 text-xs muted"><input type="checkbox" className="checkbox" checked={m.isSupervisor} onChange={() => toggleSup(u.id)} /> Supervisor</label>}
                  </div>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
