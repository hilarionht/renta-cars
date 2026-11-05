/**
 * docs/persistence/10-DECISIONES.md #156: lockfile de runtime de una app, para `npm ci --omit=dev`
 * en su imagen Docker.
 *
 * El package-lock.json que genera Nx (`generatePackageJson: true`) re-hoistea entradas anidadas y
 * `npm ci` lo rechaza (p.ej. content-type@2.1.0 sube a @nestjs/platform-express/node_modules y tapa
 * el ^1.0.5 de express@5). Este script lo reemplaza por un subconjunto del package-lock.json raiz
 * con las MISMAS rutas, cerrado por resolucion: cada paquete resuelve igual que en el monorepo.
 *
 * Uso: node tools/scripts/prune-runtime-lockfile.mjs <dist de la app> [paquete cargado por nombre...]
 *
 * Los paquetes extra son los que la app carga por nombre en runtime, sin import (p.ej. un transport
 * de pino): Nx no los ve, asi que se agregan al package.json generado con la version del lock raiz.
 */

import { readFileSync, writeFileSync } from 'fs';
import { builtinModules } from 'module';
import { join } from 'path';

const [distDir, ...loadedByName] = process.argv.slice(2);
if (!distDir) fail('uso: prune-runtime-lockfile.mjs <dist de la app> [paquete...]');

const rootLock = readJson('package-lock.json');
const appPackage = readJson(join(distDir, 'package.json'));
const rootPackages = rootLock.packages;
const errors = [];

for (const name of loadedByName) {
  const entry = rootPackages[`node_modules/${name}`];
  if (!rootLock.packages[''].dependencies?.[name] || !entry) {
    fail(`${name}: tiene que ser una dependency (no dev) del package.json raiz`);
  }
  appPackage.dependencies = { ...appPackage.dependencies, [name]: entry.version };
}
appPackage.dependencies = Object.fromEntries(
  Object.entries(appPackage.dependencies ?? {}).sort(([a], [b]) => a.localeCompare(b)),
);

// Algoritmo de resolucion de Node sobre las rutas del lock: node_modules/<name> desde la ruta del
// paquete que lo pide, subiendo un nivel de node_modules por vez hasta la raiz.
function resolve(packages, fromPath, name) {
  let base = fromPath;
  for (;;) {
    const candidate = `${base ? `${base}/` : ''}node_modules/${name}`;
    if (packages[candidate]) return candidate;
    if (!base) return null;
    const cut = base.lastIndexOf('/node_modules/');
    base = cut < 0 ? '' : base.slice(0, cut);
  }
}

// Aristas de una entrada: [nombre, obligatoria]. Los peers opcionales no se siguen (p.ej. `prisma`
// de @prisma/client: el CLI es de build).
function edges(entry) {
  const peerMeta = entry.peerDependenciesMeta ?? {};
  return [
    ...Object.keys(entry.dependencies ?? {}).map((name) => [name, true]),
    ...Object.keys(entry.optionalDependencies ?? {}).map((name) => [name, false]),
    ...Object.keys(entry.peerDependencies ?? {})
      .filter((name) => !peerMeta[name]?.optional)
      .map((name) => [name, true]),
  ];
}

// Recorrido en anchura: `required` = la ruta es alcanzable sin pasar por una arista opcional. Lo
// que solo se alcanza por aristas opcionales (binarios de otra plataforma) queda `optional`.
const required = new Set();
const reached = new Set();
const queue = [];
function visit(path, isRequired) {
  if (isRequired ? required.has(path) : reached.has(path)) return;
  reached.add(path);
  if (isRequired) required.add(path);
  queue.push([path, isRequired]);
}

for (const [name, version] of Object.entries(appPackage.dependencies ?? {})) {
  const path = `node_modules/${name}`;
  const entry = rootPackages[path];
  if (!entry) {
    errors.push(`${name}: no esta en el package-lock.json raiz`);
    continue;
  }
  if (entry.version !== version) {
    errors.push(
      `${name}: el package.json generado pide ${version}, el lock raiz tiene ${entry.version}`,
    );
  }
  if (entry.dev) {
    console.warn(`aviso: ${name} es solo de dev en el lock raiz (lo agrego Nx por un import)`);
  }
  visit(path, true);
}

while (queue.length) {
  const [path, isRequired] = queue.shift();
  for (const [name, edgeRequired] of edges(rootPackages[path])) {
    const target = resolve(rootPackages, path, name);
    if (target) visit(target, isRequired && edgeRequired);
    else if (edgeRequired) errors.push(`${path} -> ${name}: no resuelve en el lock raiz`);
  }
}

const packages = {
  '': {
    name: appPackage.name,
    version: appPackage.version,
    dependencies: appPackage.dependencies,
  },
};
for (const path of [...reached].sort()) {
  const entry = { ...rootPackages[path] };
  delete entry.dev;
  delete entry.devOptional;
  delete entry.optional;
  if (entry.link || entry.inBundle || entry.bundleDependencies) {
    errors.push(`${path}: link/bundle no soportado`);
  }
  if (!entry.resolved || !entry.integrity) errors.push(`${path}: sin resolved o integrity`);
  packages[path] = required.has(path) ? entry : { ...entry, optional: true };
}

// Autoverificacion: toda arista obligatoria resuelve dentro del subconjunto (npm ci es el juez
// final de los rangos).
for (const [path, entry] of Object.entries(packages)) {
  if (!path) continue;
  for (const [name, edgeRequired] of edges(entry)) {
    if (edgeRequired && !resolve(packages, path, name)) {
      errors.push(`${path} -> ${name}: no resuelve en el subconjunto`);
    }
  }
}

// Cada require() externo del bundle tiene que resolver en el subconjunto: Nx omite los paquetes de
// devDependencies, y un `npm install` sin lock los tapaba de casualidad al hoistear una transitiva
// (#156: dotenv en instrumentation.ts). Una transitiva hoisteada en el lock raiz (tslib) resuelve
// siempre igual con el lock fijo; solo se avisa.
const warnings = new Set();
const bundle = readFileSync(join(distDir, 'main.js'), 'utf8');
for (const [, specifier] of bundle.matchAll(/require\("([^"]+)"\)/g)) {
  if (specifier.startsWith('.') || specifier.startsWith('node:')) continue;
  const name = specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');
  if (builtinModules.includes(name)) continue;
  if (!packages[`node_modules/${name}`]) {
    errors.push(`main.js requiere ${name}, que no resuelve en el subconjunto`);
  } else if (!appPackage.dependencies?.[name]) {
    warnings.add(`aviso: main.js requiere ${name}, que llega como transitiva hoisteada`);
  }
}
warnings.forEach((warning) => console.warn(warning));

if (errors.length) fail([...new Set(errors)].join('\n'));

writeFileSync(join(distDir, 'package.json'), `${JSON.stringify(appPackage, null, 2)}\n`);
writeFileSync(
  join(distDir, 'package-lock.json'),
  `${JSON.stringify(
    {
      name: appPackage.name,
      version: appPackage.version,
      lockfileVersion: 3,
      requires: true,
      packages,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `${join(distDir, 'package-lock.json')}: ${reached.size} paquetes (${reached.size - required.size} opcionales)`,
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
