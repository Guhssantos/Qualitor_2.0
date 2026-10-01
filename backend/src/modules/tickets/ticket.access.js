/**
 * Regras centrais de visibilidade e atuação em chamados.
 * Todas as rotas de chamados passam por aqui — a interface apenas reflete estas regras.
 */

/** Filtro Prisma com os chamados que o usuário pode visualizar. */
export function visibilityWhere(ctx) {
  if (ctx.can('tickets.view_all')) return {};
  const or = [{ requesterId: ctx.id }];
  if (ctx.can('tickets.view_authorized')) {
    // Regra estrita: sem a categoria autorizada, nem chamados já atribuídos ficam visíveis.
    if (ctx.categoryIds.length) or.push({ categoryId: { in: ctx.categoryIds } });
  }
  if (ctx.can('tickets.view_team') && ctx.teamIds.length) {
    or.push({ teamId: { in: ctx.teamIds } });
  }
  return { OR: or };
}

/** Pode atuar como equipe de atendimento neste chamado? */
export function canWork(ctx, t) {
  if (ctx.can('tickets.view_all')) return true;
  if (ctx.can('tickets.view_authorized')) {
    if (ctx.categoryIds.includes(t.categoryId)) return true;
  }
  if (ctx.can('tickets.view_team') && t.teamId && ctx.teamIds.includes(t.teamId)) return true;
  return false;
}

export function canView(ctx, t) {
  return t.requesterId === ctx.id || canWork(ctx, t);
}

/** Pode ver notas internas / anexos internos? */
export function canSeeInternal(ctx, t) {
  return canWork(ctx, t) && ctx.can('tickets.internal_notes');
}

/** Ações disponíveis — usadas pela UI para exibir botões (o backend revalida em cada rota). */
export function ticketCapabilities(ctx, t) {
  const work = canWork(ctx, t);
  const isRequester = t.requesterId === ctx.id;
  const final = ['CLOSED', 'CANCELLED'].includes(t.status);
  return {
    work,
    reply: !final && ((work) || (isRequester && ctx.can('tickets.reply'))),
    internalNote: !final && work && ctx.can('tickets.internal_notes'),
    changeStatus: !final && work && ctx.can('tickets.change_status'),
    changePriority: !final && work && ctx.can('tickets.change_priority'),
    changeCategory: !final && work && ctx.can('tickets.change_category'),
    transfer: !final && work && ctx.can('tickets.transfer'),
    assign: !final && work && ctx.can('tickets.assign'),
    assume: !final && work && ctx.can('tickets.assume') && t.assigneeId !== ctx.id,
    attach: !final && (work || isRequester),
    requesterCancel: isRequester && ['OPEN', 'TRIAGE'].includes(t.status),
    requesterValidate: isRequester && t.status === 'VALIDATION',
    requesterClose: isRequester && t.status === 'RESOLVED',
    rate: isRequester && ctx.can('tickets.rate') && ['RESOLVED', 'CLOSED'].includes(t.status) && t.rating == null,
  };
}
