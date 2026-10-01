import { prisma } from './prisma.js';
import { ROLE_KEYS } from './constants.js';

/**
 * Carrega o contexto de acesso efetivo do usuário a partir do banco a cada requisição,
 * garantindo que alterações feitas pelo Administrador sejam aplicadas imediatamente.
 *
 * Usuário → Perfil (permissões do perfil ± exceções do usuário)
 *         → Equipes (categorias da equipe)
 *         → Categorias diretas
 */
export async function loadAccessContext(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      permissions: { include: { permission: true } },
      categories: true,
      teams: { include: { team: { include: { categories: true } } } },
    },
  });
  if (!user) return null;

  const perms = new Set(user.role.permissions.map((rp) => rp.permission.key));
  for (const up of user.permissions) {
    if (up.grant) perms.add(up.permission.key);
    else perms.delete(up.permission.key);
  }

  const activeTeams = user.teams.filter((tm) => tm.team.active);
  const categoryIds = new Set(user.categories.map((c) => c.categoryId));
  for (const tm of activeTeams) tm.team.categories.forEach((tc) => categoryIds.add(tc.categoryId));

  const isAdmin = user.role.key === ROLE_KEYS.ADMIN;
  const teamIds = activeTeams.map((tm) => tm.teamId);
  const supervisedTeamIds = activeTeams.filter((tm) => tm.isSupervisor).map((tm) => tm.teamId);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    login: user.login,
    active: user.active,
    department: user.department,
    role: { id: user.role.id, key: user.role.key, name: user.role.name },
    isAdmin,
    permissions: isAdmin ? new Set([...perms, '*']) : perms,
    categoryIds: [...categoryIds],
    teamIds,
    supervisedTeamIds,
    can(permission) {
      return this.isAdmin || this.permissions.has(permission);
    },
  };
}

export function serializeAccess(ctx) {
  return {
    id: ctx.id,
    name: ctx.name,
    email: ctx.email,
    login: ctx.login,
    department: ctx.department,
    role: ctx.role,
    isAdmin: ctx.isAdmin,
    permissions: [...ctx.permissions],
    categoryIds: ctx.categoryIds,
    teamIds: ctx.teamIds,
    supervisedTeamIds: ctx.supervisedTeamIds,
  };
}
