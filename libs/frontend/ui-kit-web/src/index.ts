// Exporta explicitamente, nunca `export *` (docs/technical/09-CODING-STANDARDS.md).
// docs/technical/02-PROYECTOS.md SS4: renderizado DOM de las primitivas de ui-kit-core. Todo
// componente aqui es presentacional puro (docs/06-CONVENCIONES-FRONTEND.md SS7): recibe props,
// no hace fetch, no conoce rutas. Estilos: CSS Modules sobre las variables de styles/tokens.css
// (docs/persistence/10-DECISIONES.md #134); la app importa styles/tokens.css y styles/base.css
// una sola vez en su layout raiz.
export { Alert, type AlertTone } from './alert/alert';
export { Badge, type BadgeTone } from './badge/badge';
export { Button, type ButtonProps, type ButtonVariant } from './button/button';
export { Checkbox, type CheckboxProps } from './checkbox/checkbox';
export { ConfirmDialog, Dialog, type ConfirmDialogProps, type DialogProps } from './dialog/dialog';
export { FileInput, type FileInputProps } from './file-input/file-input';
export { PageHeader } from './page-header/page-header';
export { Select, type SelectOption, type SelectProps } from './select/select';
export { Spinner } from './spinner/spinner';
export { Table, type TableColumn, type TableProps } from './table/table';
export { TextField, type TextFieldProps } from './text-field/text-field';
export { Tabs, type TabItem, type TabLinkProps, type TabsProps } from './tabs/tabs';
