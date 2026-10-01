import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';

export const PALETTE = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e', '#ec4899', '#64748b', '#06b6d4', '#a3e635'];
const PRIORITY_COLORS = { LOW: '#64748b', MEDIUM: '#0ea5e9', HIGH: '#f97316', CRITICAL: '#ef4444' };

function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    grid: dark ? '#1e293b' : '#e2e8f0',
    axis: dark ? '#64748b' : '#94a3b8',
    tooltip: {
      contentStyle: { background: dark ? '#0f172a' : '#fff', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, borderRadius: 8, fontSize: 12 },
      labelStyle: { color: dark ? '#e2e8f0' : '#0f172a' },
      cursor: { fill: dark ? 'rgba(148,163,184,.08)' : 'rgba(15,23,42,.04)' },
    },
  };
}

export function SeriesChart({ data }) {
  const t = useChartTheme();
  const fmt = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="gOpen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
          <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmt} stroke={t.axis} fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis allowDecimals={false} stroke={t.axis} fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip {...t.tooltip} labelFormatter={fmt} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="opened" name="Abertos" stroke="#3b82f6" fill="url(#gOpen)" strokeWidth={2} />
        <Area type="monotone" dataKey="resolved" name="Resolvidos" stroke="#22c55e" fill="url(#gRes)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HBarChart({ data, height }) {
  const t = useChartTheme();
  const rows = data.slice(0, 10);
  return (
    <ResponsiveContainer width="100%" height={height || Math.max(160, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid stroke={t.grid} horizontal={false} />
        <XAxis type="number" allowDecimals={false} stroke={t.axis} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" width={120} stroke={t.axis} fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip {...t.tooltip} />
        <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]} barSize={14}>
          {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
        <Bar dataKey="open" name="Em aberto" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={6} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, priority = false }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="total" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
          {data.map((d, i) => <Cell key={d.key} fill={priority ? PRIORITY_COLORS[d.key] : PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip {...t.tooltip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
