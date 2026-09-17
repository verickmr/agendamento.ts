import { AppError } from '../domain/errors.js';
import type { AuthRepository } from './repositories/auth-repository.js';
import type { PasswordVerifier } from './password-verifier.js';

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwords: PasswordVerifier,
  ) {}
  async login(email: string, password: string) {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const allowed = await this.repository.reserveAttempt(email, cutoff, 5);
    if (!allowed)
      throw new AppError(
        429,
        'LOGIN_THROTTLED',
        'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.',
      );
    const user = await this.repository.findCredentials(email);
    const matches = await this.passwords.verify(password, user?.passwordHash ?? null);
    if (!user || !matches)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    return { id: user.id, name: user.name, email: user.email };
  }
  async current(id: string | undefined) {
    if (!id) throw new AppError(401, 'UNAUTHENTICATED', 'Entre para acessar a recepção.');
    const user = await this.repository.findUser(id);
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Sessão inválida. Entre novamente.');
    return user;
  }
}
