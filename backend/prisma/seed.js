// Seed: dados obrigatórios + (opcional) dados de demonstração.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { bootstrap } from './bootstrap.js';
import { computeDueDates } from '../src/modules/sla/sla.service.js';

const prisma = new PrismaClient();
const rounds = Number(process.env.BCRYPT_ROUNDS || 10);

async function main() {
  await bootstrap(prisma);
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.key, r]));

  // Primeiro administrador
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('Defina ADMIN_PASSWORD no .env antes de rodar o seed.');
  const admin = await prisma.user.upsert({
    where: { login: (process.env.ADMIN_LOGIN || 'admin').toLowerCase() },
    create: {
      name: process.env.ADMIN_NAME || 'Administrador',
      email: (process.env.ADMIN_EMAIL || 'admin@empresa.com').toLowerCase(),
      login: (process.env.ADMIN_LOGIN || 'admin').toLowerCase(),
      passwordHash: await bcrypt.hash(adminPassword, rounds),
      roleId: roles.ADMIN.id, department: 'TI', jobTitle: 'Administrador do Sistema',
    },
    update: {},
  });
  console.log(`✔ Administrador: ${admin.login}`);

  if (process.env.SEED_DEMO !== 'true') return;
  if (await prisma.user.findUnique({ where: { login: 'joao.silva' } })) {
    console.log('• Dados de demonstração já existem.');
    return;
  }
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword) throw new Error('Defina DEMO_PASSWORD no .env para criar os usuários de demonstração.');
  const hash = await bcrypt.hash(demoPassword, rounds);

  // Equipes
  const teamDefs = [
    { name: 'Service Desk', description: 'Primeiro nível de atendimento' },
    { name: 'Infraestrutura', description: 'Servidores, redes e datacenter' },
    { name: 'Segurança da Informação', description: 'Incidentes e acessos sensíveis' },
  ];
  const teams = {};
  for (const t of teamDefs) teams[t.name] = await prisma.team.create({ data: t });

  // Categorias e subcategorias
  const catDefs = [
    ['Hardware', 'Equipamentos e periféricos', 'MEDIUM', 'Service Desk', ['Notebook', 'Desktop', 'Monitor', 'Teclado', 'Mouse', 'Impressora']],
    ['Software', 'Sistemas e aplicativos', 'MEDIUM', 'Service Desk', ['Windows', 'Microsoft 365', 'Aplicativos', 'Sistemas corporativos']],
    ['Acesso', 'Contas, senhas e permissões', 'HIGH', 'Service Desk', ['Senha', 'Active Directory', 'MFA', 'Permissões', 'VPN']],
    ['Microsoft 365', 'Outlook, Teams, OneDrive e SharePoint', 'MEDIUM', 'Service Desk', ['Outlook', 'Teams', 'OneDrive', 'SharePoint', 'Licenças']],
    ['Rede', 'Conectividade e infraestrutura de rede', 'HIGH', 'Infraestrutura', ['Wi-Fi', 'Internet', 'Cabeamento', 'VPN', 'Switch']],
    ['Telefonia', 'Ramais e telefonia móvel', 'LOW', 'Infraestrutura', ['Ramal', 'Celular corporativo', 'Linha']],
    ['Infraestrutura', 'Servidores, backup e datacenter', 'HIGH', 'Infraestrutura', ['Servidor', 'Backup', 'Storage', 'Banco de dados']],
    ['Segurança', 'Incidentes de segurança da informação', 'CRITICAL', 'Segurança da Informação', ['Phishing', 'Malware', 'Vazamento de dados', 'Auditoria de acesso']],
  ];
  const cats = {};
  for (const [name, description, defaultPriority, team, subs] of catDefs) {
    cats[name] = await prisma.category.create({
      data: {
        name, description, defaultPriority, teamId: teams[team].id,
        subcategories: { create: subs.map((s) => ({ name: s })) },
        teams: { create: [{ teamId: teams[team].id }] },
      },
      include: { subcategories: true },
    });
  }

  // SLA específico de exemplo: Segurança crítica mais agressiva
  await prisma.slaPolicy.create({ data: { categoryId: cats['Segurança'].id, priority: 'CRITICAL', firstResponseMinutes: 10, resolutionMinutes: 60 } });

  // Usuários
  const mk = (data) => prisma.user.create({ data: { passwordHash: hash, ...data } });
  const marcos = await mk({ name: 'Marcos Lima', email: 'marcos.lima@empresa.com', login: 'marcos.lima', department: 'TI', jobTitle: 'Coordenador de Service Desk', roleId: roles.SUPERVISOR.id });
  const joao = await mk({ name: 'João Silva', email: 'joao.silva@empresa.com', login: 'joao.silva', department: 'TI', jobTitle: 'Analista de Suporte', roleId: roles.AGENT.id });
  const ana = await mk({ name: 'Ana Souza', email: 'ana.souza@empresa.com', login: 'ana.souza', department: 'TI', jobTitle: 'Analista de Suporte', roleId: roles.AGENT.id });
  const carla = await mk({ name: 'Carla Mendes', email: 'carla.mendes@empresa.com', login: 'carla.mendes', department: 'TI', jobTitle: 'Analista de Infraestrutura', roleId: roles.AGENT.id });
  const maria = await mk({ name: 'Maria Oliveira', email: 'maria.oliveira@empresa.com', login: 'maria.oliveira', department: 'Financeiro', jobTitle: 'Analista Financeira', roleId: roles.REQUESTER.id });
  const pedro = await mk({ name: 'Pedro Santos', email: 'pedro.santos@empresa.com', login: 'pedro.santos', department: 'Comercial', jobTitle: 'Executivo de Vendas', roleId: roles.REQUESTER.id });
  const lucia = await mk({ name: 'Lúcia Ferreira', email: 'lucia.ferreira@empresa.com', login: 'lucia.ferreira', department: 'RH', jobTitle: 'Analista de RH', roleId: roles.REQUESTER.id });

  // Usuário → Perfil → Equipe → Categorias
  // João: equipe Service Desk SEM categorias de equipe; categorias diretas Hardware, Software, Acesso, Microsoft 365.
  await prisma.teamCategory.deleteMany({ where: { teamId: teams['Service Desk'].id } });
  await prisma.teamCategory.createMany({ data: ['Hardware', 'Software', 'Acesso'].map((c) => ({ teamId: teams['Service Desk'].id, categoryId: cats[c].id })) });
  await prisma.teamMember.createMany({
    data: [
      { teamId: teams['Service Desk'].id, userId: marcos.id, isSupervisor: true },
      { teamId: teams['Service Desk'].id, userId: joao.id },
      { teamId: teams['Service Desk'].id, userId: ana.id },
      { teamId: teams.Infraestrutura.id, userId: carla.id },
    ],
  });
  await prisma.team.update({ where: { id: teams['Service Desk'].id }, data: { leaderId: marcos.id } });
  await prisma.team.update({ where: { id: teams.Infraestrutura.id }, data: { leaderId: carla.id } });
  await prisma.userCategory.createMany({ data: [{ userId: joao.id, categoryId: cats['Microsoft 365'].id }] });

  // Chamados de exemplo
  let number = 0;
  const now = Date.now();
  const sub = (cat, name) => cats[cat].subcategories.find((s) => s.name === name)?.id;
  const ticketDefs = [
    { title: 'Notebook não liga', description: 'Meu notebook não liga desde hoje cedo, a luz de energia não acende.', cat: 'Hardware', subName: 'Notebook', priority: 'HIGH', requester: maria, status: 'OPEN', hoursAgo: 1 },
    { title: 'Senha do AD expirada', description: 'Minha senha expirou e não consigo acessar a rede.', cat: 'Acesso', subName: 'Senha', priority: 'HIGH', requester: pedro, status: 'IN_PROGRESS', assignee: joao, hoursAgo: 3 },
    { title: 'Instalar Power BI Desktop', description: 'Preciso do Power BI Desktop instalado para os relatórios mensais.', cat: 'Software', subName: 'Aplicativos', priority: 'LOW', requester: maria, status: 'WAITING_USER', assignee: ana, hoursAgo: 26 },
    { title: 'Wi-Fi instável na sala 3', description: 'A rede Wi-Fi cai a cada 10 minutos na sala de reuniões 3.', cat: 'Rede', subName: 'Wi-Fi', priority: 'MEDIUM', requester: lucia, status: 'TRIAGE', hoursAgo: 5 },
    { title: 'Servidor de arquivos lento', description: 'O servidor de arquivos está muito lento para todos do financeiro.', cat: 'Infraestrutura', subName: 'Servidor', priority: 'CRITICAL', requester: maria, status: 'IN_PROGRESS', assignee: carla, hoursAgo: 3 },
    { title: 'E-mail suspeito recebido', description: 'Recebi um e-mail pedindo para atualizar meus dados bancários.', cat: 'Segurança', subName: 'Phishing', priority: 'CRITICAL', requester: pedro, status: 'OPEN', hoursAgo: 0.2 },
    { title: 'Outlook não sincroniza', description: 'O Outlook parou de sincronizar os e-mails no celular e no computador.', cat: 'Microsoft 365', subName: 'Outlook', priority: 'MEDIUM', requester: lucia, status: 'VALIDATION', assignee: joao, hoursAgo: 30 },
    { title: 'Troca de mouse com defeito', description: 'O botão esquerdo do mouse está falhando.', cat: 'Hardware', subName: 'Mouse', priority: 'LOW', requester: pedro, status: 'CLOSED', assignee: ana, hoursAgo: 72, rating: 5 },
    { title: 'Monitor piscando', description: 'O monitor secundário fica piscando intermitentemente.', cat: 'Hardware', subName: 'Monitor', priority: 'MEDIUM', requester: lucia, status: 'RESOLVED', assignee: joao, hoursAgo: 20 },
  ];
  for (const d of ticketDefs) {
    number += 1;
    const createdAt = new Date(now - d.hoursAgo * 3600000);
    const due = await computeDueDates(cats[d.cat].id, d.priority, createdAt);
    const done = ['VALIDATION', 'RESOLVED', 'CLOSED'].includes(d.status);
    const t = await prisma.ticket.create({
      data: {
        number, title: d.title, description: d.description, categoryId: cats[d.cat].id, subcategoryId: sub(d.cat, d.subName),
        priority: d.priority, status: d.status, requesterId: d.requester.id, assigneeId: d.assignee?.id ?? null,
        teamId: cats[d.cat].teamId, department: d.requester.department, location: 'Matriz',
        firstResponseDueAt: due.firstResponseDueAt, resolutionDueAt: due.resolutionDueAt, createdAt,
        firstRespondedAt: d.assignee ? new Date(createdAt.getTime() + 10 * 60000) : null,
        resolvedAt: done ? new Date(createdAt.getTime() + 2 * 3600000) : null,
        closedAt: d.status === 'CLOSED' ? new Date(createdAt.getTime() + 24 * 3600000) : null,
        slaPausedAt: d.status === 'WAITING_USER' ? new Date(now - 2 * 3600000) : null,
        rating: d.rating ?? null,
        history: { create: [{ userId: d.requester.id, action: 'CREATED', toValue: 'OPEN', note: 'Chamado aberto via PORTAL.', createdAt }] },
      },
    });
    if (d.status !== 'OPEN') {
      await prisma.ticketHistory.create({ data: { ticketId: t.id, userId: d.assignee?.id ?? marcos.id, action: 'STATUS', field: 'status', fromValue: 'OPEN', toValue: d.status, createdAt: new Date(createdAt.getTime() + 15 * 60000) } });
    }
    if (d.assignee) {
      await prisma.ticketMessage.create({ data: { ticketId: t.id, authorId: d.assignee.id, type: 'PUBLIC', body: `Olá ${d.requester.name.split(' ')[0]}, já estou verificando sua solicitação.`, createdAt: new Date(createdAt.getTime() + 10 * 60000) } });
      await prisma.ticketMessage.create({ data: { ticketId: t.id, authorId: d.assignee.id, type: 'INTERNAL', body: 'Nota interna: verificar histórico do equipamento/usuário antes de responder.', createdAt: new Date(createdAt.getTime() + 12 * 60000) } });
    }
  }
  await prisma.counter.upsert({ where: { key: 'ticket' }, create: { key: 'ticket', value: number }, update: { value: number } });
  console.log(`✔ Demonstração: 3 equipes, ${catDefs.length} categorias, 7 usuários, ${number} chamados (senha: DEMO_PASSWORD)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
