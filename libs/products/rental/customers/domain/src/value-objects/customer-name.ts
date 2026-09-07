// Gap del mismo tipo que BranchName - ningun documento nombra un campo de nombre/razon
// social para Customer, a pesar de que todo otro aggregate lo tiene (User.PersonName,
// Branch.BranchName, Company.LegalName). Se agrega aca, documentado en el mismo commit
// (docs/model/02-AGGREGATES.md SS10).
const MIN_LENGTH = 2;
const MAX_LENGTH = 120;

export class CustomerName {
  private constructor(private readonly value: string) {}

  static from(raw: string): CustomerName {
    const trimmed = raw.trim();
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      throw new TypeError(
        `CustomerName debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres: "${raw}"`,
      );
    }
    return new CustomerName(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
