import { prisma } from '../../lib/prisma.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { getSetting } from '../../lib/settings.js';
import { formatTicketNumber } from '../../lib/http.js';
import { PRIORITY_LABELS, STATUS_LABELS, STATUS_TRANSITIONS } from '../../lib/constants.js';
import { computeDueDates } from '../sla/sla.service.js';
import { agentsForCategory, notify } from '../notifications/notifications.service.js';
import { canView, canWork } from './ticket.access.js';

export const ticketListInclude = {
  category: { select: { id: true, name: true } },
  subcategory: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true, email: true, department: true } },
  assignee: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
};

async function nextNumber(tx) {
  const c = await tx.counter.upsert({
    where: { key: 'ticket' },
    create: { key: 'ticket', value: 1 },
    update: { value: { increment: 1 } },
  });
  return c.value;
}

/** Carrega um chamado garantindo que o usuário pode visualizá-lo (404 caso contrário, sem vazar existência). */
export async function getVisibleTicket(ctx, id) {
  const t = await prisma.ticket.findUnique({ where: { id } });
  if (!t || !canView(ctx, t)) throw notFound('Chamado não encontrado');
  return t;
}

export async function getWorkableTicket(ctx, id, permission) {
  const t = await getVisibleTicket(ctx, id);
  if (!canWork(ctx, t)) throw forbidden('Você não tem permissão para atuar neste chamado.');
  if (permission && !ctx.can(permission)) throw forbidden(`Permissão necessária: ${permission}`);
  if (['CLOSED', 'CANCELLED'].includes(t.status)) throw badRequest('Chamado finalizado não pode ser alterado.');
  return t;
}

export async function addHistory(tx, { ticketId, userId, action, field, fromValue, toValue, note, internal = false }) {
  return tx.ticketHistory.create({
    data: { ticketId, userId, action, field, fromValue: fromValue ?? null, toValue: toValue ?? null, note: note ?? null, internal },
  });
}

const label = (t) => `${formatTicketNumber(t.number)} — ${t.title}`;

export async function createTicket(req, input) {
  const ctx = req.user;
  const category = await prisma.category.findFirst({ where: { id: input.categoryId, active: true } });
  if (!category) throw badRequest('Categoria inválida ou inativa');
  if (input.subcategoryId) {
    const sub = await prisma.subcategory.findFirst({ where: { id: input.subcategoryId, categoryId: category.id, active: true } });
    if (!sub) throw badRequest('Subcategoria inválida para a categoria informada');
  }

  // Abertura em nome de outro usuário (integrações / service desk).
  let requesterId = ctx.id;
  if (input.requesterId && input.requesterId !== ctx.id) {
    if (!ctx.can('tickets.view_all') && !ctx.can('tickets.assign')) throw forbidden('Sem permissão para abrir chamado em nome de outro usuário');
    requesterId = input.requesterId;
  }
  const requester = await prisma.user.findUnique({ where: { id: requesterId } });
  if (!requester?.active) throw badRequest('Solicitante inválido');

  const requesterCanSetPriority = (await getSetting('tickets.requesterCanSetPriority')) === 'true';
  const isStaff = ctx.can('tickets.view_authorized') || ctx.can('tickets.view_all');
  const priority = input.priority && (requesterCanSetPriority || isStaff) ? input.priority : category.defaultPriority;
  const now = new Date();
  const due = await computeDueDates(category.id, priority, now);

  const ticket = await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx);
    const t = await tx.ticket.create({
      data: {
        number,
        title: input.title,
        description: input.description,
        categoryId: category.id,
        subcategoryId: input.subcategoryId || null,
        priority,
        status: 'OPEN',
        source: input.source || 'PORTAL',
        location: input.location || null,
        department: input.department || requester.department || null,
        requesterId,
        teamId: category.teamId,
        firstResponseDueAt: due.firstResponseDueAt,
        resolutionDueAt: due.resolutionDueAt,
        aiMetadata: input.aiMetadata ? JSON.stringify(input.aiMetadata) : null,
      },
    });
    await addHistory(tx, {
      ticketId: t.id, userId: ctx.id, action: 'CREATED', toValue: 'OPEN',
      note: `Chamado aberto via ${t.source}. SLA: 1ª resposta ${due.policy.firstResponseMinutes} min, resolução ${due.policy.resolutionMinutes} min${due.policy.businessDaysOnly ? ' (dias úteis)' : ''}.`,
    });
    return t;
  });

  await audit(req, { action: 'ticket.created', entity: 'Ticket', entityId: ticket.id, details: { number: ticket.number, categoryId: ticket.categoryId, priority, source: ticket.source } });
  await notify([requesterId], { type: 'TICKET_CREATED', title: 'Chamado aberto', message: `Seu chamado ${label(ticket)} foi registrado.`, ticketId: ticket.id });
  await notify(await agentsForCategory(category.id), {
    type: 'QUEUE_NEW', title: 'Novo chamado na fila',
    message: `${label(ticket)} — ${category.name} · Prioridade ${PRIORITY_LABELS[priority]}`, ticketId: ticket.id, excludeUserId: ctx.id,
  });
  return ticket;
}

