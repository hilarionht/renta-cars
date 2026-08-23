import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

// Mecanismo de autenticacion (paso 9 de docs/engineering/10-BOOTSTRAP-PLAN.md).
// JwtAuthGuard se registra global via useExisting en app.module.ts, referenciando esta
// instancia. PermissionGuard (RBAC, Fase 4 item 2) ya NO vive aca - necesita ROLE_LOOKUP_PORT
// (puerto cross-modulo de RolesPermissionsModule, que AuthModule no importa) - se registra
// directo en app.module.ts como { provide: APP_GUARD, useClass: PermissionGuard }, mismo
// patron que TenantModuleEnabledGuard (tambien depende de un puerto cross-modulo,
// SETTINGS_LOOKUP_PORT, y tampoco vive en un modulo de feature dedicado).
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
