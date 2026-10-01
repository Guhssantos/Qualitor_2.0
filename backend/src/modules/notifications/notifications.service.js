import { prisma } from '../../lib/prisma.js';
import { dispatchExternal } from '../../integrations/channels/index.js';

/**
 * Cria notificações in-app e encaminha aos canais externos configurados.
 * @param {string[]} userIds destinatários (duplicados e o autor da ação são ignorados)
 */
export async function notify(userIds, { type, title, message, ticketId = null, excludeUserId = null }) {
  const ids = [...new Set(userIds.filter(Boolean))].filter((id) => id !== excludeUserId);
  if (!ids.length) return;
  const users = await prisma.user.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, name: true, email: true, phone: true } });
  await prisma.notification.createMany({ data: users.map((u) => ({ userId: u.id, type, title, message, ticketId })) });
  for (const u of users) dispatchExternal(u, { type, title, message, ticketId }).catch(() => {});
}

/** Atendentes que podem atender uma categoria (diretos + equipes) e administradores não entram (evita ruído). */
export async function agentsForCategory(categoryId) {
  const users = await prisma.user.findMany({
    where: {
      active: true,
      role: { key: { in: ['AGENT', 'SUPERVISOR'] } },
      OR: [
        { categories: { some: { categoryId } } },
        { teams: { some: { team: { active: true, categories: { some: { categoryId } } } } } },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
