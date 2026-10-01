import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';

export const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

export function hashPassword(password) {
  return bcrypt.hash(password, env.bcryptRounds);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/** Regras mínimas de senha. */
export function passwordIssues(password) {
  const issues = [];
  if (!password || password.length < 8) issues.push('mínimo de 8 caracteres');
  if (!/[A-Za-z]/.test(password || '')) issues.push('ao menos uma letra');
  if (!/\d/.test(password || '')) issues.push('ao menos um número');
  return issues;
}

export async function createSession(user, meta) {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 255),
      expiresAt: new Date(Date.now() + env.refreshTokenDays * 86400000),
    },
  });
  const accessToken = jwt.sign({ sub: user.id, sid: session.id, role: user.role?.key }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });
  return { accessToken, refreshToken, session };
}

export async function revokeUserSessions(userId) {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
