import type { KeyboardEvent, ReactNode } from 'react';

import { Spinner } from '../spinner/spinner';
import styles from './table.module.css';

export interface TableColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
}

export interface TableProps<Row> {
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[] | undefined;
  rowKey: (row: Row) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: Row) => void;
  caption?: string;
}

export function Table<Row>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  emptyMessage = 'No hay resultados.',
  onRowClick,
  caption,
}: TableProps<Row>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: Row) => {
    if (onRowClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td className={styles.message} colSpan={columns.length}>
                <Spinner />
              </td>
            </tr>
          ) : !rows || rows.length === 0 ? (
            <tr>
              <td className={styles.message} colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? styles.clickable : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => handleKeyDown(event, row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
