// Matchers de DOM (toBeInTheDocument, etc.) para todo proyecto frontend con
// testEnvironment jsdom (docs/engineering/04-TESTING-FOUNDATION.md §1) - referenciado via
// `setupFilesAfterEnv` desde el jest.config.ts de cada proyecto, nunca importado a mano
// por archivo de test.
import '@testing-library/jest-dom';
