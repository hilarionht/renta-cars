import { registerAs } from '@nestjs/config';

// Namespace "database" - consumido por PrismaService (apps/api/src/app/prisma).
export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));
