import fs from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { getSetting } from '../../lib/settings.js';
import { formatTicketNumber, paged, pagination } from '../../lib/http.js';
import { ACTIVE_STATUSES, PRIORITIES, STATUS_TRANSITIONS, TICKET_SOURCES, TICKET_STATUS } from '../../lib/constants.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { upload, removeFile, resolveFile } from '../../integrations/storage/index.js';
import { computeDueDates, slaState } from '../sla/sla.service.js';
import { agentsForCategory, notify } from '../notifications/notifications.service.js';
import { canSeeInternal, canWork, ticketCapabilities, visibilityWhere } from './ticket.access.js';
import {
  addHistory, assertAssignable, assign, changeStatus, createTicket, getVisibleTicket, getWorkableTicket,
  ticketListInclude, updatePriority,
} from './tickets.service.js';

const router = Router();
const STATUSES = Object.keys(TICKET_STATUS);
const note = z.string().trim().max(5000).optional().nullable();
const label = (t) => `${formatTicketNumber(t.number)} — ${t.title}`;

async function withSla(tickets) {
  const threshold = Number(await getSetting('sla.warningThresholdPercent')) || 75;
  return tickets.map((t) => ({ ...t, code: formatTicketNumber(t.number), sla: slaState(t, threshold) }));
}

// ---------------------------------------------------------------------------
// Listagem com filtros
// ---------------------------------------------------------------------------
const listQuery = z.object({
  view: z.enum(['all', 'queue', 'mine', 'requested', 'waiting', 'waiting_me', 'in_progress', 'resolved', 'open']).optional(),
  q: z.string().max(200).optional(),
  number: z.string().max(20).optional(),
  status: z.string().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  priority: z.string().max(100).optional(),
  requesterId: z.string().uuid().optional(),
  requester: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  assigneeId: z.string().max(40).optional(),
  teamId: z.string().uuid().optional(),
  dateFrom: z.string().max(30).optional(),
  dateTo: z.string().max(30).optional(),
  sla: z.enum(['OK', 'WARNING', 'BREACHED', 'PAUSED', 'MET', 'MISSED']).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'priority', 'resolutionDueAt', 'number']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

function buildWhere(ctx, f) {
  const and = [visibilityWhere(ctx)];
  switch (f.view) {
    case 'queue': and.push({ assigneeId: null, status: { in: ['OPEN', 'TRIAGE'] } });
      // A fila mostra somente categorias autorizadas (ou tudo para quem vê todos).
      if (!ctx.can('tickets.view_all')) and.push({ OR: [{ categoryId: { in: ctx.categoryIds } }, ...(ctx.can('tickets.view_team') && ctx.teamIds.length ? [{ teamId: { in: ctx.teamIds } }] : [])] });
      break;
    case 'mine': and.push({ assigneeId: ctx.id, status: { notIn: ['CLOSED', 'CANCELLED'] } }); break;
    case 'requested': and.push({ requesterId: ctx.id }); break;
    case 'waiting': and.push({ status: 'WAITING_USER' }); break;
    case 'waiting_me': and.push({ requesterId: ctx.id, status: { in: ['WAITING_USER', 'VALIDATION'] } }); break;
    case 'in_progress': and.push({ status: 'IN_PROGRESS' }); break;
    case 'resolved': and.push({ status: { in: ['VALIDATION', 'RESOLVED'] } }); break;
    case 'open': and.push({ status: { in: ACTIVE_STATUSES } }); break;
    default: break;
  }
  if (f.q) {
    const n = parseInt(f.q.replace(/\D/g, ''), 10);
    and.push({ OR: [{ title: { contains: f.q } }, { description: { contains: f.q } }, ...(n ? [{ number: n }] : [])] });
  }
  if (f.number) {
    const n = parseInt(f.number.replace(/\D/g, ''), 10);
    if (n) and.push({ number: n });
  }
  if (f.status) and.push({ status: { in: f.status.split(',').filter((s) => STATUSES.includes(s)) } });
  if (f.priority) and.push({ priority: { in: f.priority.split(',').filter((p) => PRIORITIES.includes(p)) } });
  if (f.categoryId) and.push({ categoryId: f.categoryId });
  if (f.subcategoryId) and.push({ subcategoryId: f.subcategoryId });
  if (f.requesterId) and.push({ requesterId: f.requesterId });
  if (f.requester) and.push({ requester: { OR: [{ name: { contains: f.requester } }, { email: { contains: f.requester } }] } });
  if (f.department) and.push({ department: { contains: f.department } });
  if (f.assigneeId) and.push({ assigneeId: f.assigneeId === 'none' ? null : f.assigneeId });
  if (f.teamId) and.push({ teamId: f.teamId });
  if (f.dateFrom) { const d = new Date(f.dateFrom); if (!isNaN(d)) and.push({ createdAt: { gte: d } }); }
  if (f.dateTo) { const d = new Date(f.dateTo); if (!isNaN(d)) { d.setHours(23, 59, 59, 999); and.push({ createdAt: { lte: d } }); } }
  return { AND: and };
}

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const f = req.validQuery;
  const pg = pagination(f);
  const where = buildWhere(req.user, f);
  const orderBy = { [f.sort || 'createdAt']: f.order || 'desc' };

  if (f.sla) {
    // SLA é calculado em tempo real: filtra em memória (limitado) e pagina depois.
    const all = await withSla(await prisma.ticket.findMany({ where, include: ticketListInclude, orderBy, take: 5000 }));
    const filtered = all.filter((t) => t.sla.status === f.sla);
    return res.json(paged(filtered.slice(pg.skip, pg.skip + pg.take), filtered.length, pg));
  }

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({ where, include: ticketListInclude, orderBy, skip: pg.skip, take: pg.take }),
    prisma.ticket.count({ where }),
  ]);
  res.json(paged(await withSla(items), total, pg));
}));

