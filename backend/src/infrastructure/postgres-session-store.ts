import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';

export function createPostgresSessionStore(databaseUrl: string) {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 3,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });
  if (process.env.VERCEL === '1') attachDatabasePool(pool);
  pool.on('error', () => console.error('Session database connection failed.'));
  const PostgresStore = connectPgSimple(session);
  const store = new PostgresStore({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
    pruneSessionInterval: 900,
  });

  return {
    store,
    close: async () => {
      store.close();
      await pool.end();
    },
  };
}
