import { prisma } from './prisma.js';

export function requestMeta(req) {
  return {
    ip: req?.ip || req?.socket?.remoteAddress || null,
    userAgent: req?.get?.('user-agent') || null,
  };
}

/** Registra um evento de auditoria. Nunca interrompe o fluxo principal em caso de falha. */
export async function audit(req, { action, entity, entityId, details, userId }) {
  try {
    const meta = requestMeta(req);
    await prisma.auditLog.create({
      data: {
        userId: userId ?? req?.user?.id ?? null,
        action,
        entity: entity ?? null,
        entityId: entityId ?? null,
        details: details ? JSON.stringify(details) : null,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  } catch (err) {
    console.error('[audit] falha ao registrar', action, err.message);
  }
}

/** Calcula diferença entre dois objetos para os campos informados. */
export function diff(before, after, fields) {
  const changes = {};
  for (const f of fields) {
    const a = before?.[f];
    const b = after?.[f];
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[f] = { from: a ?? null, to: b ?? null };
  }
  return changes;
}
