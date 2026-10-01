import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js';
import { audit, diff } from '../../lib/audit.js';
import { paged, pagination } from '../../lib/http.js';
import { ROLE_KEYS } from '../../lib/constants.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { hashPassword, passwordIssues, revokeUserSessions } from '../auth/auth.service.js';

const router = Router();

const userInclude = {
  role: { select: { id: true, key: true, name: true } },
  teams: { select: { isSupervisor: true, team: { select: { id: true, name: true, categories: { select: { category: { select: { id: true, name: true } } } } } } } },
  categories: { select: { category: { select: { id: true, name: true } } } },
  permissions: { select: { grant: true, permission: { select: { id: true, key: true, name: true } } } },
};

function serialize(u) {
  const { passwordHash, ...rest } = u;
  return {
    ...rest,
    teams: u.teams?.map((t) => ({ id: t.team.id, name: t.team.name, isSupervisor: t.isSupervisor })),
    categories: u.categories?.map((c) => c.category),
    // Categorias efetivas = diretas + herdadas das equipes.
    effectiveCategories: [...new Map([
      ...(u.categories || []).map((c) => [c.category.id, c.category]),
      ...(u.teams || []).flatMap((t) => t.team.categories?.map((tc) => [tc.category.id, tc.category]) || []),
    ]).values()].sort((a, b) => a.name.localeCompare(b.name)),
    permissionOverrides: u.permissions?.map((p) => ({ ...p.permission, grant: p.grant })),
    permissions: undefined,
  };
}

const idList = z.array(z.string().uuid()).max(500);

const userBody = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  login: z.string().trim().toLowerCase().min(3).max(60).regex(/^[a-z0-9._-]+$/, 'Use letras, números, ponto, hífen ou sublinhado'),
  password: z.string().max(200).optional(),
  department: z.string().trim().max(120).nullable().optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  roleId: z.string().uuid(),
  active: z.boolean().optional(),
  categoryIds: idList.optional(),
  teams: z.array(z.object({ teamId: z.string().uuid(), isSupervisor: z.boolean().optional() })).max(100).optional(),
  permissionOverrides: z.array(z.object({ permissionId: z.string().uuid(), grant: z.boolean() })).max(200).optional(),
});

function tempPassword() {
  return `Qsd-${crypto.randomBytes(6).toString('base64url')}9a`;
}

async function assertNotLastAdmin(userId, { nextRoleId, nextActive }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user || user.role.key !== ROLE_KEYS.ADMIN || !user.active) return;
  const losingAdmin = (nextRoleId && nextRoleId !== user.roleId) || nextActive === false;
  if (!losingAdmin) return;
  const admins = await prisma.user.count({ where: { active: true, role: { key: ROLE_KEYS.ADMIN } } });
  if (admins <= 1) throw badRequest('Não é possível remover o último administrador ativo.');
}

async function syncRelations(tx, userId, body) {
  if (body.categoryIds) {
    await tx.userCategory.deleteMany({ where: { userId } });
    if (body.categoryIds.length) {
      await tx.userCategory.createMany({ data: body.categoryIds.map((categoryId) => ({ userId, categoryId })) });
    }
  }
  if (body.teams) {
    await tx.teamMember.deleteMany({ where: { userId } });
    if (body.teams.length) {
      await tx.teamMember.createMany({ data: body.teams.map((t) => ({ userId, teamId: t.teamId, isSupervisor: !!t.isSupervisor })) });
    }
  }
  if (body.permissionOverrides) {
    await tx.userPermission.deleteMany({ where: { userId } });
    if (body.permissionOverrides.length) {
      await tx.userPermission.createMany({ data: body.permissionOverrides.map((p) => ({ userId, permissionId: p.permissionId, grant: p.grant })) });
    }
  }
}

