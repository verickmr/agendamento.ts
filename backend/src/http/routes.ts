import { Router } from 'express';
import { AppointmentController } from './controllers/appointment-controller.js';
import { AvailabilityBlockController } from './controllers/availability-block-controller.js';
import { AuthController } from './controllers/auth-controller.js';
import { SystemController } from './controllers/system-controller.js';
import { requireAllowedOrigin, requireJson, requireSession } from './middleware/request-guards.js';
import type { HttpServices } from './services.js';
import type { SessionCookie } from './session.js';

export function createRoutes(
  services: HttpServices,
  allowedOrigins: string[],
  cookie: SessionCookie,
) {
  const router = Router();
  const appointments = new AppointmentController(services.appointments);
  const blocks = new AvailabilityBlockController(services.blocks);
  const auth = new AuthController(services.auth, cookie);
  const system = new SystemController(services.checkDatabase);
  const authenticated = requireSession(services.auth);
  const trustedOrigin = requireAllowedOrigin(allowedOrigins);

  router.get('/meta', system.metadata);
  router.get('/health', system.health);
  router.get('/available', appointments.available);
  router.post('/appointments', requireJson, appointments.create);

  router.post('/auth/login', trustedOrigin, requireJson, auth.login);
  router.get('/auth/me', authenticated, auth.current);
  router.post('/auth/logout', trustedOrigin, auth.logout);

  router.get('/appointments', authenticated, appointments.list);
  router.patch('/appointments/:id', authenticated, trustedOrigin, requireJson, appointments.update);
  router.post(
    '/appointments/:id/cancel',
    authenticated,
    trustedOrigin,
    requireJson,
    appointments.cancel,
  );

  router.get('/availability-blocks', authenticated, blocks.list);
  router.post('/availability-blocks', authenticated, trustedOrigin, requireJson, blocks.create);
  router.delete('/availability-blocks/:id', authenticated, trustedOrigin, blocks.remove);
  return router;
}
