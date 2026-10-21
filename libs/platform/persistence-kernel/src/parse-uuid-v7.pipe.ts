import { Injectable, ParseUUIDPipe } from '@nestjs/common';

// docs/persistence/10-DECISIONES.md #147: los ids de la plataforma son UUID v7 (EntityId).
// ParseUUIDPipe sin version acepta cualquier UUID, y un v4 llegaba a EntityId.from y daba 500.
// Este pipe lo rechaza en el borde con 400 (VALIDATION_FAILED). EntityId.from sigue lanzando
// TypeError (#137): si falla con un id leido de la base, es un bug del servidor.
// Excepcion: los ids de roles (System v4 en bases anteriores a #140) siguen con ParseUUIDPipe.
@Injectable()
export class ParseUuidV7Pipe extends ParseUUIDPipe {
  constructor() {
    super({ version: '7' });
  }
}
