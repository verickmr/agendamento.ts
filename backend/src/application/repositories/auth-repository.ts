import type { ReceptionUser } from '../../domain/entities.js';

export interface AuthRepository {
  reserveAttempt(account: string, cutoff: Date, limit: number): Promise<boolean>;
  findCredentials(email: string): Promise<(ReceptionUser & { passwordHash: string }) | null>;
  findUser(id: string): Promise<ReceptionUser | null>;
}
