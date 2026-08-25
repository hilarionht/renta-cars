// docs/07-DESIGN-SYSTEM.md SS2 (Capa 1, Tokens) - headless, sin renderizado. Minimo
// necesario para los 5 componentes de Fase 5 (operador de sucursal) - no un design system
// completo, ver docs/persistence/10-DECISIONES.md #108.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const colors = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  border: '#D9D9D9',
  text: '#1A1A1A',
  textMuted: '#6B6B6B',
  primary: '#1F6FEB',
  primaryText: '#FFFFFF',
  danger: '#D92D20',
  disabled: '#B0B0B0',
} as const;

export const typography = {
  body: { fontSize: 16, lineHeight: 22 },
  label: { fontSize: 14, lineHeight: 18 },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
} as const;

export const radius = {
  sm: 4,
  md: 8,
} as const;
