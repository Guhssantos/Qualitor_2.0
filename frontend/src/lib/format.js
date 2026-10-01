export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

export function fmtRelative(d) {
  if (!d) return '—';
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 30) return `há ${Math.floor(diff / 86400)} d`;
  return fmtDate(d);
}

export function fmtMinutes(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const min = Math.round(value);
  if (min < 60) return `${min} min`;
  if (min < 1440) return min % 60 ? `${Math.floor(min / 60)}h ${min % 60}min` : `${min / 60}h`;
  const h = Math.floor((min % 1440) / 60);
  return h ? `${Math.floor(min / 1440)}d ${h}h` : `${Math.floor(min / 1440)}d`;
}

export function fmtDuration(ms) {
  if (ms == null) return '—';
  const neg = ms < 0;
  const s = fmtMinutes(Math.abs(ms) / 60000);
  return neg ? `vencido há ${s}` : `restam ${s}`;
}

export const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);

export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
