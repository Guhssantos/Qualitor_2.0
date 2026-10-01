import {
  LayoutDashboard, PlusCircle, Ticket, MessageSquareReply, UserCircle, Inbox, UserCheck, ListChecks, Hourglass,
  Wrench, CheckCircle2, BarChart3, Users, UsersRound, FolderTree, ListTree, ShieldCheck, Timer, ScrollText, Settings,
} from 'lucide-react';

/**
 * Menu montado a partir das permissões efetivas do usuário.
 * `count` referencia a chave retornada por GET /tickets/counters.
 */
export function buildMenu(can) {
  const groups = [];
  groups.push({ items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] });

  const isStaff = can('tickets.view_authorized', 'tickets.view_team', 'tickets.view_all');

  if (isStaff) {
    groups.push({
      title: 'Atendimento',
      items: [
        { to: '/tickets/queue', label: 'Minha fila', icon: Inbox, count: 'queue' },
        { to: '/tickets/mine', label: 'Meus chamados', icon: UserCheck, count: 'mine' },
        { to: '/tickets/all', label: can('tickets.view_all') ? 'Todos os chamados' : 'Todos os permitidos', icon: ListChecks },
        { to: '/tickets/waiting', label: 'Aguardando usuário', icon: Hourglass, count: 'waiting' },
        { to: '/tickets/in_progress', label: 'Em atendimento', icon: Wrench, count: 'in_progress' },
        { to: '/tickets/resolved', label: 'Resolvidos', icon: CheckCircle2, count: 'resolved' },
        { to: '/reports', label: 'Relatórios', icon: BarChart3 },
      ],
    });
  }

  if (can('tickets.create', 'tickets.view_own')) {
    groups.push({
      title: isStaff ? 'Minhas solicitações' : 'Solicitações',
      items: [
        can('tickets.create') && { to: '/tickets/new', label: 'Abrir chamado', icon: PlusCircle },
        { to: '/tickets/requested', label: isStaff ? 'Abertos por mim' : 'Meus chamados', icon: Ticket },
        { to: '/tickets/waiting_me', label: 'Aguardando minha resposta', icon: MessageSquareReply, count: 'waiting_me', alert: true },
        !isStaff && { to: '/profile', label: 'Perfil', icon: UserCircle },
      ].filter(Boolean),
    });
  }

  const admin = [
    can('users.manage') && { to: '/admin/users', label: 'Usuários', icon: Users },
    can('teams.manage') && { to: '/admin/teams', label: 'Equipes', icon: UsersRound },
    can('categories.manage') && { to: '/admin/categories', label: 'Categorias', icon: FolderTree },
    can('categories.manage') && { to: '/admin/subcategories', label: 'Subcategorias', icon: ListTree },
    can('permissions.manage') && { to: '/admin/permissions', label: 'Permissões', icon: ShieldCheck },
    can('sla.manage') && { to: '/admin/sla', label: 'SLA', icon: Timer },
    can('audit.view') && { to: '/admin/audit', label: 'Auditoria', icon: ScrollText },
    can('settings.manage') && { to: '/admin/settings', label: 'Configurações', icon: Settings },
  ].filter(Boolean);
  if (admin.length) groups.push({ title: 'Administração', items: admin });

  return groups;
}

export const VIEW_TITLES = {
  queue: { title: 'Minha fila', subtitle: 'Chamados disponíveis para serem assumidos nas suas categorias' },
  mine: { title: 'Meus chamados', subtitle: 'Chamados atribuídos a você' },
  all: { title: 'Chamados', subtitle: 'Todos os chamados que você tem permissão para visualizar' },
  waiting: { title: 'Aguardando usuário', subtitle: 'Chamados que dependem de resposta do solicitante' },
  in_progress: { title: 'Em atendimento', subtitle: 'Chamados atualmente em tratamento' },
  resolved: { title: 'Resolvidos', subtitle: 'Chamados solucionados aguardando validação ou encerramento' },
  requested: { title: 'Meus chamados', subtitle: 'Solicitações abertas por você' },
  waiting_me: { title: 'Aguardando minha resposta', subtitle: 'Chamados que precisam da sua resposta ou validação' },
};
