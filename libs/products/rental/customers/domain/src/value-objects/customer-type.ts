// docs/model/04-VALUE_OBJECTS.md SS5.1: "Individual | Corporate - enumeracion cerrada,
// determina reglas de AdditionalDriver (RN-11)". Alias de tipo, no una clase - mismo
// criterio que CompanyStatus/BranchStatus.
export type CustomerType = 'Individual' | 'Corporate';
