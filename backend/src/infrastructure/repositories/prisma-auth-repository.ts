import type { PrismaClient } from '@prisma/client';
import type { AuthRepository } from '../../application/repositories/auth-repository.js';

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly db: PrismaClient) {}
  reserveAttempt(account: string, cutoff: Date, limit: number) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`login:${account}`}, 0))::text`;
      const count = await tx.loginAttempt.count({ where: { account, createdAt: { gte: cutoff } } });
      if (count >= limit) return false;
      await tx.loginAttempt.deleteMany({ where: { account, createdAt: { lt: cutoff } } });
      await tx.loginAttempt.create({ data: { account } });
      return true;
    });
  }
  findCredentials(email: string) {
    return this.db.receptionist.findUnique({ where: { email } });
  }
  findUser(id: string) {
    return this.db.receptionist.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    });
  }
}
