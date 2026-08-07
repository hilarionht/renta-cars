import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { PermissionGuard } from './permission.guard';

// Mecanismo de autenticacion/autorizacion (paso 9 de docs/engineering/10-BOOTSTRAP-PLAN.md)
// - sin registro global todavia: ningun endpoint real existe aun para aplicarlo por
// defecto (docs/technical/03-BACKEND-ARCHITECTURE.md SS7 describe el guard chain completo,
// que se activa cuando el primer controller protegido lo necesite). JwtAuthGuard/
// PermissionGuard quedan disponibles via @UseGuards() para cuando eso ocurra.
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, JwtAuthGuard, PermissionGuard],
  exports: [JwtAuthGuard, PermissionGuard],
})
export class AuthModule {}
