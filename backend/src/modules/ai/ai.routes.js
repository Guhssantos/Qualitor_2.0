import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { PRIORITY_LABELS } from '../../lib/constants.js';
import { formatTicketNumber } from '../../lib/http.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { getAIProvider, aiProviderInfo } from '../../integrations/ai/index.js';
import { ruleBasedProvider } from '../../integrations/ai/ruleBased.provider.js';
import { createTicket } from '../tickets/tickets.service.js';

/**
 * Assistente de abertura de chamados (fluxo: mensagem → interpretação → confirmação → criação).
 * O fluxo é stateless: o cliente (portal, bot do Teams/WhatsApp/Telegram) guarda a proposta e envia na confirmação.
 */
const router = Router();
router.use(requirePermission('tickets.create'));

router.get('/status', (_req, res) => res.json(aiProviderInfo()));

router.post('/triage', validate({ body: z.object({ message: z.string().trim().min(5).max(5000) }) }), asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { active: true },
    select: { id: true, name: true, description: true, defaultPriority: true, subcategories: { where: { active: true }, select: { id: true, name: true } } },
  });
  const provider = getAIProvider();
  let result;
  try {
    result = await provider.triage({ message: req.body.message, categories });
  } catch (err) {
    console.error('[ai] falha no provedor, usando regras:', err.message);
    result = await ruleBasedProvider.triage({ message: req.body.message, categories });
  }
  // Nunca confia cegamente na IA: valida IDs retornados.
  const category = categories.find((c) => c.id === result.categoryId) || null;
  const subcategory = category?.subcategories.find((s) => s.id === result.subcategoryId) || null;
  const priority = PRIORITY_LABELS[result.priority] ? result.priority : (category?.defaultPriority || 'MEDIUM');

  const proposal = {
    intent: result.intent,
    title: String(result.title || req.body.message).slice(0, 200),
    description: `${result.summary}\n\nMensagem original: "${req.body.message}"`,
    summary: result.summary,
    categoryId: category?.id || null,
    categoryName: category?.name || null,
    subcategoryId: subcategory?.id || null,
    subcategoryName: subcategory?.name || null,
    priority,
    confidence: result.confidence,
    provider: provider.name,
  };
  const confirmationMessage = category
    ? `Entendi que ${result.summary.replace(/^O usuário relata: /, 'você relata: ')}. A categoria identificada é ${category.name}${subcategory ? ` / ${subcategory.name}` : ''}, com prioridade ${PRIORITY_LABELS[priority]}. Está correto?`
    : 'Não consegui identificar a categoria com segurança. Por favor, selecione a categoria manualmente.';
  res.json({ proposal, confirmationMessage, needsManualCategory: !category });
}));

router.post('/confirm', validate({
  body: z.object({
    title: z.string().trim().min(5).max(200),
    description: z.string().trim().min(10).max(20000),
    categoryId: z.string().uuid(),
    subcategoryId: z.string().uuid().nullable().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    location: z.string().trim().max(160).nullable().optional(),
    proposal: z.record(z.any()).optional(),
  }),
}), asyncHandler(async (req, res) => {
  const { proposal, ...input } = req.body;
  const ticket = await createTicket(req, { ...input, source: 'AI', aiMetadata: { ...proposal, confirmedAt: new Date().toISOString() } });
  await audit(req, { action: 'ai.ticket_confirmed', entity: 'Ticket', entityId: ticket.id, details: { provider: proposal?.provider, confidence: proposal?.confidence } });
  res.status(201).json({ ticket: { ...ticket, code: formatTicketNumber(ticket.number) }, message: `Chamado ${formatTicketNumber(ticket.number)} criado com sucesso.` });
}));

export default router;
