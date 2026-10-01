import { useEffect, useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar, Field, PageLoader } from '../components/ui';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { fmtDateTime } from '../lib/format';

export default function Profile() {
  const { reloadUser } = useAuth();
  const toast = useToast();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [pwd, setPwd] = useState(false);

  useEffect(() => { api.get('/auth/me').then((m) => { setMe(m); setForm({ name: m.profile.name, phone: m.profile.phone || '' }); }); }, []);
  if (!me) return <PageLoader />;

  const save = async (e) => {
    e.preventDefault();
    try { await api.put('/auth/me', { name: form.name, phone: form.phone || null }); await reloadUser(); toast.success('Perfil atualizado.'); } catch (err) { toast.error(err); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="page-title">Meu perfil</h1>
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <Avatar name={me.name} size="lg" />
        <div className="flex-1">
          <p className="text-lg font-semibold">{me.name}</p>
          <p className="text-sm muted">{me.email} · {me.login}</p>
          <p className="mt-1 text-xs muted">Último acesso: {fmtDateTime(me.profile.lastLoginAt)}</p>
        </div>
        <span className="badge bg-brand-500/10 text-brand-600 ring-brand-500/30 dark:text-brand-300">{me.role.name}</span>
      </div>
      <form onSubmit={save} className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Nome"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} /></Field>
        <Field label="Telefone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Departamento"><input className="input" value={me.profile.department || ''} disabled /></Field>
        <Field label="Cargo"><input className="input" value={me.profile.jobTitle || ''} disabled /></Field>
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-secondary" onClick={() => setPwd(true)}><KeyRound size={16} /> Alterar senha</button>
          <button className="btn-primary"><Save size={16} /> Salvar</button>
        </div>
      </form>
      {(me.profile.teams.length > 0 || me.profile.categories.length > 0) && (
        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="label">Equipes</p>
            <div className="flex flex-wrap gap-1.5">{me.profile.teams.map((t) => <span key={t.team.id} className="badge bg-slate-500/10 ring-slate-500/30">{t.team.name}{t.isSupervisor ? ' (supervisor)' : ''}</span>)}</div>
          </div>
          <div>
            <p className="label">Categorias autorizadas (diretas + equipes)</p>
            <p className="text-sm">{me.categoryIds.length} categoria(s)</p>
          </div>
        </div>
      )}
      <ChangePasswordModal open={pwd} onClose={() => setPwd(false)} />
    </div>
  );
}
