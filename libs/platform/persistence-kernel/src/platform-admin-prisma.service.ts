import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Segundo PrismaClient de apps/api - excepcion documentada al comentario "Unico PrismaClient
// de todo apps/api" de PrismaService (sigue siendo el unico del camino de negocio ordinario).
// Conectado como platform_admin (BYPASSRLS, GRANT acotado a SELECT sobre
// organization.companies unicamente - docs/persistence/06-RLS.md §5, 10-DECISIONES.md #121).
// Nunca @Global() (ver PlatformAdminPrismaModule, este mismo archivo/carpeta) - solo
// ReservationsModule lo importa, para ReservationReminderScanProcessor exclusivamente.
@Injectable()
export class PlatformAdminPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: configService.getOrThrow<string>('platformAdminDatabase.url'),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
