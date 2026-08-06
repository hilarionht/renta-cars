// Wrapper de seed - docs/engineering/02-DEVELOPER-EXPERIENCE.md §1 paso 6 y §2 (`db:seed`).
// Estructura vacia a proposito (paso 6 de docs/engineering/10-BOOTSTRAP-PLAN.md): no existe
// todavia ningun modelo que sembrar. Cuando Fase 0 de docs/01-ROADMAP.md §2 agregue
// Company/Branch/User, este script sembrara los datos minimos documentados (una Company,
// una Branch, un usuario admin con rol completo).

async function seed(): Promise<void> {
  // Sin modelos que sembrar todavia.
}

seed()
  .then(() => {
    console.log('Seed: nada que sembrar todavia (paso 6 del bootstrap).');
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
