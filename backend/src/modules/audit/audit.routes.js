import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/errors.js';
import { paged, pagination } from '../../lib/http.js';
import { requirePermission } from '../../middleware/auth.js';

const router = Router();

router.get('/', requirePermission('audit.view'), asyncHandler(async (req, res) => {
  const pg = pagination(req.query, { defaultSize: 50, maxSize: 200 });
  const { action, userId, entity, entityId, dateFrom, dateTo, q } = req.query;
  const and = [];
  if (action) and.push({ action: { startsWith: String(action) } });
  if (userId) and.push({ userId: String(userId) });
  if (entity) and.push({ entity: String(entity) });
  if (entityId) and.push({ entityId: String(entityId) });
  if (q) and.push({ OR: [{ details: { contains: String(q) } }, { action: { contains: String(q) } }, { ip: { contains: String(q) } }] });
  if (dateFrom && !isNaN(new Date(dateFrom))) and.push({ createdAt: { gte: new Date(dateFrom) } });
  if (dateTo && !isNaN(new Date(dateTo))) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); and.push({ createdAt: { lte: d } }); }
  const where = and.length ? { AND: and } : {};
  const [items, total, actions] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: { select: { id: true, name: true, login: true } } }, orderBy: { createdAt: 'desc' }, skip: pg.skip, take: pg.take }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
  ]);
  res.json({
    ...paged(items.map((i) => ({ ...i, details: i.details ? JSON.parse(i.details) : null })), total, pg),
    actions: actions.map((a) => a.action),
  });
}));

export default router;
