// Puntero opaco al objeto en el proveedor de storage (docs/model/04-VALUE_OBJECTS.md SS7) -
// nunca una URL publica permanente. Inmutable tras la creacion del File (sin setter en la
// entidad).
export class StorageRef {
  private constructor(private readonly value: string) {}

  static from(raw: string): StorageRef {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new TypeError('StorageRef no puede estar vacio.');
    }
    return new StorageRef(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
