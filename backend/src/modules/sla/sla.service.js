import { prisma } from '../../lib/prisma.js';

/** Padrão caso nenhuma política esteja cadastrada. */
export const FALLBACK_SLA = {
  CRITICAL: { firstResponseMinutes: 15, resolutionMinutes: 120, businessDaysOnly: false },
  HIGH: { firstResponseMinutes: 30, resolutionMinutes: 240, businessDaysOnly: false },
  MEDIUM: { firstResponseMinutes: 120, resolutionMinutes: 480, businessDaysOnly: false },
  LOW: { firstResponseMinutes: 240, resolutionMinutes: 2880, businessDaysOnly: true },
};

/** Política aplicável: específica da categoria → global da prioridade → padrão interno. */
export async function resolvePolicy(categoryId, priority) {
  const specific = categoryId
    ? await prisma.slaPolicy.findUnique({ where: { categoryId_priority: { categoryId, priority } } })
    : null;
  if (specific) return specific;
  const global = await prisma.slaPolicy.findFirst({ where: { categoryId: null, priority } });
  return global || FALLBACK_SLA[priority] || FALLBACK_SLA.MEDIUM;
}

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

/** Soma minutos a uma data; com businessDaysOnly, sábados e domingos não contam. */
export function addSlaMinutes(start, minutes, businessDaysOnly = false) {
  if (!businessDaysOnly) return new Date(start.getTime() + minutes * 60000);
  let cursor = new Date(start);
  let remaining = minutes * 60000;
  while (remaining > 0) {
    if (isWeekend(cursor)) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      continue;
    }
    const nextDay = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    const chunk = Math.min(remaining, nextDay - cursor);
    cursor = new Date(cursor.getTime() + chunk);
    remaining -= chunk;
  }
  return cursor;
}

export async function computeDueDates(categoryId, priority, from = new Date()) {
  const p = await resolvePolicy(categoryId, priority);
  return {
    firstResponseDueAt: addSlaMinutes(from, p.firstResponseMinutes, p.businessDaysOnly),
    resolutionDueAt: addSlaMinutes(from, p.resolutionMinutes, p.businessDaysOnly),
    policy: { firstResponseMinutes: p.firstResponseMinutes, resolutionMinutes: p.resolutionMinutes, businessDaysOnly: p.businessDaysOnly },
  };
}

/**
 * Estado visual do SLA:
 *  OK (dentro do prazo) | WARNING (próximo do vencimento) | BREACHED (vencido)
 *  PAUSED (aguardando usuário) | MET (concluído no prazo) | MISSED (concluído fora do prazo)
 */
export function slaState(t, thresholdPercent = 75, now = new Date()) {
  if (!t.resolutionDueAt) return { status: 'NONE' };
  const due = new Date(t.resolutionDueAt);
  const start = new Date(t.createdAt);
  const firstResponse = {
    dueAt: t.firstResponseDueAt,
    respondedAt: t.firstRespondedAt,
    breached: t.firstResponseDueAt
      ? (t.firstRespondedAt ? new Date(t.firstRespondedAt) > new Date(t.firstResponseDueAt) : now > new Date(t.firstResponseDueAt))
      : false,
  };
  const doneAt = t.resolvedAt || t.closedAt;
  if (t.status === 'CANCELLED') return { status: 'NONE', dueAt: due, firstResponse };
  if (doneAt) {
    return { status: new Date(doneAt) <= due ? 'MET' : 'MISSED', dueAt: due, firstResponse, percent: 100 };
  }
  const ref = t.slaPausedAt ? new Date(t.slaPausedAt) : now;
  const total = Math.max(1, due - start);
  const percent = Math.max(0, Math.round(((ref - start) / total) * 100));
  let status = 'OK';
  if (ref > due || firstResponse.breached) status = 'BREACHED';
  else if (percent >= thresholdPercent) status = 'WARNING';
  if (t.slaPausedAt && status !== 'BREACHED') status = 'PAUSED';
  return { status, dueAt: due, percent: Math.min(percent, 100), remainingMs: due - ref, firstResponse };
}
