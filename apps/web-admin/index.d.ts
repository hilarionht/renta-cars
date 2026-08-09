/// <reference types="@nx/next/typings/style.d.ts" />
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/naming-convention -- `ReactComponent` es la convencion universal de @svgr/webpack para el export nombrado de un SVG importado como componente, no elegida por este proyecto. */
declare module '*.svg' {
  const content: any;
  export const ReactComponent: any;
  export default content;
}
