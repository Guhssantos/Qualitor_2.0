// Especificação OpenAPI 3.0 da API do Qualitor Service Desk.
// Disponível em /api/docs (Swagger UI) e /api/docs.json.

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ content: { 'application/json': { schema } } });
const ok = (description = 'OK', schema = { type: 'object' }) => ({ 200: { description, ...json(schema) } });
const idParam = (name = 'id') => ({ name, in: 'path', required: true, schema: { type: 'string', format: 'uuid' } });
const q = (name, description, schema = { type: 'string' }) => ({ name, in: 'query', required: false, description, schema });
const body = (schema) => ({ required: true, ...json(schema) });
const errors = {
  400: { description: 'Dados inválidos', ...json(ref('Error')) },
  401: { description: 'Não autenticado', ...json(ref('Error')) },
  403: { description: 'Sem permissão', ...json(ref('Error')) },
  404: { description: 'Não encontrado', ...json(ref('Error')) },
};
const op = (tag, summary, extra = {}) => ({
  tags: [tag], summary, ...extra, responses: { ...(extra.responses || ok()), ...errors },
});
const paging = [q('page', 'Página (1..n)', { type: 'integer' }), q('pageSize', 'Itens por página (máx. 100)', { type: 'integer' })];
const note = { type: 'string', nullable: true, description: 'Observação registrada no histórico' };

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Qualitor Service Desk API',
    version: '1.0.0',
    description: [
      'API REST para gestão de atendimentos (Service Desk).',
      '',
      '**Autenticação**: `POST /api/auth/login` retorna um `accessToken` (JWT, curta duração) e um `refreshToken`.',
      'Envie `Authorization: Bearer <accessToken>` em todas as requisições. Renove com `POST /api/auth/refresh`.',
      '',
      '**Autorização**: todas as permissões são verificadas no servidor (perfil + exceções do usuário + categorias diretas e das equipes).',
      'Chamados fora do escopo do usuário retornam 404.',
    ].join('\n'),
  },
  servers: [{ url: '/api' }],
  security: [{ bearerAuth: [] }],
  tags: ['Autenticação', 'Usuários', 'Perfis e Permissões', 'Equipes', 'Categorias', 'Chamados', 'Mensagens e Anexos', 'SLA', 'Notificações', 'Relatórios', 'Auditoria', 'Configurações', 'IA', 'Busca'].map((name) => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' }, details: {} } },
      Priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      Status: { type: 'string', enum: ['OPEN', 'TRIAGE', 'IN_PROGRESS', 'WAITING_USER', 'VALIDATION', 'RESOLVED', 'CLOSED', 'CANCELLED'] },
      LoginResponse: {
        type: 'object',
        properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, expiresIn: { type: 'string' }, mustChangePassword: { type: 'boolean' }, user: ref('AccessContext') },
      },
      AccessContext: {
        type: 'object',
        properties: {
          id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, role: { type: 'object' },
          permissions: { type: 'array', items: { type: 'string' } }, categoryIds: { type: 'array', items: { type: 'string' } }, teamIds: { type: 'array', items: { type: 'string' } },
        },
      },
      UserInput: {
        type: 'object', required: ['name', 'email', 'login', 'roleId'],
        properties: {
          name: { type: 'string' }, email: { type: 'string' }, login: { type: 'string' }, password: { type: 'string', description: 'Opcional: se omitida, uma senha temporária é gerada' },
          department: { type: 'string' }, jobTitle: { type: 'string' }, phone: { type: 'string' }, roleId: { type: 'string', format: 'uuid' }, active: { type: 'boolean' },
          categoryIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          teams: { type: 'array', items: { type: 'object', properties: { teamId: { type: 'string' }, isSupervisor: { type: 'boolean' } } } },
          permissionOverrides: { type: 'array', items: { type: 'object', properties: { permissionId: { type: 'string' }, grant: { type: 'boolean' } } } },
        },
      },
      RoleInput: { type: 'object', properties: { key: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, permissionIds: { type: 'array', items: { type: 'string' } } } },
      TeamInput: {
        type: 'object', required: ['name'],
        properties: {
          name: { type: 'string' }, description: { type: 'string' }, email: { type: 'string' }, active: { type: 'boolean' }, leaderId: { type: 'string' },
          categoryIds: { type: 'array', items: { type: 'string' } },
          members: { type: 'array', items: { type: 'object', properties: { userId: { type: 'string' }, isSupervisor: { type: 'boolean' } } } },
        },
      },
      CategoryInput: {
        type: 'object', required: ['name'],
        properties: {
          name: { type: 'string' }, description: { type: 'string' }, active: { type: 'boolean' }, defaultPriority: ref('Priority'), teamId: { type: 'string' },
          userIds: { type: 'array', items: { type: 'string' }, description: 'Atendentes autorizados' }, subcategories: { type: 'array', items: { type: 'string' } },
        },
      },
      SubcategoryInput: { type: 'object', required: ['categoryId', 'name'], properties: { categoryId: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, active: { type: 'boolean' } } },
      TicketInput: {
        type: 'object', required: ['title', 'description', 'categoryId'],
        properties: {
          title: { type: 'string' }, description: { type: 'string' }, categoryId: { type: 'string' }, subcategoryId: { type: 'string', nullable: true },
          priority: ref('Priority'), location: { type: 'string' }, department: { type: 'string' },
          source: { type: 'string', enum: ['PORTAL', 'API', 'AI', 'EMAIL', 'TEAMS', 'WHATSAPP', 'TELEGRAM'] },
          requesterId: { type: 'string', description: 'Abrir em nome de outro usuário (requer tickets.assign ou tickets.view_all)' },
        },
      },
      Ticket: {
        type: 'object',
        properties: {
          id: { type: 'string' }, number: { type: 'integer' }, code: { type: 'string', example: 'SD-000123' }, title: { type: 'string' }, description: { type: 'string' },
          status: ref('Status'), priority: ref('Priority'), category: { type: 'object' }, subcategory: { type: 'object' }, requester: { type: 'object' }, assignee: { type: 'object' }, team: { type: 'object' },
          firstResponseDueAt: { type: 'string', format: 'date-time' }, resolutionDueAt: { type: 'string', format: 'date-time' },
          sla: { type: 'object', properties: { status: { type: 'string', enum: ['OK', 'WARNING', 'BREACHED', 'PAUSED', 'MET', 'MISSED', 'NONE'] }, percent: { type: 'integer' } } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Paged: { type: 'object', properties: { items: { type: 'array', items: {} }, total: { type: 'integer' }, page: { type: 'integer' }, pageSize: { type: 'integer' }, totalPages: { type: 'integer' } } },
      SlaPolicy: {
        type: 'object', required: ['priority', 'firstResponseMinutes', 'resolutionMinutes'],
        properties: { categoryId: { type: 'string', nullable: true }, priority: ref('Priority'), firstResponseMinutes: { type: 'integer' }, resolutionMinutes: { type: 'integer' }, businessDaysOnly: { type: 'boolean' } },
      },
    },
  },
  paths: {
    '/auth/login': { post: { ...op('Autenticação', 'Login (login ou e-mail)'), security: [], requestBody: body({ type: 'object', required: ['login', 'password'], properties: { login: { type: 'string' }, password: { type: 'string' } } }), responses: { ...ok('Autenticado', ref('LoginResponse')), 401: errors[401] } } },
    '/auth/refresh': { post: { ...op('Autenticação', 'Renovar tokens (rotação do refresh token)'), security: [], requestBody: { ...json({ type: 'object', properties: { refreshToken: { type: 'string' } } }) } } },
    '/auth/logout': { post: op('Autenticação', 'Encerrar sessão atual') },
    '/auth/me': { get: op('Autenticação', 'Usuário atual, permissões efetivas e categorias'), put: { ...op('Autenticação', 'Atualizar perfil próprio'), requestBody: body({ type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' } } }) } },
    '/auth/change-password': { post: { ...op('Autenticação', 'Alterar a própria senha'), requestBody: body({ type: 'object', properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string' } } }) } },

    '/users': {
      get: { ...op('Usuários', 'Listar usuários [users.manage]'), parameters: [q('search', 'Nome, e-mail, login ou departamento'), q('roleId', 'Perfil'), q('teamId', 'Equipe'), q('categoryId', 'Categoria autorizada'), q('status', 'active | inactive'), ...paging] },
      post: { ...op('Usuários', 'Criar usuário [users.manage]'), requestBody: body(ref('UserInput')) },
    },
    '/users/assignable': { get: { ...op('Usuários', 'Atendentes elegíveis para atribuição'), parameters: [q('categoryId', 'Categoria'), q('teamId', 'Equipe')] } },
    '/users/{id}': { parameters: [idParam()], get: op('Usuários', 'Detalhar usuário'), put: { ...op('Usuários', 'Editar usuário, perfil, equipes, categorias e exceções de permissão'), requestBody: body(ref('UserInput')) } },
    '/users/{id}/status': { parameters: [idParam()], patch: { ...op('Usuários', 'Ativar/desativar (revoga sessões)'), requestBody: body({ type: 'object', properties: { active: { type: 'boolean' } } }) } },
    '/users/{id}/reset-access': { parameters: [idParam()], post: op('Usuários', 'Redefinir acesso (senha temporária)') },

    '/roles': { get: op('Perfis e Permissões', 'Listar perfis'), post: { ...op('Perfis e Permissões', 'Criar perfil [permissions.manage]'), requestBody: body(ref('RoleInput')) } },
    '/roles/{id}': { parameters: [idParam()], put: { ...op('Perfis e Permissões', 'Editar perfil e permissões'), requestBody: body(ref('RoleInput')) }, delete: op('Perfis e Permissões', 'Excluir perfil personalizado') },
    '/permissions': { get: op('Perfis e Permissões', 'Catálogo de permissões') },

    '/teams': { get: op('Equipes', 'Listar equipes'), post: { ...op('Equipes', 'Criar equipe [teams.manage]'), requestBody: body(ref('TeamInput')) } },
    '/teams/{id}': { parameters: [idParam()], get: op('Equipes', 'Detalhar equipe'), put: { ...op('Equipes', 'Editar equipe, membros e categorias'), requestBody: body(ref('TeamInput')) }, delete: op('Equipes', 'Desativar equipe') },

    '/categories': {
      get: { ...op('Categorias', 'Listar categorias (dados completos para administradores; ativas para os demais)'), parameters: [q('scope', 'active | authorized')] },
      post: { ...op('Categorias', 'Criar categoria [categories.manage]'), requestBody: body(ref('CategoryInput')) },
    },
    '/categories/{id}': { parameters: [idParam()], get: op('Categorias', 'Detalhar categoria'), put: { ...op('Categorias', 'Editar categoria'), requestBody: body(ref('CategoryInput')) } },
    '/subcategories': { get: { ...op('Categorias', 'Listar subcategorias'), parameters: [q('categoryId', 'Categoria')] }, post: { ...op('Categorias', 'Criar subcategoria'), requestBody: body(ref('SubcategoryInput')) } },
    '/subcategories/{id}': { parameters: [idParam()], put: { ...op('Categorias', 'Editar subcategoria'), requestBody: body(ref('SubcategoryInput')) } },

    '/tickets': {
      get: {
        ...op('Chamados', 'Listar chamados visíveis ao usuário'),
        parameters: [
          q('view', 'all | queue | mine | requested | waiting | waiting_me | in_progress | resolved | open'), q('q', 'Busca livre'), q('number', 'Número'),
          q('status', 'Status separados por vírgula'), q('priority', 'Prioridades separadas por vírgula'), q('categoryId', 'Categoria'), q('subcategoryId', 'Subcategoria'),
          q('requesterId', 'Solicitante (id)'), q('requester', 'Solicitante (nome/e-mail)'), q('department', 'Departamento'), q('assigneeId', 'Atendente (id ou "none")'), q('teamId', 'Equipe'),
          q('dateFrom', 'Abertura a partir de (YYYY-MM-DD)'), q('dateTo', 'Abertura até'), q('sla', 'OK | WARNING | BREACHED | PAUSED | MET | MISSED'),
          q('sort', 'createdAt | updatedAt | priority | resolutionDueAt | number'), q('order', 'asc | desc'), ...paging,
        ],
        responses: ok('Lista paginada', ref('Paged')),
      },
      post: { ...op('Chamados', 'Abrir chamado [tickets.create]'), requestBody: body(ref('TicketInput')), responses: { 201: { description: 'Criado', ...json(ref('Ticket')) } } },
    },
    '/tickets/counters': { get: op('Chamados', 'Contadores por visão (fila, meus, aguardando...)') },
    '/tickets/{id}': { parameters: [idParam()], get: op('Chamados', 'Detalhe com timeline, histórico, SLA e ações disponíveis') },
    '/tickets/{id}/status': { parameters: [idParam()], patch: { ...op('Chamados', 'Alterar status [tickets.change_status]'), requestBody: body({ type: 'object', required: ['status'], properties: { status: ref('Status'), note } }) } },
    '/tickets/{id}/priority': { parameters: [idParam()], patch: { ...op('Chamados', 'Alterar prioridade [tickets.change_priority] — recalcula SLA'), requestBody: body({ type: 'object', properties: { priority: ref('Priority'), note } }) } },
    '/tickets/{id}/assume': { parameters: [idParam()], post: op('Chamados', 'Assumir chamado [tickets.assume]') },
    '/tickets/{id}/assign': { parameters: [idParam()], patch: { ...op('Chamados', 'Atribuir atendente [tickets.assign]'), requestBody: body({ type: 'object', properties: { assigneeId: { type: 'string', nullable: true }, note } }) } },
    '/tickets/{id}/transfer': { parameters: [idParam()], patch: { ...op('Chamados', 'Transferir para equipe [tickets.transfer]'), requestBody: body({ type: 'object', required: ['teamId'], properties: { teamId: { type: 'string' }, assigneeId: { type: 'string', nullable: true }, note } }) } },
    '/tickets/{id}/category': { parameters: [idParam()], patch: { ...op('Chamados', 'Alterar categoria [tickets.change_category]'), requestBody: body({ type: 'object', required: ['categoryId'], properties: { categoryId: { type: 'string' }, subcategoryId: { type: 'string', nullable: true }, note } }) } },
    '/tickets/{id}/requester-action': { parameters: [idParam()], post: { ...op('Chamados', 'Ações do solicitante (cancelar, aprovar/rejeitar solução, encerrar, reabrir)'), requestBody: body({ type: 'object', properties: { action: { type: 'string', enum: ['cancel', 'approve', 'reject', 'close', 'reopen'] }, note } }) } },
    '/tickets/{id}/rating': { parameters: [idParam()], post: { ...op('Chamados', 'Avaliar atendimento (1 a 5)'), requestBody: body({ type: 'object', properties: { rating: { type: 'integer', minimum: 1, maximum: 5 }, comment: { type: 'string' } } }) } },
    '/tickets/{id}/messages': { parameters: [idParam()], post: { ...op('Mensagens e Anexos', 'Enviar mensagem (PUBLIC) ou nota interna (INTERNAL)'), requestBody: body({ type: 'object', required: ['body'], properties: { body: { type: 'string' }, type: { type: 'string', enum: ['PUBLIC', 'INTERNAL'] } } }) } },
    '/tickets/{id}/attachments': {
      parameters: [idParam()],
      post: {
        ...op('Mensagens e Anexos', 'Enviar anexos (multipart, campo "files")'),
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } }, internal: { type: 'string', enum: ['true', 'false'] }, messageId: { type: 'string' } } } } } },
      },
    },
    '/tickets/{id}/attachments/{attachmentId}/download': { parameters: [idParam(), idParam('attachmentId')], get: op('Mensagens e Anexos', 'Baixar anexo') },

    '/sla': { get: op('SLA', 'Políticas de SLA'), put: { ...op('SLA', 'Criar/atualizar políticas [sla.manage]'), requestBody: body({ type: 'object', properties: { policies: { type: 'array', items: ref('SlaPolicy') } } }) } },
    '/sla/{id}': { parameters: [idParam()], delete: op('SLA', 'Remover política específica') },

    '/notifications': { get: { ...op('Notificações', 'Notificações do usuário'), parameters: [q('unread', 'true para somente não lidas'), ...paging] } },
    '/notifications/unread-count': { get: op('Notificações', 'Quantidade não lida') },
    '/notifications/{id}/read': { parameters: [idParam()], post: op('Notificações', 'Marcar como lida') },
    '/notifications/read-all': { post: op('Notificações', 'Marcar todas como lidas') },

    '/reports/dashboard': { get: { ...op('Relatórios', 'Indicadores (respeitam a visibilidade do usuário)'), parameters: [q('dateFrom', 'Início'), q('dateTo', 'Fim'), q('categoryId', 'Categoria'), q('teamId', 'Equipe')] } },
    '/reports/tickets.csv': { get: { ...op('Relatórios', 'Exportar chamados em CSV (Excel/Power BI)'), parameters: [q('dateFrom', 'Início'), q('dateTo', 'Fim'), q('categoryId', 'Categoria'), q('teamId', 'Equipe')] } },

    '/audit': { get: { ...op('Auditoria', 'Logs de auditoria [audit.view]'), parameters: [q('action', 'Prefixo da ação (ex.: ticket.)'), q('userId', 'Usuário'), q('entity', 'Entidade'), q('entityId', 'ID da entidade'), q('q', 'Texto'), q('dateFrom', 'Início'), q('dateTo', 'Fim'), ...paging] } },

    '/settings/public': { get: op('Configurações', 'Metadados da interface (rótulos, fluxo de status)') },
    '/settings': { get: op('Configurações', 'Configurações do sistema [settings.manage]'), put: { ...op('Configurações', 'Atualizar configurações'), requestBody: body({ type: 'object', properties: { settings: { type: 'object', additionalProperties: { type: 'string' } } } }) } },

    '/ai/status': { get: op('IA', 'Provedor de IA ativo') },
    '/ai/triage': { post: { ...op('IA', 'Interpretar mensagem e propor chamado (categoria, prioridade, resumo)'), requestBody: body({ type: 'object', properties: { message: { type: 'string', example: 'Meu notebook não liga' } } }) } },
    '/ai/confirm': { post: { ...op('IA', 'Confirmar proposta e criar o chamado (origem AI)'), requestBody: body({ type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, categoryId: { type: 'string' }, subcategoryId: { type: 'string' }, priority: ref('Priority'), proposal: { type: 'object' } } }) } },

    '/search': { get: { ...op('Busca', 'Busca global (chamados, usuários, categorias permitidos)'), parameters: [q('q', 'Texto')] } },
    '/health': { get: { ...op('Configurações', 'Health check'), security: [] } },
  },
};
