// Mismo workaround que apps/mobile/src/test-setup.ts - Expo SDK 55+ instala globals de
// winter-runtime lazy (fetch, URL, etc.) que Jest trata como "fuera del alcance del test
// code" en un monorepo. Se reemplazan por los globals reales del runtime antes de que los
// getters lazy disparen.
jest.mock('expo/src/winter/ImportMetaRegistry', () => ({
  ImportMetaRegistry: {
    get url() {
      return null;
    },
  },
}));

const defineGlobal = (name: string, value: unknown) => {
  try {
    Object.defineProperty(global, name, {
      value,
      configurable: true,
      writable: true,
    });
  } catch {
    // Ignora entornos que no permiten redefinir estos globals.
  }
};
defineGlobal('fetch', globalThis.fetch);
defineGlobal('Headers', globalThis.Headers);
defineGlobal('Request', globalThis.Request);
defineGlobal('Response', globalThis.Response);
defineGlobal('FormData', globalThis.FormData);
defineGlobal('URL', globalThis.URL);
defineGlobal('URLSearchParams', globalThis.URLSearchParams);

if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = <T>(object: T): T => JSON.parse(JSON.stringify(object)) as T;
}
