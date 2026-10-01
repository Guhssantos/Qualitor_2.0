import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, badRequest, unauthorized } from '../../lib/errors.js';
import { audit, requestMeta } from '../../lib/audit.js';
import { loadAccessContext, serializeAccess } from '../../lib/access.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createSession, hashPassword, hashToken, passwordIssues, verifyPassword,
} from './auth.service.js';

const router = Router();
const COOKIE = 'qsd_refresh';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
});

function setRefreshCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.isProd,
    path: '/api/auth',
    maxAge: env.refreshTokenDays * 86400000,
  });
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

router.post('/login', loginLimiter, validate({
  body: z.object({ login: z.string().min(1).max(160), password: z.string().min(1).max(200) }),
}), asyncHandler(async (req, res) => {
  const { login, password } = req.body;
  const identifier = login.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ login: identifier }, { email: identifier }] },
    include: { role: true },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await audit(req, { action: 'auth.login_failed', entity: 'User', details: { login: identifier }, userId: user?.id ?? null });
    throw unauthorized('Usuário ou senha inválidos');
  }
  if (!user.active) {
    await audit(req, { action: 'auth.login_blocked', entity: 'User', entityId: user.id, userId: user.id });
    throw unauthorized('Usuário desativado. Procure o administrador.');
  }

  const { accessToken, refreshToken } = await createSession(user, requestMeta(req));
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(req, { action: 'auth.login', entity: 'User', entityId: user.id, userId: user.id });

  const ctx = await loadAccessContext(user.id);
  setRefreshCookie(res, refreshToken);
  res.json({
    accessToken,
    refreshToken,
    expiresIn: env.jwtAccessExpiresIn,
    mustChangePassword: user.mustChangePassword,
    user: serializeAccess(ctx),
  });
}));

/** Rotaciona o refresh token (cookie httpOnly ou corpo da requisição para integrações). */
router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.body?.refreshToken || readCookie(req, COOKIE);
  if (!token) throw unauthorized('Sessão expirada');

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { role: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.active) {
    throw unauthorized('Sessão expirada');
  }

  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  const { accessToken, refreshToken } = await createSession(session.user, requestMeta(req));
  const ctx = await loadAccessContext(session.userId);
  setRefreshCookie(res, refreshToken);
  res.json({
    accessToken, refreshToken, expiresIn: env.jwtAccessExpiresIn,
    mustChangePassword: session.user.mustChangePassword, user: serializeAccess(ctx),
  });
}));

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  if (req.sessionId) {
    await prisma.session.updateMany({ where: { id: req.sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  await audit(req, { action: 'auth.logout', entity: 'User', entityId: req.user.id });
  res.clearCookie(COOKIE, { path: '/api/auth' });
  res.json({ ok: true });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, name: true, email: true, login: true, department: true, jobTitle: true, phone: true,
      mustChangePassword: true, lastLoginAt: true,
      teams: { select: { isSupervisor: true, team: { select: { id: true, name: true } } } },
      categories: { select: { category: { select: { id: true, name: true } } } },
    },
  });
  res.json({ ...serializeAccess(req.user), profile: user });
}));

router.put('/me', authenticate, validate({
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    phone: z.string().max(40).nullable().optional(),
  }),
}), asyncHandler(async (req, res) => {
  const updated = await prisma.user.update({ where: { id: req.user.id }, data: req.body, select: { id: true, name: true, phone: true } });
  await audit(req, { action: 'user.profile_updated', entity: 'User', entityId: req.user.id, details: req.body });
  res.json(updated);
}));

router.post('/change-password', authenticate, validate({
  body: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1).max(200) }),
}), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!(await verifyPassword(req.body.currentPassword, user.passwordHash))) throw badRequest('Senha atual incorreta');
  const issues = passwordIssues(req.body.newPassword);
  if (issues.length) throw badRequest(`Senha fraca: ${issues.join(', ')}`);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(req.body.newPassword), mustChangePassword: false },
  });
  // Encerra as demais sessões do usuário.
  await prisma.session.updateMany({
    where: { userId: user.id, revokedAt: null, NOT: { id: req.sessionId } },
    data: { revokedAt: new Date() },
  });
  await audit(req, { action: 'auth.password_changed', entity: 'User', entityId: user.id });
  res.json({ ok: true });
}));

export default router;
