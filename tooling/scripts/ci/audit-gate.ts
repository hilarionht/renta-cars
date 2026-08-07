// docs/engineering/05-CI-CD.md §2: `npm audit` bloqueante solo ante severidad alta/critica
// CON parche disponible - `npm audit --audit-level=high` por si solo no distingue eso
// (bloquearia tambien ante una vulnerabilidad sin fix publicado, que ningun bloqueo protege).
//
// Alcance `--omit=dev`: el toolchain de Nx (y sus plugins opcionales - detox/cypress/vite/
// module-federation/vitest, nunca usados aqui pero listados como optionalDependencies del
// propio paquete `nx`) nunca se ejecuta en el proceso desplegado, solo en la maquina/runner
// que corre `nx`. Una vulnerabilidad ahi no es explotable por un usuario final de la API -
// auditar solo dependencias de produccion (lo que sí corre en el proceso desplegado) es el
// alcance que protege algo real, coherente con la misma razon que el parrafo de arriba.

import { execSync } from 'node:child_process';

interface Vulnerability {
  severity: 'info' | 'low' | 'moderate' | 'high' | 'critical';
  fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean };
}

interface AuditReport {
  vulnerabilities?: Record<string, Vulnerability>;
}

function runAudit(): AuditReport {
  try {
    const out = execSync('npm audit --omit=dev --json', {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 50,
    });
    return JSON.parse(out) as AuditReport;
  } catch (error) {
    // `npm audit` sale con codigo distinto de cero en cuanto encuentra CUALQUIER
    // vulnerabilidad - el reporte JSON igual llega por stdout, se necesita para decidir si
    // es realmente bloqueante.
    const stdout = (error as { stdout?: string }).stdout;
    if (!stdout) {
      throw error;
    }
    return JSON.parse(stdout) as AuditReport;
  }
}

// `fixAvailable` como objeto con `isSemVerMajor: true` significa que el unico "parche" es
// una migracion de major del paquete (aqui, en la practica, del propio toolchain de Nx en
// bloque) - no es un parche aplicable de forma segura en CI, es una migracion a evaluar
// aparte. Bloquear ahi tampoco protege nada (misma razon que ignorar una vulnerabilidad sin
// fix, docs/engineering/05-CI-CD.md §2), asi que solo cuenta como bloqueante un fix directo
// (`fixAvailable === true`) o un fix objeto que no sea de major.
function hasSafeFix(fixAvailable: Vulnerability['fixAvailable']): boolean {
  if (typeof fixAvailable === 'boolean') {
    return fixAvailable;
  }
  return !fixAvailable.isSemVerMajor;
}

const report = runAudit();
const blocking = Object.entries(report.vulnerabilities ?? {}).filter(
  ([, vulnerability]) =>
    (vulnerability.severity === 'high' || vulnerability.severity === 'critical') &&
    hasSafeFix(vulnerability.fixAvailable),
);

if (blocking.length > 0) {
  console.error(
    `${blocking.length} vulnerabilidad(es) alta/critica con parche disponible:\n` +
      blocking.map(([name, vulnerability]) => `  - ${name} (${vulnerability.severity})`).join('\n'),
  );
  process.exit(1);
}

console.log('Sin vulnerabilidades bloqueantes (alta/critica con parche disponible).');
