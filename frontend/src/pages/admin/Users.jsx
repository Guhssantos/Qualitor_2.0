import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { UserPlus, Pencil, Power, KeyRound, ShieldCheck, Search, Copy } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ActiveBadge, Avatar, EmptyState, Field, Modal, PageLoader, Pagination, Spinner } from '../../components/ui';
import { fmtRelative } from '../../lib/format';

const EMPTY = { name: '', email: '', login: '', password: '', department: '', jobTitle: '', phone: '', roleId: '', active: true, categoryIds: [], teams: [], permissionOverrides: [] };

function UserForm({ open, onClose, user, initialTab = 'data', onSaved, catalog }) {
  const toast = useToast();
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { roles, teams, categories, permissions } = catalog;

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setForm(user ? {
      ...EMPTY, ...user, password: '',
      department: user.department || '', jobTitle: user.jobTitle || '', phone: user.phone || '',
      roleId: user.role.id,
      categoryIds: user.categories.map((c) => c.id),
      teams: user.teams.map((t) => ({ teamId: t.id, isSupervisor: t.isSupervisor })),
      permissionOverrides: user.permissionOverrides.map((p) => ({ permissionId: p.id, grant: p.grant })),
    } : { ...EMPTY, roleId: roles.find((r) => r.key === 'REQUESTER')?.id || '' });
  }, [open, user, initialTab, roles]);

  const role = roles.find((r) => r.id === form.roleId);
  const rolePerms = new Set(role?.permissions.map((p) => p.id) || []);
  const teamCats = useMemo(() => {
    const ids = new Set();
    form.teams.forEach((tm) => teams.find((t) => t.id === tm.teamId)?.categories.forEach((c) => ids.add(c.id)));
    return ids;
  }, [form.teams, teams]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleCat = (id) => setForm((f) => ({ ...f, categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter((x) => x !== id) : [...f.categoryIds, id] }));
  const toggleTeam = (id) => setForm((f) => ({ ...f, teams: f.teams.some((t) => t.teamId === id) ? f.teams.filter((t) => t.teamId !== id) : [...f.teams, { teamId: id, isSupervisor: false }] }));
  const toggleSup = (id) => setForm((f) => ({ ...f, teams: f.teams.map((t) => (t.teamId === id ? { ...t, isSupervisor: !t.isSupervisor } : t)) }));
  const overrideOf = (pid) => form.permissionOverrides.find((o) => o.permissionId === pid);
  const setOverride = (pid, value) => setForm((f) => ({
    ...f,
    permissionOverrides: value === 'inherit' ? f.permissionOverrides.filter((o) => o.permissionId !== pid)
      : [...f.permissionOverrides.filter((o) => o.permissionId !== pid), { permissionId: pid, grant: value === 'grant' }],
  }));

  const submit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name, email: form.email, login: form.login, department: form.department || null, jobTitle: form.jobTitle || null,
        phone: form.phone || null, roleId: form.roleId, active: form.active, categoryIds: form.categoryIds, teams: form.teams,
        permissionOverrides: form.permissionOverrides, ...(form.password ? { password: form.password } : {}),
      };
      const saved = user ? await api.put(`/users/${user.id}`, payload) : await api.post('/users', payload);
      toast.success(user ? 'Usuário atualizado. As permissões já estão valendo.' : 'Usuário criado.');
      onSaved(saved);
    } catch (err) { toast.error(err); } finally { setSaving(false); }
  };

  const grouped = permissions.reduce((acc, p) => { (acc[p.module] ||= []).push(p); return acc; }, {});

  return (
    <Modal open={open} onClose={onClose} title={user ? `Editar usuário — ${user.name}` : 'Novo usuário'} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={submit} disabled={saving}>{saving && <Spinner className="text-white" />} Salvar</button></>}>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {[['data', 'Dados'], ['access', 'Perfil, equipes e categorias'], ['perms', 'Permissões']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={clsx('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab === k ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent muted')}>{l}</button>
        ))}
      </div>
      <form onSubmit={submit}>
        {tab === 'data' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome *"><input className="input" required value={form.name} onChange={set('name')} /></Field>
            <Field label="E-mail *"><input type="email" className="input" required value={form.email} onChange={set('email')} /></Field>
            <Field label="Login *"><input className="input" required value={form.login} onChange={set('login')} /></Field>
            <Field label={user ? 'Nova senha (opcional)' : 'Senha (opcional)'} hint={user ? 'Força troca no próximo acesso.' : 'Se vazio, uma senha temporária será gerada.'}>
              <input type="password" className="input" value={form.password} onChange={set('password')} autoComplete="new-password" />
            </Field>
            <Field label="Departamento"><input className="input" value={form.department} onChange={set('department')} /></Field>
            <Field label="Cargo"><input className="input" value={form.jobTitle} onChange={set('jobTitle')} /></Field>
            <Field label="Telefone"><input className="input" value={form.phone} onChange={set('phone')} /></Field>
            <Field label="Status">
              <select className="input" value={String(form.active)} onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}>
                <option value="true">Ativo</option><option value="false">Inativo</option>
              </select>
            </Field>
          </div>
        )}
        {tab === 'access' && (
          <div className="space-y-5">
            <Field label="Perfil de acesso *">
              <select className="input" required value={form.roleId} onChange={set('roleId')}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {role && <span className="mt-1 block text-xs muted">{role.description} · {role.permissions.length} permissões</span>}
            </Field>
            <div>
              <p className="label">Equipes</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {teams.filter((t) => t.active).map((t) => {
                  const m = form.teams.find((x) => x.teamId === t.id);
                  return (
                    <div key={t.id} className={clsx('flex items-center justify-between gap-2 rounded-lg border px-3 py-2', m ? 'border-brand-500/50 bg-brand-500/5' : 'border-slate-200 dark:border-slate-700')}>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="checkbox" checked={!!m} onChange={() => toggleTeam(t.id)} />{t.name}</label>
                      {m && <label className="flex items-center gap-1 text-xs muted"><input type="checkbox" className="checkbox" checked={m.isSupervisor} onChange={() => toggleSup(t.id)} /> Supervisor</label>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="label">Categorias autorizadas</p>
              <p className="mb-2 text-xs muted">Categorias marcadas como “via equipe” já são herdadas das equipes selecionadas.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((c) => {
                  const inherited = teamCats.has(c.id);
                  return (
                    <label key={c.id} className={clsx('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm', form.categoryIds.includes(c.id) || inherited ? 'border-brand-500/50 bg-brand-500/5' : 'border-slate-200 dark:border-slate-700')}>
                      <input type="checkbox" className="checkbox" checked={form.categoryIds.includes(c.id) || inherited} disabled={inherited} onChange={() => toggleCat(c.id)} />
                      <span className="flex-1">{c.name}</span>
                      {inherited && <span className="text-[10px] muted">via equipe</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {tab === 'perms' && (
          <div className="space-y-4">
            <p className="text-xs muted">Por padrão o usuário herda as permissões do perfil <b>{role?.name}</b>. Use as exceções para conceder ou revogar permissões específicas.</p>
            {Object.entries(grouped).map(([mod, list]) => (
              <div key={mod}>
                <p className="mb-1 text-xs font-semibold uppercase muted">{mod}</p>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                  {list.map((p) => {
                    const o = overrideOf(p.id);
                    const value = o ? (o.grant ? 'grant' : 'revoke') : 'inherit';
                    const effective = o ? o.grant : rolePerms.has(p.id);
                    return (
                      <div key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <span className={clsx('h-2 w-2 rounded-full', effective ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')} />
                        <div className="min-w-0 flex-1"><p className="text-sm">{p.name}</p><p className="font-mono text-[11px] muted">{p.key}</p></div>
                        <select className="input w-auto py-1 text-xs" value={value} onChange={(e) => setOverride(p.id, e.target.value)}>
                          <option value="inherit">Herdar do perfil ({rolePerms.has(p.id) ? 'sim' : 'não'})</option>
                          <option value="grant">Conceder</option>
                          <option value="revoke">Revogar</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function Users() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ search: params.get('search') || '', roleId: '', teamId: '', status: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [catalog, setCatalog] = useState({ roles: [], teams: [], categories: [], permissions: [] });
  const [editing, setEditing] = useState(null);
  const [tempPwd, setTempPwd] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/roles'), api.get('/teams'), api.get('/categories'), api.get('/permissions')])
      .then(([roles, teams, categories, permissions]) => setCatalog({ roles, teams, categories, permissions }))
      .catch((e) => toast.error(e));
  }, []); // eslint-disable-line

  const load = useCallback(() => {
    api.get('/users', { ...filters, page, pageSize: 15 }).then(setData).catch((e) => toast.error(e));
  }, [filters, page]); // eslint-disable-line
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);

  const toggleActive = async (u) => {
    if (!window.confirm(`${u.active ? 'Desativar' : 'Ativar'} ${u.name}?`)) return;
    try { await api.patch(`/users/${u.id}/status`, { active: !u.active }); toast.success('Status atualizado.'); load(); } catch (err) { toast.error(err); }
  };
  const resetAccess = async (u) => {
    if (!window.confirm(`Redefinir o acesso de ${u.name}? As sessões ativas serão encerradas.`)) return;
    try { const r = await api.post(`/users/${u.id}/reset-access`); setTempPwd({ user: u, password: r.temporaryPassword }); } catch (err) { toast.error(err); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Usuários</h1><p className="page-subtitle">Usuário → Perfil → Equipe → Categorias → Permissões</p></div>
        <button className="btn-primary" onClick={() => setEditing({ user: null, tab: 'data' })}><UserPlus size={16} /> Novo usuário</button>
      </div>
      <div className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className="input pl-9" placeholder="Nome, e-mail, login..." value={filters.search} onChange={(e) => { setPage(1); setFilters({ ...filters, search: e.target.value }); }} /></div>
        <select className="input" value={filters.roleId} onChange={(e) => { setPage(1); setFilters({ ...filters, roleId: e.target.value }); }}><option value="">Todos os perfis</option>{catalog.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select className="input" value={filters.teamId} onChange={(e) => { setPage(1); setFilters({ ...filters, teamId: e.target.value }); }}><option value="">Todas as equipes</option>{catalog.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select className="input" value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}><option value="">Todos os status</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select>
      </div>
      <div className="card overflow-hidden">
        {!data ? <PageLoader /> : data.items.length === 0 ? <EmptyState title="Nenhum usuário encontrado" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Nome</th><th>Login</th><th>Departamento / Cargo</th><th>Perfil</th><th>Equipe</th><th>Categorias autorizadas</th><th>Status</th><th>Último acesso</th><th className="text-right">Ações</th></tr></thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id}>
                      <td><div className="flex items-center gap-3"><Avatar name={u.name} size="sm" /><div className="min-w-0"><p className="font-medium text-slate-900 dark:text-slate-100">{u.name}</p><p className="text-xs muted">{u.email}</p></div></div></td>
                      <td className="font-mono text-xs">{u.login}</td>
                      <td><p className="text-sm">{u.department || '—'}</p><p className="text-xs muted">{u.jobTitle}</p></td>
                      <td><span className="badge bg-brand-500/10 text-brand-600 ring-brand-500/30 dark:text-brand-300">{u.role.name}</span>{u.permissionOverrides.length > 0 && <span className="ml-1 badge bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300" title="Possui exceções de permissão">+{u.permissionOverrides.length}</span>}</td>
                      <td className="text-sm">{u.teams.map((t) => t.name + (t.isSupervisor ? ' ★' : '')).join(', ') || '—'}</td>
                      <td className="max-w-[240px]"><div className="flex flex-wrap gap-1">{u.effectiveCategories.slice(0, 4).map((c) => <span key={c.id} className="badge bg-slate-500/10 ring-slate-500/20" title={u.categories.some((d) => d.id === c.id) ? 'Direta' : 'Via equipe'}>{c.name}</span>)}{u.effectiveCategories.length > 4 && <span className="text-xs muted" title={u.effectiveCategories.map((c) => c.name).join(', ')}>+{u.effectiveCategories.length - 4}</span>}{!u.effectiveCategories.length && <span className="text-xs muted">{u.role.key === 'ADMIN' ? 'Todas' : '—'}</span>}</div></td>
                      <td><ActiveBadge active={u.active} /></td>
                      <td className="whitespace-nowrap text-xs muted">{fmtRelative(u.lastLoginAt)}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button className="btn-ghost btn-icon" title="Editar" onClick={() => setEditing({ user: u, tab: 'data' })}><Pencil size={15} /></button>
                          <button className="btn-ghost btn-icon" title="Gerenciar permissões" onClick={() => setEditing({ user: u, tab: 'perms' })}><ShieldCheck size={15} /></button>
                          <button className="btn-ghost btn-icon" title="Redefinir acesso" onClick={() => resetAccess(u)}><KeyRound size={15} /></button>
                          <button className={clsx('btn-ghost btn-icon', u.active ? 'text-red-500' : 'text-emerald-500')} title={u.active ? 'Desativar' : 'Ativar'} disabled={u.id === me.id} onClick={() => toggleActive(u)}><Power size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
          </>
        )}
      </div>

      <UserForm open={!!editing} user={editing?.user} initialTab={editing?.tab} catalog={catalog} onClose={() => setEditing(null)}
        onSaved={(saved) => { setEditing(null); load(); if (saved.temporaryPassword) setTempPwd({ user: saved, password: saved.temporaryPassword }); }} />

      <Modal open={!!tempPwd} onClose={() => setTempPwd(null)} title="Senha temporária" size="sm" footer={<button className="btn-primary" onClick={() => setTempPwd(null)}>Concluir</button>}>
        <p className="text-sm">Informe a senha abaixo para <b>{tempPwd?.user.name}</b>. Ela será exigida a troca no primeiro acesso e não será exibida novamente.</p>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-100 p-3 font-mono text-sm dark:bg-ink-850">
          <span className="flex-1 break-all">{tempPwd?.password}</span>
          <button className="btn-ghost btn-icon" onClick={() => { navigator.clipboard?.writeText(tempPwd.password); toast.success('Copiado.'); }} aria-label="Copiar"><Copy size={15} /></button>
        </div>
      </Modal>
    </div>
  );
}
