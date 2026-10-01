import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { PRIORITIES } from '../../lib/constants.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { FALLBACK_SLA } from './sla.service.js';

const router = Router();

router.get('/', requirePermission('sla.manage', 'reports.view'), asyncHandler(async (_req, res) => {
  const policies = await prisma.slaPolicy.findMany({
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ categoryId: 'asc' }, { priority: 'asc' }],
  });
  res.json({ policies, fallback: FALLBACK_SLA });
}));

const policy = z.object({
  categoryId: z.string().uuid().nullable(),
  priority: z.enum(PRIORITIES),
  firstResponseMinutes: z.number().int().min(1).max(525600),
  resolutionMinutes: z.number().int().min(1).max(525600),
  businessDaysOnly: z.boolean().optional(),
});

/** Cria/atualiza políticas (global quando categoryId = null). */
router.put('/', requirePermission('sla.manage'), validate({ body: z.object({ policies: z.array(policy).min(1).max(500) }) }), asyncHandler(async (req, res) => {
  const results = [];
  for (const p of req.body.policies) {
    if (p.resolutionMinutes < p.firstResponseMinutes) p.resolutionMinutes = p.firstResponseMinutes;
    const existing = await prisma.slaPolicy.findFirst({ where: { categoryId: p.categoryId, priority: p.priority } });
    const data = {
      firstResponseMinutes: p.firstResponseMinutes,
      resolutionMinutes: p.resolutionMinutes,
      businessDaysOnly: p.businessDaysOnly ?? false,
    };
    results.push(existing
      ? await prisma.slaPolicy.update({ where: { id: existing.id }, data })
      : await prisma.slaPolicy.create({ data: { ...data, categoryId: p.categoryId, priority: p.priority } }));
  }
  await audit(req, { action: 'sla.updated', entity: 'SlaPolicy', details: { policies: req.body.policies } });
  res.json(results);
}));

router.delete('/:id', requirePermission('sla.manage'), asyncHandler(async (req, res) => {
  const p = await prisma.slaPolicy.delete({ where: { id: req.params.id } });
  await audit(req, { action: 'sla.deleted', entity: 'SlaPolicy', entityId: p.id, details: p });
  res.status(204).end();
}));

export default router;
