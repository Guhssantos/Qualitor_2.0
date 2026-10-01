export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg = 'Requisição inválida', details) => new AppError(400, msg, details);
export const unauthorized = (msg = 'Não autenticado') => new AppError(401, msg);
export const forbidden = (msg = 'Acesso negado') => new AppError(403, msg);
export const notFound = (msg = 'Recurso não encontrado') => new AppError(404, msg);
export const conflict = (msg = 'Conflito de dados') => new AppError(409, msg);

/** Envolve handlers async para encaminhar erros ao middleware de erro. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
