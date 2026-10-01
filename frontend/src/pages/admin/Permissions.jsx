import { Fragment, useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, Lock } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Field, Modal, PageLoader } from '../../components/ui';

export default function Permissions() {
  const toast = useToast();
  const [roles, setRoles] = useState(null);
  const [perms, setPerms] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [dirty, setDirty] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState({ key: '', name: '', description: '', copyFrom: '' });

  const load = async () => {
    const [r, p] = await Promise.all([api.get('/roles'), api.get('/permissions')]);
    setRoles(r); setPerms(p);
    setMatrix(Object.fromEntries(r.map((role) => [role.id, new Set(role.permissions.map((x) => x.id))])));
    setDirty(new Set());
  };
  useEffect(() => { load().catch((e) => toast.error(e)); }, []); // eslint-disable-line

  const grouped = useMemo(() => perms.reduce((acc, p) => { (acc[p.module] ||= []).push(p); return acc; }, {}), [perms]);
  const toggle = (roleId, pid) => {
    setMatrix((m) => { const s = new Set(m[roleId]); s.has(pid) ? s.delete(pid) : s.add(pid); return { ...m, [roleId]: s }; });
    setDirty((d) => new Set(d).add(roleId));
  };
  const saveAll = async () => {
    try {
      for (const roleId of dirty) await api.put(`/roles/${roleId}`, { permissionIds: [...matrix[roleId]] });
      toast.success('Permissões atualizadas. As alterações valem imediatamente para todos os usuários do perfil.');
      load();
    } catch (err) { toast.error(err); }
  };
  const create = async (e) => {
    e?.preventDefault();
    try {
      const permissionIds = newRole.copyFrom ? [...matrix[newRole.copyFrom]] : [];
      await api.post('/roles', { key: newRole.key, name: newRole.name, description: newRole.description || null, permissionIds });
      toast.success('Perfil criado.'); setCreating(false); setNewRole({ key: '', name: '', description: '', copyFrom: '' }); load();
    } catch (err) { toast.error(err); }
  };
  const remove = async (r) => {
    if (!window.confirm(`Excluir o perfil ${r.name}?`)) return;
    try { await api.del(`/roles/${r.id}`); toast.success('Perfil excluído.'); load(); } catch (err) { toast.error(err); }
  };

  if (!roles) return <PageLoader />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Perfis e permissões</h1><p className="page-subtitle">Matriz de permissões granulares por perfil. Exceções individuais são definidas no cadastro do usuário.</p></div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setCreating(true)}><Plus size={16} /> Novo perfil</button>
          <button className="btn-primary" disabled={!dirty.size} onClick={saveAll}><Save size={16} /> Salvar alterações {dirty.size > 0 && `(${dirty.size})`}</button>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[260px]">Permissão</th>
              {roles.map((r) => (
                <th key={r.id} className="text-center">
                  <div className="flex flex-col items-center gap-0.5 normal-case">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{r.name}</span>
                    <span className="text-[10px] font-normal">{r.userCount} usuário(s)</span>
                    {!r.isSystem && <button className="text-red-500" onClick={() => remove(r)} aria-label="Excluir perfil"><Trash2 size={12} /></button>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([mod, list]) => (
              <Fragment key={mod}>
                <tr className="hover:bg-transparent"><td colSpan={roles.length + 1} className="bg-slate-50 py-1.5 text-[11px] font-semibold uppercase tracking-wide muted dark:bg-ink-850/50">{mod}</td></tr>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td className="sticky left-0 bg-white dark:bg-ink-900"><p className="text-sm">{p.name}</p><p className="font-mono text-[11px] muted">{p.key}</p></td>
                    {roles.map((r) => (
                      <td key={r.id} className="text-center">
                        {r.key === 'ADMIN'
                          ? <span title="Administrador possui acesso total"><Lock size={14} className="mx-auto text-emerald-500" /></span>
                          : <input type="checkbox" className="checkbox" checked={matrix[r.id]?.has(p.id) || false} onChange={() => toggle(r.id, p.id)} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={creating} onClose={() => setCreating(false)} title="Novo perfil" size="sm" footer={<><button className="btn-secondary" onClick={() => setCreating(false)}>Cancelar</button><button className="btn-primary" onClick={create}>Criar</button></>}>
        <form onSubmit={create} className="space-y-3">
          <Field label="Chave *" hint="Letras maiúsculas, números e _ (ex.: N2_INFRA)"><input className="input" required value={newRole.key} onChange={(e) => setNewRole({ ...newRole, key: e.target.value.toUpperCase() })} /></Field>
          <Field label="Nome *"><input className="input" required value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} /></Field>
          <Field label="Descrição"><input className="input" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} /></Field>
          <Field label="Copiar permissões de"><select className="input" value={newRole.copyFrom} onChange={(e) => setNewRole({ ...newRole, copyFrom: e.target.value })}><option value="">Nenhum</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        </form>
      </Modal>
    </div>
  );
}
