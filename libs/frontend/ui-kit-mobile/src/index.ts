// Exporta explicitamente, nunca `export *` (docs/technical/09-CODING-STANDARDS.md).
// docs/technical/02-PROYECTOS.md SS4: renderizado nativo (React Native) de las mismas
// primitivas de ui-kit-core. Todo componente aqui es presentacional puro (docs/06-
// CONVENCIONES-FRONTEND.md SS7) - minimo necesario para Fase 5 (operador de sucursal).
export { Screen, type ScreenProps } from './screen';
export { Button, type ButtonProps } from './button';
export { TextField, type TextFieldProps } from './text-field';
export { LoadingSpinner, type LoadingSpinnerProps } from './loading-spinner';
export { PhotoPicker, type PhotoPickerProps } from './photo-picker';
