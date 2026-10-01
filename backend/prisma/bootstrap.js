// Inicialização idempotente de dados obrigatórios (permissões, perfis, configurações, SLA global).
import { DEFAULT_ROLES, DEFAULT_SETTINGS, PERMISSIONS } from '../src/lib/constants.js';
import { FALLBACK_SLA } from '../src/modules/sla/sla.service.js';

export async function bootstrap(prisma) {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, name: p.name, module: p.module, description: p.description },
      update: { name: p.name, module: p.module },
    });
  }
  const perms = await prisma.permission.findMany();
  const idOf = Object.fromEntries(perms.map((p) => [p.key, p.id]));

  for (const r of DEFAULT_ROLES) {
    const existing = await prisma.role.findUnique({ where: { key: r.key } });
    if (!existing) {
      await prisma.role.create({
        data: {
          key: r.key, name: r.name, description: r.description, isSystem: true,
          permissions: { create: r.permissions.map((k) => ({ permissionId: idOf[k] })) },
        },
      });
    } else if (r.key === 'ADMIN') {
      // Administrador sempre recebe permissões novas do catálogo.
      for (const p of perms) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: existing.id, permissionId: p.id } },
          create: { roleId: existing.id, permissionId: p.id }, update: {},
        });
      }
    }
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }

  for (const [priority, p] of Object.entries(FALLBACK_SLA)) {
    const exists = await prisma.slaPolicy.findFirst({ where: { categoryId: null, priority } });
    if (!exists) await prisma.slaPolicy.create({ data: { priority, categoryId: null, ...p } });
  }
}
