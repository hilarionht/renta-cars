import { v7 as uuidv7, validate as validateUuid, version as uuidVersion } from 'uuid';

// Identificador tipado de agregado - docs/04-MODELO-DATOS.md SS5: UUID v7 (ordenable por
// tiempo) como PK en toda tabla de negocio. El parametro fantasma <T> evita mezclar por
// error un UserId con un RoleId aunque ambos sean, en runtime, el mismo string - error de
// tipos en compilacion, no en produccion.
export class EntityId<T extends string> {
  private readonly value: string;
  private readonly _brand!: T;

  private constructor(value: string) {
    this.value = value;
  }

  static generate<T extends string>(): EntityId<T> {
    return new EntityId<T>(uuidv7());
  }

  static from<T extends string>(value: string): EntityId<T> {
    if (!validateUuid(value) || uuidVersion(value) !== 7) {
      throw new TypeError(`EntityId invalido (se espera UUID v7): "${value}"`);
    }
    return new EntityId<T>(value);
  }

  equals(other: EntityId<T>): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
