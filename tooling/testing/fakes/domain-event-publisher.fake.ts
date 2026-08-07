// docs/engineering/04-TESTING-FOUNDATION.md SS4: colecciona eventos publicados para
// aserciones, en vez de emitirlos de verdad - docs/10-TESTING.md SS9 ("se prueba... que un
// Command Handler exitoso publica el evento correcto con el payload esperado").
export class FakeDomainEventPublisher {
  readonly publishedEvents: unknown[] = [];

  publish(event: unknown): void {
    this.publishedEvents.push(event);
  }

  reset(): void {
    this.publishedEvents.length = 0;
  }
}
