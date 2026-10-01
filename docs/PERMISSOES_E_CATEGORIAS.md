# Categorias, permissões e perfis

## Adicionar novas categorias

**Pela interface** (recomendado): *Administração → Categorias → Nova categoria*.

1. Informe nome, descrição, prioridade padrão e **equipe responsável** (os chamados serão encaminhados a ela e todos os membros passam a atendê-la).
2. Opcional: marque **atendentes autorizados** diretamente (além dos membros das equipes).
3. Opcional: defina **SLA específico** por prioridade (em branco = SLA global).
4. Informe subcategorias separadas por vírgula; depois gerencie em *Subcategorias*.

**Pela API**: `POST /api/categories` com `{ name, description, defaultPriority, teamId, userIds, subcategories: ["A", "B"] }` (permissão `categories.manage`).

Para dar acesso a uma categoria a um atendente, há três caminhos (equivalentes para a autorização):
- adicionar a categoria à **equipe** do atendente (*Equipes*);
- marcar o atendente na **categoria** (*Categorias → Atendentes autorizados*);
- marcar a categoria no **usuário** (*Usuários → Perfil, equipes e categorias*).

Categorias inativas não aparecem para abertura de chamados, mas os chamados existentes continuam acessíveis.

## Permissões existentes

| Chave | Descrição | Usuário | Atendente | Supervisor | Admin |
|---|---|:-:|:-:|:-:|:-:|
| `tickets.create` | Abrir chamado | ✔ | ✔ | ✔ | ✔ |
| `tickets.view_own` | Ver os próprios chamados | ✔ | ✔ | ✔ | ✔ |
| `tickets.reply` | Responder | ✔ | ✔ | ✔ | ✔ |
| `tickets.rate` | Avaliar atendimento | ✔ | ✔ | ✔ | ✔ |
| `tickets.view_authorized` | Ver chamados das categorias autorizadas | | ✔ | ✔ | ✔ |
| `tickets.assume` | Assumir chamado | | ✔ | ✔ | ✔ |
| `tickets.change_status` | Alterar status | | ✔ | ✔ | ✔ |
| `tickets.internal_notes` | Notas internas | | ✔ | ✔ | ✔ |
| `tickets.change_category` | Alterar categoria | | ✔ | ✔ | ✔ |
| `tickets.view_team` | Ver chamados da equipe | | | ✔ | ✔ |
| `tickets.transfer` | Transferir chamados | | | ✔ | ✔ |
| `tickets.assign` | Atribuir atendente | | | ✔ | ✔ |
| `tickets.change_priority` | Alterar prioridade | | | ✔ | ✔ |
| `reports.view` | Relatórios e indicadores | | | ✔ | ✔ |
| `tickets.view_all` | Ver todos os chamados | | | | ✔ |
| `users.manage` | Gerenciar usuários | | | | ✔ |
| `teams.manage` | Gerenciar equipes | | | | ✔ |
| `categories.manage` | Gerenciar categorias | | | | ✔ |
| `permissions.manage` | Gerenciar perfis e permissões | | | | ✔ |
| `sla.manage` | Configurar SLA | | | | ✔ |
| `audit.view` | Ver auditoria | | | | ✔ |
| `settings.manage` | Configurações | | | | ✔ |

A matriz de cada perfil pode ser alterada em *Administração → Permissões*, e cada usuário pode ter exceções (*Usuários → Gerenciar permissões*). O perfil Administrador sempre tem acesso total.

## Criar uma nova permissão

1. Adicione a entrada em `backend/src/lib/constants.js` → `PERMISSIONS`:
   ```js
   { key: 'kb.manage', module: 'Base de conhecimento', name: 'Gerenciar artigos' },
   ```
2. Proteja a rota no backend:
   ```js
   import { requirePermission } from '../../middleware/auth.js';
   router.post('/articles', requirePermission('kb.manage'), handler);
   // ou, dentro de uma regra: if (!req.user.can('kb.manage')) throw forbidden();
   ```
3. Rode `npm --prefix backend run db:seed` — a permissão é criada (upsert) e atribuída automaticamente ao Administrador.
4. Atribua aos perfis desejados em *Administração → Permissões*.
5. (Opcional) No frontend, use `const { can } = useAuth(); can('kb.manage')` para exibir menus/botões e `<Guard perms={['kb.manage']}>` nas rotas (`src/App.jsx`, `src/lib/menu.js`). Lembre-se: a interface só esconde — quem autoriza é a API.

## Criar um novo perfil

*Administração → Permissões → Novo perfil* — informe chave (ex.: `N2_INFRA`), nome e, opcionalmente, copie as permissões de um perfil existente. Pela API: `POST /api/roles`.
