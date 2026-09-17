import type { RequestHandler } from 'express';
import { AppError } from '../../domain/errors.js';
import type { ReceptionUser } from '../../domain/entities.js';
import type { AuthenticationService } from '../services.js';

declare global {
  namespace Express {
    interface Locals {
      user: ReceptionUser;
    }
  }
}

export function requireSession(auth: Pick<AuthenticationService, 'current'>): RequestHandler {
  return async (request, response, next) => {
    response.locals.user = await auth.current(request.session.userId);
    next();
  };
}

export function requireAllowedOrigin(allowedOrigins: readonly string[]): RequestHandler {
  return (request, _response, next) => {
    const origin = request.get('Origin');
    if (!origin || !allowedOrigins.includes(origin)) {
      return next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origem da requisição não permitida.'));
    }
    next();
  };
}

export const requireJson: RequestHandler = (request, _response, next) => {
  if (!request.is('application/json')) {
    return next(new AppError(415, 'JSON_REQUIRED', 'Envie os dados no formato JSON.'));
  }
  next();
};
