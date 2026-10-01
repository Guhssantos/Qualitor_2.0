import { prisma } from '../lib/prisma.js';
import { getSetting } from '../lib/settings.js';
import { formatTicketNumber } from '../lib/http.js';
import { ACTIVE_STATUSES } from '../lib/constants.js';
import { slaState } from '../modules/sla/sla.service.js';
import { agentsForCategory, notify } from '../modules/notifications/notifications.service.js';

/** Alerta atendentes sobre chamados próximos do vencimento do SLA. */
export async function slaWarningJob() {
  const threshold = Number(await getSetting('sla.warningThresholdPercent')) || 75;
  const tickets = await prisma.ticket.findMany({
    where: { status: { in: ACTIVE_STATUSES }, slaWarningSentAt: null, slaPausedAt: null, resolutionDueAt: { not: null } },
  });
  let sent = 0;
  for (const t of tickets) {
    const s = slaState(t, threshold);
    if (!['WARNING', 'BREACHED'].includes(s.status)) continue;
    const targets = t.assigneeId ? [t.assigneeId] : await agentsForCategory(t.categoryId);
    await notify(targets, {
      type: s.status === 'BREACHED' ? 'SLA_BREACHED' : 'SLA_WARNING',
      title: s.status === 'BREACHED' ? 'SLA vencido' : 'SLA próximo do vencimento',
      message: `${formatTicketNumber(t.number)} — ${t.title}`,
      ticketId: t.id,
    });
    await prisma.ticket.update({ where: { id: t.id }, data: { slaWarningSentAt: new Date() } });
    sent += 1;
  }
  return sent;
}

/** Encerra automaticamente chamados resolvidos há mais de N dias. */
export async function autoCloseJob() {
  const days = Number(await getSetting('tickets.autoCloseDays'));
  if (!days || days <= 0) return 0;
  const limit = new Date(Date.now() - days * 86400000);
  const tickets = await prisma.ticket.findMany({ where: { status: 'RESOLVED', resolvedAt: { lt: limit } } });
  for (const t of tickets) {
    await prisma.$transaction([
      prisma.ticket.update({ where: { id: t.id }, data: { status: 'CLOSED', closedAt: new Date() } }),
      prisma.ticketHistory.create({ data: { ticketId: t.id, action: 'STATUS', field: 'status', fromValue: 'RESOLVED', toValue: 'CLOSED', note: `Encerrado automaticamente após ${days} dia(s) resolvido.` } }),
      prisma.auditLog.create({ data: { action: 'ticket.closed', entity: 'Ticket', entityId: t.id, details: JSON.stringify({ number: t.number, automatic: true }) } }),
    ]);
    await notify([t.requesterId], { type: 'TICKET_CLOSED', title: 'Chamado encerrado', message: `${formatTicketNumber(t.number)} — ${t.title}`, ticketId: t.id });
  }
  return tickets.length;
}

export async function sessionCleanupJob() {
  const { count } = await prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 86400000) } }] } });
  return count;
}

export function startScheduler(intervalSeconds) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await slaWarningJob();
      await autoCloseJob();
      await sessionCleanupJob();
    } catch (err) {
      console.error('[jobs] erro', err.message);
    } finally {
      running = false;
    }
  };
  const handle = setInterval(tick, intervalSeconds * 1000);
  handle.unref();
  setTimeout(tick, 5000).unref();
  return handle;
}
