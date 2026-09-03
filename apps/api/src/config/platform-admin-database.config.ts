import { registerAs } from '@nestjs/config';

// Namespace separado de "database" (mismo archivo, mismo criterio) - consumido
// exclusivamente por PlatformAdminPrismaService (apps/api/src/app/persistence). Usa
// PLATFORM_ADMIN_DATABASE_URL (rol platform_admin, BYPASSRLS) - docs/persistence/
// 06-RLS.md §5 / 10-DECISIONES.md #121. Nunca el mismo namespace que "database" (PrismaService,
// rol app_runtime) - son 2 roles/conexiones deliberadamente distintos, nunca intercambiables.
export default registerAs('platformAdminDatabase', () => ({
  url: process.env.PLATFORM_ADMIN_DATABASE_URL,
}));
