// Catálogos centrais do domínio. Valores persistidos em inglês (estáveis para API/integrações);
// rótulos em português para a interface.

export const TICKET_STATUS = {
  OPEN: 'OPEN',
  TRIAGE: 'TRIAGE',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_USER: 'WAITING_USER',
  VALIDATION: 'VALIDATION',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
};

export const STATUS_LABELS = {
  OPEN: 'Aberto',
  TRIAGE: 'Em triagem',
  IN_PROGRESS: 'Em atendimento',
  WAITING_USER: 'Aguardando usuário',
  VALIDATION: 'Em validação',
  RESOLVED: 'Resolvido',
  CLOSED: 'Encerrado',
  CANCELLED: 'Cancelado',
};

/** Transições permitidas para a equipe de atendimento. */
export const STATUS_TRANSITIONS = {
  OPEN: ['TRIAGE', 'IN_PROGRESS', 'WAITING_USER', 'CANCELLED'],
  TRIAGE: ['IN_PROGRESS', 'WAITING_USER', 'CANCELLED'],
  IN_PROGRESS: ['TRIAGE', 'WAITING_USER', 'VALIDATION', 'RESOLVED', 'CANCELLED'],
  WAITING_USER: ['IN_PROGRESS', 'VALIDATION', 'RESOLVED', 'CANCELLED'],
  VALIDATION: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

/** Estados finais/abertos usados em filtros e indicadores. */
export const FINAL_STATUSES = ['CLOSED', 'CANCELLED'];
export const ACTIVE_STATUSES = ['OPEN', 'TRIAGE', 'IN_PROGRESS', 'WAITING_USER', 'VALIDATION'];

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const PRIORITY_LABELS = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', CRITICAL: 'Crítica' };

export const TICKET_SOURCES = ['PORTAL', 'API', 'AI', 'EMAIL', 'TEAMS', 'WHATSAPP', 'TELEGRAM'];

export const ROLE_KEYS = { ADMIN: 'ADMIN', SUPERVISOR: 'SUPERVISOR', AGENT: 'AGENT', REQUESTER: 'REQUESTER' };

/**
 * Catálogo de permissões granulares. Para criar uma nova permissão, adicione-a aqui,
 * rode o seed (ele faz upsert) e use `requirePermission('chave')` na rota.
 */
export const PERMISSIONS = [
  // Chamados — solicitante
  { key: 'tickets.create', module: 'Chamados', name: 'Abrir chamado' },
  { key: 'tickets.view_own', module: 'Chamados', name: 'Visualizar próprios chamados' },
  { key: 'tickets.reply', module: 'Chamados', name: 'Responder chamados' },
  { key: 'tickets.rate', module: 'Chamados', name: 'Avaliar atendimento' },
  // Chamados — atendimento
  { key: 'tickets.view_authorized', module: 'Atendimento', name: 'Visualizar chamados das categorias autorizadas' },
  { key: 'tickets.assume', module: 'Atendimento', name: 'Assumir chamado' },
  { key: 'tickets.change_status', module: 'Atendimento', name: 'Alterar status' },
  { key: 'tickets.internal_notes', module: 'Atendimento', name: 'Adicionar e ver notas internas' },
  { key: 'tickets.change_category', module: 'Atendimento', name: 'Alterar categoria' },
  // Supervisão
  { key: 'tickets.view_team', module: 'Supervisão', name: 'Visualizar chamados da equipe' },
  { key: 'tickets.transfer', module: 'Supervisão', name: 'Transferir chamados (equipe)' },
  { key: 'tickets.assign', module: 'Supervisão', name: 'Atribuir atendente' },
  { key: 'tickets.change_priority', module: 'Supervisão', name: 'Alterar prioridade' },
  { key: 'reports.view', module: 'Supervisão', name: 'Visualizar relatórios e indicadores' },
  // Administração
  { key: 'tickets.view_all', module: 'Administração', name: 'Visualizar todos os chamados' },
  { key: 'users.manage', module: 'Administração', name: 'Gerenciar usuários' },
  { key: 'teams.manage', module: 'Administração', name: 'Gerenciar equipes' },
  { key: 'categories.manage', module: 'Administração', name: 'Gerenciar categorias e subcategorias' },
  { key: 'permissions.manage', module: 'Administração', name: 'Gerenciar perfis e permissões' },
  { key: 'sla.manage', module: 'Administração', name: 'Configurar SLA' },
  { key: 'audit.view', module: 'Administração', name: 'Visualizar auditoria' },
  { key: 'settings.manage', module: 'Administração', name: 'Configurar o sistema' },
];

const requesterPerms = ['tickets.create', 'tickets.view_own', 'tickets.reply', 'tickets.rate'];
const agentPerms = [
  ...requesterPerms,
  'tickets.view_authorized', 'tickets.assume', 'tickets.change_status', 'tickets.internal_notes', 'tickets.change_category',
];
const supervisorPerms = [
  ...agentPerms,
  'tickets.view_team', 'tickets.transfer', 'tickets.assign', 'tickets.change_priority', 'reports.view',
];

export const DEFAULT_ROLES = [
  { key: 'ADMIN', name: 'Administrador', description: 'Acesso total à plataforma', permissions: PERMISSIONS.map((p) => p.key) },
  { key: 'SUPERVISOR', name: 'Supervisor', description: 'Coordena equipes, transfere chamados e acompanha indicadores', permissions: supervisorPerms },
  { key: 'AGENT', name: 'Atendimento/TI', description: 'Atende chamados das categorias autorizadas', permissions: agentPerms },
  { key: 'REQUESTER', name: 'Usuário/Solicitante', description: 'Abre e acompanha os próprios chamados', permissions: requesterPerms },
];

export const DEFAULT_SETTINGS = {
  'company.name': 'Qualitor Service Desk',
  'tickets.autoCloseDays': '3',
  'tickets.requesterCanSetPriority': 'true',
  'sla.warningThresholdPercent': '75',
  'sla.pauseOnWaitingUser': 'true',
};
