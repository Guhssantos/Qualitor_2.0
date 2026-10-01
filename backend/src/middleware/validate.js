import { badRequest } from '../lib/errors.js';

/** Valida req.body / req.query / req.params com schemas Zod. */
export function validate(schemas) {
  return (req, _res, next) => {
    for (const part of ['body', 'query', 'params']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        return next(badRequest('Dados inválidos', result.error.issues.map((i) => ({
          path: i.path.join('.'), message: i.message,
        }))));
      }
      if (part === 'query') req.validQuery = result.data;
      else req[part] = result.data;
    }
    next();
  };
}
