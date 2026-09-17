import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthenticationService } from '../services.js';
import { endSession, startSession, type SessionCookie } from '../session.js';

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(256),
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
