import { createElement } from 'react';
import type { ComponentType, ReactNode } from 'react';

import styles from './tabs.module.css';

// docs/persistence/10-DECISIONES.md #137. Pestanas de navegacion (no de contenido): cada una es
// un link. ui-kit-web no conoce el router, asi que la app pasa su componente de link
// (next/link en web-admin) para navegar sin recarga; por defecto, un <a> comun.
export interface TabItem {
  key: string;
  label: string;
  href: string;
}

export interface TabLinkProps {
  href: string;
  className?: string;
  'aria-current'?: 'page';
  children: ReactNode;
}

export interface TabsProps {
  items: readonly TabItem[];
  activeKey: string;
  label: string;
  linkComponent?: ComponentType<TabLinkProps>;
}

function DefaultLink({ href, className, children, ...rest }: TabLinkProps) {
  return (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  );
}

export function Tabs({ items, activeKey, label, linkComponent = DefaultLink }: TabsProps) {
  return (
    <nav aria-label={label} className={styles.tabs}>
      {items.map((item) => {
        const active = item.key === activeKey;
        // createElement: el componente llega por prop y la convencion de nombres del proyecto
        // no admite variables en PascalCase (que JSX exigiria).
        return createElement(linkComponent, {
          key: item.key,
          href: item.href,
          className: [styles.tab, active ? styles.active : ''].filter(Boolean).join(' '),
          'aria-current': active ? 'page' : undefined,
          children: item.label,
        });
      })}
    </nav>
  );
}
