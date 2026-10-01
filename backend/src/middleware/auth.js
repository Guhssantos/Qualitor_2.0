import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { loadAccessContext } from '../lib/access.js';
import { forbidden, unauthorized } from '../lib/errors.js';

/** Valida o token Bearer e carrega o contexto de acesso atualizado do banco. */
export async function authenticate(req, _res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();

    let payload;
    try {
      payload = jwt.verify(token, env.jwtAccessSecret);
    } catch {
      throw unauthorized('Token inválido ou expirado');
    }

    const ctx = await loadAccessContext(payload.sub);
    if (!ctx || !ctx.active) throw unauthorized('Usuário inativo ou inexistente');
    req.user = ctx;
    req.sessionId = payload.sid;
    next();
  } catch (err) {
    next(err);
  }
}

/** Exige ao menos uma das permissões informadas. */
export function requirePermission(...keys) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (keys.some((k) => req.user.can(k))) return next();
    return next(forbidden(`Permissão necessária: ${keys.join(' ou ')}`));
  };
}
