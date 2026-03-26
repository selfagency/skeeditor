// Ambient type for the webextension-polyfill browser API.
// Source files should `import browser from 'webextension-polyfill'` to obtain
// the browser namespace at runtime.  This global declaration exists solely for
// the test harness, which assigns a mock to globalThis.browser in setup.
declare var browser: typeof import('webextension-polyfill');

// Allow side-effect CSS imports (e.g. `import './styles.css'`) in content scripts.
// Vite handles these at build time; TypeScript only needs to know the module exists.
declare module '*.css' {}

// Allow inline CSS imports (e.g. `import styles from './global.css?inline'`) for
// injecting compiled Tailwind CSS into shadow roots.
declare module '*.css?inline' {
  const content: string;
  export default content;
}
