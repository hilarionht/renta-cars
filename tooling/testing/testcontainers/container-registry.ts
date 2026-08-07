// Jest ejecuta globalSetup y globalTeardown en el mismo proceso Node que el propio CLI de
// Jest (a diferencia de los workers de test, que son procesos aparte) - un registro en
// memoria alcanza para pasar la referencia del contenedor de uno a otro sin persistir nada
// a disco.
interface Stoppable {
  stop: () => Promise<unknown>;
}

const registry = new Map<string, Stoppable>();

export function registerContainer(key: string, container: Stoppable): void {
  registry.set(key, container);
}

export async function stopRegisteredContainer(key: string): Promise<void> {
  const container = registry.get(key);
  if (container) {
    await container.stop();
    registry.delete(key);
  }
}
