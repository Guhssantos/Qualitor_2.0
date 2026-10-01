# Arquitetura

```
┌──────────────────────┐   HTTPS / JSON    ┌───────────────────────────────────────────────┐
│ Frontend (React SPA) │ ────────────────▶ │ API REST (Express)                            │
│ - rotas protegidas   │  Bearer JWT       │  middleware: helmet, CORS, rate limit         │
│ - menu por permissão │  cookie refresh   │  authenticate → carrega contexto de acesso    │
└──────────────────────┘                   │  requirePermission / regras de chamado        │
                                           │  módulos: auth, users, roles, teams,          │
  Futuro: bots Teams/WhatsApp/Telegram,    │  categories, tickets, sla, notifications,     │
  Power BI, sistemas externos ───────────▶ │  reports, audit, settings, ai, search         │
                                           ├───────────────────────────────────────────────┤
                                           │ integrations/  ai · channels · storage        │
                                           │ jobs/          SLA · auto-close · sessões     │
                                           └───────────────┬───────────────────────────────┘
                                                           │ Prisma ORM
                                                   ┌───────▼────────┐
                                                   │ Banco de dados │
                                                   └────────────────┘
```

- **Frontend** (`frontend/`): apenas apresentação. Usa as permissões retornadas pela API para montar menus e esconder botões, mas **nunca** é a fonte da autorização.
- **Backend** (`backend/src`): organizado por módulos de domínio (`modules/*`), cada um com suas rotas, validação Zod e regras. Regras transversais em `lib/` e `middleware/`.
- **Integrações** (`backend/src/integrations`): contratos plugáveis para IA, canais de notificação e armazenamento de arquivos, ativados por variáveis de ambiente.
- **Jobs** (`backend/src/jobs`): rotinas periódicas (alerta de SLA, encerramento automático, limpeza de sessões). Em escala, podem migrar para Azure Functions / filas sem alterar os módulos.

## Modelo de dados

| Tabela | Finalidade |
|---|---|
| `User` | Usuários (nome, e-mail, login, departamento, cargo, perfil, status, último acesso) |
| `Role` | Perfis (ADMIN, SUPERVISOR, AGENT, REQUESTER + personalizados) |
| `Permission` | Catálogo de permissões granulares |
| `RolePermission` | Permissões de cada perfil |
| `UserPermission` | Exceções por usuário (`grant=true` concede, `false` revoga) |
| `Team`, `TeamMember` | Equipes, membros e supervisores |
| `TeamCategory` | Categorias atendidas por uma equipe (herdadas pelos membros) |
| `Category`, `Subcategory` | Tipos de atendimento (prioridade padrão, equipe responsável) |
| `UserCategory` | Atendentes autorizados diretamente em uma categoria |
| `SlaPolicy` | SLA por prioridade (global) ou por categoria + prioridade |
| `Ticket` | Chamados (número sequencial, status, prioridade, origem, prazos e marcos de SLA, avaliação, metadados de IA) |
| `TicketMessage` | Mensagens públicas, notas internas e mensagens do sistema |
| `TicketAttachment` | Anexos (podem ser internos) |
| `TicketHistory` | Histórico de alterações (quem, quando, de/para, observação) |
| `Notification` | Notificações in-app |
| `AuditLog` | Auditoria (usuário, ação, entidade, detalhes JSON, IP, user-agent) |
| `Session` | Sessões / refresh tokens (hash), permitem revogação |
| `Setting`, `Counter` | Configurações do sistema e numeração de chamados |

Todos os IDs são UUID. Status e prioridades são persistidos como códigos estáveis em inglês (`OPEN`, `IN_PROGRESS`, `CRITICAL`...) e traduzidos na interface — o que facilita integrações e BI.

## Modelo de permissões

```
Usuário ──▶ Perfil ──▶ permissões do perfil
   │          (± exceções do usuário: conceder / revogar)
   ├──▶ Equipes ──▶ categorias da equipe ─┐
   └──▶ categorias diretas ───────────────┴──▶ categorias efetivas
```

A cada requisição, `authenticate` lê do banco (`lib/access.js`) o perfil, as exceções, as equipes ativas e as categorias, e monta o contexto `req.user` com `can(permissão)`, `categoryIds`, `teamIds`. Por isso **qualquer alteração do Administrador vale imediatamente**, sem novo login (o token JWT só carrega a identidade, não as permissões).

### Visibilidade de chamados (`modules/tickets/ticket.access.js`)

| Permissão | Chamados visíveis |
|---|---|
| (todos) | os que o próprio usuário abriu |
| `tickets.view_authorized` | das categorias efetivas do usuário |
| `tickets.view_team` | das equipes do usuário (`Ticket.teamId`) |
| `tickets.view_all` | todos |

- Chamados fora do escopo retornam **404** (não revelam existência).
- Atuar como atendente (`canWork`) exige o mesmo escopo + a permissão específica da ação (`tickets.change_status`, `tickets.assign`...).
- Regra estrita: se a categoria for removida do atendente, ele deixa de ver inclusive chamados que já estavam atribuídos a ele (o supervisor/admin deve redistribuí-los).
- Notas e anexos internos só são retornados para quem pode atuar no chamado **e** possui `tickets.internal_notes`.
- Atribuição/transferência só aceita atendentes autorizados na categoria do chamado.
- Indicadores (`/reports`) e busca global aplicam o mesmo filtro de visibilidade.

### Segurança

- Senhas com bcrypt; política mínima (8+ caracteres, letras e números); senha temporária força troca.
- Access token JWT de curta duração em memória; refresh token aleatório em cookie `httpOnly` + `SameSite=Strict`, armazenado como hash e **rotacionado** a cada uso; desativação, redefinição de acesso e troca de senha revogam sessões.
- Helmet, CORS restrito, rate limit global e específico para login, limite de payload, validação Zod em todas as entradas.
- Upload com lista de tipos permitidos, bloqueio de executáveis, nomes aleatórios e download sempre autorizado pela API.
- Auditoria de autenticação, administração e chamados com IP e user-agent.
- Nenhum segredo no código: tudo via variáveis de ambiente.
