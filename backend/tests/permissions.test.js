// Testes de integração do modelo de permissões e do fluxo completo do chamado.
// Usa um banco SQLite isolado (tests/test.db) recriado a cada execução.
import { before, after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:../tests/test.db';
process.env.JWT_ACCESS_SECRET = 'test-secret-'.padEnd(64, 'x');
process.env.ADMIN_PASSWORD = 'Admin@123';
process.env.ADMIN_LOGIN = 'admin';
process.env.SEED_DEMO = 'true';
process.env.DEMO_PASSWORD = 'Senha@123';
process.env.BCRYPT_ROUNDS = '4';
process.env.UPLOAD_DIR = path.join(root, 'tests', 'uploads');

let request; let app; let prisma;
const tokens = {};
const api = (who) => ({
  get: (url) => request(app).get(`/api${url}`).set('Authorization', `Bearer ${tokens[who]}`),
  post: (url, body) => request(app).post(`/api${url}`).set('Authorization', `Bearer ${tokens[who]}`).send(body),
  put: (url, body) => request(app).put(`/api${url}`).set('Authorization', `Bearer ${tokens[who]}`).send(body),
  patch: (url, body) => request(app).patch(`/api${url}`).set('Authorization', `Bearer ${tokens[who]}`).send(body),
});

async function login(loginName, password = 'Senha@123') {
  const res = await request(app).post('/api/auth/login').send({ login: loginName, password });
  assert.equal(res.status, 200, `login ${loginName}: ${JSON.stringify(res.body)}`);
  return res.body;
}

const byTitle = async (title) => prisma.ticket.findFirst({ where: { title } });
const listTitles = async (who, query = '') => (await api(who).get(`/tickets?pageSize=100${query}`)).body.items.map((t) => t.title);

before(async () => {
  for (const f of ['test.db', 'test.db-journal']) fs.rmSync(path.join(root, 'tests', f), { force: true });
  const env = { ...process.env };
  execSync('npx prisma db push --skip-generate --accept-data-loss', { cwd: root, env, stdio: 'ignore' });
  execSync('node prisma/seed.js', { cwd: root, env, stdio: 'ignore' });
  request = (await import('supertest')).default;
  app = (await import('../src/app.js')).createApp();
  prisma = (await import('../src/lib/prisma.js')).prisma;
  tokens.admin = (await login('admin', 'Admin@123')).accessToken;
  for (const u of ['joao.silva', 'carla.mendes', 'marcos.lima', 'maria.oliveira', 'pedro.santos', 'ana.souza']) {
    tokens[u.split('.')[0]] = (await login(u)).accessToken;
  }
});

after(async () => { await prisma?.$disconnect(); });

describe('Autenticação', () => {
  test('rejeita senha inválida e registra auditoria', async () => {
    const res = await request(app).post('/api/auth/login').send({ login: 'maria.oliveira', password: 'errada' });
    assert.equal(res.status, 401);
    assert.ok(await prisma.auditLog.findFirst({ where: { action: 'auth.login_failed' } }));
  });

  test('rotas protegidas exigem token', async () => {
    assert.equal((await request(app).get('/api/tickets')).status, 401);
    assert.equal((await request(app).get('/api/tickets').set('Authorization', 'Bearer invalido')).status, 401);
  });

  test('refresh token rotaciona e o antigo deixa de valer', async () => {
    const { refreshToken } = await login('ana.souza');
    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken });
    assert.equal(r1.status, 200);
    const r2 = await request(app).post('/api/auth/refresh').send({ refreshToken });
    assert.equal(r2.status, 401);
  });
});

