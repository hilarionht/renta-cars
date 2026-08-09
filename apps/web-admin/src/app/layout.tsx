import './global.css';

export const metadata = {
  title: 'Renta - Administración',
  description: 'Panel de administración de Renta.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
