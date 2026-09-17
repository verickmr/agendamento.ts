import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../domain/errors.js';

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Recurso não encontrado.'));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Verifique os dados informados.',
        details: error.flatten(),
      },
    });
    return;
  }
  if (error instanceof AppError) {
    if (error.status === 429) res.setHeader('Retry-After', '900');
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON inválido.' } });
    return;
  }
  if (error?.type === 'entity.too.large') {
    res
      .status(413)
      .json({ error: { code: 'BODY_TOO_LARGE', message: 'Requisição muito grande.' } });
    return;
  }
  console.error('Request failed', { name: error instanceof Error ? error.name : 'UnknownError' });
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno. Tente novamente.' },
  });
};
