import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { formatTicketNumber } from '../../lib/http.js';
import { ACTIVE_STATUSES, PRIORITY_LABELS, STATUS_LABELS } from '../../lib/constants.js';
import { audit } from '../../lib/audit.js';
import { requirePermission } from '../../middleware/auth.js';
import { slaState } from '../sla/sla.service.js';
import { visibilityWhere } from '../tickets/ticket.access.js';

const router = Router();

// Indicadores sempre respeitam a visibilidade do usuário (admin vê tudo; atendente só o que pode ver).
router.use(requirePermission('reports.view', 'tickets.view_authorized'));

function scopeWhere(req) {
  const and = [visibilityWhere(req.user)];
  const { dateFrom, dateTo, categoryId, teamId } = req.query;
  if (dateFrom && !isNaN(new Date(dateFrom))) and.push({ createdAt: { gte: new Date(dateFrom) } });
  if (dateTo && !isNaN(new Date(dateTo))) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); and.push({ createdAt: { lte: d } }); }
  if (categoryId) and.push({ categoryId: String(categoryId) });
  if (teamId) and.push({ teamId: String(teamId) });
  return { AND: and };
}

const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

function groupCount(items, keyFn, labelFn) {
  const map = new Map();
  for (const it of items) {
    const key = keyFn(it) ?? '—';
    const entry = map.get(key) || { key, label: labelFn ? labelFn(it) : key, total: 0, open: 0 };
    entry.total += 1;
    if (ACTIVE_STATUSES.includes(it.status)) entry.open += 1;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

router.get('/dashboard', asyncHandler(async (req, res) => {
  const threshold = Number(await getSetting('sla.warningThresholdPercent')) || 75;
  const tickets = await prisma.ticket.findMany({
    where: scopeWhere(req),
    select: {
      id: true, status: true, priority: true, department: true, createdAt: true, firstRespondedAt: true,
      firstResponseDueAt: true, resolutionDueAt: true, resolvedAt: true, closedAt: true, slaPausedAt: true, rating: true,
      category: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
  });

  const byStatus = Object.fromEntries(Object.keys(STATUS_LABELS).map((s) => [s, 0]));
  let overdue = 0; let warning = 0; let met = 0; let finished = 0;
  const firstResponse = []; const resolution = []; const ratings = [];
  for (const t of tickets) {
    byStatus[t.status] += 1;
    const sla = slaState(t, threshold);
    if (ACTIVE_STATUSES.includes(t.status) && sla.status === 'BREACHED') overdue += 1;
    if (ACTIVE_STATUSES.includes(t.status) && sla.status === 'WARNING') warning += 1;
    if (sla.status === 'MET') { met += 1; finished += 1; }
    if (sla.status === 'MISSED') finished += 1;
    if (t.firstRespondedAt) firstResponse.push((new Date(t.firstRespondedAt) - new Date(t.createdAt)) / 60000);
    if (t.resolvedAt) resolution.push((new Date(t.resolvedAt) - new Date(t.createdAt)) / 60000);
    if (t.rating) ratings.push(t.rating);
  }

  // Série dos últimos 30 dias (abertos x resolvidos).
  const days = 30;
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    return { date: d.toISOString().slice(0, 10), opened: 0, resolved: 0 };
  });
  const idx = (date) => Math.floor((new Date(date).setHours(0, 0, 0, 0) - start) / 86400000);
  for (const t of tickets) {
    const o = idx(t.createdAt); if (o >= 0 && o < days) series[o].opened += 1;
    if (t.resolvedAt) { const r = idx(t.resolvedAt); if (r >= 0 && r < days) series[r].resolved += 1; }
  }

  res.json({
    total: tickets.length,
    byStatus,
    cards: {
      open: byStatus.OPEN + byStatus.TRIAGE,
      inProgress: byStatus.IN_PROGRESS,
      waitingUser: byStatus.WAITING_USER,
      validation: byStatus.VALIDATION,
      resolved: byStatus.RESOLVED,
      closed: byStatus.CLOSED,
      cancelled: byStatus.CANCELLED,
      overdue,
      slaWarning: warning,
      unassigned: tickets.filter((t) => !t.assignee && ACTIVE_STATUSES.includes(t.status)).length,
    },
    avgFirstResponseMinutes: avg(firstResponse),
    avgResolutionMinutes: avg(resolution),
    slaCompliancePercent: finished ? Math.round((met / finished) * 100) : null,
    avgRating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)) : null,
    byCategory: groupCount(tickets, (t) => t.category?.id, (t) => t.category?.name),
    byAssignee: groupCount(tickets, (t) => t.assignee?.id ?? 'none', (t) => t.assignee?.name ?? 'Sem responsável'),
    byPriority: groupCount(tickets, (t) => t.priority, (t) => PRIORITY_LABELS[t.priority]),
    byDepartment: groupCount(tickets, (t) => t.department || 'Não informado'),
    byTeam: groupCount(tickets, (t) => t.team?.id ?? 'none', (t) => t.team?.name ?? 'Sem equipe'),
    series,
  });
}));

/** Exportação CSV (compatível com Excel / Power BI). */
router.get('/tickets.csv', asyncHandler(async (req, res) => {
  const threshold = Number(await getSetting('sla.warningThresholdPercent')) || 75;
  const tickets = await prisma.ticket.findMany({
    where: scopeWhere(req),
    include: {
      category: { select: { name: true } }, subcategory: { select: { name: true } },
      requester: { select: { name: true, email: true } }, assignee: { select: { name: true } }, team: { select: { name: true } },
    },
    orderBy: { number: 'asc' },
    take: 50000,
  });
  const esc = (v) => {
    if (v == null) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Numero', 'Titulo', 'Status', 'Prioridade', 'Categoria', 'Subcategoria', 'Solicitante', 'Email', 'Departamento', 'Local', 'Atendente', 'Equipe', 'Origem', 'Abertura', 'PrimeiraResposta', 'Resolucao', 'Encerramento', 'VencimentoSLA', 'SituacaoSLA', 'Avaliacao'];
  const rows = tickets.map((t) => [
    formatTicketNumber(t.number), t.title, STATUS_LABELS[t.status], PRIORITY_LABELS[t.priority], t.category?.name, t.subcategory?.name,
    t.requester?.name, t.requester?.email, t.department, t.location, t.assignee?.name, t.team?.name, t.source,
    t.createdAt, t.firstRespondedAt, t.resolvedAt, t.closedAt, t.resolutionDueAt, slaState(t, threshold).status, t.rating,
  ].map(esc).join(';'));
  await audit(req, { action: 'report.exported', entity: 'Report', details: { rows: rows.length, query: req.query } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="chamados-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`﻿${header.join(';')}\n${rows.join('\n')}`);
}));

export default router;