/** Aplica efeitos colaterais de mudança de status (SLA, datas) e retorna o objeto data. */
async function statusSideEffects(t, to, actorId, isStaff) {
  const now = new Date();
  const data = { status: to };
  const pauseEnabled = (await getSetting('sla.pauseOnWaitingUser')) === 'true';

  if (to === 'WAITING_USER' && pauseEnabled && !t.slaPausedAt) data.slaPausedAt = now;
  if (t.status === 'WAITING_USER' && t.slaPausedAt && to !== 'WAITING_USER') {
    const pausedMs = now - new Date(t.slaPausedAt);
    data.slaPausedAt = null;
    if (t.resolutionDueAt) data.resolutionDueAt = new Date(new Date(t.resolutionDueAt).getTime() + pausedMs);
    if (t.firstResponseDueAt && !t.firstRespondedAt) data.firstResponseDueAt = new Date(new Date(t.firstResponseDueAt).getTime() + pausedMs);
  }
  if (['VALIDATION', 'RESOLVED'].includes(to) && !t.resolvedAt) data.resolvedAt = now;
  if (to === 'IN_PROGRESS' && t.resolvedAt) data.resolvedAt = null;
  if (to === 'CLOSED') data.closedAt = now;
  if (to === 'CANCELLED') data.cancelledAt = now;
  if (isStaff && !t.firstRespondedAt) data.firstRespondedAt = now;
  if (isStaff && to === 'IN_PROGRESS' && !t.assigneeId) data.assigneeId = actorId;
  return data;
}

export async function changeStatus(req, t, to, note, { asRequester = false } = {}) {
  const ctx = req.user;
  if (!asRequester && !STATUS_TRANSITIONS[t.status]?.includes(to)) {
    throw badRequest(`Transição inválida: ${STATUS_LABELS[t.status]} → ${STATUS_LABELS[to] || to}`);
  }
  const data = await statusSideEffects(t, to, ctx.id, !asRequester);
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.ticket.update({ where: { id: t.id }, data });
    await addHistory(tx, { ticketId: t.id, userId: ctx.id, action: 'STATUS', field: 'status', fromValue: t.status, toValue: to, note });
    if (data.assigneeId && data.assigneeId !== t.assigneeId) {
      await addHistory(tx, { ticketId: t.id, userId: ctx.id, action: 'ASSIGNEE', field: 'assigneeId', fromValue: null, toValue: ctx.name });
    }
    if (note && !asRequester) {
      await tx.ticketMessage.create({ data: { ticketId: t.id, authorId: ctx.id, type: 'PUBLIC', body: note } });
    }
    return u;
  });

  const action = to === 'CLOSED' ? 'ticket.closed' : to === 'CANCELLED' ? 'ticket.cancelled' : 'ticket.status_changed';
  await audit(req, { action, entity: 'Ticket', entityId: t.id, details: { number: t.number, from: t.status, to, note } });

  const typeMap = { RESOLVED: 'TICKET_RESOLVED', CLOSED: 'TICKET_CLOSED', VALIDATION: 'TICKET_VALIDATION' };
  const titleMap = { RESOLVED: 'Chamado resolvido', CLOSED: 'Chamado encerrado', VALIDATION: 'Solução aguardando sua validação', WAITING_USER: 'Chamado aguardando sua resposta' };
  if (asRequester) {
    await notify([updated.assigneeId], {
      type: 'REQUESTER_ACTION', title: 'Ação do solicitante',
      message: `${label(t)}: ${STATUS_LABELS[t.status]} → ${STATUS_LABELS[to]}${note ? ` — "${note}"` : ''}`, ticketId: t.id, excludeUserId: ctx.id,
    });
  } else {
    await notify([t.requesterId], {
      type: typeMap[to] || 'STATUS_CHANGED', title: titleMap[to] || 'Status do chamado alterado',
      message: `${label(t)}: ${STATUS_LABELS[t.status]} → ${STATUS_LABELS[to]}`, ticketId: t.id, excludeUserId: ctx.id,
    });
  }
  return updated;
}

