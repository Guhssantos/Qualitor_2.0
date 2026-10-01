# Instalação e configuração

## Requisitos

- Node.js **20 ou superior** e npm
- (Produção) PostgreSQL 14+, SQL Server / Azure SQL ou outro banco suportado pelo Prisma

## 1. Instalar dependências

```bash
npm run install:all      # backend e frontend
```

## 2. Configurar variáveis de ambiente

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env   # opcional
```

Variáveis principais (`backend/.env`):

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão do banco. Padrão: `file:./dev.db` (SQLite) |
| `JWT_ACCESS_SECRET` | **Obrigatória.** Segredo para assinar os tokens. Gere com `openssl rand -hex 48` |
| `JWT_ACCESS_EXPIRES_IN` | Validade do access token (padrão `15m`) |
| `REFRESH_TOKEN_DAYS` | Validade da sessão (padrão `7`) |
| `CORS_ORIGIN` | Origem(ns) do frontend permitidas |
| `UPLOAD_DIR`, `UPLOAD_MAX_MB` | Pasta e tamanho máximo de anexos |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_LOGIN`, `ADMIN_PASSWORD` | Primeiro administrador |
| `SEED_DEMO`, `DEMO_PASSWORD` | Criar dados de demonstração |
| `JOBS_INTERVAL_SECONDS` | Intervalo dos jobs de SLA/encerramento automático |
| `AI_PROVIDER`, `AZURE_OPENAI_*` | Provedor de IA (ver [IA_E_INTEGRACOES.md](IA_E_INTEGRACOES.md)) |
| `NOTIFY_CHANNELS`, `SMTP_*`, `TEAMS_WEBHOOK_URL`, `WHATSAPP_*`, `TELEGRAM_BOT_TOKEN` | Canais externos de notificação |

> Nunca versione o arquivo `.env`. Senhas, tokens e chaves ficam apenas em variáveis de ambiente (ou em um cofre como Azure Key Vault).

## 3. Configurar o banco

### Desenvolvimento (SQLite — sem instalação)

```bash
npm --prefix backend run db:push    # cria as tabelas a partir do schema
npm --prefix backend run db:seed    # permissões, perfis, SLA padrão, admin (+ demo)
```

`npm --prefix backend run db:reset` recria o banco do zero.

### Produção (PostgreSQL)

1. Em `backend/prisma/schema.prisma`, altere `provider = "sqlite"` para `provider = "postgresql"` (ou `sqlserver`).
2. Defina `DATABASE_URL="postgresql://usuario:senha@host:5432/qualitor?schema=public"`.
3. Gere as migrations versionadas e aplique:

```bash
cd backend
npx prisma migrate dev --name init     # em ambiente de desenvolvimento, gera prisma/migrations
npx prisma migrate deploy              # em produção/CI, aplica as migrations
npm run db:seed
```

Para subir um PostgreSQL local rapidamente: `docker compose up -d db` (veja `docker-compose.yml`).

## 4. Criar o primeiro Administrador

O seed cria o administrador definido em `ADMIN_*`. Para criar/reativar um administrador a qualquer momento (por exemplo, em produção com `SEED_DEMO=false`):

```bash
npm --prefix backend run create-admin -- --login admin --email admin@empresa.com --name "Administrador" --password "UmaSenhaForte123"
```

Sem argumentos, o script usa as variáveis `ADMIN_*`. A ação é registrada na auditoria. Depois do primeiro acesso, cadastre os demais usuários pela tela **Administração → Usuários**.

## 5. Executar

```bash
npm run dev:api   # API em http://localhost:4000/api (recarrega ao salvar)
npm run dev:web   # Interface em http://localhost:5173 (proxy /api → 4000)
```

### Produção

```bash
npm run build                    # gera frontend/dist
NODE_ENV=production npm start    # a API serve o frontend compilado e a SPA
```

Recomendações: execute atrás de um proxy HTTPS (Nginx, Azure App Service, Azure Container Apps), use `CORS_ORIGIN` com o domínio real, `JWT_ACCESS_SECRET` com 48+ bytes aleatórios, banco gerenciado com backup e um armazenamento de anexos persistente (ou Azure Blob, veja `src/integrations/storage`).
