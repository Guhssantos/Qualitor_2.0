import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, badRequest } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { getSettings } from '../../lib/settings.js';
import { DEFAULT_SETTINGS, PRIORITY_LABELS, STATUS_LABELS, STATUS_TRANSITIONS, TICKET_SOURCES } from '../../lib/constants.js';
import { activeChannels } from '../../integrations/channels/index.js';
import { aiProviderInfo } from '../../integrations/ai/index.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

const router = Router();

/** Metadados públicos para a interface (rótulos, fluxo de status, nome da empresa). */
router.get('/public', asyncHandler(async (_req, res) => {
  const s = await getSettings();
  res.json({
    companyName: s['company.name'],
    requesterCanSetPriority: s['tickets.requesterCanSetPriority'] === 'true',
    statusLabels: STATUS_LABELS,
    priorityLabels: PRIORITY_LABELS,
    statusTransitions: STATUS_TRANSITIONS,
    sources: TICKET_SOURCES,
  });
}));

router.get('/', requirePermission('settings.manage'), asyncHandler(async (_req, res) => {
  res.json({
    settings: await getSettings(),
    integrations: {
      notificationChannels: activeChannels().map((c) => c.name),
      ai: aiProviderInfo(),
    },
  });
}));

router.put('/', requirePermission('settings.manage'), validate({ body: z.object({ settings: z.record(z.string().max(500)) }) }), asyncHandler(async (req, res) => {
  const entries = Object.entries(req.body.settings);
  const unknown = entries.filter(([k]) => !(k in DEFAULT_SETTINGS)).map(([k]) => k);
  if (unknown.length) throw badRequest(`Configurações desconhecidas: ${unknown.join(', ')}`);
  const before = await getSettings();
  for (const [key, value] of entries) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  const changes = Object.fromEntries(entries.filter(([k, v]) => before[k] !== v).map(([k, v]) => [k, { from: before[k], to: v }]));
  await audit(req, { action: 'settings.updated', entity: 'Setting', details: changes });
  res.json(await getSettings());
}));

export default router;
