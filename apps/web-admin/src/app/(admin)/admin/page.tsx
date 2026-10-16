import { redirect } from 'next/navigation';

// docs/persistence/10-DECISIONES.md #140: la seccion arranca en Usuarios.
export default function AdministrationPage() {
  redirect('/admin/users');
}
