import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { ROLE_KEYS } from '../../lib/constants.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

export const rolesRouter = Router();
export const permissionsRouter = Router();

const roleInclude = {
  permissions: { select: { permission: { select: { id: true, key: true, name: true, module: true } } } },
  _count: { select: { users: true } },
};
const serialize = (r) => ({
  ...r,
  permissions: r.permissions.map((p) => p.permission),
  userCount: r._count?.users ?? 0,
  _count: undefined,
});

permissionsRouter.get('/', requirePermission('permissions.manage', 'users.manage'), asyncHandler(async (_req, res) => {
  const items = await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { key: 'asc' }] });
  res.json(items);
}));

rolesRouter.get('/', requirePermission('permissions.manage', 'users.manage'), asyncHandler(async (_req, res) => {
  const roles = await prisma.role.findMany({ include: roleInclude, orderBy: { createdAt: 'asc' } });
  res.json(roles.map(serialize));
}));

const roleBody = z.object({
  key: z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9_]+$/),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(255).nullable().optional(),
  permissionIds: z.array(z.string().uuid()).max(500).optional(),
});

rolesRouter.post('/', requirePermission('permissions.manage'), validate({ body: roleBody }), asyncHandler(async (req, res) => {
  const { permissionIds = [], ...data } = req.body;
  const role = await prisma.role.create({
    data: { ...data, permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) } },
    include: roleInclude,
  });
  await audit(req, { action: 'role.created', entity: 'Role', entityId: role.id, details: { key: role.key, permissions: role.permissions.map((p) => p.permission.key) } });
  res.status(201).json(serialize(role));
}));

rolesRouter.put('/:id', requirePermission('permissions.manage'), validate({ body: roleBody.omit({ key: true }).partial() }), asyncHandler(async (req, res) => {
  const before = await prisma.role.findUnique({ where: { id: req.params.id }, include: roleInclude });
  if (!before) throw notFound('Perfil não encontrado');
  const { permissionIds, ...data } = req.body;
  if (before.key === ROLE_KEYS.ADMIN && permissionIds) throw badRequest('O perfil Administrador sempre possui acesso total.');

  const role = await prisma.$transaction(async (tx) => {
    await tx.role.update({ where: { id: before.id }, data });
    if (permissionIds) {
      await tx.rolePermission.deleteMany({ where: { roleId: before.id } });
      if (permissionIds.length) await tx.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId: before.id, permissionId })) });
    }
    return tx.role.findUnique({ where: { id: before.id }, include: roleInclude });
  });

  const oldKeys = before.permissions.map((p) => p.permission.key);
  const newKeys = role.permissions.map((p) => p.permission.key);
  await audit(req, {
    action: 'role.permissions_changed', entity: 'Role', entityId: role.id,
    details: {
      role: role.key,
      added: newKeys.filter((k) => !oldKeys.includes(k)),
      removed: oldKeys.filter((k) => !newKeys.includes(k)),
      ...(data.name && data.name !== before.name ? { name: { from: before.name, to: data.name } } : {}),
    },
  });
  res.json(serialize(role));
}));

rolesRouter.delete('/:id', requirePermission('permissions.manage'), asyncHandler(async (req, res) => {
  const role = await prisma.role.findUnique({ where: { id: req.params.id }, include: roleInclude });
  if (!role) throw notFound('Perfil não encontrado');
  if (role.isSystem) throw badRequest('Perfis do sistema não podem ser excluídos.');
  if (role._count.users > 0) throw badRequest('Existem usuários vinculados a este perfil.');
  await prisma.role.delete({ where: { id: role.id } });
  await audit(req, { action: 'role.deleted', entity: 'Role', entityId: role.id, details: { key: role.key } });
  res.status(204).end();
}));
