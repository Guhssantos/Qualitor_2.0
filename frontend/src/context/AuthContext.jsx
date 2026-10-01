import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, setAccessToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);

  const loadMeta = useCallback(async () => {
    try { setMeta(await api.get('/settings/public')); } catch { /* ignore */ }
  }, []);

  const reloadUser = useCallback(async () => {
    const me = await api.get('/auth/me');
    setUser(me);
    setMustChangePassword(!!me.profile?.mustChangePassword);
    return me;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { setAccessToken(null); setUser(null); });
    refreshSession()
      .then(async (data) => {
        setUser(data.user);
        setMustChangePassword(!!data.mustChangePassword);
        await loadMeta();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadMeta]);

  // Recarrega permissões periodicamente: mudanças feitas pelo admin aparecem sem novo login.
  useEffect(() => {
    if (!user) return undefined;
    const id = setInterval(() => { reloadUser().catch(() => {}); }, 60000);
    return () => clearInterval(id);
  }, [user?.id, reloadUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (loginName, password) => {
    const data = await api.post('/auth/login', { login: loginName, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    setMustChangePassword(!!data.mustChangePassword);
    await loadMeta();
    return data;
  }, [loadMeta]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => {
    const perms = new Set(user?.permissions || []);
    const can = (...keys) => !!user && (user.isAdmin || keys.some((k) => perms.has(k)));
    const isStaff = can('tickets.view_authorized', 'tickets.view_all', 'tickets.view_team');
    return {
      user, loading, meta, login, logout, reloadUser, can, isStaff,
      mustChangePassword, setMustChangePassword,
      statusLabel: (s) => meta?.statusLabels?.[s] || s,
      priorityLabel: (p) => meta?.priorityLabels?.[p] || p,
    };
  }, [user, loading, meta, login, logout, reloadUser, mustChangePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
