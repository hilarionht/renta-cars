import { registerAs } from '@nestjs/config';

// Namespace "database" - consumido por PrismaService (apps/api/src/app/prisma). Usa
// APP_DATABASE_URL (rol app_runtime, sujeto a RLS), nunca DATABASE_URL (rol dueño de las
// tablas, reservado a migraciones - docs/persistence/06-RLS.md §3).
export default registerAs('database', () => ({
  url: process.env.APP_DATABASE_URL,
}));
