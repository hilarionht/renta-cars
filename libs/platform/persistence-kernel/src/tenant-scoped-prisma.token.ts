// Token de inyeccion para el PrismaClient extendido con tenant-scope.extension.ts. Los
// repositorios de lectura lo inyectan en vez de PrismaService crudo cuando quieren la
// segunda capa de defensa (docs/technical/03-BACKEND-ARCHITECTURE.md SS9) sin repetir el
// filtro a mano en cada query.
export const TENANT_SCOPED_PRISMA = Symbol('TenantScopedPrismaClient');
