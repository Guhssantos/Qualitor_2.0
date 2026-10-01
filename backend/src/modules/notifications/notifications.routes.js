import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/errors.js';
import { paged, pagination } from '../../lib/http.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const pg = pagination(req.query, { defaultSize: 20 });
  const where = { userId: req.user.id, ...(req.query.unread === 'true' ? { readAt: null } : {}) };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: pg.skip, take: pg.take,
      include: { ticket: { select: { id: true, number: true } } },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user.id, readAt: null } }),
  ]);
  res.json({ ...paged(items, total, pg), unread });
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  res.json({ unread: await prisma.notification.count({ where: { userId: req.user.id, readAt: null } }) });
}));

router.post('/:id/read', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));

export default router;
