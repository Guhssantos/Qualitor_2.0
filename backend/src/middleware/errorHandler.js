import multer from 'multer';
import { AppError } from '../lib/errors.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Erro no upload: ${err.message}` });
  }
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'Registro duplicado', details: err.meta?.target });
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: 'Recurso não encontrado' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  console.error('[error]', err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}
