import { Module } from '@nestjs/common';

import { PlatformAdminPrismaService } from './platform-admin-prisma.service';

// Modulo estatico simple (no @Global(), a diferencia de PrismaModule) - deliberado: solo
// ReservationsModule lo importa (docs/persistence/10-DECISIONES.md #121). Volverlo global
// haria que PlatformAdminPrismaService (rol BYPASSRLS) fuera inyectable desde cualquier
// modulo, exactamente lo que la regla no negociable de docs/persistence/06-RLS.md §5 prohibe.
@Module({
  providers: [PlatformAdminPrismaService],
  exports: [PlatformAdminPrismaService],
})
export class PlatformAdminPrismaModule {}
