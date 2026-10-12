import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Unico PrismaClient del camino de negocio ordinario de apps/api (docs/technical/
// 04-PERSISTENCE.md SS1). Excepcion documentada: PlatformAdminPrismaService (mismo
// directorio) es un SEGUNDO PrismaClient, conectado como platform_admin (BYPASSRLS,
// docs/persistence/06-RLS.md §5 / 10-DECISIONES.md #121) - nunca inyectado fuera de
// ReservationReminderScanProcessor, nunca via este PrismaService. Prisma 7 ya no acepta una
// URL de conexion directa en el constructor - requiere un `adapter"
// (docs/persistence/08-PRISMA-CONVENTIONS.md no lo cubre porque es detalle de Prisma 7,
// posterior a la redaccion de ese documento).
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg({ connectionString: configService.getOrThrow<string>('database.url') }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
