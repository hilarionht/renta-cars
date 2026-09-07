// docs/model/04-VALUE_OBJECTS.md SS5.1: "nombre comercial de categoria... no vacio, unico
// por Company" - mismo shape que CustomerName/BranchName.
const MIN_LENGTH = 2;
const MAX_LENGTH = 120;

export class CategoryName {
  private constructor(private readonly value: string) {}

  static from(raw: string): CategoryName {
    const trimmed = raw.trim();
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      throw new TypeError(
        `CategoryName debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres: "${raw}"`,
      );
    }
    return new CategoryName(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