/** Contadores para o menu/painel do usuário atual. */
router.get('/counters', asyncHandler(async (req, res) => {
  const ctx = req.user;
  const views = ['queue', 'mine', 'requested', 'waiting', 'waiting_me', 'in_progress', 'resolved', 'open', 'all'];
  const entries = await Promise.all(views.map(async (v) => [v, await prisma.ticket.count({ where: buildWhere(ctx, { view: v }) })]));
  res.json(Object.fromEntries(entries));
}));

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------
const createBody = z.object({
  title: z.string().trim().min(5, 'Título muito curto').max(200),
  description: z.string().trim().min(10, 'Descreva melhor o problema').max(20000),
  categoryId: z.string().uuid(),
  subcategoryId: z.string().uuid().nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  location: z.string().trim().max(160).nullable().optional(),
  department: z.string().trim().max(120).nullable().optional(),
  source: z.enum(TICKET_SOURCES).optional(),
  requesterId: z.string().uuid().optional(),
  aiMetadata: z.record(z.any()).optional(),
});

router.post('/', requirePermission('tickets.create'), validate({ body: createBody }), asyncHandler(async (req, res) => {
  const ticket = await createTicket(req, req.body);
  res.status(201).json({ ...ticket, code: formatTicketNumber(ticket.number) });
}));

