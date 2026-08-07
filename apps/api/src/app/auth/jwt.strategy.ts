import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { JwtPayload } from './jwt-payload.interface';

// docs/technical/07-SECURITY.md SS1: passport-jwt, RS256, valida firma/expiracion/
// estructura minima del payload. La rotacion de clave por `kid` (ventana de gracia con la
// clave anterior) llega con el modulo Identity real - hoy solo existe una clave activa.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.publicKey'),
      algorithms: ['RS256'],
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
