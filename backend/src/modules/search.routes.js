import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/errors.js';
import { formatTicketNumber } from '../lib/http.js';
import { visibilityWhere } from './tickets/ticket.access.js';

/** Busca global — retorna apenas o que o usuário tem permissão de ver. */
const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (q.length < 2) return res.json({ tickets: [], users: [], categories: [] });
  const n = parseInt(q.replace(/\D/g, ''), 10);
  const [tickets, users, categories] = await Promise.all([
    prisma.ticket.findMany({
      where: { AND: [visibilityWhere(req.user), { OR: [{ title: { contains: q } }, { description: { contains: q } }, ...(n ? [{ number: n }] : [])] }] },
      select: { id: true, number: true, title: true, status: true, priority: true },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
    req.user.can('users.manage')
      ? prisma.user.findMany({ where: { OR: [{ name: { contains: q } }, { email: { contains: q } }, { login: { contains: q } }] }, select: { id: true, name: true, email: true }, take: 5 })
      : [],
    req.user.can('categories.manage')
      ? prisma.category.findMany({ where: { name: { contains: q } }, select: { id: true, name: true }, take: 5 })
      : [],
  ]);
  res.json({ tickets: tickets.map((t) => ({ ...t, code: formatTicketNumber(t.number) })), users, categories });
}));

export default router;