// ---------------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------------
router.get('/:id', asyncHandler(async (req, res) => {
  const base = await getVisibleTicket(req.user, req.params.id);
  const internal = canSeeInternal(req.user, base);
  const t = await prisma.ticket.findUnique({
    where: { id: base.id },
    include: {
      ...ticketListInclude,
      messages: {
        where: internal ? {} : { type: { not: 'INTERNAL' } },
        include: { author: { select: { id: true, name: true } }, attachments: { where: internal ? {} : { internal: false } } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: {
        where: internal ? {} : { internal: false },
        include: { uploader: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      history: {
        where: internal ? {} : { internal: false },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  const [withState] = await withSla([t]);
  res.json({
    ...withState,
    aiMetadata: internal && t.aiMetadata ? JSON.parse(t.aiMetadata) : undefined,
    capabilities: ticketCapabilities(req.user, t),
    allowedStatuses: canWork(req.user, t) ? STATUS_TRANSITIONS[t.status] : [],
  });
}));

// ---------------------------------------------------------------------------
// Interação
// ---------------------------------------------------------------------------
router.post('/:id/messages', validate({
  body: z.object({ body: z.string().trim().min(1).max(20000), type: z.enum(['PUBLIC', 'INTERNAL']).default('PUBLIC') }),
}), asyncHandler(async (req, res) => {
  const ctx = req.user;
  const t = await getVisibleTicket(ctx, req.params.id);
  if (['CLOSED', 'CANCELLED'].includes(t.status)) throw badRequest('Chamado finalizado não aceita novas mensagens.');
  const work = canWork(ctx, t);
  const { body, type } = req.body;

  if (type === 'INTERNAL' && !(work && ctx.can('tickets.internal_notes'))) throw forbidden('Sem permissão para notas internas');
  if (!work && !(t.requesterId === ctx.id && ctx.can('tickets.reply'))) throw forbidden('Sem permissão para responder este chamado');

  const message = await prisma.$transaction(async (tx) => {
    const m = await tx.ticketMessage.create({ data: { ticketId: t.id, authorId: ctx.id, type, body }, include: { author: { select: { id: true, name: true } } } });
    const data = {};
    if (work && type === 'PUBLIC' && !t.firstRespondedAt && t.requesterId !== ctx.id) data.firstRespondedAt = new Date();
    // Resposta do solicitante retoma o atendimento e o SLA.
    if (!work && t.status === 'WAITING_USER') {
      data.status = 'IN_PROGRESS';
      if (t.slaPausedAt) {
        const paused = Date.now() - new Date(t.slaPausedAt);
        data.slaPausedAt = null;
        data.resolutionDueAt = new Date(new Date(t.resolutionDueAt).getTime() + paused);
      }
      await addHistory(tx, { ticketId: t.id, userId: ctx.id, action: 'STATUS', field: 'status', fromValue: t.status, toValue: 'IN_PROGRESS', note: 'Retomado após resposta do solicitante' });
    }
    if (Object.keys(data).length) await tx.ticket.update({ where: { id: t.id }, data });
    else await tx.ticket.update({ where: { id: t.id }, data: { updatedAt: new Date() } });
    return m;
  });

  await audit(req, { action: type === 'INTERNAL' ? 'ticket.internal_note' : 'ticket.message', entity: 'Ticket', entityId: t.id, details: { number: t.number, messageId: message.id } });
  if (type === 'PUBLIC') {
    if (t.requesterId === ctx.id) {
      const targets = t.assigneeId ? [t.assigneeId] : await agentsForCategory(t.categoryId);
      await notify(targets, { type: 'REQUESTER_REPLY', title: 'Solicitante respondeu', message: label(t), ticketId: t.id, excludeUserId: ctx.id });
    } else {
      await notify([t.requesterId], { type: 'TICKET_REPLY', title: 'Nova resposta no seu chamado', message: label(t), ticketId: t.id, excludeUserId: ctx.id });
    }
  }
  res.status(201).json(message);
}));

router.post('/:id/attachments', upload.array('files', 10), asyncHandler(async (req, res) => {
  const ctx = req.user;
  const files = req.files || [];
  try {
    const t = await getVisibleTicket(ctx, req.params.id);
    if (!files.length) throw badRequest('Nenhum arquivo enviado');
    if (['CLOSED', 'CANCELLED'].includes(t.status)) throw badRequest('Chamado finalizado não aceita anexos.');
    const internal = req.body.internal === 'true';
    if (internal && !canSeeInternal(ctx, t)) throw forbidden('Sem permissão para anexos internos');
    let messageId = req.body.messageId || null;
    if (messageId) {
      const m = await prisma.ticketMessage.findFirst({ where: { id: messageId, ticketId: t.id, authorId: ctx.id } });
      if (!m) messageId = null;
    }
    const created = await prisma.$transaction(files.map((f) => prisma.ticketAttachment.create({
      data: {
        ticketId: t.id, messageId, uploaderId: ctx.id, internal,
        originalName: Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 255),
        storedName: f.filename, mimeType: f.mimetype, size: f.size,
      },
    })));
    await prisma.$transaction(created.map((a) => prisma.ticketHistory.create({
      data: { ticketId: t.id, userId: ctx.id, action: 'ATTACHMENT', toValue: a.originalName, internal },
    })));
    await audit(req, { action: 'ticket.attachment_added', entity: 'Ticket', entityId: t.id, details: { files: created.map((a) => a.originalName), internal } });
    res.status(201).json(created);
  } catch (err) {
    files.forEach((f) => removeFile(f.filename));
    throw err;
  }
}));

router.get('/:id/attachments/:attachmentId/download', asyncHandler(async (req, res) => {
  const t = await getVisibleTicket(req.user, req.params.id);
  const a = await prisma.ticketAttachment.findFirst({ where: { id: req.params.attachmentId, ticketId: t.id } });
  if (!a || (a.internal && !canSeeInternal(req.user, t))) throw notFound('Anexo não encontrado');
  const file = resolveFile(a.storedName);
  if (!file || !fs.existsSync(file)) throw notFound('Arquivo não encontrado no armazenamento');
  res.setHeader('Content-Type', a.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(file, a.originalName);
}));

// ---------------------------------------------------------------------------
// Ações da equipe de atendimento
// ---------------------------------------------------------------------------
router.patch('/:id/status', validate({ body: z.object({ status: z.enum(STATUSES), note }) }), asyncHandler(async (req, res) => {
  const t = await getWorkableTicket(req.user, req.params.id, 'tickets.change_status');
  res.json(await changeStatus(req, t, req.body.status, req.body.note));
}));

router.patch('/:id/priority', validate({ body: z.object({ priority: z.enum(PRIORITIES), note }) }), asyncHandler(async (req, res) => {
  const t = await getWorkableTicket(req.user, req.params.id, 'tickets.change_priority');
  res.json(await updatePriority(req, t, req.body.priority, req.body.note));
}));

router.post('/:id/assume', asyncHandler(async (req, res) => {
  const t = await getWorkableTicket(req.user, req.params.id, 'tickets.assume');
  if (t.assigneeId === req.user.id) throw badRequest('Você já é o responsável por este chamado.');
  const updated = await assign(req, t, req.user.id, 'Chamado assumido');
  if (!t.firstRespondedAt) await prisma.ticket.update({ where: { id: t.id }, data: { firstRespondedAt: new Date() } });
  res.json(updated);
}));

router.patch('/:id/assign', validate({ body: z.object({ assigneeId: z.string().uuid().nullable(), note }) }), asyncHandler(async (req, res) => {
  const t = await getWorkableTicket(req.user, req.params.id, 'tickets.assign');
  res.json(await assign(req, t, req.body.assigneeId, req.body.note));
}));

router.patch('/:id/transfer', validate({
  body: z.object({ teamId: z.string().uuid(), assigneeId: z.string().uuid().nullable().optional(), note }),
}), asyncHandler(async (req, res) => {
  const t = await getWorkableTicket(req.user, req.params.id, 'tickets.transfer');
  const team = await prisma.team.findFirst({ where: { id: req.body.teamId, active: true }, include: { members: true } });
  if (!team) throw badRequest('Equipe inválida ou inativa');
  let assignee = null;
  if (req.body.assigneeId) {
    if (!team.members.some((m) => m.userId === req.body.assigneeId)) throw badRequest('O atendente não pertence à equipe de destino.');
    assignee = await assertAssignable(req.body.assigneeId, t.categoryId);
  }
  const fromTeam = t.teamId ? await prisma.team.findUnique({ where: { id: t.teamId }, select: { name: true } }) : null;
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.ticket.update({ where: { id: t.id }, data: { teamId: team.id, assigneeId: assignee?.id ?? null } });
    await addHistory(tx, { ticketId: t.id, userId: req.user.id, action: 'TRANSFER', field: 'teamId', fromValue: fromTeam?.name, toValue: team.name, note: req.body.note });
    if (assignee?.id !== t.assigneeId) {
      await addHistory(tx, { ticketId: t.id, userId: req.user.id, action: 'ASSIGNEE', field: 'assigneeId', toValue: assignee?.name ?? 'Sem responsável' });
    }
    if (req.body.note) await tx.ticketMessage.create({ data: { ticketId: t.id, authorId: req.user.id, type: 'INTERNAL', body: `Transferência para ${team.name}: ${req.body.note}` } });
    return u;
  });
  await audit(req, { action: 'ticket.transferred', entity: 'Ticket', entityId: t.id, details: { number: t.number, from: fromTeam?.name ?? null, to: team.name, assignee: assignee?.name ?? null, note: req.body.note } });
  const targets = assignee ? [assignee.id] : team.members.map((m) => m.userId);
  await notify(targets, { type: 'TICKET_TRANSFERRED', title: `Chamado transferido para ${team.name}`, message: label(t), ticketId: t.id, excludeUserId: req.user.id });
  res.json(updated);
}));

router.patch('/:id/category', validate({
  body: z.object({ categoryId: z.string().uuid(), subcategoryId: z.string().uuid().nullable().optional(), note }),
}), asyncHandler(async (req, res) => {
  const t = await getWorkableTicket(req.user, req.params.id, 'tickets.change_category');
  const cat = await prisma.category.findFirst({ where: { id: req.body.categoryId, active: true } });
  if (!cat) throw badRequest('Categoria inválida');
  if (req.body.subcategoryId) {
    const sub = await prisma.subcategory.findFirst({ where: { id: req.body.subcategoryId, categoryId: cat.id } });
    if (!sub) throw badRequest('Subcategoria inválida para a categoria');
  }
  const prev = await prisma.category.findUnique({ where: { id: t.categoryId }, select: { name: true } });
  const due = await computeDueDates(cat.id, t.priority, new Date(t.createdAt));
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.ticket.update({
      where: { id: t.id },
      data: {
        categoryId: cat.id, subcategoryId: req.body.subcategoryId ?? null,
        teamId: cat.teamId ?? t.teamId,
        firstResponseDueAt: due.firstResponseDueAt, resolutionDueAt: due.resolutionDueAt,
      },
    });
    await addHistory(tx, { ticketId: t.id, userId: req.user.id, action: 'CATEGORY', field: 'categoryId', fromValue: prev?.name, toValue: cat.name, note: req.body.note });
    return u;
  });
  await audit(req, { action: 'ticket.category_changed', entity: 'Ticket', entityId: t.id, details: { number: t.number, from: prev?.name, to: cat.name, note: req.body.note } });
  await notify(await agentsForCategory(cat.id), { type: 'QUEUE_NEW', title: 'Chamado recategorizado para sua fila', message: `${label(t)} → ${cat.name}`, ticketId: t.id, excludeUserId: req.user.id });
  res.json(updated);
}));

// ---------------------------------------------------------------------------
// Ações do solicitante
// ---------------------------------------------------------------------------
router.post('/:id/requester-action', validate({
  body: z.object({ action: z.enum(['cancel', 'approve', 'reject', 'close', 'reopen']), note }),
}), asyncHandler(async (req, res) => {
  const t = await getVisibleTicket(req.user, req.params.id);
  if (t.requesterId !== req.user.id) throw forbidden('Somente o solicitante pode executar esta ação.');
  const rules = {
    cancel: { from: ['OPEN', 'TRIAGE'], to: 'CANCELLED' },
    approve: { from: ['VALIDATION'], to: 'RESOLVED' },
    reject: { from: ['VALIDATION', 'RESOLVED'], to: 'IN_PROGRESS' },
    close: { from: ['RESOLVED'], to: 'CLOSED' },
    reopen: { from: ['RESOLVED'], to: 'IN_PROGRESS' },
  };
  const rule = rules[req.body.action];
  if (!rule.from.includes(t.status)) throw badRequest('Ação indisponível para o status atual do chamado.');
  if (req.body.note) {
    await prisma.ticketMessage.create({ data: { ticketId: t.id, authorId: req.user.id, type: 'PUBLIC', body: req.body.note } });
  }
  res.json(await changeStatus(req, t, rule.to, req.body.note, { asRequester: true }));
}));

router.post('/:id/rating', requirePermission('tickets.rate'), validate({
  body: z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(2000).optional().nullable() }),
}), asyncHandler(async (req, res) => {
  const t = await getVisibleTicket(req.user, req.params.id);
  if (t.requesterId !== req.user.id) throw forbidden('Somente o solicitante pode avaliar.');
  if (!['RESOLVED', 'CLOSED'].includes(t.status)) throw badRequest('Avaliação disponível após a resolução.');
  if (t.rating != null) throw badRequest('Este chamado já foi avaliado.');
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.ticket.update({ where: { id: t.id }, data: { rating: req.body.rating, ratingComment: req.body.comment ?? null } });
    await addHistory(tx, { ticketId: t.id, userId: req.user.id, action: 'RATING', toValue: String(req.body.rating), note: req.body.comment });
    return u;
  });
  await audit(req, { action: 'ticket.rated', entity: 'Ticket', entityId: t.id, details: { number: t.number, rating: req.body.rating } });
  await notify([t.assigneeId], { type: 'TICKET_RATED', title: `Atendimento avaliado: ${req.body.rating}/5`, message: label(t), ticketId: t.id });
  res.json(updated);
}));

export default router;
