// Gap-filled para reportDamage() - docs/model/08-STATE_MACHINES.md SS2.1 dice "segun
// severidad" sin fijar un catalogo. Minor->Maintenance, Severe->OutOfService.
export type DamageSeverityValue = 'Minor' | 'Severe';
