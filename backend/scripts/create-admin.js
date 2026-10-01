// Cria (ou reativa) o primeiro Administrador a partir das variáveis de ambiente ou argumentos.
// Uso: npm run create-admin -- --login admin --email admin@empresa.com --name "Admin" --password "Senha@123"
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { bootstrap } from '../prisma/bootstrap.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((a) => {
  const [k, ...v] = a.trim().split(' ');
  return [k, v.join(' ').replace(/^"|"$/g, '')];
}));

const name = args.name || process.env.ADMIN_NAME || 'Administrador';
const email = (args.email || process.env.ADMIN_EMAIL || '').toLowerCase();
const login = (args.login || process.env.ADMIN_LOGIN || 'admin').toLowerCase();
const password = args.password || process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Informe ADMIN_EMAIL e ADMIN_PASSWORD no .env ou via --email/--password.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('A senha deve ter ao menos 8 caracteres.');
  process.exit(1);
}

const prisma = new PrismaClient();
await bootstrap(prisma);
const role = await prisma.role.findUnique({ where: { key: 'ADMIN' } });
const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
const user = await prisma.user.upsert({
  where: { login },
  create: { name, email, login, passwordHash, roleId: role.id, active: true },
  update: { roleId: role.id, active: true, passwordHash },
});
await prisma.auditLog.create({ data: { userId: user.id, action: 'user.admin_bootstrap', entity: 'User', entityId: user.id, details: JSON.stringify({ login }) } });
console.log(`✔ Administrador pronto: ${user.login} <${user.email}>`);
await prisma.$disconnect();