/** Lista resumida de atendentes elegíveis (para atribuição/transferência). */
router.get('/assignable', requirePermission('tickets.assign', 'tickets.transfer', 'tickets.assume'), asyncHandler(async (req, res) => {
  const { categoryId, teamId } = req.query;
  const users = await prisma.user.findMany({
    where: {
      active: true,
      role: { key: { not: ROLE_KEYS.REQUESTER } },
      ...(teamId ? { teams: { some: { teamId: String(teamId) } } } : {}),
      ...(categoryId ? {
        OR: [
          { role: { key: ROLE_KEYS.ADMIN } },
          { categories: { some: { categoryId: String(categoryId) } } },
          { teams: { some: { team: { active: true, categories: { some: { categoryId: String(categoryId) } } } } } },
        ],
      } : {}),
    },
    select: { id: true, name: true, email: true, role: { select: { key: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(users);
}));

router.use(requirePermission('users.manage'));

router.get('/', asyncHandler(async (req, res) => {
  const pg = pagination(req.query);
  const { search, roleId, teamId, status, categoryId } = req.query;
  const where = {
    ...(search ? { OR: ['name', 'email', 'login', 'department'].map((f) => ({ [f]: { contains: String(search) } })) } : {}),
    ...(roleId ? { roleId: String(roleId) } : {}),
    ...(teamId ? { teams: { some: { teamId: String(teamId) } } } : {}),
    ...(categoryId ? { categories: { some: { categoryId: String(categoryId) } } } : {}),
    ...(status === 'active' ? { active: true } : status === 'inactive' ? { active: false } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, include: userInclude, orderBy: { name: 'asc' }, skip: pg.skip, take: pg.take }),
    prisma.user.count({ where }),
  ]);
  res.json(paged(items.map(serialize), total, pg));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: userInclude });
  if (!user) throw notFound('Usuário não encontrado');
  res.json(serialize(user));
}));

router.post('/', validate({ body: userBody }), asyncHandler(async (req, res) => {
  const body = req.body;
  let password = body.password;
  let generated = false;
  if (!password) { password = tempPassword(); generated = true; }
  const issues = passwordIssues(password);
  if (issues.length) throw badRequest(`Senha fraca: ${issues.join(', ')}`);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: body.name, email: body.email, login: body.login,
        department: body.department ?? null, jobTitle: body.jobTitle ?? null, phone: body.phone ?? null,
        roleId: body.roleId, active: body.active ?? true,
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
      },
    });
    await syncRelations(tx, created.id, body);
    return tx.user.findUnique({ where: { id: created.id }, include: userInclude });
  });

  await audit(req, {
    action: 'user.created', entity: 'User', entityId: user.id,
    details: { login: user.login, role: user.role.key, categoryIds: body.categoryIds, teams: body.teams },
  });
  res.status(201).json({ ...serialize(user), ...(generated ? { temporaryPassword: password } : {}) });
}));

router.put('/:id', validate({ body: userBody.partial() }), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const before = await prisma.user.findUnique({ where: { id }, include: userInclude });
  if (!before) throw notFound('Usuário não encontrado');
  const body = req.body;
  if (id === req.user.id && body.active === false) throw badRequest('Você não pode desativar o próprio usuário.');
  await assertNotLastAdmin(id, { nextRoleId: body.roleId, nextActive: body.active });

  const data = {};
  for (const f of ['name', 'email', 'login', 'department', 'jobTitle', 'phone', 'roleId', 'active']) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  if (body.password) {
    const issues = passwordIssues(body.password);
    if (issues.length) throw badRequest(`Senha fraca: ${issues.join(', ')}`);
    data.passwordHash = await hashPassword(body.password);
    data.mustChangePassword = true;
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data });
    await syncRelations(tx, id, body);
    return tx.user.findUnique({ where: { id }, include: userInclude });
  });
  if (body.active === false || body.password) await revokeUserSessions(id);

  const a = serialize(before);
  const b = serialize(user);
  const simplify = (u) => ({
    ...u, role: u.role.key,
    categories: u.categories.map((c) => c.name).sort(),
    teams: u.teams.map((t) => `${t.name}${t.isSupervisor ? ' (supervisor)' : ''}`).sort(),
    permissionOverrides: u.permissionOverrides.map((p) => `${p.grant ? '+' : '-'}${p.key}`).sort(),
  });
  const changes = diff(simplify(a), simplify(b), ['name', 'email', 'login', 'department', 'jobTitle', 'phone', 'role', 'active', 'categories', 'teams', 'permissionOverrides']);
  if (body.password) changes.password = 'alterada';
  const permChanged = ['role', 'categories', 'teams', 'permissionOverrides'].some((k) => changes[k]);
  await audit(req, { action: permChanged ? 'user.permissions_changed' : 'user.updated', entity: 'User', entityId: id, details: changes });
  res.json(b);
}));

router.patch('/:id/status', validate({ body: z.object({ active: z.boolean() }) }), asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id && !req.body.active) throw badRequest('Você não pode desativar o próprio usuário.');
  await assertNotLastAdmin(id, { nextActive: req.body.active });
  const user = await prisma.user.update({ where: { id }, data: { active: req.body.active }, include: userInclude });
  if (!req.body.active) await revokeUserSessions(id);
  await audit(req, { action: req.body.active ? 'user.activated' : 'user.deactivated', entity: 'User', entityId: id });
  res.json(serialize(user));
}));

/** Redefine o acesso: gera senha temporária, força troca e encerra sessões. */
router.post('/:id/reset-access', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const password = tempPassword();
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } });
  await revokeUserSessions(id);
  await audit(req, { action: 'user.access_reset', entity: 'User', entityId: id });
  res.json({ temporaryPassword: password });
}));

export default router;
