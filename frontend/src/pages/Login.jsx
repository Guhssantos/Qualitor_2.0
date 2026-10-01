import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Headset, LogIn, Eye, EyeOff, ShieldCheck, Timer, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui';

const DEMO = [
  { login: 'admin', label: 'Administrador' },
  { login: 'marcos.lima', label: 'Supervisor' },
  { login: 'joao.silva', label: 'Atendente (Hardware/Software/Acesso/M365)' },
  { login: 'carla.mendes', label: 'Atendente (Infraestrutura/Rede)' },
  { login: 'maria.oliveira', label: 'Solicitante' },
];

export default function Login() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({ login: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (user) return <Navigate to={location.state?.from?.pathname || '/'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.login, form.password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-brand-900 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="rounded-xl bg-brand-600 p-2"><Headset size={24} /></div>
          <span className="text-lg font-semibold">Qualitor Service Desk</span>
        </div>
        <div className="relative mt-auto max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight">Centralize, organize e acompanhe todos os atendimentos.</h1>
          <p className="mt-4 text-slate-300">Help Desk, Service Desk e suporte interno em uma única plataforma, com controle de acesso por perfil, equipe e categoria.</p>
          <div className="mt-10 grid grid-cols-3 gap-4 text-sm">
            {[[ShieldCheck, 'Permissões granulares'], [Timer, 'SLA em tempo real'], [BarChart3, 'Indicadores']].map(([I, t]) => (
              <div key={t} className="rounded-xl border border-white/10 bg-white/5 p-4"><I size={20} className="mb-2 text-brand-300" />{t}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="rounded-xl bg-brand-600 p-2 text-white"><Headset size={22} /></div>
            <span className="text-lg font-semibold">Qualitor Service Desk</span>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Entrar</h2>
          <p className="mt-1 text-sm muted">Use seu login ou e-mail corporativo.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="login">Login ou e-mail</label>
              <input id="login" className="input" autoComplete="username" autoFocus required value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="password">Senha</label>
              <div className="relative">
                <input id="password" type={show ? 'text' : 'password'} className="input pr-10" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" className="absolute inset-y-0 right-0 px-3 text-slate-400" onClick={() => setShow((s) => !s)} aria-label="Mostrar senha">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button className="btn-primary w-full py-2.5" disabled={loading}>{loading ? <Spinner className="text-white" /> : <LogIn size={16} />} Entrar</button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
              <p className="mb-2 text-xs font-medium muted">Usuários de demonstração (ambiente de desenvolvimento)</p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO.map((d) => (
                  <button key={d.login} type="button" className="btn-secondary btn-sm" title={d.label} onClick={() => setForm({ login: d.login, password: '' })}>{d.login}</button>
                ))}
              </div>
              <p className="mt-2 text-[11px] muted">Senhas definidas em ADMIN_PASSWORD / DEMO_PASSWORD no .env do backend.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
