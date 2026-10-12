// docs/model/04-VALUE_OBJECTS.md SS5.1: "None | Blocked (con motivo) - motivo obligatorio
// si Blocked". Dimension ortogonal a CustomerStatus (ver customer-status.ts) - un Customer
// puede estar bloqueado sin importar si ya validado su documentacion. El motivo viaja como
// parametro de Customer.block(reason), no como parte de este tipo (mismo criterio que
// Company.suspend(reason)).
export type CustomerBlockStatusValue = 'None' | 'Blocked';
