import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, notFound } from '../../lib/errors.js';
import { audit, diff } from '../../lib/audit.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

const router = Router();

const teamInclude = {
  leader: { select: { id: true, name: true } },
  members: { select: { isSupervisor: true, user: { select: { id: true, name: true, email: true, active: true, role: { select: { key: true, name: true } } } } } },
  categories: { select: { category: { select: { id: true, name: true } } } },
  _count: { select: { tickets: true } },
};
const serialize = (t) => ({
  ...t,
  members: t.members.map((m) => ({ ...m.user, isSupervisor: m.isSupervisor })),
  categories: t.categories.map((c) => c.category),
  ticketCount: t._count?.tickets ?? 0,
  _count: undefined,
});

const body = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal('').transform(() => null)),
  active: z.boolean().optional(),
  leaderId: z.string().uuid().nullable().optional(),
  categoryIds: z.array(z.string().uuid()).max(500).optional(),
  members: z.array(z.object({ userId: z.string().uuid(), isSupervisor: z.boolean().optional() })).max(1000).optional(),
});

// Lista resumida, disponível a quem atende/transfere chamados (para filtros e transferência).
router.get('/', requirePermission('teams.manage', 'tickets.view_authorized', 'tickets.view_team', 'tickets.transfer', 'users.manage', 'categories.manage'), asyncHandler(async (req, res) => {
  const full = req.user.can('teams.manage') || req.user.can('users.manage');
  const teams = await prisma.team.findMany({ include: full ? teamInclude : undefined, orderBy: { name: 'asc' } });
  res.json(full ? teams.map(serialize) : teams.map(({ id, name, active }) => ({ id, name, active })));
}));

router.get('/:id', requirePermission('teams.manage'), asyncHandler(async (req, res) => {
  const team = await prisma.team.findUnique({ where: { id: req.params.id }, include: teamInclude });
  if (!team) throw notFound('Equipe não encontrada');
  res.json(serialize(team));
}));

async function sync(tx, teamId, b) {
  if (b.categoryIds) {
    await tx.teamCategory.deleteMany({ where: { teamId } });
    if (b.categoryIds.length) await tx.teamCategory.createMany({ data: b.categoryIds.map((categoryId) => ({ teamId, categoryId })) });
  }
  if (b.members) {
    await tx.teamMember.deleteMany({ where: { teamId } });
    if (b.members.length) await tx.teamMember.createMany({ data: b.members.map((m) => ({ teamId, userId: m.userId, isSupervisor: !!m.isSupervisor })) });
  }
}

router.post('/', requirePermission('teams.manage'), validate({ body }), asyncHandler(async (req, res) => {
  const { categoryIds, members, ...data } = req.body;
  const team = await prisma.$transaction(async (tx) => {
    const t = await tx.team.create({ data });
    await sync(tx, t.id, { categoryIds, members });
    return tx.team.findUnique({ where: { id: t.id }, include: teamInclude });
  });
  await audit(req, { action: 'team.created', entity: 'Team', entityId: team.id, details: { name: team.name, categoryIds, members } });
  res.status(201).json(serialize(team));
}));

router.put('/:id', requirePermission('teams.manage'), validate({ body: body.partial() }), asyncHandler(async (req, res) => {
  const before = await prisma.team.findUnique({ where: { id: req.params.id }, include: teamInclude });
  if (!before) throw notFound('Equipe não encontrada');
  const { categoryIds, members, ...data } = req.body;
  const team = await prisma.$transaction(async (tx) => {
    await tx.team.update({ where: { id: before.id }, data });
    await sync(tx, before.id, { categoryIds, members });
    return tx.team.findUnique({ where: { id: before.id }, include: teamInclude });
  });
  const simplify = (t) => {
    const s = serialize(t);
    return { ...s, categories: s.categories.map((c) => c.name).sort(), members: s.members.map((m) => `${m.name}${m.isSupervisor ? ' (supervisor)' : ''}`).sort() };
  };
  await audit(req, {
    action: 'team.updated', entity: 'Team', entityId: team.id,
    details: diff(simplify(before), simplify(team), ['name', 'description', 'email', 'active', 'leaderId', 'categories', 'members']),
  });
  res.json(serialize(team));
}));

router.delete('/:id', requirePermission('teams.manage'), asyncHandler(async (req, res) => {
  const team = await prisma.team.update({ where: { id: req.params.id }, data: { active: false } });
  await audit(req, { action: 'team.deactivated', entity: 'Team', entityId: team.id, details: { name: team.name } });
  res.status(204).end();
}));

export default router;