describe('Solicitante (Maria)', () => {
  test('vê somente os próprios chamados', async () => {
    const res = await api('maria').get('/tickets?pageSize=100');
    assert.equal(res.status, 200);
    const maria = await prisma.user.findUnique({ where: { login: 'maria.oliveira' } });
    assert.ok(res.body.items.length > 0);
    assert.ok(res.body.items.every((t) => t.requester.id === maria.id));
  });

  test('não acessa chamado de outro usuário (404)', async () => {
    const t = await byTitle('Senha do AD expirada'); // de Pedro
    assert.equal((await api('maria').get(`/tickets/${t.id}`)).status, 404);
  });

  test('não vê notas internas', async () => {
    const t = await byTitle('Instalar Power BI Desktop'); // de Maria, possui nota interna
    const res = await api('maria').get(`/tickets/${t.id}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.messages.length > 0);
    assert.ok(res.body.messages.every((m) => m.type !== 'INTERNAL'));
    assert.equal(res.body.capabilities.internalNote, false);
  });

  test('bloqueada nas áreas administrativas e de atendimento', async () => {
    const t = await byTitle('Instalar Power BI Desktop');
    assert.equal((await api('maria').get('/users')).status, 403);
    assert.equal((await api('maria').get('/audit')).status, 403);
    assert.equal((await api('maria').get('/reports/dashboard')).status, 403);
    assert.equal((await api('maria').put('/settings', { settings: {} })).status, 403);
    assert.equal((await api('maria').post(`/tickets/${t.id}/messages`, { body: 'x', type: 'INTERNAL' })).status, 403);
    assert.equal((await api('maria').patch(`/tickets/${t.id}/status`, { status: 'RESOLVED' })).status, 403);
    assert.equal((await api('maria').patch(`/tickets/${t.id}/priority`, { priority: 'CRITICAL' })).status, 403);
  });
});

describe('Atendente (João: Hardware, Software, Acesso via equipe + Microsoft 365 direto)', () => {
  test('vê apenas chamados das categorias autorizadas', async () => {
    const titles = await listTitles('joao');
    for (const t of ['Notebook não liga', 'Senha do AD expirada', 'Instalar Power BI Desktop', 'Outlook não sincroniza']) assert.ok(titles.includes(t), t);
    for (const t of ['Wi-Fi instável na sala 3', 'Servidor de arquivos lento', 'E-mail suspeito recebido']) assert.ok(!titles.includes(t), t);
  });

  test('não abre nem atua em chamado de Infraestrutura', async () => {
    const t = await byTitle('Servidor de arquivos lento');
    assert.equal((await api('joao').get(`/tickets/${t.id}`)).status, 404);
    assert.equal((await api('joao').post(`/tickets/${t.id}/assume`)).status, 404);
    assert.equal((await api('joao').post(`/tickets/${t.id}/messages`, { body: 'oi' })).status, 404);
  });

  test('vê notas internas dos chamados autorizados', async () => {
    const t = await byTitle('Instalar Power BI Desktop');
    const res = await api('joao').get(`/tickets/${t.id}`);
    assert.ok(res.body.messages.some((m) => m.type === 'INTERNAL'));
  });

  test('não altera prioridade nem transfere (permissões de supervisor)', async () => {
    const t = await byTitle('Notebook não liga');
    assert.equal((await api('joao').patch(`/tickets/${t.id}/priority`, { priority: 'LOW' })).status, 403);
    const team = await prisma.team.findFirst({ where: { name: 'Infraestrutura' } });
    assert.equal((await api('joao').patch(`/tickets/${t.id}/transfer`, { teamId: team.id })).status, 403);
    assert.equal((await api('joao').get('/users')).status, 403);
  });

  test('alteração de permissão pelo admin vale imediatamente (sem novo login)', async () => {
    const joao = await prisma.user.findUnique({ where: { login: 'joao.silva' }, include: { categories: true } });
    const rede = await prisma.category.findUnique({ where: { name: 'Rede' } });
    const m365 = await prisma.category.findUnique({ where: { name: 'Microsoft 365' } });
    const roleId = joao.roleId;

    let res = await api('admin').put(`/users/${joao.id}`, { roleId, categoryIds: [m365.id, rede.id] });
    assert.equal(res.status, 200);
    assert.ok((await listTitles('joao')).includes('Wi-Fi instável na sala 3'));

    res = await api('admin').put(`/users/${joao.id}`, { roleId, categoryIds: [] });
    assert.equal(res.status, 200);
    const titles = await listTitles('joao');
    assert.ok(!titles.includes('Wi-Fi instável na sala 3'));
    assert.ok(!titles.includes('Outlook não sincroniza'), 'perdeu Microsoft 365');
    assert.ok(titles.includes('Notebook não liga'), 'mantém Hardware herdado da equipe');

    await api('admin').put(`/users/${joao.id}`, { roleId, categoryIds: [m365.id] });
    assert.ok(await prisma.auditLog.findFirst({ where: { action: 'user.permissions_changed', entityId: joao.id } }));
  });
});

describe('Atendente (Carla: equipe Infraestrutura)', () => {
  test('vê Rede, Telefonia e Infraestrutura, mas não Hardware nem Segurança', async () => {
    const titles = await listTitles('carla');
    assert.ok(titles.includes('Servidor de arquivos lento'));
    assert.ok(titles.includes('Wi-Fi instável na sala 3'));
    assert.ok(!titles.includes('Notebook não liga'));
    assert.ok(!titles.includes('E-mail suspeito recebido'));
  });
});

describe('Supervisor (Marcos)', () => {
  test('altera prioridade e transfere chamado da equipe', async () => {
    const t = await byTitle('Notebook não liga');
    const pr = await api('marcos').patch(`/tickets/${t.id}/priority`, { priority: 'CRITICAL', note: 'Diretoria' });
    assert.equal(pr.status, 200);
    assert.equal(pr.body.priority, 'CRITICAL');
    const ok = await api('marcos').get('/reports/dashboard');
    assert.equal(ok.status, 200);
    assert.equal((await api('marcos').get('/audit')).status, 403);
  });

  test('não atribui chamado a atendente sem a categoria', async () => {
    const t = await byTitle('Notebook não liga');
    const carla = await prisma.user.findUnique({ where: { login: 'carla.mendes' } });
    const res = await api('marcos').patch(`/tickets/${t.id}/assign`, { assigneeId: carla.id });
    assert.equal(res.status, 400);
  });
});

describe('Administrador', () => {
  test('vê todos os chamados e indicadores globais', async () => {
    const all = await api('admin').get('/tickets?pageSize=100');
    assert.equal(all.body.total, await prisma.ticket.count());
    const adminDash = (await api('admin').get('/reports/dashboard')).body;
    const joaoDash = (await api('joao').get('/reports/dashboard')).body;
    assert.ok(joaoDash.total < adminDash.total, 'indicadores do atendente são restritos');
  });

  test('revogar permissão individual bloqueia a ação na API', async () => {
    const pedro = await prisma.user.findUnique({ where: { login: 'pedro.santos' } });
    const perm = await prisma.permission.findUnique({ where: { key: 'tickets.create' } });
    const hw = await prisma.category.findUnique({ where: { name: 'Hardware' } });
    await api('admin').put(`/users/${pedro.id}`, { roleId: pedro.roleId, permissionOverrides: [{ permissionId: perm.id, grant: false }] });
    const res = await api('pedro').post('/tickets', { title: 'Teste bloqueado', description: 'Não deveria criar este chamado', categoryId: hw.id });
    assert.equal(res.status, 403);
    await api('admin').put(`/users/${pedro.id}`, { roleId: pedro.roleId, permissionOverrides: [] });
  });

  test('usuário desativado perde acesso imediatamente', async () => {
    const ana = await prisma.user.findUnique({ where: { login: 'ana.souza' } });
    assert.equal((await api('admin').patch(`/users/${ana.id}/status`, { active: false })).status, 200);
    assert.equal((await api('ana').get('/tickets')).status, 401);
    assert.equal((await request(app).post('/api/auth/login').send({ login: 'ana.souza', password: 'Senha@123' })).status, 401);
    await api('admin').patch(`/users/${ana.id}/status`, { active: true });
  });

  test('não pode desativar a si mesmo', async () => {
    const admin = await prisma.user.findUnique({ where: { login: 'admin' } });
    assert.equal((await api('admin').patch(`/users/${admin.id}/status`, { active: false })).status, 400);
  });
});

describe('Fluxo completo do chamado', () => {
  test('abertura → assumir → interação → aguardando → validação → resolvido → encerrado → avaliação', async () => {
    const hw = await prisma.category.findUnique({ where: { name: 'Hardware' }, include: { subcategories: true } });
    const created = await api('maria').post('/tickets', {
      title: 'Teclado com teclas falhando', description: 'Várias teclas do teclado não funcionam.',
      categoryId: hw.id, subcategoryId: hw.subcategories.find((s) => s.name === 'Teclado').id, priority: 'MEDIUM', location: 'Sala 12',
    });
    assert.equal(created.status, 201);
    const id = created.body.id;
    assert.match(created.body.code, /^SD-\d{6}$/);
    assert.ok(created.body.resolutionDueAt);

    // Notificação ao atendente e presença na fila
    const joao = await prisma.user.findUnique({ where: { login: 'joao.silva' } });
    assert.ok(await prisma.notification.findFirst({ where: { userId: joao.id, ticketId: id, type: 'QUEUE_NEW' } }));
    assert.ok((await listTitles('joao', '&view=queue')).includes('Teclado com teclas falhando'));
    assert.ok(!(await listTitles('carla', '&view=queue')).includes('Teclado com teclas falhando'));

    // Assumir
    const assumed = await api('joao').post(`/tickets/${id}/assume`);
    assert.equal(assumed.status, 200);
    assert.equal(assumed.body.status, 'IN_PROGRESS');
    assert.equal(assumed.body.assigneeId, joao.id);

    // Mensagem pública + nota interna
    assert.equal((await api('joao').post(`/tickets/${id}/messages`, { body: 'Vou trocar seu teclado.' })).status, 201);
    assert.equal((await api('joao').post(`/tickets/${id}/messages`, { body: 'Estoque: 3 teclados.', type: 'INTERNAL' })).status, 201);
    let detail = (await api('maria').get(`/tickets/${id}`)).body;
    assert.ok(detail.messages.some((m) => m.body === 'Vou trocar seu teclado.'));
    assert.ok(!detail.messages.some((m) => m.body === 'Estoque: 3 teclados.'));

    // Anexo interno invisível ao solicitante
    const att = await request(app).post(`/api/tickets/${id}/attachments`).set('Authorization', `Bearer ${tokens.joao}`)
      .field('internal', 'true').attach('files', Buffer.from('log interno'), { filename: 'log.txt', contentType: 'text/plain' });
    assert.equal(att.status, 201);
    detail = (await api('maria').get(`/tickets/${id}`)).body;
    assert.equal(detail.attachments.length, 0);
    assert.equal((await api('maria').get(`/tickets/${id}/attachments/${att.body[0].id}/download`)).status, 404);
    assert.equal((await api('joao').get(`/tickets/${id}/attachments/${att.body[0].id}/download`)).status, 200);

    // Transição inválida
    assert.equal((await api('joao').patch(`/tickets/${id}/status`, { status: 'CLOSED' })).status, 400);

    // Aguardando usuário (SLA pausado) → resposta do usuário retoma
    let st = await api('joao').patch(`/tickets/${id}/status`, { status: 'WAITING_USER', note: 'Qual o patrimônio do teclado?' });
    assert.equal(st.body.status, 'WAITING_USER');
    assert.ok(st.body.slaPausedAt);
    assert.equal((await api('maria').post(`/tickets/${id}/messages`, { body: 'Patrimônio 12345' })).status, 201);
    let t = await prisma.ticket.findUnique({ where: { id } });
    assert.equal(t.status, 'IN_PROGRESS');
    assert.equal(t.slaPausedAt, null);

    // Validação → aprovação pelo solicitante → encerramento → avaliação
    st = await api('joao').patch(`/tickets/${id}/status`, { status: 'VALIDATION', note: 'Teclado substituído.' });
    assert.equal(st.status, 200);
    assert.equal((await api('pedro').post(`/tickets/${id}/requester-action`, { action: 'approve' })).status, 404);
    assert.equal((await api('maria').post(`/tickets/${id}/requester-action`, { action: 'approve' })).body.status, 'RESOLVED');
    assert.equal((await api('maria').post(`/tickets/${id}/requester-action`, { action: 'close' })).body.status, 'CLOSED');
    assert.equal((await api('maria').post(`/tickets/${id}/rating`, { rating: 5, comment: 'Ótimo' })).status, 200);
    assert.equal((await api('maria').post(`/tickets/${id}/rating`, { rating: 4 })).status, 400);
    assert.equal((await api('joao').patch(`/tickets/${id}/status`, { status: 'IN_PROGRESS' })).status, 400);

    // Histórico completo e auditoria
    const history = await prisma.ticketHistory.findMany({ where: { ticketId: id, action: 'STATUS' }, orderBy: { createdAt: 'asc' } });
    assert.deepEqual(history.map((h) => h.toValue), ['IN_PROGRESS', 'WAITING_USER', 'IN_PROGRESS', 'VALIDATION', 'RESOLVED', 'CLOSED']);
    assert.ok(history.every((h) => h.userId));
    for (const action of ['ticket.created', 'ticket.assigned', 'ticket.status_changed', 'ticket.closed', 'ticket.rated']) {
      assert.ok(await prisma.auditLog.findFirst({ where: { action, entityId: id } }), action);
    }
    const maria = await prisma.user.findUnique({ where: { login: 'maria.oliveira' } });
    const types = (await prisma.notification.findMany({ where: { userId: maria.id, ticketId: id } })).map((n) => n.type);
    for (const type of ['TICKET_CREATED', 'TICKET_ASSUMED', 'TICKET_REPLY', 'TICKET_VALIDATION']) assert.ok(types.includes(type), type);
  });

  test('solicitante pode cancelar chamado aberto, mas não de outro usuário', async () => {
    const t = await byTitle('E-mail suspeito recebido'); // de Pedro, OPEN
    assert.equal((await api('maria').post(`/tickets/${t.id}/requester-action`, { action: 'cancel' })).status, 404);
    assert.equal((await api('pedro').post(`/tickets/${t.id}/requester-action`, { action: 'cancel', note: 'Era legítimo' })).body.status, 'CANCELLED');
  });
});

describe('Assistente de IA (provedor por regras)', () => {
  test('interpreta, propõe categoria e cria após confirmação', async () => {
    const triage = await api('maria').post('/ai/triage', { message: 'Meu notebook não liga' });
    assert.equal(triage.status, 200);
    assert.equal(triage.body.proposal.categoryName, 'Hardware');
    assert.match(triage.body.confirmationMessage, /Hardware/);
    const p = triage.body.proposal;
    const confirm = await api('maria').post('/ai/confirm', { title: p.title, description: p.description, categoryId: p.categoryId, subcategoryId: p.subcategoryId, priority: p.priority, proposal: p });
    assert.equal(confirm.status, 201);
    assert.equal(confirm.body.ticket.source, 'AI');
  });
});
