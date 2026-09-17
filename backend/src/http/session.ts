import session, { type Session, type Store } from 'express-session';
import type { CookieOptions, Request } from 'express';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

export interface SessionCookie {
  name: string;
  options: CookieOptions;
}

export function createSessionCookie(production: boolean): SessionCookie {
  return {
    name: 'serena.sid',
    options: { httpOnly: true, sameSite: 'lax', secure: production, path: '/' },
  };
}

export function createSessionMiddleware(store: Store, secret: string, cookie: SessionCookie) {
  return session({
    name: cookie.name,
    secret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { ...cookie.options, maxAge: 8 * 60 * 60 * 1000 },
  });
}

export async function startSession(request: Request, userId: string) {
  await new Promise<void>((resolve, reject) => {
    request.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
  request.session.userId = userId;
  await new Promise<void>((resolve, reject) => {
    request.session.save((error) => (error ? reject(error) : resolve()));
  });
}

export function endSession(currentSession: Session): Promise<void> {
  return new Promise((resolve, reject) => {
    currentSession.destroy((error) => (error ? reject(error) : resolve()));
  });
}
