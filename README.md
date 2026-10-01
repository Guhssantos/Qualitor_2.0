# Qualitor 2.0 — Service Desk

Plataforma web de **Gestão de Atendimento / Service Desk** para centralizar atendimentos de TI, Help Desk e suporte interno, com controle de acesso por **usuário → perfil → equipe → categorias → permissões**.

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS (tema escuro/claro, responsivo), Recharts, Lucide |
| Backend / API | Node.js 20+ · Express · Zod (validação) · JWT + refresh token rotativo |
| Banco | Prisma ORM — SQLite em desenvolvimento, PostgreSQL / SQL Server / Azure SQL em produção |
| Documentação da API | OpenAPI 3 / Swagger em `/api/docs` |
| Testes | `node:test` + Supertest (fluxo de permissões e do chamado) |

## Funcionalidades (MVP)

- **Login** com sessão controlada (access token curto + refresh token httpOnly rotativo, revogação ao desativar usuário/trocar senha), rate limit e auditoria de login/logout/falhas.
- **Perfis** Administrador, Supervisor, Atendimento/TI e Usuário/Solicitante + perfis personalizados.
- **Permissões granulares** (22 permissões) por perfil, com **exceções por usuário** (conceder/revogar). Verificadas **no backend em toda requisição** — mudanças valem imediatamente, sem novo login.
- **Categorias e subcategorias** com descrição, status, prioridade padrão, equipe responsável, atendentes autorizados e SLA próprio.
- **Equipes** com membros, supervisores e categorias atendidas (membros herdam as categorias).
- **Chamados**: abertura (formulário ou assistente de IA), número automático `SD-000123`, SLA calculado, encaminhamento automático para a equipe da categoria, anexos.
- **Painel de atendimento**: Minha fila, Meus chamados, Todos os permitidos, Aguardando usuário, Em atendimento, Resolvidos — com filtros por número, status, categoria, subcategoria, prioridade, solicitante, departamento, atendente, equipe, data e SLA.
- **Fluxo**: Aberto → Em triagem → Em atendimento → Aguardando usuário → Em validação → Resolvido → Encerrado (+ Cancelado), com histórico completo (quem, quando, de/para, observação).
- **Tela do chamado** em formato de conversa/timeline, diferenciando **mensagem ao usuário** e **nota interna** (nunca exibida ao solicitante — filtrada na API), ações de status, prioridade, atribuição, transferência e categoria.
- **SLA** configurável por prioridade e por categoria (dias corridos ou úteis), pausa em "Aguardando usuário", estados *Dentro do prazo / Próximo do vencimento / Vencido*.
- **Notificações** in-app (sino com contador) para solicitante e atendentes + arquitetura de canais (e-mail, Teams, WhatsApp, Telegram).
- **Dashboard e relatórios**: abertos, em atendimento, aguardando, resolvidos, encerrados, atrasados, tempo médio de 1ª resposta e resolução, cumprimento de SLA, satisfação, gráficos por categoria/atendente/prioridade/departamento/equipe e exportação CSV (Excel/Power BI). Indicadores respeitam a visibilidade de cada usuário.
- **Auditoria** de logins, alterações de usuários, permissões, categorias, equipes, SLA, configurações e chamados (usuário, ação, data/hora, IP, user-agent, detalhes do antes/depois).
- **Assistente de IA (arquitetura pronta)**: mensagem → interpretação → categoria/prioridade → confirmação → criação → encaminhamento. Provedor por regras embutido; provedor Azure OpenAI/Microsoft Foundry pronto para ativar por variável de ambiente.

## Início rápido

```bash
# 1. Dependências
npm run install:all

# 2. Configuração (gere um segredo forte e defina as senhas iniciais)
cp backend/.env.example backend/.env
#   edite backend/.env: JWT_ACCESS_SECRET, ADMIN_PASSWORD, DEMO_PASSWORD

# 3. Banco + dados iniciais (admin e, se SEED_DEMO=true, dados de demonstração)
npm run setup

# 4. Executar (dois terminais)
npm run dev:api    # http://localhost:4000/api  ·  Swagger: http://localhost:4000/api/docs
npm run dev:web    # http://localhost:5173
```

Usuários de demonstração (senha = `DEMO_PASSWORD`; admin = `ADMIN_PASSWORD`):

| Login | Perfil | Escopo |
|---|---|---|
| `admin` | Administrador | Tudo |
| `marcos.lima` | Supervisor | Equipe Service Desk (transfere, prioriza, relatórios) |
| `joao.silva` | Atendimento/TI | Hardware, Software, Acesso (via equipe Service Desk) + Microsoft 365 (direto) |
| `ana.souza` | Atendimento/TI | Equipe Service Desk |
| `carla.mendes` | Atendimento/TI | Rede, Telefonia, Infraestrutura (via equipe Infraestrutura) |
| `maria.oliveira`, `pedro.santos`, `lucia.ferreira` | Solicitante | Apenas os próprios chamados |

## Testes

```bash
npm test
```

Cria um banco isolado, popula com os dados de demonstração e valida: autenticação e rotação de tokens; solicitante só vê os próprios chamados e nunca notas/anexos internos; atendente só vê/atua nas categorias autorizadas (e perde acesso imediatamente quando o admin remove a categoria); supervisor transfere e prioriza; revogação individual de permissão; desativação de usuário; fluxo completo do chamado com SLA pausado, validação, encerramento e avaliação; auditoria e notificações; assistente de IA; cálculos de SLA.

## Documentação

- [Instalação, configuração, banco e primeiro administrador](docs/INSTALACAO.md)
- [Arquitetura e modelo de permissões](docs/ARQUITETURA.md)
- [Uso da API](docs/API.md)
- [Categorias, permissões e perfis — como estender](docs/PERMISSOES_E_CATEGORIAS.md)
- [IA e integrações futuras (Azure/Foundry, WhatsApp, Telegram, Teams, e-mail, Power BI)](docs/IA_E_INTEGRACOES.md)

## Estrutura

```
backend/
  prisma/            schema.prisma, seed.js, bootstrap.js
  scripts/           create-admin.js
  src/
    config/          variáveis de ambiente
    lib/             prisma, controle de acesso, auditoria, constantes (status, permissões)
    middleware/      autenticação, autorização, validação, erros
    modules/         auth, users, roles, teams, categories, tickets, sla, notifications, reports, audit, settings, ai
    integrations/    ai/ (provedores), channels/ (e-mail, Teams, WhatsApp, Telegram), storage/ (anexos)
    jobs/            alertas de SLA, encerramento automático, limpeza de sessões
    docs/            especificação OpenAPI
  tests/
frontend/
  src/
    api/             cliente HTTP com renovação de token
    context/         autenticação, tema, notificações toast
    components/      layout, sidebar, UI, gráficos, assistente de IA
    pages/           dashboard, chamados, relatórios, perfil, admin/*
docs/
```
