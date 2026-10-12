// Movido a @frontend/data-access-core (agnostico de plataforma, compartido con la web -
// docs/persistence/10-DECISIONES.md #134). Reexport para no cambiar ningun import de mobile.
export { ApiError, AuthenticationExpiredError } from '@frontend/data-access-core';
