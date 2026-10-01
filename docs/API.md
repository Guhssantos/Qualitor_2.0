# API REST

- Base: `http://localhost:4000/api`
- Documentação interativa (Swagger UI): **`/api/docs`** · especificação JSON: `/api/docs.json`
- Formato: JSON (anexos em `multipart/form-data`)
- Erros: `{ "error": "mensagem", "details": [...] }` com status 400/401/403/404/409

## Autenticação

```bash
# Login (login ou e-mail)
curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"admin","password":"SUA_SENHA"}'
# → { "accessToken": "...", "refreshToken": "...", "expiresIn": "15m", "user": { permissions, categoryIds, ... } }

TOKEN=...   # accessToken

# Renovar (integrações enviam o refreshToken no corpo; o navegador usa o cookie httpOnly)
curl -s -X POST http://localhost:4000/api/auth/refresh -H 'Content-Type: application/json' -d '{"refreshToken":"..."}'
```

Envie `Authorization: Bearer $TOKEN` em todas as demais chamadas. O refresh token é de uso único (rotação).

> Para integrações sistema-a-sistema, crie um usuário de serviço com um perfil personalizado contendo apenas as permissões necessárias (ex.: `tickets.create`).

## Recursos

| Recurso | Endpoints |
|---|---|
| Autenticação | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET/PUT /auth/me`, `POST /auth/change-password` |
| Usuários | `GET/POST /users`, `GET/PUT /users/:id`, `PATCH /users/:id/status`, `POST /users/:id/reset-access`, `GET /users/assignable` |
| Perfis | `GET/POST /roles`, `PUT/DELETE /roles/:id` |
| Permissões | `GET /permissions` |
| Equipes | `GET/POST /teams`, `GET/PUT/DELETE /teams/:id` |
| Categorias | `GET/POST /categories`, `GET/PUT /categories/:id`, `GET/POST /subcategories`, `PUT /subcategories/:id` |
| Chamados | `GET/POST /tickets`, `GET /tickets/counters`, `GET /tickets/:id`, `PATCH /tickets/:id/{status,priority,assign,transfer,category}`, `POST /tickets/:id/assume`, `POST /tickets/:id/requester-action`, `POST /tickets/:id/rating` |
| Mensagens | `POST /tickets/:id/messages` (`type`: `PUBLIC` ou `INTERNAL`) |
| Anexos | `POST /tickets/:id/attachments`, `GET /tickets/:id/attachments/:attachmentId/download` |
| SLA | `GET/PUT /sla`, `DELETE /sla/:id` |
| Notificações | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all` |
| Relatórios | `GET /reports/dashboard`, `GET /reports/tickets.csv` |
| Auditoria | `GET /audit` |
| Configurações | `GET /settings/public`, `GET/PUT /settings` |
| IA | `GET /ai/status`, `POST /ai/triage`, `POST /ai/confirm` |
| Busca | `GET /search?q=` |

## Exemplos

```bash
# Categorias disponíveis para abertura
curl -s http://localhost:4000/api/categories?scope=active -H "Authorization: Bearer $TOKEN"

# Abrir chamado (origem API)
curl -s -X POST http://localhost:4000/api/tickets -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
  "title": "Notebook não liga",
  "description": "O notebook não liga desde hoje cedo.",
  "categoryId": "<uuid>",
  "priority": "HIGH",
  "source": "API"
}'

# Fila de atendimento com filtros
curl -s "http://localhost:4000/api/tickets?view=queue&priority=HIGH,CRITICAL&sla=WARNING" -H "Authorization: Bearer $TOKEN"

# Responder ao usuário / nota interna
curl -s -X POST http://localhost:4000/api/tickets/<id>/messages -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"body":"Verificando.","type":"PUBLIC"}'
curl -s -X POST http://localhost:4000/api/tickets/<id>/messages -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"body":"Checar garantia.","type":"INTERNAL"}'

# Alterar status com observação
curl -s -X PATCH http://localhost:4000/api/tickets/<id>/status -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"status":"WAITING_USER","note":"Qual o número de patrimônio?"}'

# Anexo
curl -s -X POST http://localhost:4000/api/tickets/<id>/attachments -H "Authorization: Bearer $TOKEN" -F files=@print.png -F internal=false

# Exportar CSV para Power BI / Excel
curl -s "http://localhost:4000/api/reports/tickets.csv?dateFrom=2026-01-01" -H "Authorization: Bearer $TOKEN" -o chamados.csv
```

### Visões de `GET /tickets?view=`

`all` (padrão, tudo que é visível) · `queue` (sem responsável, abertos/triagem, nas suas categorias) · `mine` (atribuídos a mim) · `requested` (abertos por mim) · `waiting` · `waiting_me` (meus chamados aguardando minha resposta/validação) · `in_progress` · `resolved` · `open`.

### Fluxo de status

| De | Para (equipe) |
|---|---|
| Aberto | Em triagem, Em atendimento, Aguardando usuário, Cancelado |
| Em triagem | Em atendimento, Aguardando usuário, Cancelado |
| Em atendimento | Em triagem, Aguardando usuário, Em validação, Resolvido, Cancelado |
| Aguardando usuário | Em atendimento, Em validação, Resolvido, Cancelado |
| Em validação | Em atendimento, Resolvido, Cancelado |
| Resolvido | Em atendimento, Encerrado |

Ações do solicitante (`POST /tickets/:id/requester-action`): `cancel` (aberto/triagem), `approve` / `reject` (em validação), `close` / `reopen` (resolvido). Resposta do solicitante a um chamado *Aguardando usuário* retoma automaticamente o atendimento e o SLA.
