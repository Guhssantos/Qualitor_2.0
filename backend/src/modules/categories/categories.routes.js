import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, notFound } from '../../lib/errors.js';
import { audit, diff } from '../../lib/audit.js';
import { PRIORITIES } from '../../lib/constants.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

export const categoriesRouter = Router();
export const subcategoriesRouter = Router();

const adminInclude = {
  team: { select: { id: true, name: true } },
  subcategories: { orderBy: { name: 'asc' } },
  users: { select: { user: { select: { id: true, name: true, email: true } } } },
  teams: { select: { team: { select: { id: true, name: true } } } },
  slaPolicies: true,
  _count: { select: { tickets: true } },
};
const serialize = (c) => ({
  ...c,
  users: c.users?.map((u) => u.user),
  teams: c.teams?.map((t) => t.team),
  ticketCount: c._count?.tickets,
  _count: undefined,
});

/**
 * GET /categories
 *  - Administração: todos os dados.
 *  - scope=authorized: somente categorias que o atendente pode atender (filtros do painel).
 *  - Demais usuários: categorias/subcategorias ativas (para abertura de chamados).
 */
categoriesRouter.get('/', asyncHandler(async (req, res) => {
  const isManager = req.user.can('categories.manage');
  if (req.query.scope === 'authorized' && !req.user.can('tickets.view_all')) {
    const items = await prisma.category.findMany({
      where: { id: { in: req.user.categoryIds } },
      include: { subcategories: { where: { active: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return res.json(items);
  }
  if (isManager && req.query.scope !== 'active') {
    const items = await prisma.category.findMany({ include: adminInclude, orderBy: { name: 'asc' } });
    return res.json(items.map(serialize));
  }
  const items = await prisma.category.findMany({
    where: { active: true },
    select: {
      id: true, name: true, description: true, icon: true, defaultPriority: true,
      subcategories: { where: { active: true }, select: { id: true, name: true, description: true }, orderBy: { name: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });
  res.json(items);
}));

const catBody = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  active: z.boolean().optional(),
  defaultPriority: z.enum(PRIORITIES).optional(),
  teamId: z.string().uuid().nullable().optional(),
  userIds: z.array(z.string().uuid()).max(1000).optional(),
  subcategories: z.array(z.string().trim().min(1).max(80)).max(200).optional(),
});

categoriesRouter.get('/:id', requirePermission('categories.manage'), asyncHandler(async (req, res) => {
  const c = await prisma.category.findUnique({ where: { id: req.params.id }, include: adminInclude });
  if (!c) throw notFound('Categoria não encontrada');
  res.json(serialize(c));
}));

categoriesRouter.post('/', requirePermission('categories.manage'), validate({ body: catBody }), asyncHandler(async (req, res) => {
  const { userIds = [], subcategories = [], ...data } = req.body;
  const c = await prisma.category.create({
    data: {
      ...data,
      users: { create: userIds.map((userId) => ({ userId })) },
      subcategories: { create: [...new Set(subcategories)].map((name) => ({ name })) },
      ...(data.teamId ? { teams: { create: [{ teamId: data.teamId }] } } : {}),
    },
    include: adminInclude,
  });
  await audit(req, { action: 'category.created', entity: 'Category', entityId: c.id, details: { name: c.name, teamId: c.teamId, userIds, subcategories } });
  res.status(201).json(serialize(c));
}));

categoriesRouter.put('/:id', requirePermission('categories.manage'), validate({ body: catBody.omit({ subcategories: true }).partial() }), asyncHandler(async (req, res) => {
  const before = await prisma.category.findUnique({ where: { id: req.params.id }, include: adminInclude });
  if (!before) throw notFound('Categoria não encontrada');
  const { userIds, ...data } = req.body;
  const c = await prisma.$transaction(async (tx) => {
    await tx.category.update({ where: { id: before.id }, data });
    if (userIds) {
      await tx.userCategory.deleteMany({ where: { categoryId: before.id } });
      if (userIds.length) await tx.userCategory.createMany({ data: userIds.map((userId) => ({ userId, categoryId: before.id })) });
    }
    // A equipe responsável sempre atende a categoria.
    if (data.teamId) {
      await tx.teamCategory.upsert({
        where: { teamId_categoryId: { teamId: data.teamId, categoryId: before.id } },
        create: { teamId: data.teamId, categoryId: before.id },
        update: {},
      });
    }
    return tx.category.findUnique({ where: { id: before.id }, include: adminInclude });
  });
  const simplify = (x) => ({ ...serialize(x), users: serialize(x).users.map((u) => u.name).sort() });
  await audit(req, {
    action: 'category.updated', entity: 'Category', entityId: c.id,
    details: diff(simplify(before), simplify(c), ['name', 'description', 'active', 'defaultPriority', 'teamId', 'users']),
  });
  res.json(serialize(c));
}));

// --- Subcategorias ---------------------------------------------------------

subcategoriesRouter.get('/', asyncHandler(async (req, res) => {
  const where = {
    ...(req.query.categoryId ? { categoryId: String(req.query.categoryId) } : {}),
    ...(req.user.can('categories.manage') ? {} : { active: true }),
  };
  const items = await prisma.subcategory.findMany({
    where,
    include: { category: { select: { id: true, name: true } }, _count: { select: { tickets: true } } },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  });
  res.json(items.map((s) => ({ ...s, ticketCount: s._count.tickets, _count: undefined })));
}));

const subBody = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional(),
});

subcategoriesRouter.post('/', requirePermission('categories.manage'), validate({ body: subBody }), asyncHandler(async (req, res) => {
  const s = await prisma.subcategory.create({ data: req.body });
  await audit(req, { action: 'subcategory.created', entity: 'Subcategory', entityId: s.id, details: req.body });
  res.status(201).json(s);
}));

subcategoriesRouter.put('/:id', requirePermission('categories.manage'), validate({ body: subBody.partial() }), asyncHandler(async (req, res) => {
  const before = await prisma.subcategory.findUnique({ where: { id: req.params.id } });
  if (!before) throw notFound('Subcategoria não encontrada');
  const s = await prisma.subcategory.update({ where: { id: before.id }, data: req.body });
  await audit(req, { action: 'subcategory.updated', entity: 'Subcategory', entityId: s.id, details: diff(before, s, ['categoryId', 'name', 'description', 'active']) });
  res.json(s);
}));
