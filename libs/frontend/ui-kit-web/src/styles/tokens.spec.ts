import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { colors, radius, spacing, typography } from '@frontend/ui-kit-core';

// docs/persistence/10-DECISIONES.md #134: tokens.css es una copia en variables CSS de
// ui-kit-core/tokens.ts (la CSP impide inyectarlas en un <style>). Este test falla si alguien
// cambia un token en un lado y no en el otro.
const css = readFileSync(join(__dirname, 'tokens.css'), 'utf-8');
const kebab = (value: string) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

function expectVariable(name: string, value: string) {
  expect(css).toContain(`--rk-${name}: ${value};`);
}

describe('tokens.css sincronizado con ui-kit-core/tokens.ts', () => {
  it.each(Object.entries(colors))('color %s', (key, value) => {
    expectVariable(`color-${kebab(key)}`, value);
  });

  it.each(Object.entries(spacing))('spacing %s', (key, value) => {
    expectVariable(`space-${key}`, `${value}px`);
  });

  it.each(Object.entries(radius))('radius %s', (key, value) => {
    expectVariable(`radius-${key}`, `${value}px`);
  });

  it.each(Object.entries(typography))('typography %s', (key, value) => {
    expectVariable(`font-size-${key}`, `${value.fontSize}px`);
    expectVariable(`line-height-${key}`, `${value.lineHeight}px`);
  });
});
