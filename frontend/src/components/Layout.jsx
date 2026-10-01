import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Menu, X, Sun, Moon, LogOut, UserCircle, Search, Headset, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api/client';
import { buildMenu } from '../lib/menu';
import { Avatar } from './ui';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import ChangePasswordModal from './ChangePasswordModal';

function Sidebar({ open, onClose, counters }) {
  const { can, meta } = useAuth();
  const groups = buildMenu(can);
  return (
    <>
      <div className={clsx('fixed inset-0 z-30 bg-black/50 lg:hidden', open ? 'block' : 'hidden')} onClick={onClose} />
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-ink-900 lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="rounded-lg bg-brand-600 p-1.5 text-white"><Headset size={18} /></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{meta?.companyName || 'Service Desk'}</p>
            <p className="text-[11px] muted">Gestão de Atendimento</p>
          </div>
          <button className="btn-ghost btn-icon ml-auto lg:hidden" onClick={onClose} aria-label="Fechar menu"><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((g, i) => (
            <div key={i}>
              {g.title && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.title}</p>}
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const count = it.count ? counters?.[it.count] : null;
                  return (
                    <li key={it.to}>
                      <NavLink to={it.to} end={it.end} onClick={onClose}
                        className={({ isActive }) => clsx(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                          isActive ? 'bg-brand-600/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-ink-800 dark:hover:text-slate-100',
                        )}>
                        <it.icon size={17} className="shrink-0" />
                        <span className="flex-1 truncate">{it.label}</span>
                        {count > 0 && (
                          <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', it.alert ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700 dark:bg-ink-800 dark:text-slate-300')}>{count}</span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 text-[11px] muted dark:border-slate-800">v1.0 · MVP</div>
      </aside>
    </>
  );
}

function UserMenu({ onChangePassword }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-ink-800">
        <Avatar name={user.name} size="sm" />
        <div className="hidden text-left md:block">
          <p className="max-w-[140px] truncate text-sm font-medium leading-tight text-slate-900 dark:text-white">{user.name}</p>
          <p className="text-[11px] leading-tight muted">{user.role?.name}</p>
        </div>
      </button>
      {open && (
        <div className="card absolute right-0 mt-2 w-56 overflow-hidden py-1">
          <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs muted">{user.email}</p>
          </div>
          <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-ink-800" onClick={() => { setOpen(false); navigate('/profile'); }}><UserCircle size={16} /> Meu perfil</button>
          <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-ink-800" onClick={() => { setOpen(false); onChangePassword(); }}><KeyRound size={16} /> Alterar senha</button>
          <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-slate-100 dark:text-red-400 dark:hover:bg-ink-800" onClick={async () => { await logout(); navigate('/login'); }}><LogOut size={16} /> Sair</button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [sidebar, setSidebar] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [counters, setCounters] = useState(null);
  const { theme, toggle } = useTheme();
  const { mustChangePassword } = useAuth();
  const location = useLocation();

  const loadCounters = useCallback(() => { api.get('/tickets/counters').then(setCounters).catch(() => {}); }, []);
  useEffect(() => { loadCounters(); }, [location.pathname, loadCounters]);
  useEffect(() => { const id = setInterval(loadCounters, 30000); return () => clearInterval(id); }, [loadCounters]);
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebar} onClose={() => setSidebar(false)} counters={counters} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur dark:border-slate-800 dark:bg-ink-950/80 sm:px-6">
          <button className="btn-ghost btn-icon lg:hidden" onClick={() => setSidebar(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <button onClick={() => setSearchOpen(true)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 hover:border-slate-300 dark:border-slate-800 dark:bg-ink-900 dark:hover:border-slate-700 sm:max-w-md">
            <Search size={16} className="shrink-0" />
            <span className="truncate">Buscar chamados, usuários...</span>
            <kbd className="ml-auto hidden rounded border border-slate-300 px-1.5 text-[10px] dark:border-slate-700 sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button className="btn-ghost btn-icon" onClick={toggle} aria-label="Alternar tema" title="Alternar tema">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <NotificationBell />
            <UserMenu onChangePassword={() => setPwdOpen(true)} />
          </div>
        </header>
        {mustChangePassword && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-300 sm:px-6">
            <KeyRound size={16} /> Você está usando uma senha temporária. <button className="font-semibold underline" onClick={() => setPwdOpen(true)}>Alterar agora</button>
          </div>
        )}
        <main className="mx-auto max-w-[1600px] p-3 sm:p-6">
          <Outlet context={{ reloadCounters: loadCounters }} />
        </main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </div>
  );
}
