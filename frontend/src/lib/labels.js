export const STATUS_STYLE = {
  OPEN: 'bg-sky-500/10 text-sky-600 ring-sky-500/30 dark:text-sky-300',
  TRIAGE: 'bg-violet-500/10 text-violet-600 ring-violet-500/30 dark:text-violet-300',
  IN_PROGRESS: 'bg-brand-500/10 text-brand-600 ring-brand-500/30 dark:text-brand-300',
  WAITING_USER: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  VALIDATION: 'bg-teal-500/10 text-teal-700 ring-teal-500/30 dark:text-teal-300',
  RESOLVED: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  CLOSED: 'bg-slate-500/10 text-slate-600 ring-slate-500/30 dark:text-slate-300',
  CANCELLED: 'bg-rose-500/10 text-rose-600 ring-rose-500/30 dark:text-rose-300',
};

export const PRIORITY_STYLE = {
  LOW: 'bg-slate-500/10 text-slate-600 ring-slate-500/30 dark:text-slate-300',
  MEDIUM: 'bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  HIGH: 'bg-orange-500/10 text-orange-700 ring-orange-500/30 dark:text-orange-300',
  CRITICAL: 'bg-red-500/15 text-red-700 ring-red-500/40 dark:text-red-300',
};

export const SLA_STYLE = {
  OK: { label: 'Dentro do prazo', cls: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300', bar: 'bg-emerald-500' },
  WARNING: { label: 'Próximo do vencimento', cls: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300', bar: 'bg-amber-500' },
  BREACHED: { label: 'Vencido', cls: 'bg-red-500/15 text-red-700 ring-red-500/40 dark:text-red-300', bar: 'bg-red-500' },
  PAUSED: { label: 'Pausado', cls: 'bg-slate-500/10 text-slate-600 ring-slate-500/30 dark:text-slate-300', bar: 'bg-slate-400' },
  MET: { label: 'Cumprido', cls: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300', bar: 'bg-emerald-500' },
  MISSED: { label: 'Não cumprido', cls: 'bg-red-500/10 text-red-700 ring-red-500/30 dark:text-red-300', bar: 'bg-red-500' },
  NONE: { label: '—', cls: 'bg-slate-500/10 text-slate-500 ring-slate-500/20', bar: 'bg-slate-400' },
};

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const STATUSES = ['OPEN', 'TRIAGE', 'IN_PROGRESS', 'WAITING_USER', 'VALIDATION', 'RESOLVED', 'CLOSED', 'CANCELLED'];

export const ACTION_LABELS = {
  'auth.login': 'Login', 'auth.logout': 'Logout', 'auth.login_failed': 'Falha de login', 'auth.login_blocked': 'Login bloqueado',
  'auth.password_changed': 'Senha alterada',
  'user.created': 'Usuário criado', 'user.updated': 'Usuário alterado', 'user.permissions_changed': 'Permissões do usuário alteradas',
  'user.activated': 'Usuário ativado', 'user.deactivated': 'Usuário desativado', 'user.access_reset': 'Acesso redefinido',
  'user.profile_updated': 'Perfil atualizado', 'user.admin_bootstrap': 'Administrador inicial',
  'role.created': 'Perfil criado', 'role.permissions_changed': 'Permissões do perfil alteradas', 'role.deleted': 'Perfil excluído',
  'team.created': 'Equipe criada', 'team.updated': 'Equipe alterada', 'team.deactivated': 'Equipe desativada',
  'category.created': 'Categoria criada', 'category.updated': 'Categoria alterada',
  'subcategory.created': 'Subcategoria criada', 'subcategory.updated': 'Subcategoria alterada',
  'ticket.created': 'Chamado criado', 'ticket.status_changed': 'Status alterado', 'ticket.closed': 'Chamado encerrado',
  'ticket.cancelled': 'Chamado cancelado', 'ticket.priority_changed': 'Prioridade alterada', 'ticket.assigned': 'Atribuição',
  'ticket.transferred': 'Transferência', 'ticket.category_changed': 'Categoria do chamado alterada', 'ticket.message': 'Mensagem',
  'ticket.internal_note': 'Nota interna', 'ticket.attachment_added': 'Anexo', 'ticket.rated': 'Avaliação',
  'sla.updated': 'SLA alterado', 'sla.deleted': 'SLA removido', 'settings.updated': 'Configurações alteradas',
  'report.exported': 'Relatório exportado', 'ai.ticket_confirmed': 'Chamado criado via IA',
};
