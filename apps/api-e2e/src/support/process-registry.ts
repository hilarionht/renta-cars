import type { ChildProcess } from 'node:child_process';

// Mismo principio que tooling/testing/testcontainers/container-registry.ts: globalSetup y
// globalTeardown corren en el mismo proceso de Jest, un modulo-singleton alcanza.
let apiProcess: ChildProcess | undefined;

export function registerApiProcess(child: ChildProcess): void {
  apiProcess = child;
}

export function stopApiProcess(): void {
  apiProcess?.kill();
  apiProcess = undefined;
}
