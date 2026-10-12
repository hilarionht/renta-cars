import { fireEvent, render, screen } from '@testing-library/react';

import { Alert } from './alert/alert';
import { Badge } from './badge/badge';
import { Button } from './button/button';
import { ConfirmDialog } from './dialog/dialog';
import { PageHeader } from './page-header/page-header';
import { Select } from './select/select';
import { Table } from './table/table';
import { TextField } from './text-field/text-field';

// docs/persistence/10-DECISIONES.md #134.
describe('Button', () => {
  it('es type=button por defecto y aplica la variante', () => {
    render(<Button variant="danger">Borrar</Button>);
    const button = screen.getByRole('button', { name: 'Borrar' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('danger');
  });

  it('loading lo deshabilita y muestra el spinner', () => {
    const onClick = jest.fn();
    render(
      <Button loading onClick={onClick}>
        Guardar
      </Button>,
    );
    const button = screen.getByRole('button', { name: /Guardar/ });
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TextField / Select', () => {
  it('asocia label e input, y expone el error accesible', () => {
    render(<TextField label="Email" error="Requerido" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Requerido');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });

  it('Select renderiza placeholder y opciones', () => {
    render(
      <Select
        label="Estado"
        placeholder="Todos"
        options={[
          { value: 'Confirmed', label: 'Confirmada' },
          { value: 'Cancelled', label: 'Cancelada' },
        ]}
      />,
    );
    const select = screen.getByLabelText('Estado');
    expect(select.querySelectorAll('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: 'Confirmada' })).toHaveValue('Confirmed');
  });
});

describe('Table', () => {
  const columns = [{ key: 'name', header: 'Nombre', render: (row: { id: string }) => row.id }];

  it('muestra el estado vacio', () => {
    render(<Table columns={columns} rows={[]} rowKey={(row) => row.id} emptyMessage="Sin datos" />);
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });

  it('muestra cargando', () => {
    render(<Table columns={columns} rows={undefined} rowKey={(row) => row.id} isLoading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('filas clickeables con mouse y teclado', () => {
    const onRowClick = jest.fn();
    render(
      <Table
        columns={columns}
        rows={[{ id: 'r1' }]}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );
    const cell = screen.getByText('r1');
    fireEvent.click(cell);
    fireEvent.keyDown(cell.closest('tr') as HTMLElement, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });
});

describe('ConfirmDialog', () => {
  it('no se renderiza cerrado', () => {
    render(
      <ConfirmDialog
        open={false}
        title="X"
        message="m"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abierto: confirma, cancela y cierra con Escape', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        open
        title="Cancelar reserva"
        message="Seguro?"
        confirmLabel="Si, cancelar"
        tone="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Cancelar reserva' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Si, cancelar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Badge / Alert / PageHeader', () => {
  it('renderizan su contenido con el tono indicado', () => {
    render(
      <>
        <Badge tone="success">Confirmada</Badge>
        <Alert tone="danger">Algo fallo</Alert>
        <PageHeader title="Reservas" description="Listado" actions={<Button>Nueva</Button>} />
      </>,
    );
    expect(screen.getByText('Confirmada').className).toContain('success');
    expect(screen.getByRole('alert')).toHaveTextContent('Algo fallo');
    expect(screen.getByRole('heading', { level: 1, name: 'Reservas' })).toBeInTheDocument();
  });
});
