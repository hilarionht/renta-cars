import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { DomainEventEmitted } from '@platform/shared-kernel';
import type { RoleLookupPort } from '@platform/roles-permissions/application';

import { PrismaRoleLookupAdapter } from './prisma/prisma-role-lookup.adapter';

// docs/09-SEGURIDAD.md SS1/docs/technical/07-SECURITY.md SS2: PermissionGuard resuelve
// roles[] -> permissions[] "sin tocar la base de datos de negocio" en el camino caliente -
// cache en memoria por proceso, mismo criterio ya aceptado para el rate-limiter
// (app.module.ts: "una unica instancia hoy, escalar horizontalmente es un gap conocido de
// una tanda futura"). Envuelve PrismaRoleLookupAdapter inyectado directo (no via
// ROLE_LOOKUP_PORT, para no auto-referenciarse) - existsAndBelongsToCompanyOrSystem()
// delega sin cachear (no esta en el camino caliente de cada request, solo en
// users:assign-role). getPermissionsForRoles() cachea por roleId, populate on miss.
// Invalidacion: @OnEvent('RolePermissionsChanged.v1')/@OnEvent('RoleDeactivated.v1') borran
// la entrada del roleId afectado (nunca la actualizan in-place - el siguiente miss repuebla
// desde la DB, mas simple y sin riesgo de que la invalidacion misma quede desincronizada).
// Sin invalidacion en RoleCreated.v1 - un roleId nuevo nunca estuvo cacheado.
@Injectable()
export class CachedRoleLookupAdapter implements RoleLookupPort {
  private readonly permissionsCache = new Map<string, string[]>();

  constructor(private readonly prismaRoleLookupAdapter: PrismaRoleLookupAdapter) {}

  existsAndBelongsToCompanyOrSystem(roleId: string, companyId: string): Promise<boolean> {
    return this.prismaRoleLookupAdapter.existsAndBelongsToCompanyOrSystem(roleId, companyId);
  }

  async getPermissionsForRoles(roleIds: string[], companyId?: string): Promise<string[]> {
    const uncachedRoleIds = roleIds.filter((roleId) => !this.permissionsCache.has(roleId));
    // Cachea por roleId individual, no por la union pedida - un roleId ya cacheado en una
    // request anterior no debe volver a pedirse solo porque esta request pide OTRO roleId
    // sin cache junto a el. Un query por roleId sin cache (no un unico findMany batched) -
    // costo aceptable, ocurre solo en el primer miss de cada role, nunca en el camino
    // caliente de requests repetidas.
    await Promise.all(
      uncachedRoleIds.map(async (roleId) => {
        const rolePermissions = await this.prismaRoleLookupAdapter.getPermissionsForRoles(
          [roleId],
          companyId,
        );
        this.permissionsCache.set(roleId, rolePermissions);
      }),
    );

    const allPermissions = roleIds.flatMap((roleId) => this.permissionsCache.get(roleId) ?? []);
    return Array.from(new Set(allPermissions));
  }

  @OnEvent('RolePermissionsChanged.v1')
  onPermissionsChanged(event: DomainEventEmitted): void {
    const roleId = (event.payload as { roleId?: string }).roleId;
    if (roleId) {
      this.permissionsCache.delete(roleId);
    }
  }

  @OnEvent('RoleDeactivated.v1')
  onRoleDeactivated(event: DomainEventEmitted): void {
    const roleId = (event.payload as { roleId?: string }).roleId;
    if (roleId) {
      this.permissionsCache.delete(roleId);
    }
  }
}
