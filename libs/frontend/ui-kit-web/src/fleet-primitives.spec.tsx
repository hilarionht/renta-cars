import { fireEvent, render, screen } from '@testing-library/react';

import type { TabLinkProps } from './tabs/tabs';
import { FileInput } from './file-input/file-input';
import { Tabs } from './tabs/tabs';

// docs/persistence/10-DECISIONES.md #137.
describe('Tabs', () => {
  const items = [
    { key: 'vehicles', label: 'Vehículos', href: '/fleet' },
    { key: 'categories', label: 'Categorías', href: '/fleet/categories' },
  ];

  it('marca la pestana activa con aria-current y usa links', () => {
    render(<Tabs items={items} activeKey="categories" label="Secciones de flota" />);

    expect(screen.getByRole('navigation', { name: 'Secciones de flota' })).toBeInTheDocument();
    const active = screen.getByRole('link', { name: 'Categorías' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveAttribute('href', '/fleet/categories');
    expect(screen.getByRole('link', { name: 'Vehículos' })).not.toHaveAttribute('aria-current');
  });

  it('acepta el componente de link de la app (p.ej. next/link)', () => {
    function CustomLink({ href, children, ...rest }: TabLinkProps) {
      return (
        <a href={href} data-custom="si" {...rest}>
          {children}
        </a>
      );
    }

    render(
      <Tabs items={items} activeKey="vehicles" label="Secciones" linkComponent={CustomLink} />,
    );

    expect(screen.getByRole('link', { name: 'Vehículos' })).toHaveAttribute('data-custom', 'si');
  });
});

describe('FileInput', () => {
  it('asocia el label, entrega el archivo elegido y expone el error accesible', () => {
    const onFileChange = jest.fn();
    render(
      <FileInput
        label="Documento"
        accept="application/pdf"
        error="Muy grande"
        onFileChange={onFileChange}
      />,
    );

    const input = screen.getByLabelText('Documento');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'application/pdf');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Muy grande');

    const file = new File(['%PDF'], 'poliza.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileChange).toHaveBeenCalledWith(file);
  });

  it('sin archivo elegido entrega null', () => {
    const onFileChange = jest.fn();
    render(<FileInput label="Documento" onFileChange={onFileChange} />);

    fireEvent.change(screen.getByLabelText('Documento'), { target: { files: [] } });

    expect(onFileChange).toHaveBeenCalledWith(null);
  });
});
