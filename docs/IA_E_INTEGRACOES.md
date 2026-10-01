# IA e integrações futuras

## Assistente de IA para abertura de chamados

O fluxo já está implementado de ponta a ponta e é **stateless** — qualquer canal (portal, Teams, WhatsApp, Telegram) pode usá-lo:

1. Usuário envia a mensagem → `POST /api/ai/triage { "message": "Meu notebook não liga" }`
2. O provedor de IA interpreta: intenção, categoria, subcategoria, prioridade, título e resumo reescrito.
3. A API **valida** a resposta (IDs devem existir e estar ativos; prioridade válida) e devolve uma proposta + `confirmationMessage`:
   > "Entendi que você relata: Meu notebook não liga. A categoria identificada é Hardware / Notebook, com prioridade Alta. Está correto?"
4. O canal exibe e pede confirmação.
5. Confirmado → `POST /api/ai/confirm` cria o chamado com `source = "AI"` e guarda a proposta em `aiMetadata` (visível apenas à equipe).
6. O chamado é encaminhado automaticamente à equipe responsável pela categoria, com SLA calculado e notificações disparadas.

### Provedores

Contrato em `backend/src/integrations/ai/index.js`:

```js
triage({ message, categories }) => Promise<{ intent, categoryId, subcategoryId, priority, title, summary, confidence }>
```

| `AI_PROVIDER` | Descrição |
|---|---|
| `rule-based` (padrão) | Palavras-chave locais; sem custo nem dependências; também é o *fallback* se o provedor externo falhar |
| `azure-openai` | Azure OpenAI / Microsoft Foundry (Chat Completions com saída JSON) |

Ativar Azure OpenAI / Foundry:

```env
AI_PROVIDER=azure-openai
AZURE_OPENAI_ENDPOINT=https://<recurso>.openai.azure.com
AZURE_OPENAI_API_KEY=<chave>          # ou use Managed Identity adaptando o provedor
AZURE_OPENAI_DEPLOYMENT=<nome-do-deployment>
AZURE_OPENAI_API_VERSION=2024-10-21
```

Para adicionar outro provedor (Foundry Agent Service, Anthropic Claude, modelo próprio), crie `integrations/ai/<nome>.provider.js` implementando `name`, `isConfigured()` e `triage()` e registre-o no objeto `providers`.

### Próximos passos sugeridos (fase 2)

- **Sugestão automática de solução**: endpoint `POST /api/ai/suggest` usando RAG sobre chamados encerrados bem avaliados (`rating >= 4`) e uma base de conhecimento (Azure AI Search).
- **Classificação automática** de chamados abertos por e-mail/API sem categoria.
- **Triagem automática**: job que move chamados `OPEN` para `TRIAGE` com prioridade sugerida e nota interna da IA.
- **Resumo do chamado** para o atendente e rascunho de resposta.
- Registrar custo/latência por chamada e manter sempre a confirmação humana para ações sensíveis.

## Canais de notificação e atendimento

`backend/src/integrations/channels/` define um contrato simples:

```js
{ name, isConfigured(): boolean, send({ user, notification }): Promise<void> }
```

Todas as notificações in-app passam por `notify()` (`modules/notifications/notifications.service.js`), que também despacha para os canais ativos em `NOTIFY_CHANNELS`.

| Canal | Situação | Como evoluir |
|---|---|---|
| E-mail | stub (log) | Implementar com `nodemailer` (SMTP) ou Microsoft Graph `sendMail`. Para **abertura por e-mail**, ler caixa via Graph (webhook de mensagens) e chamar `POST /api/tickets` com `source: "EMAIL"`. |
| Microsoft Teams | funcional via Incoming Webhook/Workflows (`TEAMS_WEBHOOK_URL`) | Bot (Azure Bot Service) que usa `/api/ai/triage` + `/api/ai/confirm` para abrir chamados por conversa. |
| WhatsApp | stub | WhatsApp Cloud API ou Azure Communication Services; vincular o telefone (`User.phone`). Webhook de entrada → fluxo de IA. |
| Telegram | stub | Bot API (`sendMessage`); vincular `chat_id` ao usuário. |

Os chamados possuem o campo `source` (`PORTAL`, `API`, `AI`, `EMAIL`, `TEAMS`, `WHATSAPP`, `TELEGRAM`) para rastrear a origem.

## Power BI

- **Exportação CSV**: `GET /api/reports/tickets.csv` (separador `;`, UTF-8 com BOM) — conecte como fonte Web/arquivo.
- **API**: `GET /api/reports/dashboard` e `GET /api/tickets` (paginado) com token de um usuário de serviço com `reports.view`/`tickets.view_all`.
- **Banco**: em produção (PostgreSQL/Azure SQL), crie *views* somente leitura e um usuário de banco dedicado para o Power BI.

## Sistemas externos

Use a API REST documentada em `/api/docs` com um usuário de serviço e perfil personalizado com permissões mínimas. Todas as ações ficam registradas na auditoria.
