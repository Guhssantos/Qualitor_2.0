import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { openapi } from './docs/openapi.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import { rolesRouter, permissionsRouter } from './modules/roles/roles.routes.js';
import teamRoutes from './modules/teams/teams.routes.js';
import { categoriesRouter, subcategoriesRouter } from './modules/categories/categories.routes.js';
import ticketRoutes from './modules/tickets/tickets.routes.js';
import slaRoutes from './modules/sla/sla.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import searchRoutes from './modules/search.routes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));
  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: env.isTest ? 100000 : 600, standardHeaders: true, legacyHeaders: false }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  app.get('/api/docs.json', (_req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Qualitor Service Desk — API' }));

  // Públicas
  app.use('/api/auth', authRoutes);

  // Protegidas (token obrigatório + permissões verificadas em cada rota)
  const api = express.Router();
  api.use(authenticate);
  api.use('/users', userRoutes);
  api.use('/roles', rolesRouter);
  api.use('/permissions', permissionsRouter);
  api.use('/teams', teamRoutes);
  api.use('/categories', categoriesRouter);
  api.use('/subcategories', subcategoriesRouter);
  api.use('/tickets', ticketRoutes);
  api.use('/sla', slaRoutes);
  api.use('/notifications', notificationRoutes);
  api.use('/reports', reportRoutes);
  api.use('/audit', auditRoutes);
  api.use('/settings', settingsRoutes);
  api.use('/ai', aiRoutes);
  api.use('/search', searchRoutes);
  app.use('/api', api);
  app.use('/api', notFoundHandler);

  // Em produção o backend pode servir o build do frontend.
  const webDist = path.resolve(process.cwd(), '../frontend/dist');
  if (env.isProd && fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
