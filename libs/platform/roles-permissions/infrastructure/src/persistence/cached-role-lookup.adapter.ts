import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Redis } from 'ioredis';

import { CACHE_REDIS_CLIENT } from '@platform/persistence-kernel';
import type { DomainEventEmitted } from '@platform/shared-kernel';
import type { RoleLookupPort } from '@platform/roles-permissions/application';

import { PrismaRoleLookupAdapter } from './prisma/prisma-role-lookup.adapter';

// docs/09-SEGURIDAD.md SS1/docs/technical/07-SECURITY.md SS2: PermissionGuard resuelve
// roles[] -> permissions[] "sin tocar la base de datos de negocio" en el camino caliente -
// cache en Redis compartido entre instancias (Fase 6/Hardening "cache/performance",
// docs/persistence/10-DECISIONES.md #106; antes era un Map en memoria por proceso, gap ya
// documentado en #104). Envuelve PrismaRoleLookupAdapter inyectado directo (no via
// ROLE_LOOKUP_PORT, para no auto-referenciarse) - existsAndBelongsToCompanyOrSystem()
// delega sin cachear (no esta en el camino caliente de cada request, solo en
// users:assign-role). getPermissionsForRoles() cachea por roleId, populate on miss.
// Toda operacion Redis (get/set/del) esta envuelta en try/catch: un error de Redis (caido,
// timeout) se trata como cache-miss, nunca como fallo de la request - mismo principio de
// docs/11-INTEGRACIONES.md SS12 (un fallo de infraestructura externa no debe corromper el
// camino principal), aplicado aca a Redis. Invalidacion: @OnEvent('RolePermissionsChanged.v1')/
// @OnEvent('RoleDeactivated.v1') borran la entrada del roleId afectado (nunca la actualizan
// in-place - el siguiente miss repuebla desde la DB). Sin invalidacion en RoleCreated.v1 - un
// roleId nuevo nunca estuvo cacheado. TTL defensivo (no estrictamente necesario para
// correccion, la invalidacion por evento ya es precisa) contra el unico caso que esa
// invalidacion no cubre: una escritura directa a Role.permissions que bypasee
// EditRolePermissionsHandler/DeactivateRoleHandler (seed, fix manual de SQL) y por lo tanto
// nunca emita el evento de dominio.
const CACHE_KEY_PREFIX = 'rbac:permissions:';
const CACHE_TTL_SECONDS = 60 * 60 * 24;

@Injectable()
export class CachedRoleLookupAdapter implements RoleLookupPort {
  private readonly logger = new Logger(CachedRoleLookupAdapter.name);

  constructor(
    private readonly prismaRoleLookupAdapter: PrismaRoleLookupAdapter,
    @Inject(CACHE_REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  existsAndBelongsToCompanyOrSystem(roleId: string, companyId: string): Promise<boolean> {
    return this.prismaRoleLookupAdapter.existsAndBelongsToCompanyOrSystem(roleId, companyId);
  }

  async getPermissionsForRoles(roleIds: string[], companyId?: string): Promise<string[]> {
    const cached = new Map<string, string[]>();
    await Promise.all(
      roleIds.map(async (roleId) => {
        const permissions = await this.getFromCache(roleId);
        if (permissions) {
          cached.set(roleId, permissions);
        }
      }),
    );

    const uncachedRoleIds = roleIds.filter((roleId) => !cached.has(roleId));
    // Un query por roleId sin cache (no un unico findMany batched) - costo aceptable, ocurre
    // solo en el primer miss de cada role, nunca en el camino caliente de requests repetidas.
    await Promise.all(
      uncachedRoleIds.map(async (roleId) => {
        const rolePermissions = await this.prismaRoleLookupAdapter.getPermissionsForRoles(
          [roleId],
          companyId,
        );
        cached.set(roleId, rolePermissions);
        await this.setInCache(roleId, rolePermissions);
      }),
    );

    const allPermissions = roleIds.flatMap((roleId) => cached.get(roleId) ?? []);
    return Array.from(new Set(allPermissions));
  }

  private async getFromCache(roleId: string): Promise<string[] | undefined> {
    try {
      const raw = await this.redis.get(`${CACHE_KEY_PREFIX}${roleId}`);
      return raw ? (JSON.parse(raw) as string[]) : undefined;
    } catch (error) {
      this.logger.warn(
        `Redis get() fallo para roleId "${roleId}", se trata como cache-miss`,
        error,
      );
      return undefined;
    }
  }

  private async setInCache(roleId: string, permissions: string[]): Promise<void> {
    try {
      await this.redis.set(
        `${CACHE_KEY_PREFIX}${roleId}`,
        JSON.stringify(permissions),
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(`Redis set() fallo para roleId "${roleId}", se ignora`, error);
    }
  }

  private async deleteFromCache(roleId: string): Promise<void> {
    try {
      await this.redis.del(`${CACHE_KEY_PREFIX}${roleId}`);
    } catch (error) {
      this.logger.warn(`Redis del() fallo para roleId "${roleId}", se ignora`, error);
    }
  }

  @OnEvent('RolePermissionsChanged.v1')
  onPermissionsChanged(event: DomainEventEmitted): void {
    const roleId = (event.payload as { roleId?: string }).roleId;
    if (roleId) {
      void this.deleteFromCache(roleId);
    }
  }

  @OnEvent('RoleDeactivated.v1')
  onRoleDeactivated(event: DomainEventEmitted): void {
    const roleId = (event.payload as { roleId?: string }).roleId;
    if (roleId) {
      void this.deleteFromCache(roleId);
    }
  }
}
