import type { RequestHandler } from 'express';
import { z } from 'zod';
import { emailSchema } from '../../domain/contact.js';
import type { AuthenticationService } from '../services.js';
import { endSession, startSession, type SessionCookie } from '../session.js';

const loginSchema = z
  .object({
    email: emailSchema,
    password: z
      .string({ required_error: 'Informe sua senha.' })
      .min(1, 'Informe sua senha.')
      .max(256, 'A senha deve ter até 256 caracteres.'),
  })
  .strict();

export class AuthController {
  constructor(
    private readonly auth: AuthenticationService,
    private readonly cookie: SessionCookie,
  ) {}

  login: RequestHandler = async (request, response) => {
    const { email, password } = loginSchema.parse(request.body);
    const user = await this.auth.login(email, password);
    await startSession(request, user.id);
    response.json({ user });
  };

  current: RequestHandler = (_request, response) => {
    response.json({ user: response.locals.user });
  };

  logout: RequestHandler = async (request, response) => {
    await endSession(request.session);
    response.clearCookie(this.cookie.name, this.cookie.options).status(204).end();
  };
}