export async function updatePriority(req, t, priority, note) {
  if (t.priority === priority) return t;
  const due = await computeDueDates(t.categoryId, priority, new Date(t.createdAt));
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.ticket.update({
      where: { id: t.id },
      data: { priority, firstResponseDueAt: due.firstResponseDueAt, resolutionDueAt: due.resolutionDueAt, slaWarningSentAt: null },
    });
    await addHistory(tx, { ticketId: t.id, userId: req.user.id, action: 'PRIORITY', field: 'priority', fromValue: t.priority, toValue: priority, note });
    return u;
  });
  await audit(req, { action: 'ticket.priority_changed', entity: 'Ticket', entityId: t.id, details: { number: t.number, from: t.priority, to: priority, note } });
  return updated;
}

/** Verifica se um usuário pode receber chamados da categoria. */
export async function assertAssignable(userId, categoryId) {
  const { loadAccessContext } = await import('../../lib/access.js');
  const target = await loadAccessContext(userId);
  if (!target || !target.active) throw badRequest('Atendente inválido ou inativo');
  if (!target.can('tickets.view_all') && !(target.can('tickets.view_authorized') && target.categoryIds.includes(categoryId))) {
    throw badRequest(`${target.name} não possui permissão para a categoria deste chamado.`);
  }
  return target;
}

export async function assign(req, t, assigneeId, note) {
  const target = assigneeId ? await assertAssignable(assigneeId, t.categoryId) : null;
  const prev = t.assigneeId ? await prisma.user.findUnique({ where: { id: t.assigneeId }, select: { name: true } }) : null;
  const updated = await prisma.$transaction(async (tx) => {
    const data = { assigneeId: target?.id ?? null };
    if (target && ['OPEN', 'TRIAGE'].includes(t.status)) data.status = 'IN_PROGRESS';
    const u = await tx.ticket.update({ where: { id: t.id }, data });
    await addHistory(tx, { ticketId: t.id, userId: req.user.id, action: 'ASSIGNEE', field: 'assigneeId', fromValue: prev?.name, toValue: target?.name ?? 'Sem responsável', note });
    if (data.status) await addHistory(tx, { ticketId: t.id, userId: req.user.id, action: 'STATUS', field: 'status', fromValue: t.status, toValue: data.status });
    return u;
  });
  await audit(req, { action: 'ticket.assigned', entity: 'Ticket', entityId: t.id, details: { number: t.number, from: prev?.name ?? null, to: target?.name ?? null, note } });
  if (target) {
    await notify([target.id], { type: 'TICKET_ASSIGNED', title: 'Chamado atribuído a você', message: label(t), ticketId: t.id, excludeUserId: req.user.id });
    await notify([t.requesterId], { type: 'TICKET_ASSUMED', title: 'Chamado em atendimento', message: `${label(t)} está com ${target.name}.`, ticketId: t.id, excludeUserId: req.user.id });
  }
  return updated;
}
