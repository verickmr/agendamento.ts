import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import type { AppConfig } from '../config.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { createRoutes } from './routes.js';
import type { HttpServices } from './services.js';
import type { SessionCookie } from './session.js';

interface HttpAppOptions {
  services: HttpServices;
  sessionMiddleware: RequestHandler;
  cookie: SessionCookie;
  config: Pick<AppConfig, 'trustProxy' | 'allowedOrigins'>;
}

export function createHttpApp({ services, sessionMiddleware, cookie, config }: HttpAppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '16kb', strict: true }));
  app.use(sessionMiddleware);
  app.use(createRoutes(services, config.allowedOrigins, cookie));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
