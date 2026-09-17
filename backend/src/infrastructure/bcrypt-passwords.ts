import bcrypt from 'bcryptjs';
import type { PasswordVerifier } from '../application/password-verifier.js';

export class BcryptPasswordVerifier implements PasswordVerifier {
  private readonly dummyHash = bcrypt.hash('unmatchable-placeholder-password', 12);
  async verify(password: string, hash: string | null) {
    // Unknown accounts still perform the same cost-12 password work.
    return bcrypt.compare(password, hash ?? (await this.dummyHash));
  }
}
