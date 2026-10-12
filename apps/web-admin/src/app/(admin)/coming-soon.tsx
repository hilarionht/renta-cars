import { Alert, PageHeader } from '@frontend/ui-kit-web';

// Placeholder de los modulos que llegan en los incrementos 2-5 (docs/persistence/
// 10-DECISIONES.md #134, hoja de ruta de la web de administracion).
export function ComingSoon({ title, increment }: { title: string; increment: number }) {
  return (
    <>
      <PageHeader title={title} />
      <Alert tone="info">Este módulo llega en el incremento {increment} de la web.</Alert>
    </>
  );
}
