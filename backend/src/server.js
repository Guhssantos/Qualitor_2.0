import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { startScheduler } from './jobs/scheduler.js';

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`✔ API Qualitor Service Desk em http://localhost:${env.port}/api`);
  console.log(`  Documentação Swagger: http://localhost:${env.port}/api/docs`);
});
startScheduler(env.jobsIntervalSeconds);

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
